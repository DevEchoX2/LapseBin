const cors = require('cors')
const express = require('express')
const helmet = require('helmet')

const config = require('./config')
const { createInstancePoolService } = require('./services/instancePoolService')
const { createSessionService } = require('./services/sessionService')
const { createWaitlistService } = require('./services/waitlistService')

const app = express()

const instancePoolService = createInstancePoolService({
  instancePoolFile: config.INSTANCE_POOL_FILE,
})

const sessionService = createSessionService({
  sessionDurationMs: config.SESSION_DURATION_MS,
  connectTokenTtlMs: config.CONNECT_TOKEN_TTL_MS,
  sessionLogFile: config.SESSION_LOG_FILE,
  instancePoolService,
})

const waitlistService = createWaitlistService({
  waitlistFile: config.WAITLIST_FILE,
})

app.use(helmet())
app.use(cors())
app.use(express.json({ limit: '16kb' }))

app.get('/api/ping', (_req, res) => {
  res.json({ ok: true, serverTime: new Date().toISOString() })
})

app.get('/api/instances', async (_req, res) => {
  const instances = await instancePoolService.list()
  res.json({ instances })
})

app.post('/api/session/start', async (req, res) => {
  const authToken = String(req.get('authorization') || req.body?.authToken || '').replace(/^Bearer\s+/i, '')
  const gameId = req.body?.gameId ? String(req.body.gameId).trim() : ''
  const desktopMode = Boolean(req.body?.desktopMode)

  const result = await sessionService.startSession({ authToken, gameId, desktopMode })
  res.status(result.status).json(result.payload)
})

app.get('/api/session/status', (req, res) => {
  const result = sessionService.getStatus(req)
  res.status(result.status).json(result.payload)
})

app.post('/api/session/connect', async (req, res) => {
  const sessionId = String(req.body?.sessionId || '').trim()
  const connectToken = String(req.body?.connectToken || '').trim()
  const result = await sessionService.redeemConnectToken({ sessionId, connectToken })
  res.status(result.status).json(result.payload)
})

app.post('/api/session/disconnect', async (req, res) => {
  const sessionId = String(req.body?.sessionId || req.get('x-session-id') || '').trim()
  const reason = String(req.body?.reason || 'USER_DISCONNECT').trim()
  const result = await sessionService.forceDisconnect(sessionId, reason)
  res.status(result.status).json(result.payload)
})

app.post('/api/waitlist/signup', async (req, res) => {
  const result = await waitlistService.signup(req.body?.email)
  if (!result.ok) {
    return res.status(400).json({ message: result.error })
  }

  return res.status(201).json({ message: 'Waitlist signup successful.' })
})

Promise.all([instancePoolService.bootstrap(), sessionService.bootstrap(), waitlistService.bootstrap()])
  .then(() => {
    app.listen(config.PORT, () => {
      console.log(`Backend listening on port ${config.PORT}`)
    })
  })
  .catch((error) => {
    console.error('Startup failure:', error)
    process.exit(1)
  })
