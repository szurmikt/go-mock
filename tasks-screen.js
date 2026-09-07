/* global React, I, Segment, BRIEFING_ITEMS */

const { useState } = React;

function TasksScreen({ go, tasks, toggleTask }) {
  const [scope, setScope] = useState("Your");
  const filtered = tasks.filter(t => t.assignee === (scope === "Your" ? "you" : "team"));

  return (
    <div className="page">
      <div className="page-header" style={{ paddingTop: 16 }}>
        <h1 style={{ fontSize: 22 }}>Tasks</h1>
      </div>

      <div className="app-scroll" style={{ paddingTop: 4, paddingBottom: "calc(94px + env(safe-area-inset-bottom, 0px))" }}>
        <div className="card tap-anim tappable" onClick={() => go("briefing")}
          style={{ margin: "0 var(--pad) 20px", display: "flex", alignItems: "center", gap: 14 }}>
          <span className="action-icon"><I.Bell /></span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: "var(--ink)" }}>Good morning, Tamas</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink-3)", marginTop: 2 }}>{BRIEFING_ITEMS.length} things need attention</div>
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 2, color: "var(--primary)", fontWeight: 800, fontSize: 13, flexShrink: 0 }}>
            Open briefing <I.ChevronRight style={{ width: 14, height: 14 }} />
          </span>
        </div>

        <div className="section-title"><h2>Tasks</h2></div>

        <Segment tabs={["Your", "Team"]} value={scope} onChange={setScope} />

        <div className="stagger" style={{ marginTop: 16 }}>
          {filtered.length === 0 && <div className="empty">No {scope.toLowerCase()} tasks</div>}
          {filtered.map(t => (
            <div key={t.id} className="task-item tap-anim" onClick={() => toggleTask(t.id)}>
              <span className={"task-check" + (t.done ? " done" : "")}>{t.done && <I.Check style={{ width: 12, height: 12 }} />}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <div className={"task-title" + (t.done ? " done" : "")}>{t.title}</div>
                {t.who && <div className="task-who">{t.who}</div>}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function BriefingScreen({ back, tasks, addTask, addToast }) {
  return (
    <div className="page">
      <div className="sub-header">
        <button className="back" onClick={back}><I.ChevronBack /></button>
        <span className="title">Today's Briefing</span>
      </div>
      <div className="app-scroll" style={{ paddingBottom: "calc(24px + env(safe-area-inset-bottom, 0px))" }}>
        <div className="stagger" style={{ padding: "8px var(--pad) 0" }}>
          {BRIEFING_ITEMS.map(item => {
            const Icon = I[item.icon];
            const added = tasks.some(t => t.fromBriefingId === item.id);
            return (
              <div key={item.id} className="card" style={{ marginBottom: 12, display: "flex", gap: 14, alignItems: "flex-start" }}>
                <span className="action-icon"><Icon /></span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: "var(--ink)", lineHeight: 1.3 }}>{item.title}</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink-3)", marginTop: 4, lineHeight: 1.4 }}>{item.detail}</div>
                  <button className={added ? "btn secondary" : "btn"} disabled={added}
                    style={{ marginTop: 12, height: 38, fontSize: 14, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                    onClick={() => { addTask({ id: `t-${Date.now()}`, title: item.title, assignee: "you", done: false, fromBriefingId: item.id }); addToast("Added to your tasks"); }}>
                    {added ? (<><I.Check style={{ width: 14, height: 14 }} /> Added</>) : "Add as task"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

window.TasksScreen = TasksScreen;
window.BriefingScreen = BriefingScreen;
