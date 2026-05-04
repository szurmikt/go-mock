/* global React, I, StatusBar, Pill, RESERVATIONS, GUESTS */

const { useState, useEffect, useMemo } = React;

function GuestDetailScreen({ resId, guestId, back, go }) {
  const list = GUESTS[resId] || [];
  const g = list.find(x => x.id === guestId) || list[0];
  const [menuOpen, setMenuOpen] = React.useState(false);
  if (!g) return null;
  return (
    <div className="page">
      <div className="sub-header">
        <button className="back" onClick={back}><I.ChevronBack /></button>
        <span className="title">Guest details</span>
      </div>

      <div className="app-scroll" style={{ paddingBottom: "calc(80px + env(safe-area-inset-bottom, 0px))" }}>
        <div style={{ padding: "0 16px" }} className="stagger">
          <div className="card" style={{ marginBottom: 16 }}>
            <Row label={`ID: ${g.id}`} value={g.name} divider />
            <Row label="Maiden full name" value={g.maiden || "—"} divider />
            <Row label="Mother's full name" value={g.mother || "—"} divider />
            <div style={{ display: "flex", gap: 24, padding: "12px 0", borderBottom: "1px solid var(--line)" }}>
              <div style={{ flex: 1 }}><Tiny label="Birth date" value={g.birth} /></div>
              <div style={{ flex: 1 }}><Tiny label="Birth Place" value={g.birthPlace} /></div>
            </div>
            <div style={{ padding: "12px 0 0" }}><Tiny label="Citizenship" value={g.citizenship} /></div>
          </div>

          <SectionTitle>Contact details</SectionTitle>
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
              <Tiny label="Phone" value={g.phone} />
              <button className="icon-btn" style={{ color: "var(--primary)" }}><I.Phone /></button>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0" }}>
              <Tiny label="Email" value={g.email} />
              <button className="icon-btn" style={{ color: "var(--primary)" }}><I.Mail /></button>
            </div>
          </div>

          <SectionTitle>Travelling document</SectionTitle>
          <div className="card">
            <div style={{ display: "flex", gap: 24, padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
              <div style={{ flex: 1 }}><Tiny label="Document Type" value={g.docType} /></div>
              <div style={{ flex: 1 }}><Tiny label="Scanned" value={g.scanned ? "Yes" : "No"} /></div>
            </div>
            <div style={{ padding: "12px 0 0" }}><Tiny label="Number" value={g.docNo} /></div>
          </div>
        </div>
      </div>

      <button className="fab" onClick={() => setMenuOpen(true)}><I.GridFill /></button>

      {menuOpen && (
        <div className="sheet-backdrop" onClick={() => setMenuOpen(false)}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <div className="head">
              <h3>{g.name}</h3>
              <button className="icon-btn" onClick={() => setMenuOpen(false)}><I.X /></button>
            </div>
            <div style={{ marginTop: 8 }}>
              <button className="action-item" onClick={() => { setMenuOpen(false); go("editguest", { resId, guestId }); }}>
                <span className="action-icon"><I.Edit /></span>
                Edit guest
              </button>
              <button className="action-item" onClick={() => { setMenuOpen(false); go("idscan"); }}>
                <span className="action-icon"><I.Scan /></span>
                ID Scan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EditGuestScreen({ resId, guestId, back, addToast }) {
  const list = GUESTS[resId] || [];
  const g = list.find(x => x.id === guestId) || list[0];
  const [form, setForm] = React.useState({
    name:        g?.name        || "",
    maiden:      g?.maiden      || "",
    mother:      g?.mother      || "",
    birth:       g?.birth       || "",
    birthPlace:  g?.birthPlace  || "",
    citizenship: g?.citizenship || "",
    phone:       g?.phone       || "",
    email:       g?.email       || "",
    docType:     g?.docType     || "Passport",
    docNo:       g?.docNo       || "",
  });
  if (!g) return null;

  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }));

  return (
    <div className="page">
      <div className="sub-header">
        <button className="back" onClick={back}><I.ChevronBack /></button>
        <span className="title">Edit Guest</span>
      </div>

      <div className="app-scroll" style={{ padding: "8px 16px 16px" }}>

        <SectionTitle>Personal</SectionTitle>

        <div className="form-group">
          <input placeholder=" " value={form.name} onChange={set("name")} />
          <label>First &amp; Last name</label>
          <span className="form-icon"><I.IDCard style={{ width: 20, height: 20 }} /></span>
        </div>

        <div className="form-group">
          <input placeholder=" " value={form.maiden} onChange={set("maiden")} />
          <label>Maiden full name</label>
          <span className="form-icon"><I.IDCard style={{ width: 20, height: 20 }} /></span>
        </div>

        <div className="form-group">
          <input placeholder=" " value={form.mother} onChange={set("mother")} />
          <label>Mother's full name</label>
          <span className="form-icon"><I.IDCard style={{ width: 20, height: 20 }} /></span>
        </div>

        <div className="form-group">
          <input placeholder=" " value={form.birth} onChange={set("birth")} />
          <label>Birth Date</label>
          <span className="form-icon">
            <I.IDCard style={{ width: 20, height: 20 }} />
            <I.Calendar style={{ width: 20, height: 20 }} />
          </span>
        </div>

        <div className="form-group">
          <input placeholder=" " value={form.birthPlace} onChange={set("birthPlace")} />
          <label>Birth place</label>
        </div>

        <div className="form-group">
          <input placeholder=" " value={form.citizenship} onChange={set("citizenship")} />
          <label>Citizenship</label>
        </div>

        <SectionTitle>Contact Details</SectionTitle>

        <div className="form-group">
          <input placeholder=" " type="tel" value={form.phone} onChange={set("phone")} />
          <label>Phone</label>
        </div>

        <div className="form-group">
          <input placeholder=" " type="email" value={form.email} onChange={set("email")} />
          <label>Email</label>
        </div>

        <SectionTitle>Travelling document</SectionTitle>

        <div className="form-group">
          <select value={form.docType} onChange={set("docType")}>
            <option>Passport</option>
            <option>ID Card</option>
            <option>Driving Licence</option>
            <option>Residence Permit</option>
          </select>
          <label>Document Type</label>
          <span className="form-icon"><I.ChevronRight style={{ width: 18, height: 18 }} /></span>
        </div>

        <div className="form-group">
          <input placeholder=" " value={form.docNo} onChange={set("docNo")} />
          <label>Document Number</label>
        </div>

      </div>

      <div style={{ padding: "12px 16px calc(28px + env(safe-area-inset-bottom, 0px))", background: "var(--bg)", borderTop: "1px solid var(--line)", flexShrink: 0, display: "flex" }}>
        <button className="btn" onClick={() => { addToast("Guest details saved"); back(); }}>Save</button>
      </div>
    </div>
  );
}

function Row({ label, value, divider }) {
  return (
    <div style={{ padding: "12px 0", borderBottom: divider ? "1px solid var(--line)" : "none" }}>
      <div style={{ fontSize: 13, color: "var(--ink-4)", fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 19, color: "var(--ink)", fontWeight: 700, marginTop: 2 }}>{value}</div>
    </div>
  );
}
function Tiny({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 13, color: "var(--ink-4)", fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 18, color: "var(--ink)", fontWeight: 700, marginTop: 2 }}>{value}</div>
    </div>
  );
}
function SectionTitle({ children }) {
  return <h3 className="group-title">{children}</h3>;
}

function SearchScreen({ back, go }) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    return RESERVATIONS.filter(r =>
      r.name.toLowerCase().includes(s) ||
      r.email.toLowerCase().includes(s) ||
      r.id.toLowerCase().includes(s) ||
      r.room.toLowerCase().includes(s) ||
      r.roomNo.includes(s)
    );
  }, [q]);
  return (
    <div className="page">
      <div className="sub-header">
        <button className="back" onClick={back}><I.ChevronBack /></button>
        <span className="title">Search</span>
      </div>
      <div className="search-field" style={{ marginTop: 0 }}>
        <I.Search />
        <input autoFocus placeholder="Search guests, rooms, codes…" value={q} onChange={e => setQ(e.target.value)} />
        {q && <button className="icon-btn" style={{ width: 28, height: 28 }} onClick={() => setQ("")}><I.X style={{ width: 16, height: 16 }} /></button>}
      </div>

      <div className="app-scroll" style={{ paddingTop: 16 }}>
        {!q && (
          <div style={{ padding: "0 16px", color: "var(--ink-4)" }}>
            <div style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Suggestions</div>
            {["Emma Williams", "68CXK25", "Junior Suit", "Booking.com"].map(s => (
              <button key={s} onClick={() => setQ(s)}
                style={{ display: "block", width: "100%", textAlign: "left", padding: "12px 14px", background: "#fff", border: "1px solid var(--line)", borderRadius: 10, marginBottom: 8, fontSize: 16, fontWeight: 700, color: "var(--ink-2)", cursor: "pointer" }}>
                {s}
              </button>
            ))}
          </div>
        )}
        {q && filtered.length === 0 && <div className="empty">No matches for "{q}"</div>}
        {q && filtered.length > 0 && (
          <div className="stagger">
            {filtered.map(r => (
              <div key={r.id} className="card res-card tap-anim tappable" onClick={() => go("reservation", r.id)}>
                <div className="top">
                  <span className="res-code">{r.id}</span>
                  <Pill status={r.status} />
                </div>
                <div className="res-name">{r.name}</div>
                <div className="res-email">{r.email}</div>
                <div className="res-meta">
                  <span><span className="v">{r.date}</span> · {r.guests} guests</span>
                  <span className="v">{r.room}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function IDScanScreen({ back, addToast }) {
  const [phase, setPhase] = useState("camera"); // camera | scanning | result
  const onShoot = () => {
    setPhase("scanning");
    setTimeout(() => setPhase("result"), 1600);
  };
  return (
    <div className="page scan-screen">
      <div className="sub-header" style={{ color: "#fff" }}>
        <button className="back" onClick={back} style={{ color: "#fff" }}><I.ChevronBack /></button>
        <span className="title" style={{ color: "#fff" }}>ID Scan</span>
      </div>

      <div className="scan-viewfinder">
        <div className="scan-frame"><div className="scan-corners" /></div>
        {phase === "camera" && <div className="scan-laser" />}
        {phase === "scanning" && (
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, color: "#fff" }}>
            <div style={{ width: 48, height: 48, border: "4px solid rgba(255,255,255,0.2)", borderTopColor: "var(--primary)", borderRadius: "50%", animation: "spin 0.9s linear infinite" }} />
            <div style={{ fontWeight: 700 }}>Reading document…</div>
          </div>
        )}
        <div style={{ position: "absolute", left: 16, right: 16, bottom: 24, color: "rgba(255,255,255,0.85)", textAlign: "center", fontSize: 14, fontWeight: 600 }}>
          Align the document within the frame
        </div>
      </div>

      <div className="scan-toolbar">
        <button className="shutter-btn" onClick={onShoot} disabled={phase !== "camera"} />
      </div>

      {phase === "result" && (
        <div className="sheet-backdrop" onClick={() => setPhase("camera")}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <div className="head">
              <h3>ID Scan result</h3>
              <button className="icon-btn" onClick={() => setPhase("camera")}><I.X /></button>
            </div>
            <div style={{ marginTop: 16 }}>
              <div className="field" style={{ marginBottom: 14 }}>
                <div className="l">First & Last name</div>
                <div className="v">Emma Smith</div>
              </div>
              <div className="grid-2">
                <div className="field"><div className="l">Document type</div><div className="v">ID</div></div>
                <div className="field"><div className="l">Document number</div><div className="v">519716IE</div></div>
                <div className="field"><div className="l">Age</div><div className="v">48</div></div>
                <div className="field"><div className="l">Gender</div><div className="v">Male</div></div>
                <div className="field"><div className="l">Place of birth</div><div className="v">Kecskemet</div></div>
                <div className="field"><div className="l">Date of birth</div><div className="v">1977.11.28</div></div>
                <div className="field"><div className="l">Citizenship</div><div className="v">Hungary</div></div>
              </div>
              <div className="field" style={{ marginTop: 14 }}>
                <div className="l">Mother's name</div>
                <div className="v">Jenna Gabriel Goldsmith</div>
              </div>
            </div>
            <div className="actions">
              <button className="btn secondary" onClick={() => { addToast("Edit mode"); setPhase("camera"); }}>Edit</button>
              <button className="btn" onClick={() => { addToast("Saved guest details"); back(); }}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

window.GuestDetailScreen = GuestDetailScreen;
window.EditGuestScreen = EditGuestScreen;
window.SearchScreen = SearchScreen;
window.IDScanScreen = IDScanScreen;
