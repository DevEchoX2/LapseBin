const GAME_LIBRARY = [
  { id: 'fortnite', label: 'Fortnite' },
  { id: 'steam-dashboard', label: 'Steam Dashboard' },
  { id: 'desktop', label: 'Remote Desktop Mode', desktopMode: true },
]

export default function GameLibraryDashboard({ selectedId, onSelect }) {
  return (
    <section className="panel">
      <header className="panel-head">
        <h2>Game Library</h2>
      </header>
      <p className="panel-label">Multi-tenant worker allocation target</p>
      <div className="tile-grid">
        {GAME_LIBRARY.map((game) => {
          const active = selectedId === game.id
          return (
            <button
              className={`tile ${active ? 'active' : ''}`}
              type="button"
              key={game.id}
              onClick={() => onSelect(game)}
            >
              {game.label}
            </button>
          )
        })}
      </div>
    </section>
  )
}
