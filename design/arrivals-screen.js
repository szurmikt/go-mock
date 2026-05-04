/* global React, I, Pill, RESERVATIONS, Segment, ReservationCard */

const { useState, useRef, useEffect } = React;

function ArrivalsScreen({ go, back }) {
  const [tab, setTab] = useState("Today");
  const [collapsed, setCollapsed] = useState(false);
  const sentinelRef = useRef(null);
  const list = RESERVATIONS;

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => setCollapsed(!entry.isIntersecting),
      { threshold: 0 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div className="page">
      <div className="sub-header">
        <button className="back" onClick={back}><I.ChevronBack /></button>
        <span className="title">{collapsed ? `${tab}'s Arrivals` : "Arrivals"}</span>
      </div>

      <div className="app-scroll" style={{ paddingBottom: "calc(24px + env(safe-area-inset-bottom, 0px))" }}>
        <Segment tabs={["Yesterday", "Today", "Tomorrow"]} value={tab} onChange={setTab} />

        <div className="stat-block">
          <div className="stat-card">
            <div className="label"><I.Users style={{ width: 16, height: 16 }} /> Guests</div>
            <div className="value">23 / 56</div>
          </div>
          <div className="stat-card">
            <div className="label"><I.Briefcase style={{ width: 16, height: 16 }} /> Reservations</div>
            <div className="value">6 / 17</div>
          </div>
        </div>

        <div className="section-title" ref={sentinelRef}>
          <h2>{tab}'s Arrivals</h2>
          <button className="icon-btn"><I.Filter /></button>
        </div>

        <div className="stagger">
          {list.map(r => (
            <ReservationCard key={r.id} r={r} onClick={() => go("reservation", r.id)} dimmed={tab !== "Today" && r.status === "open"} />
          ))}
        </div>
      </div>
    </div>
  );
}

function ReservationDetailScreen({ id, go, back, addToast }) {
  const r = RESERVATIONS.find(x => x.id === id) || RESERVATIONS[0];
  const [status, setStatus] = useState(r.status);
  const guests = (window.GUESTS[r.id] || []);

  const cycle = () => {
    const order = ["confirmed", "onboard", "check-in", "check-out"];
    const i = order.indexOf(status);
    const next = order[(i + 1) % order.length];
    setStatus(next);
    addToast(`Status → ${next === "check-in" ? "Check-in" : next === "check-out" ? "Check-out" : next === "onboard" ? "Onboard" : "Confirmed"}`);
  };

  return (
    <div className="page">
      <div className="sub-header">
        <button className="back" onClick={back}><I.ChevronBack /></button>
        <span className="title">Reservation Details</span>
      </div>

      <div className="app-scroll" style={{ paddingBottom: "calc(24px + env(safe-area-inset-bottom, 0px))" }}>
        <div className="detail-block">
          <div className="header">
            <span style={{ color: "var(--primary)", fontSize: 22, fontWeight: 800, letterSpacing: "0.02em" }}>{r.id}</span>
            <button onClick={cycle} style={{ background: "transparent", border: 0, padding: 0, cursor: "pointer" }} title="Tap to advance status">
              <Pill status={status} />
            </button>
          </div>
          <div className="name">{r.name}</div>
          <div className="fact-grid">
            <div className="fact"><div className="l"><I.Calendar style={{ width: 14, height: 14 }} /> Check-in</div><div className="v">{r.checkIn}</div></div>
            <div className="fact"><div className="l"><I.Calendar style={{ width: 14, height: 14 }} /> Check-out</div><div className="v">{r.checkOut}</div></div>
            <div className="fact"><div className="l"><I.Users style={{ width: 14, height: 14 }} /> Guests</div><div className="v">{r.composition}</div></div>
            <div className="fact"><div className="l"><I.Briefcase style={{ width: 14, height: 14 }} /> Partner</div><div className="v">{r.partner}</div></div>
            <div className="fact" style={{ gridColumn: "1 / -1" }}><div className="l"><I.Door style={{ width: 14, height: 14 }} /> Room / Type</div><div className="v">{r.roomNo} ({r.room})</div></div>
          </div>
        </div>

        <div className="section-title">
          <h2>Guests</h2>
        </div>

        <div className="stagger">
          {guests.map(g => (
            <div key={g.id} className="guest-card tap-anim tappable" onClick={() => go("guest", { resId: r.id, guestId: g.id })}>
              <button className="scan-btn" onClick={(e) => { e.stopPropagation(); go("idscan"); }}>
                <I.IDCard />
              </button>
              <div className="id">ID: {g.id}{g.booker && <span className="booker">(Booker)</span>}</div>
              <div className="name">{g.name}</div>
              <div className="fact-grid" style={{ gap: "8px 16px" }}>
                <div><div style={{ fontSize: 13, color: "var(--ink-4)", fontWeight: 600 }}>Age</div><div style={{ fontSize: 17, fontWeight: 700 }}>{g.age}</div></div>
                <div><div style={{ fontSize: 13, color: "var(--ink-4)", fontWeight: 600 }}>Gender</div><div style={{ fontSize: 17, fontWeight: 700 }}>{g.gender}</div></div>
                <div><div style={{ fontSize: 13, color: "var(--ink-4)", fontWeight: 600 }}>Nationality</div><div style={{ fontSize: 17, fontWeight: 700 }}>{g.nationality}</div></div>
                <div><div style={{ fontSize: 13, color: "var(--ink-4)", fontWeight: 600 }}>Reporting</div><div style={{ fontSize: 17, fontWeight: 700 }}>{g.reporting}</div></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

window.ArrivalsScreen = ArrivalsScreen;
window.ReservationDetailScreen = ReservationDetailScreen;
