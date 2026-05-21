const cors = require('cors')
const express = require('express')
const fs = require('fs/promises')
const helmet = require('helmet')
const path = require('path')
const { randomUUID } = require('crypto')

const app = express()
const PORT = Number(process.env.PORT || 5000)
const SESSION_DURATION_MS = 50 * 60 * 1000
const waitlistFilePath = process.env.WAITLIST_FILE || path.resolve(__dirname, '../data/waitlist.json')
const sessions = new Map()

app.use(helmet())
app.use(cors())
app.use(express.json({ limit: '10kb' }))

async function ensureWaitlistFile() {
  await fs.mkdir(path.dirname(waitlistFilePath), { recursive: true })

  try {
    await fs.access(waitlistFilePath)
  } catch {
    await fs.writeFile(waitlistFilePath, '[]\n', 'utf8')
  }
}

function sanitizeEmail(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^\x20-\x7e]/g, '')
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function getSessionId(req) {
  const raw = req.get('x-session-id') || req.query.sessionId || ''
  return String(raw).trim()
}

app.post('/api/session/start', (_req, res) => {
  const sessionId = randomUUID()
  const expiresAt = Date.now() + SESSION_DURATION_MS
  sessions.set(sessionId, expiresAt)

  res.status(201).json({
    sessionId,
    expiresAt: new Date(expiresAt).toISOString(),
    remainingMs: SESSION_DURATION_MS,
  })
})

app.get('/api/session/status', (req, res) => {
  const sessionId = getSessionId(req)
  if (!sessionId || !sessions.has(sessionId)) {
    return res.status(404).json({
      active: false,
      disconnect: true,
      reason: 'SESSION_NOT_FOUND',
      remainingMs: 0,
    })
  }

  const expiresAt = sessions.get(sessionId)
  const remainingMs = expiresAt - Date.now()

  if (remainingMs <= 0) {
    sessions.delete(sessionId)
    return res.status(401).json({
      active: false,
      disconnect: true,
      reason: 'SESSION_EXPIRED',
      remainingMs: 0,
    })
  }

  return res.json({
    active: true,
    disconnect: false,
    sessionId,
    expiresAt: new Date(expiresAt).toISOString(),
    remainingMs,
  })
})

app.post('/api/waitlist/signup', async (req, res) => {
  const email = sanitizeEmail(req.body?.email)
  if (!isValidEmail(email)) {
    return res.status(400).json({ message: 'Invalid email format.' })
  }

  await ensureWaitlistFile()

  const raw = await fs.readFile(waitlistFilePath, 'utf8')
  const entries = JSON.parse(raw)
  entries.push({
    email,
    createdAt: new Date().toISOString(),
  })

  await fs.writeFile(waitlistFilePath, `${JSON.stringify(entries, null, 2)}\n`, 'utf8')

  return res.status(201).json({ message: 'Waitlist signup successful.' })
})

app.get('/api/ping', (_req, res) => {
  res.json({ ok: true, serverTime: new Date().toISOString() })
})

ensureWaitlistFile()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Backend listening on port ${PORT}`)
    })
  })
  .catch((error) => {
    console.error('Startup failure:', error)
    process.exit(1)
  })
