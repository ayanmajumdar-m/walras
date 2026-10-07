import React, { useCallback, useEffect, useState } from "react";
import { Send, Mail, RefreshCw, Square, Play, AlertTriangle, Search, X } from "lucide-react";
import { adminApi } from "../adminApi";

/*
  Email customers: write one message and send it to every customer in an
  audience. Only verified, non-suspended accounts receive it; "News & offers"
  also skips people who unsubscribed. Sends in the background with progress,
  and can be stopped or resumed.
*/

const STATUS = {
  sending: { label: "Sending", cls: "is-pending" },
  sent: { label: "Sent", cls: "is-active" },
  interrupted: { label: "Interrupted", cls: "is-failed" },
  cancelled: { label: "Stopped", cls: "is-stopped" },
};

const formatDate = (d) =>
  d ? new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";

// Find and pick one customer to email (audience "single").
const CustomerPicker = ({ value, onChange, category }) => {
  const [term, setTerm] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const q = term.trim();
    if (q.length < 2) { setResults([]); return undefined; }
    setSearching(true);
    const t = setTimeout(() => {
      adminApi(`/bulk-email/customers?q=${encodeURIComponent(q)}`)
        .then((d) => setResults(d.customers || []))
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 250);
    return () => clearTimeout(t);
  }, [term]);

  if (value) {
    return (
      <div className="ap-picked">
        <span className="cx-avatar" aria-hidden="true">{(value.name || value.email)[0].toUpperCase()}</span>
        <span className="ap-picked-text">
          <strong>{value.name || value.email}</strong>
          <small>{value.email}{value.waladminId ? ` · ${value.waladminId}` : ""}</small>
          {value.suspended && <small className="is-warn">Suspended account</small>}
          {!value.verified && <small className="is-warn">Email address not verified</small>}
          {category === "marketing" && value.unsubscribed && <small className="is-danger">Unsubscribed from news and offers: won't receive this kind</small>}
        </span>
        <button type="button" className="cx-icon-btn" onClick={() => onChange(null)} aria-label="Choose someone else"><X size={15} /></button>
      </div>
    );
  }

  return (
    <div className="ap-picker">
      <span className="ap-picker-input">
        <Search size={15} aria-hidden="true" />
        <input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search by name, email or WALADMIN ID" autoComplete="off" aria-label="Find a customer" />
      </span>
      {term.trim().length >= 2 && (
        <ul className="ap-picker-list">
          {results.length === 0 ? (
            <li className="ap-muted">{searching ? "Searching…" : "No customers match."}</li>
          ) : results.map((u) => (
            <li key={u.id}>
              <button type="button" onClick={() => { onChange(u); setTerm(""); }}>
                <strong>{u.name || u.email}</strong>
                <small>{u.email}{u.waladminId ? ` · ${u.waladminId}` : ""}{u.suspended ? " · suspended" : ""}{!u.verified ? " · unverified" : ""}</small>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const BulkEmail = () => {
  const [data, setData] = useState(null);
  const [notice, setNotice] = useState(null);
  const [form, setForm] = useState({ subject: "", body: "", category: "announcement", audience: "all" });
  const [testTo, setTestTo] = useState("");
  const [busy, setBusy] = useState("");
  const [customer, setCustomer] = useState(null); // audience "single"

  const load = useCallback(() => {
    adminApi("/bulk-email").then(setData).catch((e) => setNotice({ type: "error", text: e.message }));
  }, []);
  useEffect(load, [load]);

  // Refresh progress while something is sending.
  const sending = data?.campaigns.some((c) => c.status === "sending");
  useEffect(() => {
    if (!sending) return undefined;
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [sending, load]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const single = form.audience === "single";
  const count = single
    ? (customer && !(form.category === "marketing" && customer.unsubscribed) ? 1 : 0)
    : data?.counts?.[form.audience]?.[form.category] ?? 0;
  const payload = { ...form, ...(single && customer ? { targetUserId: customer.id } : {}) };
  const valid = form.subject.trim().length >= 3 && form.body.trim().length >= 10;

  const act = async (key, fn) => {
    setBusy(key);
    setNotice(null);
    try {
      const d = await fn();
      setNotice({ type: "success", text: d.message });
      load();
      return d;
    } catch (e) {
      setNotice({ type: "error", text: e.message });
      return null;
    } finally {
      setBusy("");
    }
  };

  const sendTest = () => act("test", () => adminApi("/bulk-email/test", { method: "POST", body: { ...payload, to: testTo } }));

  const sendAll = async () => {
    const question = single
      ? `Send "${form.subject.trim()}" to ${customer.name || customer.email} <${customer.email}>?`
      : `Send "${form.subject.trim()}" to ${count} customer${count === 1 ? "" : "s"} (${data.audiences[form.audience].label.toLowerCase()})?\n\nThis can't be undone once it starts, though you can stop it part way.`;
    if (!window.confirm(question)) return;
    const d = await act("send", () => adminApi("/bulk-email", { method: "POST", body: { ...payload, expectedCount: count } }));
    if (d) setForm((f) => ({ ...f, subject: "", body: "" }));
  };

  if (!data) {
    return <div className="cx-page">{notice ? <div className="cx-alert is-error">{notice.text}</div> : <div className="cx-card cx-empty"><p>Loading…</p></div>}</div>;
  }

  return (
    <div className="cx-page">
      <div className="cx-page-head cx-page-head-row">
        <div>
          <h2>Email customers</h2>
          <p>Send one message to every customer in an audience. Only verified, active accounts receive it.</p>
        </div>
        <button type="button" className="cx-btn cx-btn-ghost" onClick={load}><RefreshCw size={15} /> Refresh</button>
      </div>

      {notice && <div className={`cx-alert is-${notice.type}`} role="status">{notice.text}</div>}
      {!data.emailConfigured && (
        <div className="cx-alert is-error"><AlertTriangle size={16} /> Email isn't configured on the server (SMTP settings), so nothing can be sent.</div>
      )}

      <div className="ap-bulk-grid">
        <section className="cx-card ap-card">
          <h3><Mail size={18} /> New email</h3>

          <div className="cx-field">
            <span>Kind of email</span>
            <div className="ap-choice">
              {Object.entries(data.categories).map(([key, { label, desc }]) => (
                <label key={key} className={`ap-choice-item${form.category === key ? " is-on" : ""}`}>
                  <input type="radio" name="bulk-category" checked={form.category === key} onChange={() => setForm((f) => ({ ...f, category: key }))} />
                  <span><strong>{label}</strong><small>{desc}</small></span>
                </label>
              ))}
            </div>
          </div>

          <label className="cx-field">
            <span>Send to</span>
            <select className="ap-select" value={form.audience} onChange={set("audience")}>
              {Object.entries(data.audiences).map(([key, { label }]) => (
                <option key={key} value={key}>{label}{data.counts[key] ? ` (${data.counts[key][form.category]})` : ""}</option>
              ))}
            </select>
          </label>

          {single && (
            <div className="cx-field">
              <span>Customer</span>
              <CustomerPicker value={customer} onChange={setCustomer} category={form.category} />
            </div>
          )}

          <label className="cx-field">
            <span>Subject</span>
            <input value={form.subject} onChange={set("subject")} maxLength={200} placeholder="Scheduled maintenance on 12 October" />
          </label>

          <label className="cx-field">
            <span>Message</span>
            <textarea className="ap-textarea" value={form.body} onChange={set("body")} rows={12} maxLength={20000}
              placeholder={"Hi {{name}},\n\nWe're upgrading our Mumbai network on 12 October between 02:00 and 03:00 IST…\n\nThe Walras Cloud team"} />
            <small className="ap-muted">Plain text. Leave a blank line between paragraphs; links become clickable. <code>{"{{name}}"}</code> becomes each customer's first name.</small>
          </label>

          <div className="ap-bulk-test">
            <input type="email" value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="you@walras.net" aria-label="Send a test to" />
            <button type="button" className="cx-btn cx-btn-ghost" onClick={sendTest} disabled={!valid || !testTo || busy !== ""}>
              <Mail size={15} /> {busy === "test" ? "Sending…" : "Send test"}
            </button>
          </div>

          <div className="ap-card-foot ap-bulk-foot">
            <span className="ap-muted">{single ? (customer ? (count ? customer.email : "Unsubscribed from news and offers") : "Choose a customer") : `${count} recipient${count === 1 ? "" : "s"}`}</span>
            <button type="button" className="cx-btn cx-btn-primary" onClick={sendAll} disabled={!valid || count === 0 || busy !== "" || sending || !data.emailConfigured}>
              <Send size={15} /> {busy === "send" ? "Starting…" : single ? "Send email" : `Send to ${count}`}
            </button>
          </div>
          {sending && <p className="ap-muted">Another email is sending. You can send the next one when it finishes.</p>}
        </section>

        <section className="cx-card ap-card">
          <h3>Sent emails</h3>
          {data.campaigns.length === 0 ? (
            <p className="ap-muted">Nothing sent yet.</p>
          ) : (
            <div className="ap-bulk-list">
              {data.campaigns.map((c) => {
                const done = c.sent + c.failed;
                const pct = c.total ? Math.min(100, Math.round((done / c.total) * 100)) : 100;
                const st = STATUS[c.status] || { label: c.status, cls: "" };
                return (
                  <div key={c.id} className="ap-bulk-item">
                    <div className="ap-bulk-item-head">
                      <strong>{c.subject}</strong>
                      <span className={`cx-status ${st.cls}`}>{st.label}</span>
                    </div>
                    <small className="ap-muted">
                      {data.categories[c.category]?.label} · {c.audience === "single" ? (c.target_email || "One customer") : data.audiences[c.audience]?.label || c.audience} · {c.created_by_name || "Admin"} · {formatDate(c.created_at)}
                    </small>
                    <div className="ap-progress" aria-label={`${pct}% sent`}><span style={{ width: `${pct}%` }} /></div>
                    <small>
                      {c.sent} sent{c.failed ? ` · ${c.failed} failed` : ""} of {c.total}
                      {c.failed > 0 && c.last_error ? ` · last error: ${c.last_error}` : ""}
                    </small>
                    {(c.status === "sending" || c.status === "interrupted") && (
                      <div className="ap-bulk-actions">
                        {c.status === "interrupted" && (
                          <button type="button" className="cx-btn cx-btn-ghost cx-btn-sm" disabled={busy !== ""}
                            onClick={() => act(`resume${c.id}`, () => adminApi(`/bulk-email/${c.id}/resume`, { method: "POST" }))}>
                            <Play size={13} /> Resume
                          </button>
                        )}
                        <button type="button" className="cx-btn cx-btn-ghost cx-btn-sm" disabled={busy !== ""}
                          onClick={() => window.confirm("Stop sending? Customers who haven't received it yet won't get it.") &&
                            act(`cancel${c.id}`, () => adminApi(`/bulk-email/${c.id}/cancel`, { method: "POST" }))}>
                          <Square size={13} /> Stop
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default BulkEmail;
