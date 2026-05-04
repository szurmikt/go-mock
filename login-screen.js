/* global React, I */

const { useState, useRef, useEffect } = React;

const VALID_EMAIL    = "tamas@szurmik.com";
const VALID_PASSWORD = "password";
const VALID_OTP      = "444555";

const LANGS = [
  { code: "en", label: "EN" },
  { code: "hu", label: "HU" },
  { code: "de", label: "DE" },
  { code: "tr", label: "TR" },
  { code: "fr", label: "FR" },
  { code: "lv", label: "LV" },
  { code: "es", label: "ES" },
];

function LoginScreen({ go, goHome }) {
  const [lang, setLang]       = useState("en");
  const [email, setEmail]     = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]     = useState(false);
  const [loading, setLoading] = useState(false);
  const passwordRef           = useRef(null);

  const submit = (e) => {
    e.preventDefault();
    if (loading) return;
    if (!email && !password) { goHome(); return; }
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      if (email.trim() === VALID_EMAIL && password === VALID_PASSWORD) {
        go("mfa");
      } else {
        setError(true);
      }
    }, 600);
  };

  const retry = () => {
    setError(false);
    setPassword("");
    setTimeout(() => passwordRef.current?.focus(), 50);
  };

  return (
    <div className="login-page">
      <div className="login-header">
        <select className="lang-select" value={lang} onChange={e => setLang(e.target.value)}>
          {LANGS.map(l => (
            <option key={l.code} value={l.code}>{l.label}</option>
          ))}
        </select>
      </div>

      <div className="login-body">
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--primary)", marginBottom: 8 }}>SabeeApp Go</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: "var(--ink)", letterSpacing: "-0.02em", lineHeight: 1.15 }}>Welcome back</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: "var(--ink-4)", marginTop: 6 }}>Sign in to your account</div>
        </div>

        <form onSubmit={submit}>
          <div className="form-group">
            <input
              placeholder=" "
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="email"
            />
            <label>Email</label>
          </div>

          <div className="form-group" style={{ marginBottom: 24 }}>
            <input
              ref={passwordRef}
              placeholder=" "
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
            />
            <label>Password</label>
          </div>

          <button
            className="btn"
            type="submit"
            disabled={loading}
            style={{ opacity: 1 }}
          >
            {loading
              ? <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 18, height: 18, border: "2.5px solid rgba(255,255,255,0.4)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.8s linear infinite", display: "inline-block" }} />
                  Signing in…
                </span>
              : "Sign in"
            }
          </button>
        </form>
      </div>

      <div className="login-footer">
        Account management is handled through your SabeeApp PMS
      </div>

      {error && (
        <div className="sheet-backdrop" onClick={retry}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <div className="head">
              <h3>Sign in failed</h3>
              <button className="icon-btn" onClick={retry}><I.X /></button>
            </div>
            <div style={{ marginTop: 16, marginBottom: 8 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: "var(--ink-3)", lineHeight: 1.5 }}>
                The email or password you entered is incorrect. Please check your credentials and try again.
              </div>
            </div>
            <div style={{ marginTop: 24 }}>
              <button className="btn" onClick={retry}>Try again</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MFAScreen({ goHome, back }) {
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [error, setError]   = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRefs = [useRef(), useRef(), useRef(), useRef(), useRef(), useRef()];

  useEffect(() => {
    const t = setTimeout(() => inputRefs[0].current?.focus(), 350);
    return () => clearTimeout(t);
  }, []);

  const verify = (d) => {
    const code = d.join("");
    setLoading(true);
    setTimeout(() => {
      if (code === VALID_OTP) {
        goHome();
      } else {
        setLoading(false);
        setError(true);
        setDigits(["", "", "", "", "", ""]);
        setTimeout(() => inputRefs[0].current?.focus(), 50);
      }
    }, 600);
  };

  const handleKey = (i, e) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      const next = [...digits];
      if (next[i]) {
        next[i] = "";
        setDigits(next);
      } else if (i > 0) {
        next[i - 1] = "";
        setDigits(next);
        inputRefs[i - 1].current?.focus();
      }
      setError(false);
    }
  };

  const handleChange = (i, e) => {
    if (loading) return;
    const val = e.target.value.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[i] = val;
    setDigits(next);
    setError(false);
    if (val && i < 5) {
      inputRefs[i + 1].current?.focus();
    } else if (val && i === 5) {
      verify(next);
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    const next = ["", "", "", "", "", ""];
    for (let i = 0; i < pasted.length; i++) next[i] = pasted[i];
    setDigits(next);
    setError(false);
    if (pasted.length === 6) {
      verify(next);
    } else {
      inputRefs[Math.min(pasted.length, 5)].current?.focus();
    }
  };

  return (
    <div className="page">
      <div className="sub-header">
        <button className="back" onClick={back}><I.ChevronBack /></button>
        <span className="title">Two-step verification</span>
      </div>

      <div style={{ padding: "48px var(--pad) 0", textAlign: "center" }}>
        <div style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--primary-soft-bg)", border: "1.5px solid var(--primary-soft)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--primary)", marginBottom: 20 }}>
          <I.IDCard style={{ width: 30, height: 30 }} />
        </div>
        <div style={{ fontSize: 15, fontWeight: 600, color: "var(--ink-3)", lineHeight: 1.5, marginBottom: 40 }}>
          Enter the 6-digit code from<br />your authenticator app
        </div>

        <div className="otp-row" style={{ marginBottom: 20 }}>
          {digits.map((d, i) => (
            <React.Fragment key={i}>
              {i === 3 && <span className="otp-sep">·</span>}
              <input
                ref={inputRefs[i]}
                className={"otp-digit" + (d ? " filled" : "") + (error ? " error" : "")}
                type="tel"
                inputMode="numeric"
                maxLength={1}
                value={d}
                disabled={loading}
                onChange={e => handleChange(i, e)}
                onKeyDown={e => handleKey(i, e)}
                onPaste={i === 0 ? handlePaste : undefined}
              />
            </React.Fragment>
          ))}
        </div>

        <div style={{ height: 28, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {loading && (
            <span style={{ width: 20, height: 20, border: "2.5px solid var(--line-strong)", borderTopColor: "var(--primary)", borderRadius: "50%", animation: "spin 0.8s linear infinite", display: "inline-block" }} />
          )}
          {error && !loading && (
            <span>
              <span style={{ fontSize: 14, fontWeight: 700, color: "var(--warn)" }}>Invalid code. </span>
              <button onClick={() => { setError(false); setTimeout(() => inputRefs[0].current?.focus(), 50); }}
                style={{ background: "none", border: "none", fontSize: 14, fontWeight: 700, color: "var(--primary)", cursor: "pointer", padding: 0 }}>
                Try again
              </button>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

window.LoginScreen = LoginScreen;
window.MFAScreen   = MFAScreen;
