import { useState } from 'react'
import GameLibraryDashboard from './components/GameLibraryDashboard'
import StreamingControlPlane from './components/StreamingControlPlane'
import InstancePoolPane from './components/InstancePoolPane'
import PremiumHub from './components/PremiumHub'
import DiagnosticsPane from './components/DiagnosticsPane'

function App() {
  const [selection, setSelection] = useState({
    id: 'fortnite',
    label: 'Fortnite',
    desktopMode: false,
  })

  return (
    <main className="app-shell">
      <header className="topbar">
        <h1>LapseBin Multi-Tenant Cloud Arcade</h1>
        <p>Control plane orchestration → WebRTC stream node attachment → isolated worker lifecycle</p>
      </header>

      <section className="grid">
        <GameLibraryDashboard selectedId={selection.id} onSelect={setSelection} />
        <InstancePoolPane />
        <DiagnosticsPane />
      </section>

      <StreamingControlPlane selection={selection} />

      <section className="grid">
        <PremiumHub />
      </section>
    </main>
  )
}

export default App
