import React, { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2, X, Eye, EyeOff, RefreshCw } from "lucide-react";
import { adminApi } from "../adminApi";
import { formatInr, formatUplink, processorLine } from "../../Dedicated/DedicatedCatalog";

/*
  Products → Dedicated → Listings: the servers customers can order on
  metal.walras.net and in the console. Stock is how many can still be
  ordered: each order takes one, a cancelled order gives it back. A listing
  anyone ordered can only be hidden. Nothing is charged or provisioned yet.
*/

const EMPTY = {
  brand: "", model: "", cpu: "", cores: "", threads: "", ghz: "", memoryGb: "", storage: "",
  network: "1Gbit/s Guaranteed", uplinkGbps: "1", trafficTb: "", countryCode: "", location: "",
  delivery: "24h", categories: [], badge: "", monthly: "", stock: "1", sortOrder: "", active: true,
};

const Field = ({ label, hint, wide, children }) => (
  <label className={`cx-field${wide ? " ap-wide" : ""}`}>
    <span>{label}</span>
    {children}
    {hint && <small className="ap-muted">{hint}</small>}
  </label>
);

const ServerForm = ({ initial, editing, meta, onDone, onClose }) => {
  const [f, setF] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  const toggleCategory = (id) => setF({ ...f, categories: f.categories.includes(id) ? f.categories.filter((c) => c !== id) : [...f.categories, id] });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const { sortOrder, ...rest } = f;
    const body = { ...rest, countryCode: f.countryCode.trim().toUpperCase(), ...(sortOrder !== "" ? { sortOrder } : {}) };
    try {
      const d = editing
        ? await adminApi(`/dedicated/servers/${initial.id}`, { method: "PUT", body })
        : await adminApi("/dedicated/servers", { method: "POST", body });
      onDone(d.message);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(`Delete ${initial.cpu}? This can't be undone.`)) return;
    setBusy(true);
    try {
      onDone((await adminApi(`/dedicated/servers/${initial.id}`, { method: "DELETE" })).message);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="cx-modal-scrim" onClick={onClose}>
      <div className="cx-modal ap-plan-modal ap-ds-modal" role="dialog" aria-modal="true" aria-label="Dedicated server" onClick={(e) => e.stopPropagation()}>
        <div className="cx-modal-head">
          <h3>{editing ? `Edit ${initial.cpu}` : "Add a dedicated server"}</h3>
          <button type="button" className="cx-icon-btn" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <form className="ap-plan-form" onSubmit={submit}>
          {error && <div className="cx-alert is-error">{error}</div>}
          <div className="ap-plan-grid">
            <Field label="Processor" hint="e.g. AMD EPYC 4245P" wide><input value={f.cpu} onChange={set("cpu")} maxLength={80} required autoFocus /></Field>
            <Field label="Brand" hint="Optional, e.g. ASRock"><input value={f.brand} onChange={set("brand")} maxLength={40} /></Field>
            <Field label="Model" hint="Optional, e.g. 1U2S-B650"><input value={f.model} onChange={set("model")} maxLength={60} /></Field>
            <Field label="Cores"><input type="number" min="1" step="1" value={f.cores} onChange={set("cores")} required /></Field>
            <Field label="Threads"><input type="number" min="1" step="1" value={f.threads} onChange={set("threads")} required /></Field>
            <Field label="Clock speed (GHz)"><input type="number" min="0.1" max="9.99" step="0.01" value={f.ghz} onChange={set("ghz")} required /></Field>
            <Field label="Memory (GB)"><input type="number" min="1" step="1" value={f.memoryGb} onChange={set("memoryGb")} required /></Field>
            <Field label="Storage" hint="As customers should read it, e.g. 2x 2TB NVMe SSD" wide><input value={f.storage} onChange={set("storage")} maxLength={120} required /></Field>
            <Field label="Network" hint="e.g. 1Gbit/s Guaranteed"><input value={f.network} onChange={set("network")} maxLength={80} required /></Field>
            <Field label="Uplink (Gbit/s)" hint="Used for the Uplink filter"><input type="number" min="0.1" step="0.1" value={f.uplinkGbps} onChange={set("uplinkGbps")} required /></Field>
            <Field label="Traffic (TB / month)" hint="0 = unmetered"><input type="number" min="0" step="1" value={f.trafficTb} onChange={set("trafficTb")} required /></Field>
            <Field label="Country code" hint="Two letters: NL, DE, IN… (flag and filter)"><input value={f.countryCode} onChange={set("countryCode")} maxLength={2} required /></Field>
            <Field label="Location" hint="Shown on the card, e.g. Netherlands or Amsterdam"><input value={f.location} onChange={set("location")} maxLength={60} required /></Field>
            <Field label="Time to deliver">
              <select className="ap-select" value={f.delivery} onChange={set("delivery")}>
                {Object.entries(meta.delivery).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
              </select>
            </Field>
            <Field label="Ribbon" hint="Optional corner label, e.g. NEW 2026"><input value={f.badge} onChange={set("badge")} maxLength={30} /></Field>
            <Field label="Price (₹ / month)" hint="Excluding GST."><input type="number" min="1" step="0.01" value={f.monthly} onChange={set("monthly")} required /></Field>
            <Field label="Stock" hint="How many can still be ordered"><input type="number" min="0" step="1" value={f.stock} onChange={set("stock")} required /></Field>
            <Field label="Order" hint="Lower shows first under Recommended."><input type="number" step="1" value={f.sortOrder} onChange={set("sortOrder")} /></Field>
          </div>
          <fieldset className="ap-ds-cats">
            <legend>Categories (the pills on the catalog)</legend>
            {Object.entries(meta.categories).map(([id, label]) => (
              <label key={id} className="ap-check">
                <input type="checkbox" checked={f.categories.includes(id)} onChange={() => toggleCategory(id)} />
                <span>{label}</span>
              </label>
            ))}
          </fieldset>
          <label className="ap-plan-active">
            <input type="checkbox" checked={f.active} onChange={set("active")} />
            <span><strong>Visible and on sale</strong><small>Hidden servers aren't shown. Orders already placed are unaffected.</small></span>
          </label>
          <div className="ap-plan-actions">
            {editing && (
              <button type="button" className="cx-btn cx-btn-ghost is-danger" onClick={remove} disabled={busy || initial.orders > 0}
                title={initial.orders > 0 ? "Ordered by customers: hide it instead" : "Delete this server"}>
                <Trash2 size={15} /> Delete
              </button>
            )}
            <span className="ap-plan-spacer" />
            <button type="button" className="cx-btn cx-btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
            <button type="submit" className="cx-btn cx-btn-primary" disabled={busy}>{busy ? "Saving…" : editing ? "Save server" : "Add server"}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

const DedicatedServers = ({ can }) => {
  const [data, setData] = useState(null);
  const [notice, setNotice] = useState(null);
  const [editing, setEditing] = useState(null);
  const editable = can("manage_plans");

  const load = useCallback(() => {
    adminApi("/dedicated/servers").then(setData).catch((e) => setNotice({ type: "error", text: e.message }));
  }, []);
  useEffect(load, [load]);

  const done = (text) => { setEditing(null); setNotice({ type: "success", text }); load(); };
  const toggle = async (s) => {
    try {
      await adminApi(`/dedicated/servers/${s.id}`, { method: "PUT", body: { active: !s.active } });
      setNotice({ type: "success", text: `${s.cpu} ${s.active ? "hidden from customers" : "is on sale"}.` });
      load();
    } catch (e) { setNotice({ type: "error", text: e.message }); }
  };
  const toForm = (s) => ({
    ...s, cores: String(s.cores), threads: String(s.threads), ghz: String(s.ghz), memoryGb: String(s.memoryGb),
    uplinkGbps: String(s.uplinkGbps), trafficTb: String(s.trafficTb), monthly: String(s.monthly), stock: String(s.stock), sortOrder: String(s.sortOrder),
  });

  return (
    <div className="cx-page">
      <div className="cx-page-head cx-page-head-row">
        <div>
          <h2>Dedicated server listings</h2>
          <p>What customers can order on metal.walras.net and in the console. Nothing is charged or set up automatically yet.</p>
        </div>
        <div className="cx-welcome-actions">
          <button type="button" className="cx-btn cx-btn-ghost" onClick={load}><RefreshCw size={15} /> Refresh</button>
          {editable && data && <button type="button" className="cx-btn cx-btn-primary" onClick={() => setEditing("new")}><Plus size={16} /> Add server</button>}
        </div>
      </div>
      {notice && <div className={`cx-alert is-${notice.type}`} role="status">{notice.text}</div>}
      {!data ? <div className="cx-card cx-empty"><p>Loading servers…</p></div> : data.servers.length === 0 ? (
        <div className="cx-card cx-empty">
          <h4>No dedicated servers listed yet</h4>
          <p>Add one and it appears on metal.walras.net and in the console straight away.</p>
        </div>
      ) : (
        <div className="cx-card cx-table-wrap">
          <table className="cx-table ap-plan-table">
            <thead><tr><th>Server</th><th>Specs</th><th>Location</th><th>₹ / month</th><th>Stock</th><th>Orders</th><th>Status</th><th /></tr></thead>
            <tbody>
              {data.servers.map((s) => (
                <tr key={s.id} className={s.active ? "" : "is-hidden-plan"}>
                  <td data-label="Server"><strong>{s.cpu}</strong><small>{[s.brand, s.model].filter(Boolean).join(" ")}{s.badge ? ` · ${s.badge}` : ""}</small></td>
                  <td data-label="Specs">{processorLine(s)}<small>{s.memoryGb}GB · {s.storage} · {formatUplink(s.uplinkGbps)}{s.trafficTb ? ` · ${s.trafficTb}TB` : " · unmetered"}</small></td>
                  <td data-label="Location">{s.location}<small>{s.countryCode} · {data.delivery[s.delivery]}</small></td>
                  <td data-label="₹ / month"><strong>{formatInr(s.monthly)}</strong></td>
                  <td data-label="Stock">{s.stock === 0 ? <span className="cx-status is-stopped">out</span> : s.stock}</td>
                  <td data-label="Orders">{s.orders}</td>
                  <td data-label="Status"><span className={`cx-status ${s.active ? "is-active" : "is-stopped"}`}>{s.active ? "On sale" : "Hidden"}</span></td>
                  <td className="cx-actions">
                    {editable && (<>
                      <button type="button" className="cx-icon-btn" onClick={() => toggle(s)} title={s.active ? "Hide from customers" : "Show to customers"}>
                        {s.active ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                      <button type="button" className="cx-icon-btn" onClick={() => setEditing(s)} title="Edit"><Pencil size={15} /></button>
                    </>)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="ap-muted">Prices exclude GST. Orders are listed under Dedicated → Orders.</p>
      {editing && data && (
        <ServerForm editing={editing !== "new"} meta={data} initial={editing === "new" ? EMPTY : toForm(editing)}
          onDone={done} onClose={() => setEditing(null)} />
      )}
    </div>
  );
};

export default DedicatedServers;
