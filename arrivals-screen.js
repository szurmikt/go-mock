/* global React, I, Pill, RESERVATIONS, Segment, ReservationCard, CheckinSignScreen */

const { useState, useRef, useEffect } = React;

// Mock "history" timestamps for the Reservation Status sheet. Not wired to
// any specific reservation's real dates — this is an illustrative timeline
// shared by every reservation, so every offset is <= 0 (today or earlier)
// to avoid ever showing a future date for a step already marked done.
// Built from local date parts (day/month), not toISOString() — same reason
// as relDate()/calIso() elsewhere in this project: toISOString() converts
// to UTC first and can silently shift the displayed day back by one.
function historyStamp(offsetDays, hh, mm) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const month = d.toLocaleDateString("en-US", { month: "short" });
  return `${d.getDate()} ${month} ${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

const STATUS_STEPS = [
  { key: "confirmed", label: "Reserved",  Icon: I.Calendar, ts: historyStamp(-6, 9, 12) },
  { key: "check-in",  label: "Check-in",  Icon: I.Refresh,  ts: historyStamp(-2, 15, 5) },
  { key: "onboard",   label: "Onboard",   Icon: I.ArrowIn,  ts: historyStamp(-2, 15, 7) },
  { key: "check-out", label: "Check-out", Icon: I.ArrowOut, ts: historyStamp(0, 11, 30) },
];

// Signing and VIZA reporting are onboarding actions, not "whatever the
// current status happens to be" actions — they're always attached directly
// below the Onboard row itself (see the sheet's render below), whether that
// row is still the upcoming/outlined step or already done. Report to VIZA
// only makes sense once onboarding has actually happened, so it only joins
// Sign once Onboard is reached.

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
  const [menuOpen, setMenuOpen] = useState(false);
  const [statusSheetOpen, setStatusSheetOpen] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [checkoutConfirmOpen, setCheckoutConfirmOpen] = useState(false);
  const [vizaStatus, setVizaStatus] = useState("idle"); // idle | loading | done
  const [checkinOpen, setCheckinOpen] = useState(false);
  const [signed, setSigned] = useState(false);
  const [commentsSheetOpen, setCommentsSheetOpen] = useState(false);
  const [comments, setComments] = useState(window.COMMENTS[r.id] || []);
  const [commentDraft, setCommentDraft] = useState("");
  const commentsListRef = useRef(null);
  const guests = (window.GUESTS[r.id] || []);
  const statusIndex = Math.max(0, STATUS_STEPS.findIndex(s => s.key === status));

  const scrollCommentsToBottom = () => {
    const el = commentsListRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  };

  useEffect(() => {
    if (commentsSheetOpen) setTimeout(scrollCommentsToBottom, 0);
  }, [commentsSheetOpen]);

  const sendComment = () => {
    const text = commentDraft.trim();
    if (!text) return;
    setComments(prev => [...prev, { id: `local-${Date.now()}`, author: "You", role: "Front Desk", dateTime: "Just now", message: text }]);
    setCommentDraft("");
    setTimeout(scrollCommentsToBottom, 0);
  };

  const initials = (name) => name.split(" ").filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase();

  const cycle = () => {
    const order = ["confirmed", "onboard", "check-in", "check-out"];
    const i = order.indexOf(status);
    const next = order[(i + 1) % order.length];
    setStatus(next);
    addToast(`Status → ${next === "check-in" ? "Check-in" : next === "check-out" ? "Check-out" : next === "onboard" ? "Onboard" : "Confirmed"}`);
  };

  const doAdvance = (next) => {
    setStatusUpdating(true);
    setTimeout(() => {
      setStatus(next.key);
      setStatusUpdating(false);
      addToast(`Status → ${next.label}`);
    }, 1400);
  };

  // Check-out only ever follows Onboard in STATUS_STEPS, so this is really
  // "guard the onboard → check-out transition" — going straight to check-out
  // right after onboarding is an unusual, high-consequence jump (most likely
  // a mis-tap), so it gets a confirmation instead of advancing immediately
  // like every other step does.
  const advanceStatus = () => {
    const next = STATUS_STEPS[statusIndex + 1];
    if (!next || statusUpdating) return;
    if (next.key === "check-out") {
      setCheckoutConfirmOpen(true);
      return;
    }
    doAdvance(next);
  };

  const confirmCheckout = () => {
    setCheckoutConfirmOpen(false);
    const next = STATUS_STEPS[statusIndex + 1];
    if (next) doAdvance(next);
  };

  const reportToViza = () => {
    if (vizaStatus !== "idle") return;
    setVizaStatus("loading");
    setTimeout(() => setVizaStatus("done"), 1200);
  };

  return (
    <div className="page">
      <div className="sub-header">
        <button className="back" onClick={back}><I.ChevronBack /></button>
        <span className="title">Reservation Details</span>
      </div>

      <div className="app-scroll" style={{ paddingBottom: "calc(80px + env(safe-area-inset-bottom, 0px))" }}>
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

      <button className="fab" onClick={() => setMenuOpen(true)}><I.GridFill /></button>

      {menuOpen && (
        <div className="sheet-backdrop" onClick={() => setMenuOpen(false)}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <div className="head">
              <h3>{r.id}</h3>
              <button className="icon-btn" onClick={() => setMenuOpen(false)}><I.X /></button>
            </div>
            <div style={{ marginTop: 8 }}>
              <button className="action-item" onClick={() => { setMenuOpen(false); setStatusSheetOpen(true); }}>
                <span className="action-icon"><I.Bolt /></span>
                Change Status
              </button>
              <button className="action-item" onClick={() => { setMenuOpen(false); setCommentsSheetOpen(true); }}>
                <span className="action-icon"><I.Comment /></span>
                Comments
              </button>
            </div>
          </div>
        </div>
      )}

      {statusSheetOpen && (
        <div className="sheet-backdrop" onClick={() => setStatusSheetOpen(false)}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <div className="head">
              <h3>Reservation Status</h3>
              <button className="icon-btn" onClick={() => setStatusSheetOpen(false)}><I.X /></button>
            </div>
            <div style={{ marginTop: 20 }}>
              <div className="status-timeline">
                {(() => {
                  const doneSteps = STATUS_STEPS.slice(0, statusIndex + 1);
                  const nextStep = STATUS_STEPS[statusIndex + 1] || null;
                  const nextIsOnboard = !!nextStep && nextStep.key === "onboard";

                  const actionsRow = (buttons, isFinal) => (
                    <div className="status-step actions-row">
                      <div className="node-col">
                        {!isFinal && <div className="connector dashed" />}
                      </div>
                      <div className="body">
                        <div className="status-actions">
                          {buttons.includes("sign") && (
                            <button
                              className={"status-action-btn" + (signed ? " done" : "")}
                              onClick={() => setCheckinOpen(true)}
                              disabled={signed}
                            >
                              {signed ? <I.Check style={{ width: 16, height: 16 }} /> : <I.Edit style={{ width: 16, height: 16 }} />}
                              {signed ? "Signed" : "Sign"}
                            </button>
                          )}
                          {buttons.includes("report") && (
                            <button
                              className={"status-action-btn" + (vizaStatus === "done" ? " done" : "")}
                              onClick={reportToViza}
                              disabled={vizaStatus !== "idle"}
                            >
                              {vizaStatus === "loading" && <div className="status-spinner status-spinner-sm" />}
                              {vizaStatus === "done" && <I.Check style={{ width: 16, height: 16 }} />}
                              {vizaStatus === "idle" && "Report to VIZA"}
                              {vizaStatus === "loading" && "Reporting…"}
                              {vizaStatus === "done" && "Scheduled"}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );

                  return (
                    <>
                      {doneSteps.map((s, i) => {
                        const isCurrent = i === statusIndex;
                        const isLastDone = i === doneSteps.length - 1;
                        const onboardDoneHere = s.key === "onboard";
                        const dashedAfter = onboardDoneHere || (isLastDone && nextStep);
                        return (
                          <React.Fragment key={s.key}>
                            <div className={"status-step " + (isCurrent ? "current" : "done") + (onboardDoneHere ? " tight-bottom" : "")}>
                              <div className="node-col">
                                <div className="icon-circle"><s.Icon style={{ width: 18, height: 18 }} /></div>
                                {(!isLastDone || dashedAfter) && <div className={"connector" + (dashedAfter ? " dashed" : "")} />}
                              </div>
                              <div className="body">
                                <div className="label-line"><h4>{s.label}</h4></div>
                                <div className="ts">{s.ts}</div>
                              </div>
                            </div>
                            {/* Onboard already reached — its actions (both Sign and, now
                                that onboarding happened, Report to VIZA) attach right here,
                                regardless of whether Onboard is the current step or an
                                earlier one already passed. */}
                            {onboardDoneHere && actionsRow(["sign", "report"], false)}
                          </React.Fragment>
                        );
                      })}

                      {nextStep && (
                        <React.Fragment>
                          <div className={"status-step future next" + (nextIsOnboard ? " tight-bottom" : " last")}>
                            <div className="node-col">
                              <div
                                className={"icon-circle" + (statusUpdating ? " updating" : "")}
                                onClick={!statusUpdating ? advanceStatus : undefined}
                              >
                                {statusUpdating
                                  ? <div className="status-spinner" />
                                  : <nextStep.Icon style={{ width: 20, height: 20 }} />}
                              </div>
                            </div>
                            <div className="body">
                              <div className="label-line"><h4>{statusUpdating ? "Updating status…" : nextStep.label}</h4></div>
                            </div>
                          </div>
                          {/* Onboard hasn't happened yet — only Sign is available; Report
                              to VIZA isn't possible before onboarding. This is also always
                              the last visible row, since only the immediate next step is
                              ever shown. */}
                          {nextIsOnboard && actionsRow(["sign"], true)}
                        </React.Fragment>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

      {checkoutConfirmOpen && (
        <div className="sheet-backdrop" onClick={() => setCheckoutConfirmOpen(false)}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <div className="head">
              <h3>Check out guest?</h3>
              <button className="icon-btn" onClick={() => setCheckoutConfirmOpen(false)}><I.X /></button>
            </div>
            <div style={{ marginTop: 16, fontSize: "var(--font-base)", color: "var(--ink-2)", lineHeight: 1.5 }}>
              This guest was only just onboarded. Checking out immediately after onboarding is unusual — are you sure you want to continue?
            </div>
            <div className="actions">
              <button className="btn secondary" onClick={() => setCheckoutConfirmOpen(false)}>Cancel</button>
              <button className="btn" onClick={confirmCheckout}>Check out</button>
            </div>
          </div>
        </div>
      )}

      {commentsSheetOpen && (
        <div className="sheet-backdrop" onClick={() => setCommentsSheetOpen(false)}>
          <div className="sheet comments-sheet" onClick={e => e.stopPropagation()}>
            <div className="head">
              <h3>Comments</h3>
              <button className="icon-btn" onClick={() => setCommentsSheetOpen(false)}><I.X /></button>
            </div>

            <div className="comments-list" ref={commentsListRef}>
              {comments.length === 0 && (
                <div style={{ padding: "24px 0", textAlign: "center", color: "var(--ink-4)", fontSize: "var(--font-sm)", fontWeight: 600 }}>
                  No comments yet
                </div>
              )}
              {comments.map(c => (
                <div key={c.id} className={"comment-row" + (c.role === "Guest" ? " guest" : "")}>
                  <div className="comment-avatar">{initials(c.author)}</div>
                  <div className="comment-body">
                    <div className="comment-meta">
                      <span className="comment-author">{c.author} <span className="comment-role">· {c.role}</span></span>
                      <span className="comment-time">{c.dateTime}</span>
                    </div>
                    <div className="comment-message">{c.message}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="comments-compose">
              <textarea
                rows={1}
                placeholder="Write a comment…"
                value={commentDraft}
                onChange={e => setCommentDraft(e.target.value)}
              />
              <button className="comment-send" disabled={!commentDraft.trim()} onClick={sendComment}>
                <I.Send />
              </button>
            </div>
          </div>
        </div>
      )}

      {checkinOpen && (
        <CheckinSignScreen
          guestName={r.name}
          guestEmail={r.email}
          onClose={() => setCheckinOpen(false)}
          onConfirm={() => {
            setSigned(true);
            setCheckinOpen(false);
            addToast("T&C accepted — signature saved");
          }}
        />
      )}
    </div>
  );
}

window.ArrivalsScreen = ArrivalsScreen;
window.ReservationDetailScreen = ReservationDetailScreen;
