/* global React, I, PROPERTIES */

function PropertySelectScreen({ onSelect }) {
  return (
    <div className="login-page">
      <div style={{ flex: 1, padding: "60px var(--pad) 0" }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--primary)", marginBottom: 8 }}>SabeeApp Go</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: "var(--ink)", letterSpacing: "-0.02em", lineHeight: 1.15 }}>Select Property</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: "var(--ink-4)", marginTop: 6 }}>Choose a property to manage</div>
        </div>

        {PROPERTIES.map(p => (
          <div key={p.id} className="card tap-anim tappable"
            style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 14 }}
            onClick={() => onSelect(p)}>
            <div style={{ width: 44, height: 44, borderRadius: "var(--radius-sm)", background: "var(--primary-soft-bg)", border: "1.5px solid var(--primary-soft)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--primary)", flexShrink: 0 }}>
              <I.Home style={{ width: 20, height: 20 }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 17, fontWeight: 800, color: "var(--ink)", letterSpacing: "-0.01em", lineHeight: 1.2 }}>{p.name}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-4)", marginTop: 2 }}>{p.type}</div>
            </div>
            <I.ChevronRight style={{ color: "var(--ink-4)", width: 18, height: 18, flexShrink: 0 }} />
          </div>
        ))}
      </div>
    </div>
  );
}

window.PropertySelectScreen = PropertySelectScreen;
