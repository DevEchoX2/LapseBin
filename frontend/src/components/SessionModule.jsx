import { useEffect, useState } from 'react'
import { getSessionStatus, startSession } from '../api'

const MAX_SESSION_MS = 50 * 60 * 1000

function formatRemaining(ms) {
  const safeMs = Math.max(0, ms)
  const totalSeconds = Math.ceil(safeMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export default function SessionModule() {
  const [sessionId, setSessionId] = useState(() => localStorage.getItem('sessionId'))
  const [remainingMs, setRemainingMs] = useState(MAX_SESSION_MS)
  const [status, setStatus] = useState('connecting')

  const bootSession = async () => {
    setStatus('connecting')
    const started = await startSession()
    localStorage.setItem('sessionId', started.sessionId)
    setSessionId(started.sessionId)
    setRemainingMs(started.remainingMs)
    setStatus('active')
  }

  useEffect(() => {
    if (!sessionId) {
      let cancelled = false
      startSession()
        .then((started) => {
          if (cancelled) {
            return
          }

          localStorage.setItem('sessionId', started.sessionId)
          setSessionId(started.sessionId)
          setRemainingMs(started.remainingMs)
          setStatus('active')
        })
        .catch(() => {
          if (!cancelled) {
            setStatus('disconnected')
          }
        })

      return () => {
        cancelled = true
      }
    }

    let cancelled = false
    const poll = async () => {
      const current = await getSessionStatus(sessionId)
      if (cancelled) {
        return
      }

      if (!current || current.disconnect) {
        localStorage.removeItem('sessionId')
        setStatus('disconnected')
        setRemainingMs(0)
        return
      }

      setStatus('active')
      setRemainingMs(current.remainingMs)
    }

    poll().catch(() => setStatus('disconnected'))
    const interval = setInterval(() => {
      poll().catch(() => setStatus('disconnected'))
    }, 1000)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [sessionId])

  return (
    <section className="panel">
      <header className="panel-head">
        <h2>Active Session</h2>
        <span className={`status-dot ${status === 'active' ? 'online' : ''}`}></span>
      </header>
      <p className="panel-label">Server-authoritative countdown (max 50 minutes)</p>
      <div className="timer">{formatRemaining(remainingMs)}</div>
      <p className="panel-label">
        {status === 'active' ? 'Connection stable' : 'Session disconnected'}
      </p>
      {status !== 'active' && (
        <button className="action-btn" type="button" onClick={() => bootSession().catch(() => setStatus('disconnected'))}>
          Reconnect
        </button>
      )}
    </section>
  )
}
