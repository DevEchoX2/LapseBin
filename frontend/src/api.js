const API_BASE = '/api'

export async function listInstances() {
  const response = await fetch(`${API_BASE}/instances`, { cache: 'no-store' })
  if (!response.ok) {
    throw new Error('Failed to fetch instance pool')
  }

  return response.json()
}

export async function startSession({ authToken, gameId, desktopMode }) {
  const response = await fetch(`${API_BASE}/session/start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({ gameId, desktopMode }),
  })

  const payload = await response.json()
  return {
    ok: response.ok,
    status: response.status,
    payload,
  }
}

export async function getSessionStatus(sessionId) {
  const response = await fetch(`${API_BASE}/session/status`, {
    headers: { 'x-session-id': sessionId },
    cache: 'no-store',
  })

  const payload = await response.json()
  return {
    ok: response.ok,
    status: response.status,
    payload,
  }
}

export async function redeemConnectToken({ sessionId, connectToken }) {
  const response = await fetch(`${API_BASE}/session/connect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, connectToken }),
  })

  const payload = await response.json()
  if (!response.ok) {
    throw new Error(payload.message || 'Failed to redeem connect token')
  }

  return payload
}

export async function disconnectSession(sessionId) {
  const response = await fetch(`${API_BASE}/session/disconnect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, reason: 'CLIENT_DISCONNECT' }),
  })

  return response.ok
}

export async function submitWaitlist(email) {
  const response = await fetch(`${API_BASE}/waitlist/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })

  const data = await response.json()
  if (!response.ok) {
    throw new Error(data.message || 'Failed to submit waitlist signup')
  }

  return data
}

export async function pingServer() {
  const start = performance.now()
  const response = await fetch(`${API_BASE}/ping`, { cache: 'no-store' })
  if (!response.ok) {
    throw new Error('Ping failed')
  }

  await response.json()
  const end = performance.now()

  return Math.round(end - start)
}
