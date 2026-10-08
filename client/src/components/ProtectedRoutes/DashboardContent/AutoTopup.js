import React, { useCallback, useEffect, useState } from "react";
import { RefreshCw, Clock, AlertTriangle } from "lucide-react";
import { authHeaders } from "../consoleApi";
import { useConsole } from "../ConsoleContext";

/*
  Auto top-up (utils/autoTopup.js on the server): when the balance falls to
  "When balance reaches", the saved payment method is charged to bring it
  back to "Top up to". Setting it up is one normal CCAvenue payment that also
  approves automatic payments with the bank.
*/

const api = async (method, body) => {
  const res = await fetch(`/api/wallet/auto-topup${method === "POST" ? "/setup" : ""}`, {
    method,
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong. Please try again.");
  return data;
};

const inr = (n) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const when = (d) => new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

// Posts the CCAvenue form, like Add Funds does.
const goToCheckout = ({ actionUrl, encRequest, accessCode }) => {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = actionUrl;
  for (const [name, value] of [["encRequest", encRequest], ["access_code", accessCode]]) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = value;
    form.appendChild(input);
  }
  document.body.appendChild(form);
  form.submit();
};

const AutoTopup = ({ balance, onChange }) => {
  const { platform, can } = useConsole();
  const [s, setS] = useState(null);
  const [form, setForm] = useState({ threshold: "", target: "" });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);

  const load = useCallback(() => {
    api("GET").then((d) => { setS(d); setForm({ threshold: String(d.threshold), target: String(d.target) }); })
      .catch((e) => setNotice({ type: "error", text: e.message }));
  }, []);

  useEffect(() => {
    load();
    // Back from the setup checkout.
    const params = new URLSearchParams(window.location.search);
    const result = params.get("autotopup");
    if (result) {
      const message = params.get("message");
      setNotice(result === "on"
        ? { type: "success", text: "Auto top-up is on. Your payment was added to your balance." }
        : result === "cancelled"
          ? { type: "info", text: "Auto top-up setup was cancelled. Nothing was charged." }
          : { type: "error", text: message || "Auto top-up couldn't be set up." });
      params.delete("autotopup");
      params.delete("message");
      window.history.replaceState({}, document.title, `${window.location.pathname}${params.toString() ? `?${params}` : ""}`);
    }
  }, [load]);

  if (!platform?.autoTopup && !s?.enabled) return null;
  if (!s) return null;

  const active = s.mandate === "active";
  const threshold = Number(form.threshold);
  const target = Number(form.target);
  const setupAmount = Math.max(1, target - balance);
  const dirty = threshold !== s.threshold || target !== s.target;

  const run = async (fn, success) => {
    setBusy(true);
    setNotice(null);
    try {
      const d = await fn();
      if (d) setS(d);
      if (success) setNotice({ type: "success", text: success });
      onChange?.();
    } catch (e) {
      setNotice({ type: "error", text: e.message });
    } finally {
      setBusy(false);
    }
  };

  const setup = () => run(async () => { goToCheckout(await api("POST", { threshold, target })); return null; });
  const toggle = (enabled) => run(() => api("PUT", { enabled }), enabled ? "Auto top-up is on." : "Auto top-up is off. Your saved payment method is kept.");
  const save = () => run(() => api("PUT", { threshold, target }), "Auto top-up amounts saved.");
  const remove = () => {
    if (!window.confirm("Remove the saved payment method and switch auto top-up off? You'd need to set it up again to use it.")) return;
    run(() => api("DELETE"), "Auto top-up is off and the saved payment method was removed.");
  };

  return (
    <div className="wallet-add-section at-card">
      <div className="at-head">
        <span className="at-title"><RefreshCw size={18} aria-hidden="true" /> Auto top-up {s.enabled ? "on" : "off"}</span>
        {active && (
          <label className="at-toggle" title={s.enabled ? "Turn off" : "Turn on"}>
            <input type="checkbox" checked={s.enabled} disabled={busy || !platform?.autoTopup} onChange={(e) => toggle(e.target.checked)}
              aria-label="Auto top-up" />
            <span aria-hidden="true" />
          </label>
        )}
      </div>

      {notice && <div className={`at-notice is-${notice.type}`} role="status">{notice.text}</div>}

      <div className="at-fields">
        <label>
          <span>When balance reaches</span>
          <span className="at-money"><em>₹</em>
            <input type="number" min={s.limits.minThreshold} step="1" value={form.threshold} disabled={busy}
              onChange={(e) => setForm({ ...form, threshold: e.target.value })} />
          </span>
        </label>
        <label>
          <span>Top up to</span>
          <span className="at-money"><em>₹</em>
            <input type="number" max={s.limits.maxTarget} step="1" value={form.target} disabled={busy}
              onChange={(e) => setForm({ ...form, target: e.target.value })} />
          </span>
        </label>
      </div>

      {active ? (<>
        <p className="at-note">
          Walras Cloud will charge {s.paymentMethod || "your saved payment method"} the amount needed to bring your balance back
          to {inr(s.target)} whenever it falls to {inr(s.threshold)}. You'll get an email about each charge {s.limits.noticeHours} hours before it's made,
          and there are at most {s.limits.maxPerDay} automatic charges a day.
        </p>
        {s.upcoming && (
          <p className="at-meta"><Clock size={15} aria-hidden="true" />
            {s.upcoming.status === "scheduled" ? `${inr(s.upcoming.amount)} will be charged on ${when(s.upcoming.dueAt)}` : `${inr(s.upcoming.amount)} charge in progress`}
          </p>
        )}
        {s.lastError && <p className="at-meta is-error"><AlertTriangle size={15} aria-hidden="true" /> Last attempt failed: {s.lastError}</p>}
        <div className="at-actions">
          {can("delete") && <button type="button" className="at-link" onClick={remove} disabled={busy}>Remove saved payment method</button>}
          <button type="button" className="wallet-add-btn" onClick={save} disabled={busy || !dirty}>{busy ? "Saving…" : "Save"}</button>
        </div>
      </>) : (<>
        <p className="at-note">
          To set it up you'll pay {inr(setupAmount)} now, added to your balance, through CCAvenue, and approve automatic payments with your
          bank (OTP). After that, whenever your balance falls to the first amount we'll charge your card or UPI the amount needed to reach the
          second, with an email {s.limits.noticeHours} hours before each charge. Top up to can be at most {inr(s.limits.maxTarget)}.
        </p>
        {s.lastError && <p className="at-meta is-error"><AlertTriangle size={15} aria-hidden="true" /> {s.lastError}</p>}
        <div className="at-actions">
          <button type="button" className="wallet-add-btn" onClick={setup} disabled={busy || !platform?.autoTopup}>
            {busy ? "Opening checkout…" : `Set up auto top-up · pay ${inr(setupAmount)}`}
          </button>
        </div>
      </>)}
    </div>
  );
};

export default AutoTopup;
