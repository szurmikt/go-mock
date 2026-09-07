/* global React, I, Pill, RESERVATIONS, PROPERTIES */

const { useState, useRef, useEffect } = React;

function Segment({ tabs, value, onChange }) {
  const refs = useRef({});
  const [thumb, setThumb] = useState({ left: 3, width: 0 });
  useEffect(() => {
    const el = refs.current[value];
    if (el) setThumb({ left: el.offsetLeft, width: el.offsetWidth });
  }, [value, tabs]);
  return (
    <div className="segment">
      <div className="seg-thumb" style={{ left: thumb.left, width: thumb.width }} />
      {tabs.map(t => (
        <button key={t} ref={el => (refs.current[t] = el)}
          className={"seg" + (t === value ? " active" : "")}
          onClick={() => onChange(t)}>{t}</button>
      ))}
    </div>
  );
}

function ReservationCard({ r, onClick, dimmed }) {
  return (
    <div className={"card res-card tap-anim" + (onClick ? " tappable" : "")}
      style={dimmed ? { opacity: 0.5 } : {}}
      onClick={onClick}>
      <div className="top">
        <span className="res-code">{r.id}</span>
        <Pill status={r.status} />
      </div>
      <div className="res-name">{r.name}</div>
      <div className="res-email">{r.email}</div>
      <div className="res-meta">
        <span><span className="v">{r.date}</span> · {r.guests} guests / {r.nights} nights</span>
        <span className="v">{r.room}</span>
      </div>
    </div>
  );
}

function HomeScreen({ go, property, setProperty }) {
  const [switchOpen, setSwitchOpen] = useState(false);
  const [tab, setTab] = useState("Today");
  const propName = property?.name || "Sunshine Hotel & Apartments";
  const totalGuests = RESERVATIONS.reduce((sum, r) => sum + r.guests, 0);
  const totalReservations = RESERVATIONS.length;

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

      <div className="app-scroll" style={{ paddingTop: 12, paddingBottom: "calc(94px + env(safe-area-inset-bottom, 0px))" }}>
        <Segment tabs={["Yesterday", "Today", "Tomorrow"]} value={tab} onChange={setTab} />

        <div className="stat-block">
          <div className="stat-card">
            <div className="label"><I.Users style={{ width: 16, height: 16 }} /> Guests</div>
            <div className="value">{totalGuests}</div>
          </div>
          <div className="stat-card">
            <div className="label"><I.Briefcase style={{ width: 16, height: 16 }} /> Reservations</div>
            <div className="value">{totalReservations}</div>
          </div>
        </div>

        <div className="section-title">
          <h2>{tab}'s Arrivals</h2>
          <button className="icon-btn"><I.Filter /></button>
        </div>

        <div className="stagger">
          {RESERVATIONS.map(r => (
            <ReservationCard key={r.id} r={r} onClick={() => go("reservation", r.id)} dimmed={tab !== "Today" && r.status === "open"} />
          ))}
        </div>
      </div>
    </div>
  );
}

window.Segment = Segment;
window.ReservationCard = ReservationCard;
window.HomeScreen = HomeScreen;
