/* global React, ReactDOM, I, StatusBar, Toast, LoginScreen, MFAScreen, PropertySelectScreen, HomeScreen, ArrivalsScreen, ReservationDetailScreen, GuestDetailScreen, EditGuestScreen, SearchScreen, IDScanScreen, useTweaks, TweaksPanel, TweakSection, TweakRadio */

const { useState, useEffect, useRef } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "density": "comfy",
  "card": "outlined",
  "pill": "soft"
}/*EDITMODE-END*/;

function App() {
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [stack, setStack] = useState([{ name: "login" }]);
  const [direction, setDirection] = useState("forward");
  const [tab, setTab] = useState("home");
  const [toasts, setToasts] = useState([]);
  const [property, setProperty] = useState(null);

  const top = stack[stack.length - 1];

  const go = (name, payload) => {
    setDirection("forward");
    setStack(s => [...s, { name, payload }]);
  };
  const back = () => {
    if (stack.length <= 1) return;
    setDirection("back");
    setStack(s => s.slice(0, -1));
  };
  const setRootTab = (name) => {
    setTab(name);
    setDirection("forward");
    if (name === "home") setStack([{ name: "home" }]);
    else if (name === "arrivals") setStack([{ name: "arrivals" }]);
    else if (name === "search") setStack([{ name: "search" }]);
    else if (name === "scan") setStack([{ name: "idscan" }]);
  };

  const addToast = (msg) => {
    const id = Math.random();
    setToasts(t => [...t, { id, msg }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 2200);
  };

  const renderScreen = (s) => {
    if (!s) return null;
    switch (s.name) {
      case "login":    return <LoginScreen go={go} goHome={() => setStack([{ name: "property" }])} />;
      case "mfa":      return <MFAScreen goHome={() => setStack([{ name: "property" }])} back={back} />;
      case "property": return <PropertySelectScreen onSelect={p => { setProperty(p); setStack([{ name: "home" }]); }} />;
      case "home": return <HomeScreen go={go} property={property} setProperty={setProperty} />;
      case "arrivals": return <ArrivalsScreen go={go} back={back} />;
      case "reservation": return <ReservationDetailScreen id={s.payload} go={go} back={back} addToast={addToast} />;
      case "guest": return <GuestDetailScreen resId={s.payload.resId} guestId={s.payload.guestId} go={go} back={back} />;
      case "editguest": return <EditGuestScreen resId={s.payload.resId} guestId={s.payload.guestId} back={back} addToast={addToast} />;
      case "search": return <SearchScreen back={back} go={go} />;
      case "idscan": return <IDScanScreen back={back} addToast={addToast} />;
      case "blockdate": return <BlockDateScreen back={back} addToast={addToast} />;
      default: return null;
    }
  };

  // Bottom nav visibility — hide on full-screen modals like ID scan
  const showNav = false;

  return (
    <div className="app-stage">
      <div className="app-window"
        data-density={tweaks.density}
        data-card={tweaks.card}
        data-pill={tweaks.pill}>
        <div style={{ position: "relative", flex: 1, overflow: "hidden" }}>
          <PageTransitions stack={stack} direction={direction} renderScreen={renderScreen} />
          <div className="toast-stack">
            {toasts.map(t => <Toast key={t.id} msg={t.msg} />)}
          </div>
        </div>
        {showNav && <BottomNav active={top.name} setRootTab={setRootTab} />}
      </div>

      <TweaksPanel title="Tweaks">
        <TweakSection title="Density">
          <TweakRadio value={tweaks.density} options={[{value: "comfy", label: "Comfy"}, {value: "compact", label: "Compact"}]} onChange={v => setTweak("density", v)} />
        </TweakSection>
        <TweakSection title="Card style">
          <TweakRadio value={tweaks.card} options={[{value: "outlined", label: "Outlined"}, {value: "soft", label: "Soft"}, {value: "elevated", label: "Elevated"}]} onChange={v => setTweak("card", v)} />
        </TweakSection>
        <TweakSection title="Status pill">
          <TweakRadio value={tweaks.pill} options={[{value: "soft", label: "Soft"}, {value: "solid", label: "Solid"}, {value: "outline", label: "Outline"}]} onChange={v => setTweak("pill", v)} />
        </TweakSection>
      </TweaksPanel>
    </div>
  );
}

function PageTransitions({ stack, direction, renderScreen }) {
  // Render last 2 stack frames during transition
  const [rendered, setRendered] = useState(stack);
  const prevLen = useRef(stack.length);

  useEffect(() => {
    if (stack.length === prevLen.current && stack[stack.length - 1] === rendered[rendered.length - 1]) return;
    setRendered(stack);
    prevLen.current = stack.length;
  }, [stack]);

  const top = rendered[rendered.length - 1];
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <PageHost key={top ? top.name + JSON.stringify(top.payload || "") : "x"} direction={direction}>
        {renderScreen(top)}
      </PageHost>
    </div>
  );
}

function PageHost({ children, direction }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const enterClass = direction === "back" ? "page-back-enter" : "page-enter";
    const activeClass = direction === "back" ? "page-back-enter-active" : "page-enter-active";
    el.classList.add(enterClass);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.classList.add(activeClass);
        el.classList.remove(enterClass);
      });
    });
    const t = setTimeout(() => el.classList.remove(activeClass), 360);
    return () => clearTimeout(t);
  }, []);
  return (
    <div ref={ref} style={{ position: "absolute", inset: 0 }}>
      {children}
    </div>
  );
}

function BottomNav({ active, setRootTab }) {
  const items = [
    { id: "home", label: "Home", Icon: I.Home, IconActive: I.HomeFill },
    { id: "arrivals", label: "Arrivals", Icon: I.ArrowIn, IconActive: I.ArrowIn },
    { id: "scan", label: "Scan", Icon: I.Scan, IconActive: I.Scan },
    { id: "search", label: "Search", Icon: I.Search, IconActive: I.Search },
  ];
  return (
    <div className="bottom-nav">
      {items.map(it => {
        const isActive = it.id === active || (it.id === "arrivals" && active === "arrivals");
        const Icon = isActive ? it.IconActive : it.Icon;
        return (
          <button key={it.id} className={"nav-item" + (isActive ? " active" : "")} onClick={() => setRootTab(it.id)}>
            <Icon className="nav-icon" />
            <span>{it.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function BlockDateScreen({ back, addToast }) {
  const today = new Date();
  const [start, setStart] = useState(null);
  const [end, setEnd] = useState(null);
  const days = [];
  const first = new Date(today.getFullYear(), today.getMonth(), 1);
  const lead = (first.getDay() + 6) % 7;
  for (let i = 0; i < lead; i++) days.push(null);
  const total = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  for (let d = 1; d <= total; d++) days.push(d);

  const pick = (d) => {
    if (!start || (start && end)) { setStart(d); setEnd(null); }
    else if (d < start) setStart(d);
    else setEnd(d);
  };

  const inRange = (d) => start && end && d >= start && d <= end;
  const isEdge = (d) => d === start || d === end;

  return (
    <div className="page">
      <div className="sub-header">
        <button className="back" onClick={back}><I.ChevronBack /></button>
        <span className="title">Block Date</span>
      </div>
      <div className="app-scroll" style={{ padding: "0 16px calc(24px + env(safe-area-inset-bottom, 0px))" }}>
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: "var(--ink)", marginBottom: 12 }}>
            {today.toLocaleString(undefined, { month: "long", year: "numeric" })}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, fontSize: 12, fontWeight: 700, color: "var(--ink-4)", textAlign: "center", marginBottom: 6 }}>
            {["Mo","Tu","We","Th","Fr","Sa","Su"].map(d => <div key={d}>{d}</div>)}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
            {days.map((d, i) => (
              <button key={i} disabled={!d}
                onClick={() => d && pick(d)}
                style={{
                  aspectRatio: "1 / 1",
                  border: 0,
                  background: d && isEdge(d) ? "var(--primary)" : d && inRange(d) ? "var(--primary-soft-bg)" : "transparent",
                  color: d && isEdge(d) ? "#fff" : d && inRange(d) ? "var(--primary-strong)" : "var(--ink)",
                  fontWeight: 700,
                  borderRadius: 999,
                  cursor: d ? "pointer" : "default",
                  fontSize: 15,
                }}>
                {d || ""}
              </button>
            ))}
          </div>
        </div>
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <div><div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-4)" }}>From</div><div style={{ fontSize: 18, fontWeight: 800 }}>{start ? `${String(start).padStart(2,"0")} ${today.toLocaleString(undefined,{month:"short"})}` : "—"}</div></div>
            <div><div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-4)" }}>To</div><div style={{ fontSize: 18, fontWeight: 800 }}>{end ? `${String(end).padStart(2,"0")} ${today.toLocaleString(undefined,{month:"short"})}` : "—"}</div></div>
          </div>
        </div>
        <button className="btn" disabled={!start || !end} onClick={() => { addToast("Date blocked"); back(); }} style={{ opacity: (!start || !end) ? 0.5 : 1 }}>Block selected dates</button>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
