import React, { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2, X, Eye, EyeOff, RefreshCw } from "lucide-react";
import { adminApi } from "../adminApi";
import { formatRam, formatBandwidth } from "../../../data/plans";

/*
  VM plans: every Virtual Machine plan and its price, as customers see them on
  Pricing and in the console, and as they're charged. Add a plan, edit specs
  and prices, hide it from sale, or delete one no server has ever used.
  A plan's name can't change once created. Changes apply straight away to new
  orders; servers already running keep the price they were bought at.
*/

const EMPTY = { name: "", cpu: "intel", vcpu: "", ram: "", storage: "", bandwidth: "", network: "1", monthly: "", usd: "", sortOrder: "", active: true };

const Modal = ({ title, onClose, children }) => (
  <div className="cx-modal-scrim" onClick={onClose}>
    <div className="cx-modal ap-plan-modal" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
      <div className="cx-modal-head">
        <h3>{title}</h3>
        <button type="button" className="cx-icon-btn" onClick={onClose} aria-label="Close"><X size={18} /></button>
      </div>
      {children}
    </div>
  </div>
);

const Field = ({ label, hint, children }) => (
  <label className="cx-field">
    <span>{label}</span>
    {children}
    {hint && <small className="ap-muted">{hint}</small>}
  </label>
);

const PlanForm = ({ initial, cpuTypes, editing, onSaved, onDeleted, onClose }) => {
  const [f, setF] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const body = {
      cpu: f.cpu, vcpu: f.vcpu, ram: f.ram, storage: f.storage, bandwidth: f.bandwidth, network: f.network,
      monthly: f.monthly, usd: f.usd === "" ? null : f.usd, active: f.active,
      ...(f.sortOrder !== "" ? { sortOrder: f.sortOrder } : {}),
      ...(editing ? {} : { name: f.name.trim() }),
    };
    try {
      const d = editing
        ? await adminApi(`/vm-plans/${initial.id}`, { method: "PUT", body })
        : await adminApi("/vm-plans", { method: "POST", body });
      onSaved(d.message);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(`Delete ${initial.name}? Its stock is removed too. This can't be undone.`)) return;
    setBusy(true);
    try {
      const d = await adminApi(`/vm-plans/${initial.id}`, { method: "DELETE" });
      onDeleted(d.message);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <Modal title={editing ? `Edit ${initial.name}` : "Add a plan"} onClose={onClose}>
      <form className="ap-plan-form" onSubmit={submit}>
        {error && <div className="cx-alert is-error">{error}</div>}
        <div className="ap-plan-grid">
          {editing ? (
            <Field label="Plan name" hint="Can't be changed. Hide this plan and add a new one to rename.">
              <input value={initial.name} disabled />
            </Field>
          ) : (
            <Field label="Plan name" hint="e.g. VMgAM_4. Can't be changed later.">
              <input value={f.name} onChange={set("name")} maxLength={40} required autoFocus />
            </Field>
          )}
          <Field label="CPU type">
            <select className="ap-select" value={f.cpu} onChange={set("cpu")}>
              {Object.entries(cpuTypes).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select>
          </Field>
          <Field label="vCPUs"><input type="number" min="1" step="1" value={f.vcpu} onChange={set("vcpu")} required /></Field>
          <Field label="RAM (GB)" hint="0.5 = 512 MB"><input type="number" min="0.25" step="0.25" value={f.ram} onChange={set("ram")} required /></Field>
          <Field label="NVMe SSD (GB)"><input type="number" min="1" step="1" value={f.storage} onChange={set("storage")} required /></Field>
          <Field label="Bandwidth (GB / month)" hint="1024 = 1 TB"><input type="number" min="0" step="1" value={f.bandwidth} onChange={set("bandwidth")} required /></Field>
          <Field label="Network (Gbps)"><input type="number" min="0.1" step="0.1" value={f.network} onChange={set("network")} required /></Field>
          <Field label="Price (₹ / month)" hint="Excluding GST. What customers are charged."><input type="number" min="1" step="0.01" value={f.monthly} onChange={set("monthly")} required /></Field>
          <Field label="Price ($ / month)" hint="Optional, for reference."><input type="number" min="0" step="0.01" value={f.usd} onChange={set("usd")} /></Field>
          <Field label="Order" hint="Lower shows first."><input type="number" step="1" value={f.sortOrder} onChange={set("sortOrder")} /></Field>
        </div>
        <label className="ap-plan-active">
          <input type="checkbox" checked={f.active} onChange={set("active")} />
          <span><strong>Visible and on sale</strong><small>Hidden plans aren't shown or sold. Servers already on them keep running.</small></span>
        </label>
        {editing && Number(initial.monthly) !== Number(f.monthly) && (
          <div className="cx-alert is-info">New orders pay the new price. Servers already running keep the price they were bought at.</div>
        )}
        <div className="ap-plan-actions">
          {editing && (
            <button type="button" className="cx-btn cx-btn-ghost is-danger" onClick={remove} disabled={busy || initial.servers > 0}
              title={initial.servers > 0 ? "Used by servers: hide it instead" : "Delete this plan"}>
              <Trash2 size={15} /> Delete
            </button>
          )}
          <span className="ap-plan-spacer" />
          <button type="button" className="cx-btn cx-btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" className="cx-btn cx-btn-primary" disabled={busy}>{busy ? "Saving…" : editing ? "Save plan" : "Add plan"}</button>
        </div>
      </form>
    </Modal>
  );
};

const VmPlans = ({ can }) => {
  const [data, setData] = useState(null);
  const [notice, setNotice] = useState(null);
  const [editing, setEditing] = useState(null); // plan, or "new"
  const editable = can("manage_plans");

  const load = useCallback(() => {
    adminApi("/vm-plans").then(setData).catch((e) => setNotice({ type: "error", text: e.message }));
  }, []);
  useEffect(load, [load]);

  const done = (text) => { setEditing(null); setNotice({ type: "success", text }); load(); };

  const toggle = async (p) => {
    try {
      const d = await adminApi(`/vm-plans/${p.id}`, { method: "PUT", body: { active: !p.active } });
      setNotice({ type: "success", text: `${d.message} ${p.active ? "Hidden from customers." : "Visible to customers."}` });
      load();
    } catch (e) { setNotice({ type: "error", text: e.message }); }
  };

  if (!data) {
    return <div className="cx-page">{notice ? <div className="cx-alert is-error">{notice.text}</div> : <div className="cx-card cx-empty"><p>Loading plans…</p></div>}</div>;
  }

  const groups = Object.entries(data.cpuTypes).map(([id, label]) => ({ id, label, plans: data.plans.filter((p) => p.cpu === id) }));

  return (
    <div className="cx-page">
      <div className="cx-page-head cx-page-head-row">
        <div>
          <h2>VM plans</h2>
          <p>Virtual Machine → General Purpose. What customers see on Pricing and in the console, and what they're charged.</p>
        </div>
        <div className="cx-welcome-actions">
          <button type="button" className="cx-btn cx-btn-ghost" onClick={load}><RefreshCw size={15} /> Refresh</button>
          {editable && <button type="button" className="cx-btn cx-btn-primary" onClick={() => setEditing("new")}><Plus size={16} /> Add plan</button>}
        </div>
      </div>

      {notice && <div className={`cx-alert is-${notice.type}`} role="status">{notice.text}</div>}
      {!editable && <div className="cx-alert is-info">You can view plans. Changing them needs the "Change plans and prices" permission.</div>}

      {groups.map((g) => (
        <section key={g.id} className="cx-section">
          <div className="cx-section-head"><h3>{g.label}</h3><span className="cx-count">{g.plans.length}</span></div>
          {g.plans.length === 0 ? (
            <div className="cx-card cx-empty"><p>No {g.label} plans yet. Customers see "{g.label} plans are coming soon".</p></div>
          ) : (
            <div className="cx-card cx-table-wrap">
              <table className="cx-table ap-plan-table">
                <thead>
                  <tr><th>Plan</th><th>vCPUs</th><th>RAM</th><th>NVMe SSD</th><th>Bandwidth</th><th>Network</th><th>₹ / month</th><th>$ / month</th><th>Servers</th><th>Status</th><th /></tr>
                </thead>
                <tbody>
                  {g.plans.map((p) => (
                    <tr key={p.id} className={p.active ? "" : "is-hidden-plan"}>
                      <td data-label="Plan"><strong>{p.name}</strong></td>
                      <td data-label="vCPUs">{p.vcpu}</td>
                      <td data-label="RAM">{formatRam(p.ram)}</td>
                      <td data-label="NVMe SSD">{p.storage} GB</td>
                      <td data-label="Bandwidth">{formatBandwidth(p.bandwidth)}</td>
                      <td data-label="Network">{p.network} Gbps</td>
                      <td data-label="₹ / month"><strong>₹{p.monthly.toLocaleString("en-IN")}</strong></td>
                      <td data-label="$ / month">{p.usd === null ? "—" : `$${p.usd}`}</td>
                      <td data-label="Servers">{p.servers}</td>
                      <td data-label="Status">
                        <span className={`cx-status ${p.active ? "is-active" : "is-stopped"}`}>{p.active ? "On sale" : "Hidden"}</span>
                      </td>
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

      <p className="ap-muted">
        Customers can buy a plan only when it's on sale here <em>and</em> has stock in VM stock. Prices exclude GST.
      </p>

      {editing && (
        <PlanForm
          editing={editing !== "new"}
          initial={editing === "new" ? EMPTY : {
            ...editing, usd: editing.usd ?? "", sortOrder: editing.sortOrder, network: editing.network,
          }}
          cpuTypes={data.cpuTypes}
          onSaved={done}
          onDeleted={done}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
};

export default VmPlans;
