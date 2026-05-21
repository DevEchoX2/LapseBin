import SessionModule from './components/SessionModule'
import PremiumHub from './components/PremiumHub'
import DiagnosticsPane from './components/DiagnosticsPane'

function App() {
  return (
    <main className="app-shell">
      <header className="topbar">
        <h1>LapseBin Cloud Runtime</h1>
        <p>Monochrome low-latency cloud gaming control plane</p>
      </header>

      <section className="grid">
        <SessionModule />
        <DiagnosticsPane />
        <PremiumHub />
      </section>
    </main>
  )
}

export default App
