/* global React, I, ROOMS, RESERVATIONS, BLOCKS, PROPERTIES */

const { useState, useRef, useLayoutEffect, useEffect, useMemo } = React;

const CAL_DAY_COL = 46;
const CAL_ROOM_COL = 64;
const CAL_HEADER_H = 34;
const CAL_GROUP_H = 28;
const CAL_ROW_H = 44;
const CAL_DAYS_BEFORE = 14;
const CAL_DAYS_AFTER = 45;
const CAL_TOTAL_DAYS = CAL_DAYS_BEFORE + CAL_DAYS_AFTER + 1;
const CAL_DOW = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const CAL_TAP_SLOP = 6;

// Local date parts — NOT toISOString(), which converts to UTC first and
// silently shifts the date by a day in any timezone ahead of UTC.
function calIso(d) {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}
function calAddDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function calParseISO(s) { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); }
function calDayIndex(windowStart, iso) { return Math.round((calParseISO(iso) - windowStart) / 86400000); }
// Shared by both the tap-to-select flow and the confirm sheet's own date
// inputs, so editing the dates after the sheet is open is checked exactly
// the same way as the initial two-tap selection.
function calRangeConflict(roomId, startIso, endIso) {
  if (RESERVATIONS.some(r => r.roomId === roomId && startIso < r.endDate && r.startDate < endIso)) {
    return "Can't block — an existing reservation falls in that range";
  }
  if (BLOCKS.some(b => b.roomId === roomId && startIso < b.endDate && b.startDate < endIso)) {
    return "Can't block — part of that range is already blocked";
  }
  return null;
}
function calClamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function calFormat(iso) { return calParseISO(iso).toLocaleDateString(undefined, { day: "2-digit", month: "short" }); }

// Interleaves room-type header rows with room rows (skipping rooms whose
// type is collapsed), each carrying its cumulative vertical offset — this
// is the single source of truth for where every row sits in the grid.
function calBuildRows(rooms, collapsed) {
  const list = [];
  let y = 0;
  let lastType = null;
  for (const room of rooms) {
    if (room.type !== lastType) {
      list.push({ kind: "header", type: room.type, y, height: CAL_GROUP_H });
      y += CAL_GROUP_H;
      lastType = room.type;
    }
    if (!collapsed.has(room.type)) {
      list.push({ kind: "room", room, y, height: CAL_ROW_H });
      y += CAL_ROW_H;
    }
  }
  return list;
}
function calRowAt(rowList, y) {
  for (const row of rowList) if (y >= row.y && y < row.y + row.height) return row;
  return null;
}

function CalendarScreen({ go, property, setProperty, addToast }) {
  const [switchOpen, setSwitchOpen] = useState(false);
  const [roomPickerOpen, setRoomPickerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => new Set());
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [animate, setAnimate] = useState(false);
  const [pending, setPending] = useState(null); // { roomId, roomName, iso }
  const [confirm, setConfirm] = useState(null); // { roomId, roomName, startIso, endIso }
  const [expandedRoom, setExpandedRoom] = useState(null); // roomId

  const wrapRef = useRef(null);
  const drag = useRef(null);
  const expandTimer = useRef(null);
  const anchored = useRef(false);

  const propName = property?.name || "Sunshine Hotel & Apartments";
  const rooms = ROOMS;

  const windowStart = useRef(calAddDays(new Date(new Date().setHours(0, 0, 0, 0)), -CAL_DAYS_BEFORE)).current;

  const dates = useMemo(() => {
    const arr = [];
    for (let i = 0; i < CAL_TOTAL_DAYS; i++) {
      const d = calAddDays(windowStart, i);
      arr.push({ iso: calIso(d), dow: CAL_DOW[d.getDay()], num: d.getDate(), isToday: i === CAL_DAYS_BEFORE });
    }
    return arr;
  }, []);

  const rowList = useMemo(() => calBuildRows(rooms, collapsed), [rooms, collapsed]);
  const roomRowY = {};
  for (const row of rowList) if (row.kind === "room") roomRowY[row.room.id] = row.y;
  const headers = rowList.filter(r => r.kind === "header");

  const gridWidth = CAL_TOTAL_DAYS * CAL_DAY_COL;
  const gridHeight = rowList.length ? rowList[rowList.length - 1].y + rowList[rowList.length - 1].height : 0;

  useEffect(() => () => { if (expandTimer.current) clearTimeout(expandTimer.current); }, []);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth, h = el.clientHeight;
      setSize({ w, h });
      if (!anchored.current && w > 0) {
        anchored.current = true;
        const initialMaxPanX = Math.max(0, gridWidth - Math.max(0, w - CAL_ROOM_COL));
        setPanX(calClamp(CAL_DAYS_BEFORE * CAL_DAY_COL, 0, initialMaxPanX));
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const areaW = Math.max(0, size.w - CAL_ROOM_COL);
  const areaH = Math.max(0, size.h - CAL_HEADER_H);
  const maxPanX = Math.max(0, gridWidth - areaW);
  const maxPanY = Math.max(0, gridHeight - areaH);

  // Sticky-with-push header: pinned at the top of the content unless the
  // next section's header is close enough to shove it out of the way.
  let activeIdx = 0;
  for (let i = 0; i < headers.length; i++) { if (headers[i].y <= panY) activeIdx = i; else break; }
  const activeHeader = headers[activeIdx];
  const nextHeader = headers[activeIdx + 1];
  let pinnedOffset = 0;
  if (nextHeader) {
    const gap = (nextHeader.y - panY) - CAL_GROUP_H;
    if (gap < 0) pinnedOffset = gap;
  }

  const toggleCollapse = (type) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type); else next.add(type);
      return next;
    });
  };

  const goToday = () => {
    setAnimate(true);
    setPanX(calClamp(CAL_DAYS_BEFORE * CAL_DAY_COL, 0, maxPanX));
    setPanY(0);
    setTimeout(() => setAnimate(false), 340);
  };

  const startBlockFromPicker = (room) => {
    setRoomPickerOpen(false);
    let nextCollapsed = collapsed;
    if (collapsed.has(room.type)) {
      nextCollapsed = new Set(collapsed);
      nextCollapsed.delete(room.type);
      setCollapsed(nextCollapsed);
    }
    const rows = calBuildRows(rooms, nextCollapsed);
    const targetRow = rows.find(r => r.kind === "room" && r.room.id === room.id);
    const newGridHeight = rows.length ? rows[rows.length - 1].y + rows[rows.length - 1].height : 0;
    const newAreaH = Math.max(0, size.h - CAL_HEADER_H);
    const newMaxPanY = Math.max(0, newGridHeight - newAreaH);

    setPending({ roomId: room.id, roomName: room.name, iso: dates[CAL_DAYS_BEFORE].iso });
    setAnimate(true);
    setPanX(calClamp(CAL_DAYS_BEFORE * CAL_DAY_COL, 0, maxPanX));
    if (targetRow) {
      const centered = targetRow.y - newAreaH / 2 + CAL_ROW_H / 2;
      setPanY(calClamp(centered, 0, newMaxPanY));
    }
    setTimeout(() => setAnimate(false), 340);
    addToast(`Tap an end date for ${room.name}`);
  };

  const expandRoomLabel = (roomId) => {
    if (expandTimer.current) clearTimeout(expandTimer.current);
    setExpandedRoom(roomId);
    expandTimer.current = setTimeout(() => setExpandedRoom(null), 2500);
  };

  const handleTap = (localX, localY, panXAtDown, panYAtDown) => {
    if (expandedRoom) {
      if (expandTimer.current) clearTimeout(expandTimer.current);
      setExpandedRoom(null);
    }

    // The pinned sticky header spans the full width — it always wins.
    if (localY >= CAL_HEADER_H && localY < CAL_HEADER_H + CAL_GROUP_H) {
      if (activeHeader) toggleCollapse(activeHeader.type);
      return;
    }
    if (localY < CAL_HEADER_H) return;

    const gy = localY - CAL_HEADER_H + panYAtDown;
    const row = calRowAt(rowList, gy);
    if (!row) return;

    if (row.kind === "header") { toggleCollapse(row.type); return; }

    const room = row.room;
    if (localX < CAL_ROOM_COL) { expandRoomLabel(room.id); return; }

    const gx = localX - CAL_ROOM_COL + panXAtDown;
    const dateIdx = Math.floor(gx / CAL_DAY_COL);
    const date = dates[dateIdx];
    if (!date) return;

    const res = RESERVATIONS.find(r => r.roomId === room.id && date.iso >= r.startDate && date.iso < r.endDate);
    if (res) { go("reservation", res.id); return; }

    const blk = BLOCKS.find(b => b.roomId === room.id && date.iso >= b.startDate && date.iso < b.endDate);
    if (blk) { addToast("This date is blocked"); return; }

    if (!pending || pending.roomId !== room.id) {
      setPending({ roomId: room.id, roomName: room.name, iso: date.iso });
      return;
    }

    // Both tapped dates are included in the block — tapping the 7th then
    // the 10th blocks the 7th, 8th, 9th and 10th (checkout the 11th).
    const startIso = pending.iso < date.iso ? pending.iso : date.iso;
    const lastIso = pending.iso < date.iso ? date.iso : pending.iso;
    const endIso = calIso(calAddDays(calParseISO(lastIso), 1));

    // Check the whole range, not just the two tapped endpoints — a
    // reservation or existing block can sit entirely between them.
    const conflict = calRangeConflict(room.id, startIso, endIso);
    if (conflict) {
      addToast(conflict);
      setPending(null);
      return;
    }

    setConfirm({ roomId: room.id, roomName: room.name, startIso, endIso, comment: "" });
    setPending(null);
  };

  const onPointerDown = (e) => {
    setAnimate(false);
    const rect = wrapRef.current.getBoundingClientRect();
    drag.current = {
      x0: e.clientX, y0: e.clientY,
      panX0: panX, panY0: panY,
      moved: false,
      localX: e.clientX - rect.left,
      localY: e.clientY - rect.top,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x0, dy = e.clientY - d.y0;
    if (!d.moved && Math.hypot(dx, dy) > CAL_TAP_SLOP) d.moved = true;
    if (d.moved) {
      setPanX(calClamp(d.panX0 - dx, 0, maxPanX));
      setPanY(calClamp(d.panY0 - dy, 0, maxPanY));
    }
  };
  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d || d.moved) return;
    handleTap(d.localX, d.localY, d.panX0, d.panY0);
  };

  const todayIdx = CAL_DAYS_BEFORE;
  const leftDate = dates[calClamp(Math.round(panX / CAL_DAY_COL), 0, dates.length - 1)];
  const cornerLabel = leftDate ? calParseISO(leftDate.iso).toLocaleDateString(undefined, { month: "short" }) : "";

  // Bars run from the midpoint of the check-in day's column to the midpoint
  // of the checkout day's column (arrival/departure happen midday), matching
  // the desktop PMS calendar's convention — not the day-column edges.
  const bars = RESERVATIONS.map(r => {
    const y = roomRowY[r.roomId];
    if (y === undefined) return null;
    const startIdx = calClamp(calDayIndex(windowStart, r.startDate), 0, CAL_TOTAL_DAYS);
    const endIdx = calClamp(calDayIndex(windowStart, r.endDate), 0, CAL_TOTAL_DAYS);
    if (endIdx <= startIdx) return null;
    return (
      <div key={r.id} className="cal-bar" data-status={r.status}
        style={{ left: startIdx * CAL_DAY_COL + CAL_DAY_COL / 2, top: y + 4, width: (endIdx - startIdx) * CAL_DAY_COL, height: CAL_ROW_H - 8 }}>
        {r.name}
      </div>
    );
  });

  const blockBars = BLOCKS.map(b => {
    const y = roomRowY[b.roomId];
    if (y === undefined) return null;
    const startIdx = calClamp(calDayIndex(windowStart, b.startDate), 0, CAL_TOTAL_DAYS);
    const endIdx = calClamp(calDayIndex(windowStart, b.endDate), 0, CAL_TOTAL_DAYS);
    if (endIdx <= startIdx) return null;
    return (
      <div key={b.id} className="cal-bar cal-bar-blocked"
        style={{ left: startIdx * CAL_DAY_COL + CAL_DAY_COL / 2, top: y + 4, width: (endIdx - startIdx) * CAL_DAY_COL, height: CAL_ROW_H - 8 }}>
        Blocked
      </div>
    );
  });

  let pendingMark = null;
  if (pending) {
    const y = roomRowY[pending.roomId];
    const idx = calDayIndex(windowStart, pending.iso);
    if (y !== undefined && idx >= 0 && idx < CAL_TOTAL_DAYS) {
      pendingMark = <div className="cal-pending" style={{ left: idx * CAL_DAY_COL + 2, top: y + 2, width: CAL_DAY_COL - 4, height: CAL_ROW_H - 4 }} />;
    }
  } else if (confirm) {
    // Highlights exactly the nights that will be blocked (startDate up to,
    // but not including, the checkout date) — stays on screen behind the
    // confirm sheet so the selected range is still visible, not just named.
    const y = roomRowY[confirm.roomId];
    const startIdx = calClamp(calDayIndex(windowStart, confirm.startIso), 0, CAL_TOTAL_DAYS);
    const endIdx = calClamp(calDayIndex(windowStart, confirm.endIso), 0, CAL_TOTAL_DAYS);
    if (y !== undefined && endIdx > startIdx) {
      pendingMark = <div className="cal-pending" style={{ left: startIdx * CAL_DAY_COL + 2, top: y + 2, width: (endIdx - startIdx) * CAL_DAY_COL - 4, height: CAL_ROW_H - 4 }} />;
    }
  }

  let expandedLabel = null;
  if (expandedRoom) {
    const y = roomRowY[expandedRoom];
    const room = rooms.find(r => r.id === expandedRoom);
    if (y !== undefined && room) {
      expandedLabel = (
        <div className="cal-room-expanded" style={{ top: CAL_HEADER_H + y - panY, height: CAL_ROW_H }}>
          <span>{room.name}</span>
          {room.housekeeping && <span className="cal-room-dot" data-hk={room.housekeeping} />}
        </div>
      );
    }
  }

  return (
    <div className="page">
      <div className="page-header" style={{ paddingTop: 16 }}>
        <button className="title-row" onClick={() => setSwitchOpen(true)}
          style={{ background: "none", border: 0, padding: 0, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 0, textAlign: "left" }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", color: "var(--ink)", lineHeight: 1.2, flex: 1, minWidth: 0 }}>{propName}</h1>
          <I.ChevronDown style={{ color: "var(--primary)", width: 22, height: 22, flexShrink: 0 }} />
        </button>
        <div className="actions">
          <button className="icon-btn" onClick={goToday} aria-label="Jump to today" style={{ width: 36, height: 36 }}><I.Today day={dates[todayIdx].num} style={{ width: 36, height: 36 }} /></button>
          <button className="cal-add-btn" onClick={() => setRoomPickerOpen(true)} aria-label="Block a date"><I.Plus style={{ width: 14, height: 14 }} /></button>
        </div>
      </div>

      {roomPickerOpen && (
        <div className="sheet-backdrop" onClick={() => setRoomPickerOpen(false)}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <div className="head">
              <h3>Block a Date</h3>
              <button className="icon-btn" onClick={() => setRoomPickerOpen(false)}><I.X /></button>
            </div>
            <div style={{ marginTop: 8, fontSize: 13, fontWeight: 700, color: "var(--ink-4)", padding: "8px 4px 4px" }}>Select a room</div>
            <div>
              {rooms.map(r => (
                <button key={r.id} className="action-item" onClick={() => startBlockFromPicker(r)}>
                  <span className="action-icon"><I.Door /></span>
                  <span style={{ flex: 1, textAlign: "left" }}>
                    <div>{r.name}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-4)", marginTop: 2 }}>{r.type}</div>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

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

      <div className="cal-wrap" ref={wrapRef}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>

        <div className="cal-corner" style={{ width: CAL_ROOM_COL, height: CAL_HEADER_H }}>
          <span className="dow">&nbsp;</span>
          <span className="num">{cornerLabel}</span>
        </div>

        <div className="cal-dates" style={{ left: CAL_ROOM_COL, height: CAL_HEADER_H }}>
          <div className={"cal-dates-inner" + (animate ? " cal-animated" : "")} style={{ width: gridWidth, transform: `translateX(${-panX}px)` }}>
            {dates.map((d, i) => (
              <div key={d.iso} className={"cal-date-cell" + (d.isToday ? " today" : "")} style={{ left: i * CAL_DAY_COL, width: CAL_DAY_COL }}>
                <span className="dow">{d.dow}</span>
                <span className="num">{d.num}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="cal-rooms" style={{ top: CAL_HEADER_H, width: CAL_ROOM_COL }}>
          <div className={"cal-rooms-inner" + (animate ? " cal-animated" : "")} style={{ height: gridHeight, transform: `translateY(${-panY}px)` }}>
            {rowList.filter(r => r.kind === "room").map(row => (
              <div key={row.room.id} className="cal-room-cell" style={{ top: row.y, height: row.height }}>
                <span className="cal-room-name">{row.room.name}</span>
                {row.room.housekeeping && <span className="cal-room-dot" data-hk={row.room.housekeeping} />}
              </div>
            ))}
          </div>
        </div>

        <div className="cal-body" style={{ top: CAL_HEADER_H, left: CAL_ROOM_COL }}>
          <div className={"cal-body-inner" + (animate ? " cal-animated" : "")}
            style={{ width: gridWidth, height: gridHeight, transform: `translate(${-panX}px, ${-panY}px)`, backgroundSize: `${CAL_DAY_COL}px 100%` }}>
            <div className="cal-today-col" style={{ left: todayIdx * CAL_DAY_COL, width: CAL_DAY_COL, height: gridHeight }} />
            {rowList.filter(r => r.kind === "room").map(row => (
              <div key={"rb-" + row.room.id} className="cal-room-band" style={{ top: row.y, height: row.height, width: gridWidth }} />
            ))}
            {blockBars}
            {bars}
            {pendingMark}
          </div>
        </div>

        {/* Full-width, edge-to-edge — spans past the frozen room column's
            border, unlike the old split room-column/grid pair it replaces. */}
        {headers.map(row => (
          <div key={"h-" + row.type} className="cal-type-row"
            style={{ top: CAL_HEADER_H + row.y - panY, height: row.height, transition: animate ? "top 0.34s cubic-bezier(0.32, 0.72, 0, 1)" : "none" }}>
            <I.ChevronRight className={"cal-type-chevron" + (collapsed.has(row.type) ? "" : " open")} />
            <span>{row.type}</span>
          </div>
        ))}

        {activeHeader && (
          <div className="cal-sticky-header" style={{ top: CAL_HEADER_H + pinnedOffset, height: CAL_GROUP_H }}>
            <I.ChevronRight className={"cal-type-chevron" + (collapsed.has(activeHeader.type) ? "" : " open")} />
            <span>{activeHeader.type}</span>
          </div>
        )}

        {expandedLabel}
      </div>

      {confirm && (
        <div className="sheet-backdrop" onClick={() => setConfirm(null)}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <div className="head">
              <h3>Block Date</h3>
              <button className="icon-btn" onClick={() => setConfirm(null)}><I.X /></button>
            </div>
            <div style={{ marginTop: 16 }}>
              <div className="field" style={{ marginBottom: 14 }}>
                <div className="l">Room</div>
                <div className="v">{confirm.roomName}</div>
              </div>
              <div className="grid-2">
                <div className="field">
                  <div className="l">From</div>
                  <input type="date" className="v-input" value={confirm.startIso}
                    max={calIso(calAddDays(calParseISO(confirm.endIso), -1))}
                    onChange={e => e.target.value && setConfirm(c => ({ ...c, startIso: e.target.value }))} />
                </div>
                <div className="field">
                  <div className="l">To (last night)</div>
                  <input type="date" className="v-input" value={calIso(calAddDays(calParseISO(confirm.endIso), -1))}
                    min={confirm.startIso}
                    onChange={e => e.target.value && setConfirm(c => ({ ...c, endIso: calIso(calAddDays(calParseISO(e.target.value), 1)) }))} />
                </div>
              </div>
              <div style={{ marginTop: 10, fontSize: 13, fontWeight: 700, color: "var(--ink-4)" }}>
                {calDayIndex(calParseISO(confirm.startIso), confirm.endIso)} night{calDayIndex(calParseISO(confirm.startIso), confirm.endIso) === 1 ? "" : "s"} blocked · checkout {calFormat(confirm.endIso)}
              </div>
              <div className="comment-field">
                <label>Comment</label>
                <textarea rows={2} placeholder="Add a note for this block…" value={confirm.comment}
                  onChange={e => setConfirm(c => ({ ...c, comment: e.target.value }))} />
              </div>
            </div>
            <button className="btn" style={{ marginTop: 20 }} onClick={() => {
              const conflict = calRangeConflict(confirm.roomId, confirm.startIso, confirm.endIso);
              if (conflict) { addToast(conflict); return; }
              addToast("Date blocked"); setConfirm(null);
            }}>Block selected dates</button>
          </div>
        </div>
      )}
    </div>
  );
}

window.CalendarScreen = CalendarScreen;
