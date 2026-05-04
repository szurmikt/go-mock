/* global React, I, StatusBar, Pill, RESERVATIONS, PROPERTIES */

const { useState } = React;

function HomeScreen({ go, property, setProperty }) {
  const [switchOpen, setSwitchOpen] = useState(false);
  const propName = property?.name || "Sunshine Hotel & Apartments";

  return (
    <div className="page">
      <div className="page-header" style={{ paddingTop: 16 }}>
        <button className="title-row" onClick={() => setSwitchOpen(true)}
          style={{ background: "none", border: 0, padding: 0, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 0, textAlign: "left" }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", color: "var(--ink)", lineHeight: 1.2, flex: 1, minWidth: 0 }}>{propName}</h1>
          <I.ChevronDown style={{ color: "var(--primary)", width: 22, height: 22, flexShrink: 0 }} />
        </button>
        <div className="actions">
          <button className="icon-btn" aria-label="Notifications"><I.Bell /></button>
          <button className="icon-btn" aria-label="Settings"><I.Settings /></button>
        </div>
      </div>

      {switchOpen && (
        <div className="sheet-backdrop" onClick={() => setSwitchOpen(false)}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <div className="head">
              <h3>Switch Property</h3>
              <button className="icon-btn" onClick={() => setSwitchOpen(false)}><I.X /></button>
            </div>
            <div style={{ marginTop: 8 }}>
              {PROPERTIES.map(p => (
                <button key={p.id} className="action-item" onClick={() => { setProperty(p); setSwitchOpen(false); }}>
                  <span className="action-icon"><I.Home /></span>
                  <span style={{ flex: 1, textAlign: "left" }}>
                    <div>{p.name}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-4)", marginTop: 2 }}>{p.type}</div>
                  </span>
                  {property?.id === p.id && <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--primary)", flexShrink: 0 }} />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <button className="search-field" style={{ textAlign: "left", cursor: "pointer", width: "calc(100% - 32px)" }} onClick={() => go("search")}>
        <I.Search />
        <span style={{ flex: 1, color: "var(--ink-4)", fontSize: 16, fontWeight: 600 }}>Search</span>
      </button>

      <div className="app-scroll" style={{ paddingBottom: "calc(24px + env(safe-area-inset-bottom, 0px))" }}>
        <div className="tile-grid stagger">
          <div className="card tile tinted" onClick={() => go("idscan")}>
            <div className="tile-icon"><I.Scan /></div>
            <h3>ID Scan</h3>
            <div className="tile-sub"><strong>14</strong> arrival guests</div>
          </div>
          <div className="card tile tinted" onClick={() => go("blockdate")}>
            <div className="tile-icon"><I.Calendar /></div>
            <h3>Block Date</h3>
          </div>
          <div className="card tile" onClick={() => go("arrivals")}>
            <div className="tile-icon"><I.ArrowIn /></div>
            <h3>Arrivals</h3>
            <div className="tile-sub"><strong>23 / 56</strong><br />Arrived guests</div>
          </div>
          <div className="card tile" onClick={() => go("arrivals")}>
            <div className="tile-icon" style={{ color: "var(--ink-3)" }}><I.ArrowOut /></div>
            <h3>Departures</h3>
            <div className="tile-sub"><strong>9 / 23</strong><br />Left guests</div>
          </div>
        </div>

        {/* Occupancy */}
        <div className="card wide-card stagger" style={{ animationDelay: "0.3s" }}>
          <div className="row">
            <h3><span style={{ color: "var(--primary)" }}><I.Users /></span> Occupancy Rate</h3>
          </div>
          <div className="row" style={{ alignItems: "center", marginTop: 4 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "var(--ink-3)" }}>Today's status</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--success)", marginTop: 4 }}>+2.3% from yesterday</div>
            </div>
            <Donut percent={68} />
          </div>
        </div>

        {/* ADR + RevPar */}
        <div className="tile-grid" style={{ paddingTop: 0, marginTop: 16 }}>
          <div className="card tile" style={{ minHeight: 152 }}>
            <div className="tile-icon"><I.Bars /></div>
            <h3 style={{ color: "var(--ink-3)" }}>ADR</h3>
            <div style={{ fontSize: 26, fontWeight: 800, color: "var(--ink)", letterSpacing: "-0.01em" }}>85.63 €</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--success)" }}>+2.3% from yesterday</div>
          </div>
          <div className="card tile" style={{ minHeight: 152 }}>
            <div className="tile-icon"><I.Bars /></div>
            <h3 style={{ color: "var(--ink-3)" }}>RevPar</h3>
            <div style={{ fontSize: 26, fontWeight: 800, color: "var(--ink)", letterSpacing: "-0.01em" }}>82.47 €</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--warn)" }}>−4.3% from yesterday</div>
          </div>
        </div>

        {/* Feedback */}
        <div className="card wide-card" style={{ marginBottom: 16 }}>
          <div className="row">
            <h3><span style={{ color: "var(--primary)" }}><I.Comment /></span> Onboarded Guest Feedback</h3>
          </div>
          <div className="row" style={{ alignItems: "flex-end", marginTop: 4 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink-3)" }}>Average</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: "var(--ink)", marginTop: 2 }}>9.58</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink-3)" }}>Needs attention</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "var(--warn)", marginTop: 2 }}>2 feedback</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Donut({ percent }) {
  const r = 32, c = 2 * Math.PI * r;
  const off = c - (c * percent) / 100;
  return (
    <div style={{ position: "relative", width: 88, height: 88 }}>
      <svg className="donut" width="88" height="88" viewBox="0 0 88 88">
        <circle className="track" cx="44" cy="44" r={r} />
        <circle className="progress" cx="44" cy="44" r={r}
          strokeDasharray={`${c - off} ${off}`} strokeDashoffset="0" />
      </svg>
      <div style={{
        position: "absolute", inset: 0, display: "flex",
        alignItems: "center", justifyContent: "center",
        fontSize: 18, fontWeight: 800, color: "var(--ink)"
      }}>{percent}%</div>
    </div>
  );
}

window.HomeScreen = HomeScreen;
