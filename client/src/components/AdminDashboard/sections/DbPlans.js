import React, { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2, X, Eye, EyeOff, RefreshCw } from "lucide-react";
import { adminApi } from "../adminApi";
import { formatRam, formatStorage, formatBackups } from "../../../data/plans";

/*
  Managed Database → Plans: General Purpose plans and prices, as customers see
  them on Pricing and in the console, and as they're charged (any engine).
  Like VM plans: a name is fixed once created; a plan any database used can
  only be hidden. Databases already running keep the price they were bought at.
*/

const EMPTY = { name: "", vcpu: "", ram: "", storage: "", backupDays: "7", monthly: "", sortOrder: "", active: true };

const Field = ({ label, hint, children }) => (
  <label className="cx-field">
    <span>{label}</span>
    {children}
    {hint && <small className="ap-muted">{hint}</small>}
  </label>
);

const PlanForm = ({ initial, editing, onDone, onClose }) => {
  const [f, setF] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const body = {
      vcpu: f.vcpu, ram: f.ram, storage: f.storage, backupDays: f.backupDays, monthly: f.monthly, active: f.active,
      ...(f.sortOrder !== "" ? { sortOrder: f.sortOrder } : {}),
      ...(editing ? {} : { name: f.name.trim() }),
    };
    try {
      const d = editing
        ? await adminApi(`/db/plans/${initial.id}`, { method: "PUT", body })
        : await adminApi("/db/plans", { method: "POST", body });
      onDone(d.message);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(`Delete ${initial.name}? Its stock is removed too. This can't be undone.`)) return;
    setBusy(true);
    try {
      onDone((await adminApi(`/db/plans/${initial.id}`, { method: "DELETE" })).message);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="cx-modal-scrim" onClick={onClose}>
      <div className="cx-modal ap-plan-modal" role="dialog" aria-modal="true" aria-label="Database plan" onClick={(e) => e.stopPropagation()}>
        <div className="cx-modal-head">
          <h3>{editing ? `Edit ${initial.name}` : "Add a database plan"}</h3>
          <button type="button" className="cx-icon-btn" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <form className="ap-plan-form" onSubmit={submit}>
          {error && <div className="cx-alert is-error">{error}</div>}
          <div className="ap-plan-grid">
            {editing ? (
              <Field label="Plan name" hint="Can't be changed. Hide this plan and add a new one to rename."><input value={initial.name} disabled /></Field>
            ) : (
              <Field label="Plan name" hint="e.g. MDsIN_xlarge. Can't be changed later."><input value={f.name} onChange={set("name")} maxLength={40} required autoFocus /></Field>
            )}
            <Field label="vCPUs" hint="0.5 = half a core"><input type="number" min="0.1" step="0.1" value={f.vcpu} onChange={set("vcpu")} required /></Field>
            <Field label="RAM (GB)" hint="0.5 = 512 MB"><input type="number" min="0.25" step="0.25" value={f.ram} onChange={set("ram")} required /></Field>
            <Field label="Storage (GB)" hint="0.5 = 500 MB"><input type="number" min="0.1" step="0.1" value={f.storage} onChange={set("storage")} required /></Field>
            <Field label="Backup retention (days)" hint="Daily backups kept this long. 0 = none."><input type="number" min="0" step="1" value={f.backupDays} onChange={set("backupDays")} required /></Field>
            <Field label="Price (₹ / month)" hint="Excluding GST."><input type="number" min="1" step="0.01" value={f.monthly} onChange={set("monthly")} required /></Field>
            <Field label="Order" hint="Lower shows first."><input type="number" step="1" value={f.sortOrder} onChange={set("sortOrder")} /></Field>
          </div>
          <label className="ap-plan-active">
            <input type="checkbox" checked={f.active} onChange={set("active")} />
            <span><strong>Visible and on sale</strong><small>Hidden plans aren't shown or sold. Databases already on them keep running.</small></span>
          </label>
          <div className="ap-plan-actions">
            {editing && (
              <button type="button" className="cx-btn cx-btn-ghost is-danger" onClick={remove} disabled={busy || initial.databases > 0}
                title={initial.databases > 0 ? "Used by databases: hide it instead" : "Delete this plan"}>
                <Trash2 size={15} /> Delete
              </button>
            )}
            <span className="ap-plan-spacer" />
            <button type="button" className="cx-btn cx-btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
            <button type="submit" className="cx-btn cx-btn-primary" disabled={busy}>{busy ? "Saving…" : editing ? "Save plan" : "Add plan"}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

const DbPlans = ({ can }) => {
  const [data, setData] = useState(null);
  const [notice, setNotice] = useState(null);
  const [editing, setEditing] = useState(null);
  const editable = can("manage_plans");

  const load = useCallback(() => {
    adminApi("/db/plans").then(setData).catch((e) => setNotice({ type: "error", text: e.message }));
  }, []);
  useEffect(load, [load]);

  const done = (text) => { setEditing(null); setNotice({ type: "success", text }); load(); };
  const toggle = async (p) => {
    try {
      const d = await adminApi(`/db/plans/${p.id}`, { method: "PUT", body: { active: !p.active } });
      setNotice({ type: "success", text: `${d.message} ${p.active ? "Hidden from customers." : "Visible to customers."}` });
      load();
    } catch (e) { setNotice({ type: "error", text: e.message }); }
  };

  return (
    <div className="cx-page">
      <div className="cx-page-head cx-page-head-row">
        <div>
          <h2>Database plans</h2>
          <p>Managed Database → General Purpose. The same plan and price for MySQL and PostgreSQL.</p>
        </div>
        <div className="cx-welcome-actions">
          <button type="button" className="cx-btn cx-btn-ghost" onClick={load}><RefreshCw size={15} /> Refresh</button>
          {editable && <button type="button" className="cx-btn cx-btn-primary" onClick={() => setEditing("new")}><Plus size={16} /> Add plan</button>}
        </div>
      </div>
      {notice && <div className={`cx-alert is-${notice.type}`} role="status">{notice.text}</div>}
      {!data ? <div className="cx-card cx-empty"><p>Loading plans…</p></div> : data.plans.length === 0 ? (
        <div className="cx-card cx-empty"><p>No plans yet. Customers see "Managed Database plans are coming soon".</p></div>
      ) : (
        <div className="cx-card cx-table-wrap">
          <table className="cx-table ap-plan-table">
            <thead><tr><th>Plan</th><th>vCPUs</th><th>RAM</th><th>Storage</th><th>Backups</th><th>₹ / month</th><th>Databases</th><th>Status</th><th /></tr></thead>
            <tbody>
              {data.plans.map((p) => (
                <tr key={p.id} className={p.active ? "" : "is-hidden-plan"}>
                  <td data-label="Plan"><strong>{p.name}</strong></td>
                  <td data-label="vCPUs">{p.vcpu}</td>
                  <td data-label="RAM">{formatRam(p.ram)}</td>
                  <td data-label="Storage">{formatStorage(p.storage)}</td>
                  <td data-label="Backups">{formatBackups(p.backupDays)}</td>
                  <td data-label="₹ / month"><strong>₹{p.monthly.toLocaleString("en-IN")}</strong></td>
                  <td data-label="Databases">{p.databases}</td>
                  <td data-label="Status"><span className={`cx-status ${p.active ? "is-active" : "is-stopped"}`}>{p.active ? "On sale" : "Hidden"}</span></td>
                  <td className="cx-actions">
                    {editable && (<>
                      <button type="button" className="cx-icon-btn" onClick={() => toggle(p)} title={p.active ? "Hide from customers" : "Show to customers"}>
                        {p.active ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                      <button type="button" className="cx-icon-btn" onClick={() => setEditing(p)} title="Edit"><Pencil size={15} /></button>
                    </>)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="ap-muted">Customers can buy a plan only when it's on sale here <em>and</em> has stock in Database stock. Prices exclude GST.</p>
      {editing && (
        <PlanForm editing={editing !== "new"} initial={editing === "new" ? EMPTY : { ...editing }}
          onDone={done} onClose={() => setEditing(null)} />
      )}
    </div>
  );
};

export default DbPlans;
