const tabs = [
  { id: "home", label: "Home" },
  { id: "devices", label: "Devices" },
  { id: "analytics", label: "Analytics" },
  { id: "settings", label: "Settings" },
];

export default function Navigation({ activeTab, onChange, onLogout, userName }) {
  return (
    <>
      <aside className="sidebar-nav panel">
        <div className="brand-block">
          <span className="section-tag">AI energy control</span>
          <h1>GridSense</h1>
          <p>Real-time electricity monitoring with intelligent multi-floor automation.</p>
        </div>

        <div className="nav-list">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`nav-button ${activeTab === tab.id ? "active" : ""}`}
              onClick={() => onChange(tab.id)}
            >
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="sidebar-foot">
          <div className="user-chip">
            <strong>{userName}</strong>
            <span>Authenticated session</span>
          </div>
          <button type="button" className="ghost-button" onClick={onLogout}>
            Logout
          </button>
        </div>
      </aside>

      <nav className="mobile-nav">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`mobile-nav-button ${activeTab === tab.id ? "active" : ""}`}
            onClick={() => onChange(tab.id)}
          >
            <span>{tab.label}</span>
          </button>
        ))}
      </nav>
    </>
  );
}
