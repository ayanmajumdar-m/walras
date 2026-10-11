import React, { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2, X, Eye, EyeOff, RefreshCw } from "lucide-react";
import { adminApi } from "../adminApi";
import { formatRam, formatBandwidth } from "../../../data/plans";
import ProductLocations from "./ProductLocations";

/*
  App Platform → Plans: Shared plans (on sale) and Dedicated plans (the type
  is "coming soon", so they aren't sold yet). Like VM plans: the name is
  fixed once created; a plan any app used can only be hidden. Apps already
  running keep the price they were bought at.
*/

const EMPTY = { name: "", type: "shared", vcpu: "", ram: "", storage: "", bandwidth: "", dedicatedIp: false, monthly: "", sortOrder: "", active: true };

const Field = ({ label, hint, children }) => (
  <label className="cx-field">
    <span>{label}</span>
    {children}
    {hint && <small className="ap-muted">{hint}</small>}
  </label>
);

const PlanForm = ({ initial, types, editing, onDone, onClose }) => {
  const [f, setF] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const body = {
      type: f.type, vcpu: f.vcpu, ram: f.ram, storage: f.storage, bandwidth: f.bandwidth, dedicatedIp: f.dedicatedIp,
      monthly: f.monthly, active: f.active,
      ...(f.sortOrder !== "" ? { sortOrder: f.sortOrder } : {}),
      ...(editing ? {} : { name: f.name.trim() }),
    };
    try {
      const d = editing
        ? await adminApi(`/apps/plans/${initial.id}`, { method: "PUT", body })
        : await adminApi("/apps/plans", { method: "POST", body });
      onDone(d.message);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(`Delete ${initial.name}? This can't be undone.`)) return;
    setBusy(true);
    try {
      onDone((await adminApi(`/apps/plans/${initial.id}`, { method: "DELETE" })).message);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="cx-modal-scrim" onClick={onClose}>
      <div className="cx-modal ap-plan-modal" role="dialog" aria-modal="true" aria-label="App Platform plan" onClick={(e) => e.stopPropagation()}>
        <div className="cx-modal-head">
          <h3>{editing ? `Edit ${initial.name}` : "Add an App Platform plan"}</h3>
          <button type="button" className="cx-icon-btn" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <form className="ap-plan-form" onSubmit={submit}>
          {error && <div className="cx-alert is-error">{error}</div>}
          <div className="ap-plan-grid">
            {editing ? (
              <Field label="Plan name" hint="Can't be changed. Hide this plan and add a new one to rename."><input value={initial.name} disabled /></Field>
            ) : (
              <Field label="Plan name" hint="e.g. DPsAP_4. Can't be changed later."><input value={f.name} onChange={set("name")} maxLength={40} required autoFocus /></Field>
            )}
            <Field label="Type" hint="Dedicated is shown as coming soon and isn't sold yet.">
              <select className="ap-select" value={f.type} onChange={set("type")}>
                {Object.entries(types).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
              </select>
            </Field>
            <Field label="vCPUs"><input type="number" min="0.1" step="0.1" value={f.vcpu} onChange={set("vcpu")} required /></Field>
            <Field label="RAM (GB)"><input type="number" min="0.25" step="0.25" value={f.ram} onChange={set("ram")} required /></Field>
            <Field label="NVMe SSD (GB)"><input type="number" min="1" step="1" value={f.storage} onChange={set("storage")} required /></Field>
            <Field label="Bandwidth (GB / month)" hint="1024 = 1 TB"><input type="number" min="0" step="1" value={f.bandwidth} onChange={set("bandwidth")} required /></Field>
            <Field label="Price (₹ / month)" hint="Excluding GST."><input type="number" min="1" step="0.01" value={f.monthly} onChange={set("monthly")} required /></Field>
            <Field label="Order" hint="Lower shows first."><input type="number" step="1" value={f.sortOrder} onChange={set("sortOrder")} /></Field>
          </div>
          <label className="ap-plan-active">
            <input type="checkbox" checked={f.dedicatedIp} onChange={set("dedicatedIp")} />
            <span><strong>Dedicated IP</strong><small>Off = shared IP.</small></span>
          </label>
          <label className="ap-plan-active">
            <input type="checkbox" checked={f.active} onChange={set("active")} />
            <span><strong>Visible and on sale</strong><small>Hidden plans aren't shown or sold. Apps already on them keep running.</small></span>
          </label>
          <div className="ap-plan-actions">
            {editing && (
              <button type="button" className="cx-btn cx-btn-ghost is-danger" onClick={remove} disabled={busy || initial.apps > 0}
                title={initial.apps > 0 ? "Used by apps: hide it instead" : "Delete this plan"}>
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

const AppPlans = ({ can }) => {
  const [data, setData] = useState(null);
  const [notice, setNotice] = useState(null);
  const [editing, setEditing] = useState(null);
  const editable = can("manage_plans");

  const load = useCallback(() => {
    adminApi("/apps/plans").then(setData).catch((e) => setNotice({ type: "error", text: e.message }));
  }, []);
  useEffect(load, [load]);

  const done = (text) => { setEditing(null); setNotice({ type: "success", text }); load(); };
  const toggle = async (p) => {
    try {
      const d = await adminApi(`/apps/plans/${p.id}`, { method: "PUT", body: { active: !p.active } });
      setNotice({ type: "success", text: `${d.message} ${p.active ? "Hidden from customers." : "Visible to customers."}` });
      load();
    } catch (e) { setNotice({ type: "error", text: e.message }); }
  };

  const groups = data ? Object.entries(data.types).map(([id, label]) => ({ id, label, plans: data.plans.filter((p) => p.type === id) })) : [];

  return (
    <div className="cx-page">
      <div className="cx-page-head cx-page-head-row">
        <div>
          <h2>App Platform plans</h2>
          <p>What customers see on Pricing and when deploying, and what they're charged. Dedicated is shown as coming soon.</p>
        </div>
        <div className="cx-welcome-actions">
          <button type="button" className="cx-btn cx-btn-ghost" onClick={load}><RefreshCw size={15} /> Refresh</button>
          {editable && <button type="button" className="cx-btn cx-btn-primary" onClick={() => setEditing("new")}><Plus size={16} /> Add plan</button>}
        </div>
      </div>
      {notice && <div className={`cx-alert is-${notice.type}`} role="status">{notice.text}</div>}
      <ProductLocations product="apps" label="App Platform" editable={editable} />
      {!data ? <div className="cx-card cx-empty"><p>Loading plans…</p></div> : groups.map((g) => (
        <section key={g.id} className="cx-section">
          <div className="cx-section-head"><h3>{g.label}{g.id === "dedicated" ? " (coming soon)" : ""}</h3><span className="cx-count">{g.plans.length}</span></div>
          {g.plans.length === 0 ? (
            <div className="cx-card cx-empty"><p>No {g.label} plans yet.</p></div>
          ) : (
            <div className="cx-card cx-table-wrap">
              <table className="cx-table ap-plan-table">
                <thead><tr><th>Plan</th><th>vCPUs</th><th>RAM</th><th>NVMe SSD</th><th>Bandwidth</th><th>IP</th><th>₹ / month</th><th>Apps</th><th>Status</th><th /></tr></thead>
                <tbody>
                  {g.plans.map((p) => (
                    <tr key={p.id} className={p.active ? "" : "is-hidden-plan"}>
                      <td data-label="Plan"><strong>{p.name}</strong></td>
                      <td data-label="vCPUs">{p.vcpu}</td>
                      <td data-label="RAM">{formatRam(p.ram)}</td>
                      <td data-label="NVMe SSD">{p.storage} GB</td>
                      <td data-label="Bandwidth">{formatBandwidth(p.bandwidth)}</td>
                      <td data-label="IP">{p.dedicatedIp ? "Dedicated" : "Shared"}</td>
                      <td data-label="₹ / month"><strong>₹{p.monthly.toLocaleString("en-IN")}</strong></td>
                      <td data-label="Apps">{p.apps}</td>
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
        </section>
      ))}
      <p className="ap-muted">Prices exclude GST. There's no provisioning integration yet: an app is active as soon as it's paid.</p>
      {editing && data && (
        <PlanForm editing={editing !== "new"} types={data.types} initial={editing === "new" ? EMPTY : { ...editing }}
          onDone={done} onClose={() => setEditing(null)} />
      )}
    </div>
  );
};

export default AppPlans;
