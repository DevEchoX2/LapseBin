import { useEffect, useState } from 'react'
import { listInstances } from '../api'

export default function InstancePoolPane() {
  const [instances, setInstances] = useState([])

  useEffect(() => {
    let mounted = true

    const poll = async () => {
      try {
        const data = await listInstances()
        if (mounted) {
          setInstances(data.instances || [])
        }
      } catch {
        if (mounted) {
          setInstances([])
        }
      }
    }

    poll()
    const interval = setInterval(poll, 3000)

    return () => {
      mounted = false
      clearInterval(interval)
    }
  }, [])

  return (
    <section className="panel">
      <header className="panel-head">
        <h2>Instance Manager</h2>
      </header>
      <p className="panel-label">Pool state: idle / busy / provisioning</p>
      <ul className="instance-list">
        {instances.map((instance) => (
          <li key={instance.id}>
            <span>{instance.id}</span>
            <span className={`state ${instance.status}`}>{instance.status}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
