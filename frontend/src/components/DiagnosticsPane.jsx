import { useEffect, useState } from 'react'
import { pingServer } from '../api'

export default function DiagnosticsPane() {
  const [ping, setPing] = useState(null)
  const [status, setStatus] = useState('checking')

  useEffect(() => {
    let active = true

    const monitor = async () => {
      try {
        const nextPing = await pingServer()
        if (!active) {
          return
        }

        setPing(nextPing)
        setStatus('online')
      } catch {
        if (!active) {
          return
        }

        setStatus('offline')
      }
    }

    monitor()
    const interval = setInterval(monitor, 5000)

    return () => {
      active = false
      clearInterval(interval)
    }
  }, [])

  return (
    <section className="panel">
      <header className="panel-head">
        <h2>Connection Diagnostics</h2>
        <span className={`status-dot ${status === 'online' ? 'online' : ''}`}></span>
      </header>
      <p className="panel-label">Browser → API HTTP round-trip telemetry</p>
      <div className="metric">{ping === null ? '—' : `${ping} ms`}</div>
      <p className="panel-label">{status}</p>
    </section>
  )
}
