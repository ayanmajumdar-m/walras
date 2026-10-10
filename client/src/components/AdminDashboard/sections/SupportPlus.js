import React, { useCallback, useEffect, useState } from "react";
import { RefreshCw, Search, Phone, ChevronDown, ChevronUp, Clock } from "lucide-react";
import { adminApi } from "../adminApi";

/*
  Support → Support + (utils/supportPlus.js). Customers on Support +
  (₹2,000/month + GST) ask us to call them back. A request is pending until
  someone accepts it; accepting promises a call within 60 minutes (the
  customer sees that, and gets an email). Then it's completed, or declined.
  The customer can cancel a request while it's open.
*/

const TABS = [
  { id: "open", label: "Open" },
  { id: "completed", label: "Completed" },
  { id: "declined", label: "Declined" },
  { id: "cancelled", label: "Cancelled" },
  { id: "all", label: "All" },
  { id: "subscribers", label: "Subscribers" },
];

const STATUS = {
  pending: { label: "Waiting", cls: "is-pending" },
  accepted: { label: "Accepted", cls: "is-active" },
  completed: { label: "Completed", cls: "is-ticket-resolved" },
  declined: { label: "Declined", cls: "is-failed" },
  cancelled: { label: "Cancelled", cls: "is-ticket-closed" },
};
const CHOICES = ["pending", "accepted", "completed", "declined"];
const CHOICE_LABELS = { pending: "Waiting", accepted: "Accepted · call within 60 min", completed: "Completed", declined: "Declined" };

const when = (d) => (d ? new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "—");
const time = (d) => new Date(d).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
const ago = (d) => {
  const min = Math.max(0, Math.round((Date.now() - new Date(d).getTime()) / 60000));
  return min < 1 ? "just now" : min < 60 ? `${min} min ago` : min < 1440 ? `${Math.floor(min / 60)} h ${min % 60} min ago` : `${Math.floor(min / 1440)} d ago`;
};
const inr = (n) => `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// The note the customer sees, edited in the expanded row.
const NoteEditor = ({ r, onSave, busy }) => {
  const [note, setNote] = useState(r.adminNote);
  return (
    <div className="ap-sp-note">
      <label className="cx-field">
        <span>Note to the customer <small className="ap-muted">(shown on their Support page and in the accept / decline email)</small></span>
        <textarea rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Our engineer Rahul will call from +91 …" />
      </label>
      <button type="button" className="cx-btn cx-btn-ghost cx-btn-sm" disabled={busy || note === r.adminNote} onClick={() => onSave(note)}>Save note</button>
    </div>
  );
};

const SupportPlus = ({ openCustomer }) => {
  const [tab, setTab] = useState("open");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [data, setData] = useState(null);
  const [subs, setSubs] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(null);
  const [open, setOpen] = useState(null);
  const [, setTick] = useState(0);

  const load = useCallback(() => {
    if (tab === "subscribers") {
      adminApi("/support-plus/subscribers").then(setSubs).catch((e) => setNotice({ type: "error", text: e.message }));
      return;
    }
    adminApi(`/support-plus/callbacks?status=${tab}&search=${encodeURIComponent(query)}`)
      .then(setData).catch((e) => setNotice({ type: "error", text: e.message }));
  }, [tab, query]);

  useEffect(() => { setData(null); load(); }, [load]);
  // Search as you type, a moment after the last key.
  useEffect(() => { const t = setTimeout(() => setQuery(search.trim()), 300); return () => clearTimeout(t); }, [search]);
  // New requests need answering within the hour: keep the open list fresh.
  useEffect(() => {
    const t = setInterval(() => { setTick((n) => n + 1); if (tab === "open" && !busy) load(); }, 30000);
    return () => clearInterval(t);
  }, [tab, load, busy]);

  const save = async (r, status, note) => {
    if (status === "declined" && note === undefined) {
      const reason = window.prompt("Decline this call-back? Reason shown to the customer (optional):", r.adminNote || "");
      if (reason === null) return;
      note = reason;
    }
    setBusy(r.id);
    try {
      const d = await adminApi(`/support-plus/callbacks/${r.id}`, { method: "PUT", body: { status, ...(note !== undefined ? { note } : {}) } });
      setNotice({ type: "success", text: status === "accepted" && r.status !== "accepted" ? `Accepted. Call ${r.name} on ${r.phone} by ${time(d.request.callBy)}.` : d.message });
      load();
    } catch (e) {
      setNotice({ type: "error", text: e.message });
    } finally {
      setBusy(null);
    }
  };

  const counts = data?.counts || {};
  return (
    <div className="cx-page">
      <div className="cx-page-head cx-page-head-row">
        <div>
          <h2>Support +</h2>
          <p>Call-back requests from Support + customers. Accept a request when someone can call within 60 minutes (the customer is told to expect the call), then mark it completed.</p>
        </div>
        <div className="cx-welcome-actions">
          <button type="button" className="cx-btn cx-btn-ghost" onClick={load}><RefreshCw size={15} /> Refresh</button>
        </div>
      </div>

      {notice && <div className={`cx-alert is-${notice.type}`} role="status">{notice.text}</div>}

      {data && (
        <div className="ap-inv-summary">
          <div className="cx-card"><small>Waiting</small><strong>{counts.pending || 0}</strong><span>to accept or decline</span></div>
          <div className="cx-card"><small>Accepted</small><strong>{counts.accepted || 0}</strong><span>to call within 60 minutes</span></div>
          <div className="cx-card"><small>Subscribers</small><strong>{data.subscribers}</strong><span>on Support +</span></div>
        </div>
      )}

      <div className="ap-toolbar">
        <div className="ap-subtabs" role="tablist">
          {TABS.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={`ap-subtab${tab === t.id ? " is-active" : ""}`}
              onClick={() => { setTab(t.id); setOpen(null); }}>
              {t.label}{t.id === "open" && (counts.pending || 0) + (counts.accepted || 0) > 0 ? ` (${(counts.pending || 0) + (counts.accepted || 0)})` : ""}
            </button>
          ))}
        </div>
        {tab !== "subscribers" && (
          <label className="ap-search">
            <Search size={16} aria-hidden="true" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search customer, email, WALADMIN ID or phone" />
          </label>
        )}
      </div>

      {tab === "subscribers" ? (
        !subs ? <div className="cx-card cx-empty"><p>Loading subscribers…</p></div>
          : subs.subscribers.length === 0 ? <div className="cx-card cx-empty"><p>No one is on Support + yet.</p></div> : (
            <div className="cx-card cx-table-wrap">
              <table className="cx-table">
                <thead><tr><th>Customer</th><th>Since</th><th>Billing</th><th>Requests</th></tr></thead>
                <tbody>
                  {subs.subscribers.map((s) => (
                    <tr key={s.userId}>
                      <td data-label="Customer">
                        <button type="button" className="cx-link ap-link-btn" onClick={() => openCustomer(s.userId)}>{s.name}</button>
                        <small>{s.waladminId} · {s.email}{s.company ? ` · ${s.company}` : ""}</small>
                      </td>
                      <td data-label="Since">{when(s.startedAt)}</td>
                      <td data-label="Billing">
                        {inr(s.monthlyPrice)}/month + GST
                        <small className={s.cancelAt ? "is-warn" : ""}>{s.cancelAt ? `cancelled, ends ${when(s.cancelAt)}` : `paid until ${when(s.paidUntil)}`}</small>
                      </td>
                      <td data-label="Requests">{s.requests}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
      ) : !data ? <div className="cx-card cx-empty"><p>Loading requests…</p></div>
        : data.requests.length === 0 ? <div className="cx-card cx-empty"><p>{tab === "open" ? "No open call-back requests." : "No requests here."}</p></div> : (
          <div className="cx-card cx-table-wrap">
            <table className="cx-table">
              <thead><tr><th>Requested</th><th>Customer</th><th>Call</th><th>Status</th><th /></tr></thead>
              <tbody>
                {data.requests.map((r) => {
                  const st = STATUS[r.status];
                  const late = r.status === "accepted" && r.callBy && new Date() > new Date(r.callBy);
                  const isOpen = open === r.id;
                  return (
                    <React.Fragment key={r.id}>
                      <tr>
                        <td data-label="Requested">
                          <strong>{when(r.createdAt)}</strong>
                          <small>{r.status === "pending" ? ago(r.createdAt) : `#${r.id}`}</small>
                        </td>
                        <td data-label="Customer">
                          <button type="button" className="cx-link ap-link-btn" onClick={() => openCustomer(r.userId)}>{r.accountName}</button>
                          <small>{r.waladminId} · {r.accountEmail}{r.company ? ` · ${r.company}` : ""}</small>
                          {!r.plusActive && <small className="is-warn">Support + has ended</small>}
                        </td>
                        <td data-label="Call">
                          <a className="cx-link" href={`tel:${r.phone}`}><Phone size={14} aria-hidden="true" /> {r.phone}</a>
                          <small>{r.name}{r.requestedBy ? ` (team member ${r.requestedBy})` : ""}</small>
                          {r.note && <small className="ap-sp-cust-note">“{r.note.length > 90 && !isOpen ? `${r.note.slice(0, 90)}…` : r.note}”</small>}
                        </td>
                        <td data-label="Status">
                          {r.status === "cancelled" ? <span className={`cx-status ${st.cls}`}>{st.label}</span> : (
                            <select className="ap-select" value={r.status} disabled={busy === r.id} aria-label="Status"
                              onChange={(e) => save(r, e.target.value)}>
                              {CHOICES.map((c) => <option key={c} value={c}>{CHOICE_LABELS[c]}</option>)}
                            </select>
                          )}
                          {r.status === "accepted" && r.callBy && (
                            <small className={late ? "is-danger" : "is-warn"}><Clock size={12} aria-hidden="true" /> {late ? `call was due by ${time(r.callBy)}` : `call by ${time(r.callBy)}`}</small>
                          )}
                          {r.handledBy && <small>by {r.handledBy}</small>}
                        </td>
                        <td className="cx-actions">
                          <button type="button" className="cx-icon-btn" onClick={() => setOpen(isOpen ? null : r.id)} title={isOpen ? "Hide details" : "Details and note"}>
                            {isOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                          </button>
                        </td>
                      </tr>
                      {isOpen && (
                        <tr className="ap-inv-detail">
                          <td colSpan={5}>
                            <dl className="ap-sp-facts">
                              <div><dt>Requested</dt><dd>{when(r.createdAt)}</dd></div>
                              <div><dt>Accepted</dt><dd>{when(r.acceptedAt)}</dd></div>
                              <div><dt>Closed</dt><dd>{when(r.closedAt)}</dd></div>
                              <div><dt>Last change</dt><dd>{when(r.updatedAt)}{r.handledBy ? ` by ${r.handledBy}` : ""}</dd></div>
                            </dl>
                            {r.note && <p className="ap-sp-full-note"><strong>Customer's note:</strong> {r.note}</p>}
                            {r.status !== "cancelled" && <NoteEditor key={r.adminNote} r={r} busy={busy === r.id} onSave={(note) => save(r, r.status, note)} />}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
    </div>
  );
};

export default SupportPlus;
