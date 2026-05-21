const { randomUUID } = require('crypto')
const { readJson, writeJson, ensureJsonFile } = require('../storage/jsonStore')

function createSessionService({ sessionDurationMs, connectTokenTtlMs, sessionLogFile, instancePoolService }) {
  const sessionMap = new Map()
  const teardownTimers = new Map()

  async function bootstrap() {
    await ensureJsonFile(sessionLogFile, [])
  }

  async function appendLog(entry) {
    const rows = await readJson(sessionLogFile, [])
    rows.push({ createdAt: new Date().toISOString(), ...entry })
    await writeJson(sessionLogFile, rows)
  }

  async function launchTargetOnInstance(instance, gameId, desktopMode) {
    await appendLog({
      type: 'provision.launch',
      instanceId: instance.id,
      gameId: gameId || null,
      desktopMode: Boolean(desktopMode),
      note: 'Stub launch call for VM/cluster API integration',
    })
    return {
      target: desktopMode ? 'desktop' : gameId,
      status: 'launched',
    }
  }

  async function teardownSession(sessionId, reason) {
    const current = sessionMap.get(sessionId)
    if (!current) {
      return
    }

    teardownTimers.delete(sessionId)
    sessionMap.delete(sessionId)

    await instancePoolService.markProvisioning(current.instanceId)
    await appendLog({
      type: 'session.teardown',
      sessionId,
      instanceId: current.instanceId,
      reason,
      action: 'reset-instance-image',
    })

    await instancePoolService.releaseInstance(current.instanceId)
  }

  function scheduleWatchdog(sessionId, expiresAt) {
    const msUntilTeardown = Math.max(0, expiresAt - Date.now())
    const timer = setTimeout(() => {
      teardownSession(sessionId, 'SESSION_EXPIRED').catch(() => {})
    }, msUntilTeardown)

    teardownTimers.set(sessionId, timer)
  }

  async function startSession({ authToken, gameId, desktopMode }) {
    if (!authToken || typeof authToken !== 'string') {
      return { ok: false, status: 401, payload: { message: 'Missing authentication token.' } }
    }

    if (!desktopMode && !gameId) {
      return {
        ok: false,
        status: 400,
        payload: { message: 'Provide gameId or desktopMode for provisioning.' },
      }
    }

    const sessionId = randomUUID()
    const instance = await instancePoolService.claimIdleInstance(sessionId)
    if (!instance) {
      const pool = await instancePoolService.list()
      const busyCount = pool.filter((item) => item.status !== 'idle').length
      return {
        ok: false,
        status: 202,
        payload: {
          queued: true,
          message: 'No idle instances available. You have been queued.',
          queueDepth: busyCount,
        },
      }
    }

    await launchTargetOnInstance(instance, gameId, desktopMode)

    const now = Date.now()
    const expiresAt = now + sessionDurationMs
    const connectToken = randomUUID()

    sessionMap.set(sessionId, {
      sessionId,
      authToken,
      instanceId: instance.id,
      gameId: gameId || null,
      desktopMode: Boolean(desktopMode),
      createdAt: now,
      expiresAt,
      signalingEndpoint: instance.signalingEndpoint,
      connectToken,
      connectTokenExpiresAt: now + connectTokenTtlMs,
      connectTokenUsed: false,
    })

    scheduleWatchdog(sessionId, expiresAt)
    await appendLog({ type: 'session.start', sessionId, instanceId: instance.id, gameId: gameId || null, desktopMode: Boolean(desktopMode) })

    return {
      ok: true,
      status: 201,
      payload: {
        queued: false,
        sessionId,
        instanceId: instance.id,
        streamNode: instance.host,
        expiresAt: new Date(expiresAt).toISOString(),
        remainingMs: sessionDurationMs,
        connectToken,
        connectTokenExpiresAt: new Date(now + connectTokenTtlMs).toISOString(),
      },
    }
  }

  function getSessionIdFromRequest(req) {
    return String(req.get('x-session-id') || req.query.sessionId || '').trim()
  }

  function statusById(sessionId) {
    const current = sessionMap.get(sessionId)
    if (!current) {
      return {
        found: false,
        status: 404,
        payload: {
          active: false,
          disconnect: true,
          reason: 'SESSION_NOT_FOUND',
          remainingMs: 0,
        },
      }
    }

    const remainingMs = current.expiresAt - Date.now()
    if (remainingMs <= 0) {
      teardownSession(sessionId, 'SESSION_EXPIRED').catch(() => {})
      return {
        found: false,
        status: 401,
        payload: {
          active: false,
          disconnect: true,
          reason: 'SESSION_EXPIRED',
          remainingMs: 0,
        },
      }
    }

    return {
      found: true,
      status: 200,
      payload: {
        active: true,
        disconnect: false,
        sessionId,
        instanceId: current.instanceId,
        streamNode: current.signalingEndpoint,
        expiresAt: new Date(current.expiresAt).toISOString(),
        remainingMs,
      },
    }
  }

  function getStatus(req) {
    const sessionId = getSessionIdFromRequest(req)
    return statusById(sessionId)
  }

  async function redeemConnectToken({ sessionId, connectToken }) {
    const current = sessionMap.get(sessionId)
    if (!current) {
      return { ok: false, status: 404, payload: { message: 'Session not found.' } }
    }

    if (current.connectTokenUsed) {
      return { ok: false, status: 401, payload: { message: 'Connect token already used.' } }
    }

    if (Date.now() > current.connectTokenExpiresAt) {
      return { ok: false, status: 401, payload: { message: 'Connect token expired.' } }
    }

    if (connectToken !== current.connectToken) {
      return { ok: false, status: 401, payload: { message: 'Invalid connect token.' } }
    }

    current.connectTokenUsed = true
    sessionMap.set(sessionId, current)
    await appendLog({ type: 'session.connect-token-used', sessionId, instanceId: current.instanceId })

    return {
      ok: true,
      status: 200,
      payload: {
        signalingEndpoint: current.signalingEndpoint,
        dataChannelLabel: 'input-forwarding',
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      },
    }
  }

  async function forceDisconnect(sessionId, reason = 'USER_DISCONNECT') {
    if (!sessionMap.has(sessionId)) {
      return { ok: false, status: 404, payload: { message: 'Session not found.' } }
    }

    const timer = teardownTimers.get(sessionId)
    if (timer) {
      clearTimeout(timer)
      teardownTimers.delete(sessionId)
    }

    await teardownSession(sessionId, reason)
    return { ok: true, status: 200, payload: { disconnected: true, reason } }
  }

  return {
    bootstrap,
    startSession,
    getStatus,
    redeemConnectToken,
    forceDisconnect,
  }
}

module.exports = {
  createSessionService,
}
