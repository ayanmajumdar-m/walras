import React, { useCallback, useEffect, useState } from "react";
import { RefreshCw, X, CheckCircle2, Undo2, Pencil } from "lucide-react";
import { adminApi } from "../adminApi";

/*
  Managed Database → Databases: customers' databases. No provisioning
  integration yet, so each new order waits as Provisioning: set it up, then
  "Mark ready" with its connection details (the customer is emailed and sees
  them in Resources → Databases; the password is stored encrypted). One that
  can't be set up is removed with "Refund", which returns its purchase to the
  customer's balance and its stock unit.
*/

const TABS = [["provisioning", "Provisioning"], ["active", "Active"], ["", "All"]];
const when = (d) => (d ? new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }) : "—");
const DEFAULT_PORT = { mysql: 3306, postgresql: 5432 };

const ReadyForm = ({ db, onDone, onClose }) => {
  const [f, setF] = useState({
    host: db.host, port: db.port || DEFAULT_PORT[db.engine] || "", database: db.database || db.name.replace(/-/g, "_"),
    user: db.user || "", password: "", note: db.note,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const d = await adminApi(`/db/databases/${db.id}/ready`, {
        method: "PUT",
        body: { host: f.host.trim(), port: Number(f.port), database: f.database.trim(), user: f.user.trim(), ...(f.password ? { password: f.password } : {}), note: f.note },
      });
      onDone(d.message);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="cx-modal-scrim" onClick={onClose}>
      <div className="cx-modal ap-plan-modal" role="dialog" aria-modal="true" aria-label="Database details" onClick={(e) => e.stopPropagation()}>
        <div className="cx-modal-head">
          <h3>{db.status === "active" ? `Edit ${db.name}` : `Mark ${db.name} ready`}</h3>
          <button type="button" className="cx-icon-btn" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <form className="ap-plan-form" onSubmit={submit}>
          {error && <div className="cx-alert is-error">{error}</div>}
          <p className="ap-muted">{db.engineLabel} · {db.plan} · {db.location} · {db.customer} ({db.waladminId})</p>
          <div className="ap-plan-grid">
            <label className="cx-field"><span>Host</span><input value={f.host} onChange={set("host")} placeholder="db1.walras.net or 203.0.113.10" required autoFocus /></label>
            <label className="cx-field"><span>Port</span><input type="number" min="1" max="65535" value={f.port} onChange={set("port")} required /></label>
            <label className="cx-field"><span>Database name</span><input value={f.database} onChange={set("database")} maxLength={64} required /></label>
            <label className="cx-field"><span>User</span><input value={f.user} onChange={set("user")} maxLength={64} required autoComplete="off" /></label>
            <label className="cx-field">
              <span>Password</span>
              <input type="text" value={f.password} onChange={set("password")} maxLength={128} autoComplete="off" spellCheck="false"
                placeholder={db.hasPassword ? "Leave empty to keep the current one" : "8 to 128 characters"} required={!db.hasPassword} />
              <small className="ap-muted">Stored encrypted. The customer can reveal it in their console.</small>
            </label>
            <label className="cx-field"><span>Note to the customer (optional)</span><input value={f.note} onChange={set("note")} maxLength={500} placeholder="e.g. Connections allowed from any IP over SSL" /></label>
          </div>
          <div className="ap-plan-actions">
            <span className="ap-plan-spacer" />
            <button type="button" className="cx-btn cx-btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
            <button type="submit" className="cx-btn cx-btn-primary" disabled={busy}>{busy ? "Saving…" : db.status === "active" ? "Save details" : "Mark ready and email customer"}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

const DbDatabases = ({ can, openCustomer }) => {
  const [tab, setTab] = useState("provisioning");
  const [data, setData] = useState(null);
  const [notice, setNotice] = useState(null);
  const [editing, setEditing] = useState(null);
  const manage = can("manage_services");

  const load = useCallback(() => {
    adminApi(`/db/databases?status=${tab}`).then(setData).catch((e) => setNotice({ type: "error", text: e.message }));
  }, [tab]);
  useEffect(() => { setData(null); load(); }, [load]);

  const refund = async (d) => {
    if (!window.confirm(`Remove ${d.name} for ${d.customer} and refund its purchase to their account balance? Its stock unit is returned. This can't be undone.`)) return;
    try {
      setNotice({ type: "success", text: (await adminApi(`/db/databases/${d.id}/refund`, { method: "POST" })).message });
      load();
    } catch (e) { setNotice({ type: "error", text: e.message }); }
  };

  return (
    <div className="cx-page">
      <div className="cx-page-head cx-page-head-row">
        <div>
          <h2>Managed Databases</h2>
          <p>Customers' databases. New orders wait as Provisioning: set each one up, then mark it ready with its connection details.</p>
        </div>
        <button type="button" className="cx-btn cx-btn-ghost" onClick={load}><RefreshCw size={15} /> Refresh</button>
      </div>
      {notice && <div className={`cx-alert is-${notice.type}`} role="status">{notice.text}</div>}
      {data && (
        <div className="ap-inv-summary">
          <div className="cx-card"><small>Provisioning</small><strong>{data.counts.provisioning}</strong><span>waiting to be set up</span></div>
          <div className="cx-card"><small>Active</small><strong>{data.counts.active}</strong><span>running</span></div>
          <div className="cx-card"><small>Total</small><strong>{data.counts.total}</strong><span>databases</span></div>
        </div>
      )}
      <div className="ap-subtabs" role="tablist">
        {TABS.map(([id, label]) => (
          <button key={id || "all"} type="button" role="tab" aria-selected={tab === id} className={`ap-subtab${tab === id ? " is-active" : ""}`} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>
      {!data ? <div className="cx-card cx-empty"><p>Loading databases…</p></div> : data.databases.length === 0 ? (
        <div className="cx-card cx-empty"><p>{tab === "provisioning" ? "Nothing waiting to be set up." : "No databases here."}</p></div>
      ) : (
        <div className="cx-card cx-table-wrap">
          <table className="cx-table">
            <thead><tr><th>Database</th><th>Customer</th><th>Plan</th><th>Status</th><th>Connection</th><th /></tr></thead>
            <tbody>
              {data.databases.map((d) => (
                <tr key={d.id}>
                  <td data-label="Database"><strong>{d.name}</strong><small>{d.engineLabel} · ordered {when(d.createdAt)}</small></td>
                  <td data-label="Customer">
                    <button type="button" className="cx-link ap-link-btn" onClick={() => openCustomer(d.userId)}>{d.customer}</button>
                    <small>{d.waladminId} · {d.email}</small>
                  </td>
                  <td data-label="Plan">{d.plan}<small>{d.location} · ₹{d.monthlyCost.toLocaleString("en-IN")}/mo</small></td>
                  <td data-label="Status">
                    <span className={`cx-status ${d.status === "active" ? "is-active" : d.status === "failed" ? "is-failed" : "is-pending"}`}>{d.status}</span>
                    {d.suspended && <small className="is-danger">suspended (unpaid invoice)</small>}
                    {d.cancelAt && <small className="is-warn">cancelled, ends {when(d.cancelAt)}</small>}
                    {d.readyAt && <small>ready {when(d.readyAt)}</small>}
                  </td>
                  <td data-label="Connection">{d.host ? <><code>{d.host}:{d.port}</code><small>{d.database} · {d.user}</small></> : "—"}</td>
                  <td className="cx-actions">
                    {manage && (d.status === "active"
                      ? <button type="button" className="cx-icon-btn" onClick={() => setEditing(d)} title="Edit connection details"><Pencil size={15} /></button>
                      : <button type="button" className="cx-btn cx-btn-primary cx-btn-sm" onClick={() => setEditing(d)}><CheckCircle2 size={14} /> Mark ready</button>)}
                    {manage && !d.readyAt && (
                      <button type="button" className="cx-icon-btn is-danger" onClick={() => refund(d)} title="Remove and refund"><Undo2 size={15} /></button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && <ReadyForm db={editing} onDone={(m) => { setEditing(null); setNotice({ type: "success", text: m }); load(); }} onClose={() => setEditing(null)} />}
    </div>
  );
};

export default DbDatabases;
