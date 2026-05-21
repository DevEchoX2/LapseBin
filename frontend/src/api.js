const API_BASE = '/api'

export async function startSession() {
  const response = await fetch(`${API_BASE}/session/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  })

  if (!response.ok) {
    throw new Error('Failed to start session')
  }

  return response.json()
}

export async function getSessionStatus(sessionId) {
  const response = await fetch(`${API_BASE}/session/status`, {
    headers: { 'x-session-id': sessionId },
    cache: 'no-store',
  })

  if (!response.ok) {
    return null
  }

  return response.json()
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
