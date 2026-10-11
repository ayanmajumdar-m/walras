import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PhoneCall, Check, RefreshCw, X, Clock, Headphones } from "lucide-react";
import { api } from "../consoleApi";
import { useConsole } from "../ConsoleContext";

/*
  Support + on the Support page (utils/supportPlus.js): priority phone
  support for ₹2,000/month + GST, billed with the monthly services invoice.
  Not on: an offer to enable it. On: request a call back (name and phone come
  from the account and can be changed) and follow the request: requested →
  accepted ("you will get a call within 60 minutes") → completed.
*/

const POLL_MS = 15000;

const inr = (n) => `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const price = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const day = (d) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "long" });
const time = (d) => new Date(d).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
const stamp = (d) => new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

const STATUS = {
  pending: { label: "Requested", cls: "is-pending" },
  accepted: { label: "Accepted", cls: "is-active" },
  completed: { label: "Completed", cls: "is-ticket-resolved" },
  declined: { label: "Declined", cls: "is-failed" },
  cancelled: { label: "Cancelled", cls: "is-ticket-closed" },
};

// Links that fix the usual reasons enabling fails.
const ErrorHelp = ({ error }) => {
  if (error?.data?.insufficient) return <Link to="/dashboard/billing?tab=wallet" className="cx-btn cx-btn-primary cx-btn-sm">Add funds</Link>;
  if (error?.data?.overdue || error?.data?.suspended) return <Link to="/dashboard/billing?tab=invoices" className="cx-btn cx-btn-primary cx-btn-sm">Pay invoice</Link>;
  return null;
};

// ── Not on yet: a quiet, optional add-on (tickets stay free) ────────────────
const Offer = ({ data, onEnabled }) => {
  const { balance, refreshBalance } = useConsole();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const q = data.quote;

  const enable = async () => {
    setBusy(true);
    setError(null);
    try {
      await api("/api/support/plus", { method: "POST" });
      refreshBalance();
      onEnabled("Support+ is on. You can request a call back now.");
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="cx-card cx-splus-mini" aria-labelledby="splus-title">
      <div className="cx-splus-mini-row">
        <span className="cx-splus-mini-icon"><Headphones size={18} aria-hidden="true" /></span>
        <div className="cx-splus-mini-text">
          <h4 id="splus-title">Prefer to talk on the phone? <span className="cx-pill">Optional add-on</span></h4>
          <p>Ticket support is free for every account. If you'd also like phone call-backs, Support+ adds them for {price(data.price)}/month + GST.</p>
        </div>
        <button type="button" className="cx-btn cx-btn-ghost cx-btn-sm" onClick={() => setOpen(!open)} aria-expanded={open}>
          {open ? "Hide" : "About Support+"}
        </button>
      </div>
      {open && (
        <div className="cx-splus-mini-more">
          <p><strong>Needed help? Yes, we are there!</strong> With Support+ you can ask a Walras engineer to call you back from this page; once we accept the request, you'll get a call within {data.callWithinMinutes} minutes.</p>
          <p className="cx-splus-hint">
            It's charged up front: enabling it today costs the full {price(data.price)} + {inr(q.tax)} GST = {inr(q.total)}, paid from your account balance ({inr(balance)}),
            and it runs until {day(q.paidUntil)}. From then, {price(data.price)} + GST is added to your monthly services invoice on the 1st. Cancel anytime.
          </p>
          <div className="cx-splus-confirm-actions">
            <button type="button" className="cx-btn cx-btn-ghost" onClick={enable} disabled={busy || !data.canManage}>
              {busy ? <RefreshCw size={15} className="cx-spin" /> : <PhoneCall size={15} />} Enable Support+
            </button>
          </div>
          {!data.canManage && <p className="cx-splus-hint">Ask an account admin, or someone with Billing access, to enable it.</p>}
          {error && (
            <div className="cx-alert is-error" role="alert">
              <span>{error.message}</span>
              <ErrorHelp error={error} />
            </div>
          )}
        </div>
      )}
    </section>
  );
};

// ── An open request: where it is ──────────────────────────────────────────
const Tracker = ({ request, onCancel, busy }) => {
  const accepted = request.status === "accepted";
  const steps = [
    { label: "Requested", at: request.createdAt, done: true },
    { label: "Accepted", at: request.acceptedAt, done: accepted },
    { label: "Call", at: null, done: false },
  ];
  return (
    <div className={`cx-splus-tracker${accepted ? " is-accepted" : ""}`} role="status" aria-live="polite">
      <ol className="cx-splus-steps">
        {steps.map((s, i) => (
          <li key={s.label} className={s.done ? "is-done" : i === steps.findIndex((x) => !x.done) ? "is-current" : ""}>
            <span className="cx-splus-dot">{s.done ? <Check size={13} /> : i + 1}</span>
            <span>{s.label}{s.at ? <small>{time(s.at)}</small> : null}</span>
          </li>
        ))}
      </ol>
      {accepted ? (
        <div className="cx-splus-callnote">
          <PhoneCall size={22} aria-hidden="true" />
          <div>
            <strong>You will get a call within 60 minutes</strong>
            <p>We'll call {request.name} on {request.phone}{request.callBy ? `, by ${time(request.callBy)}` : ""}.</p>
          </div>
        </div>
      ) : (
        <div className="cx-splus-callnote is-waiting">
          <Clock size={22} aria-hidden="true" />
          <div>
            <strong>Request received</strong>
            <p>We'll confirm it here shortly, and by email. Then you'll get a call within 60 minutes on {request.phone}.</p>
          </div>
        </div>
      )}
      {request.reply && <p className="cx-splus-reply"><strong>From Walras Support:</strong> {request.reply}</p>}
      <div className="cx-splus-tracker-actions">
        <button type="button" className="cx-btn cx-btn-ghost cx-btn-sm" onClick={onCancel} disabled={busy}>
          <X size={14} /> Cancel request
        </button>
      </div>
    </div>
  );
};

// ── The call-back form ────────────────────────────────────────────────────
const RequestForm = ({ contact, onDone, notify, disabled }) => {
  const [name, setName] = useState(contact.name);
  const [phone, setPhone] = useState(contact.phone);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (name.trim().length < 2) return notify("Enter the name of the person we should ask for.", "error");
    if (!/^\+?\d{7,15}$/.test(phone.replace(/[\s\-().]/g, ""))) return notify("Enter a valid phone number, e.g. +91 98765 43210.", "error");
    setBusy(true);
    try {
      await api("/api/support/callbacks", { method: "POST", body: { name: name.trim(), phone: phone.trim(), note: note.trim() } });
      setNote("");
      onDone("Call-back requested. We'll confirm shortly.");
    } catch (err) {
      notify(err.message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="cx-splus-form" onSubmit={submit}>
      <h4>Request a call back</h4>
      <p className="cx-splus-hint">We've filled in the name and phone number on your account. Change them if someone else should take the call.</p>
      <div className="cx-splus-fields">
        <label className="cx-field">
          <span>Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} autoComplete="name" required />
        </label>
        <label className="cx-field">
          <span>Phone number</span>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={20} inputMode="tel" autoComplete="tel" placeholder="+91 98765 43210" required />
        </label>
      </div>
      <label className="cx-field">
        <span>What's it about? <small>(optional)</small></span>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={2} placeholder="e.g. My server web1 isn't reachable since this morning" />
      </label>
      <div className="cx-ticket-actions">
        <button type="submit" className="cx-btn cx-btn-primary" disabled={busy || disabled}>
          {busy ? <RefreshCw size={15} className="cx-spin" /> : <PhoneCall size={15} />} Request a call back
        </button>
      </div>
    </form>
  );
};

// ── On: manage and request ────────────────────────────────────────────────
const Active = ({ data, reload, notify }) => {
  const sub = data.subscription;
  const [busy, setBusy] = useState(false);
  const recent = data.callbacks.filter((c) => c.id !== data.open?.id).slice(0, 5);

  const run = async (path, method, done, confirmText) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    try {
      await api(path, { method });
      notify(done, "success");
      reload();
    } catch (e) {
      notify(e.message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="cx-card cx-splus" aria-label="Support +">
      <div className="cx-splus-head">
        <span className="cx-splus-icon"><Headphones size={20} aria-hidden="true" /></span>
        <div className="cx-splus-title">
          <h3>Support + <span className={`cx-status ${sub.cancelAt ? "is-pending" : "is-active"}`}>{sub.cancelAt ? "Cancelled" : "Active"}</span></h3>
          <small>
            {sub.cancelAt
              ? `Ends on ${day(sub.cancelAt)}. It won't be renewed.`
              : `${price(sub.monthlyPrice)}/month + GST, on your services invoice. Paid until ${day(sub.paidUntil)}.`}
          </small>
        </div>
        {data.canManage && (sub.cancelAt ? (
          <button type="button" className="cx-btn cx-btn-ghost cx-btn-sm" disabled={busy}
            onClick={() => run("/api/support/plus/keep", "POST", "Support + will continue.")}>Keep Support +</button>
        ) : (
          <button type="button" className="cx-btn cx-btn-ghost cx-btn-sm" disabled={busy}
            onClick={() => run("/api/support/plus", "DELETE", "Support + is cancelled. It stays on until the end of the month you've paid for.",
              `Cancel Support +? It stays on until ${day(sub.paidUntil)} and isn't renewed. There's no refund for the rest of this month.`)}>
            Cancel Support +
          </button>
        ))}
      </div>

      {data.suspended && (
        <div className="cx-alert is-error" role="status">
          <span>Support + is paused while your services are suspended for an unpaid invoice.</span>
          <Link to="/dashboard/billing?tab=invoices" className="cx-btn cx-btn-primary cx-btn-sm">Pay invoice</Link>
        </div>
      )}

      {data.open ? (
        <Tracker request={data.open} busy={busy}
          onCancel={() => run(`/api/support/callbacks/${data.open.id}/cancel`, "POST", "Request cancelled.", "Cancel this call-back request?")} />
      ) : (
        <RequestForm contact={data.contact} disabled={data.suspended} notify={notify} onDone={(m) => { notify(m, "success"); reload(); }} />
      )}

      {recent.length > 0 && (
        <div className="cx-splus-recent">
          <h4>Recent requests</h4>
          <ul>
            {recent.map((c) => (
              <li key={c.id}>
                <span>{stamp(c.createdAt)} · {c.phone}</span>
                <span className={`cx-status ${STATUS[c.status].cls}`}>{STATUS[c.status].label}</span>
                {c.reply && <small>From Walras Support: {c.reply}</small>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
};

/** Support+ state for the Support page, refreshed while a request is open. */
export const useSupportPlus = () => {
  const [data, setData] = useState(null);
  const load = useCallback(() => {
    api("/api/support/plus").then(setData).catch(() => {});
  }, []);
  useEffect(load, [load]);
  const waiting = Boolean(data?.open);
  useEffect(() => {
    if (!waiting) return undefined;
    const t = setInterval(() => { if (!document.hidden) load(); }, POLL_MS);
    return () => clearInterval(t);
  }, [waiting, load]);
  return { data, load };
};

// Subscribers: the call-back card, at the top of the page.
export const SupportPlusActive = ({ plus, notify }) => (plus.data?.subscription.active
  ? <Active data={plus.data} reload={plus.load} notify={notify} /> : null);

// Everyone else: the optional add-on, below the tickets.
export const SupportPlusOffer = ({ plus, notify }) => (plus.data && !plus.data.subscription.active
  ? <Offer data={plus.data} onEnabled={(m) => { notify(m, "success"); plus.load(); window.scrollTo(0, 0); }} /> : null);
