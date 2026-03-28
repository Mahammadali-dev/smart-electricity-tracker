const tabs = [
  { id: "home", label: "Dashboard", shortLabel: "Home", badge: "DB", detail: "Energy summary and floor map" },
  { id: "devices", label: "Devices", shortLabel: "Devices", badge: "DV", detail: "Room controls and live states" },
  { id: "analytics", label: "Analytics", shortLabel: "Graphs", badge: "AN", detail: "Demand trends and cost insight" },
  { id: "settings", label: "Settings", shortLabel: "Settings", badge: "ST", detail: "Limits, alerts, and profile" },
];

export default function Navigation({ activeTab, onChange, onLogout, userName }) {
  return (
    <>
      <aside className="sidebar-nav panel">
        <div className="brand-block">
          <span className="section-tag">AI energy control</span>
          <span className="brand-status-dot">Live grid</span>
          <h1>GridSense</h1>
          <p>Real-time electricity monitoring with cinematic multi-floor automation and animated live energy flow.</p>
        </div>

        <div className="nav-list">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`nav-button ${activeTab === tab.id ? "active" : ""}`}
              onClick={() => onChange(tab.id)}
            >
              <span className="nav-button-badge" aria-hidden="true">{tab.badge}</span>
              <span className="nav-button-copy">
                <strong>{tab.label}</strong>
                <small>{tab.detail}</small>
              </span>
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
            <span className="mobile-nav-badge" aria-hidden="true">{tab.badge}</span>
            <span className="mobile-nav-copy">{tab.shortLabel}</span>
          </button>
        ))}
      </nav>
    </>
  );
}
