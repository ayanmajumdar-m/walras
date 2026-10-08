import React, { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2, X, Eye, EyeOff, RefreshCw } from "lucide-react";
import { adminApi } from "../adminApi";

/*
  Locations: the server locations customers see (order form, About page,
  homepage, footer, sign-in page). Add, rename, hide or reorder them. Which
  SolusVM panels serve a location is set on each account in SolusVM
  accounts; a location no active account serves shows "coming soon" in the
  order form.
*/

const EMPTY = { name: "", country: "", note: "", flagUrl: "", sortOrder: "", active: true };

// A flag image from its link; nothing if there's no link or it doesn't load.
const Flag = ({ url, size = "sm" }) => {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [url]);
  if (!url || broken) return null;
  return <img src={url} alt="" className={`ap-flag is-${size}`} loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} />;
};

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

const Field = ({ label, hint, wide, children }) => (
  <label className={`cx-field${wide ? " ap-wide" : ""}`}>
    <span>{label}</span>
    {children}
    {hint && <small className="ap-muted">{hint}</small>}
  </label>
);

const LocationForm = ({ initial, editing, onSaved, onClose }) => {
  const [f, setF] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const body = { name: f.name, country: f.country, note: f.note, flagUrl: f.flagUrl.trim(), active: f.active, ...(f.sortOrder !== "" ? { sortOrder: f.sortOrder } : {}) };
    try {
      const d = editing
        ? await adminApi(`/locations/${initial.id}`, { method: "PUT", body })
        : await adminApi("/locations", { method: "POST", body });
      onSaved(d.message);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(`Delete ${initial.name}? Its stock and SolusVM links are removed too. This can't be undone.`)) return;
    setBusy(true);
    try {
      const d = await adminApi(`/locations/${initial.id}`, { method: "DELETE" });
      onSaved(d.message);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <Modal title={editing ? `Edit ${initial.name}` : "Add a location"} onClose={onClose}>
      <form className="ap-plan-form" onSubmit={submit}>
        {error && <div className="cx-alert is-error">{error}</div>}
        <div className="ap-plan-grid">
          <Field label="City"><input value={f.name} onChange={set("name")} maxLength={60} required autoFocus={!editing} placeholder="Los Angeles" /></Field>
          <Field label="Country"><input value={f.country} onChange={set("country")} maxLength={60} required placeholder="United States" /></Field>
          <Field label="Description" hint="Shown on the About page." wide>
            <input value={f.note} onChange={set("note")} maxLength={160} placeholder="Our region for customers across the Americas." />
          </Field>
          <Field label="Flag image link" hint="Optional. A link to the flag image (PNG or SVG), shown on top of the location for customers." wide>
            <span className="ap-flag-field">
              <input type="url" value={f.flagUrl} onChange={set("flagUrl")} maxLength={500} placeholder="https://flagcdn.com/w80/in.png" />
              {f.flagUrl.trim() && <Flag url={f.flagUrl.trim()} size="md" />}
            </span>
          </Field>
          <Field label="Order" hint="Lower shows first."><input type="number" step="1" value={f.sortOrder} onChange={set("sortOrder")} /></Field>
        </div>
        <label className="ap-plan-active">
          <input type="checkbox" checked={f.active} onChange={set("active")} />
          <span><strong>Shown to customers</strong><small>Hidden locations aren't listed or sold. Servers already there keep running.</small></span>
        </label>
        {!editing && <p className="ap-muted">After adding it, link it to a SolusVM panel in SolusVM accounts so servers can be ordered here.</p>}
        <div className="ap-plan-actions">
          {editing && (
            <button type="button" className="cx-btn cx-btn-ghost is-danger" onClick={remove} disabled={busy || initial.servers > 0}
              title={initial.servers > 0 ? "Has servers: hide it instead" : "Delete this location"}>
              <Trash2 size={15} /> Delete
            </button>
          )}
          <span className="ap-plan-spacer" />
          <button type="button" className="cx-btn cx-btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" className="cx-btn cx-btn-primary" disabled={busy}>{busy ? "Saving…" : editing ? "Save location" : "Add location"}</button>
        </div>
      </form>
    </Modal>
  );
};

const Locations = ({ can }) => {
  const [data, setData] = useState(null);
  const [notice, setNotice] = useState(null);
  const [editing, setEditing] = useState(null); // location, or "new"
  const editable = can("manage_plans");

  const load = useCallback(() => {
    adminApi("/locations").then(setData).catch((e) => setNotice({ type: "error", text: e.message }));
  }, []);
  useEffect(load, [load]);

  const done = (text) => { setEditing(null); setNotice({ type: "success", text }); load(); };

  const toggle = async (l) => {
    try {
      const d = await adminApi(`/locations/${l.id}`, { method: "PUT", body: { active: !l.active } });
      setNotice({ type: "success", text: `${d.message} ${l.active ? "Hidden from customers." : "Shown to customers."}` });
      load();
    } catch (e) { setNotice({ type: "error", text: e.message }); }
  };

  if (!data) {
    return <div className="cx-page">{notice ? <div className="cx-alert is-error">{notice.text}</div> : <div className="cx-card cx-empty"><p>Loading locations…</p></div>}</div>;
  }

  return (
    <div className="cx-page">
      <div className="cx-page-head cx-page-head-row">
        <div>
          <h2>Locations</h2>
          <p>Where customers can run servers. Shown in the order form and named on the site (About, homepage, footer, sign-in).</p>
        </div>
        <div className="cx-welcome-actions">
          <button type="button" className="cx-btn cx-btn-ghost" onClick={load}><RefreshCw size={15} /> Refresh</button>
          {editable && <button type="button" className="cx-btn cx-btn-primary" onClick={() => setEditing("new")}><Plus size={16} /> Add location</button>}
        </div>
      </div>

      {notice && <div className={`cx-alert is-${notice.type}`} role="status">{notice.text}</div>}

      {data.locations.length === 0 ? (
        <div className="cx-card cx-empty"><p>No locations yet. Add one to show it on the site and in the order form.</p></div>
      ) : (
        <div className="cx-card cx-table-wrap">
          <table className="cx-table">
            <thead><tr><th>Location</th><th>Served by</th><th>Servers</th><th>Status</th><th /></tr></thead>
            <tbody>
              {data.locations.map((l) => {
                const activeServers = l.servedBy.filter((a) => a.status === "active");
                return (
                  <tr key={l.id} className={l.active ? "" : "is-hidden-plan"}>
                    <td data-label="Location">
                      <span className="ap-loc-name"><Flag url={l.flagUrl} /><strong>{l.name}</strong></span>
                      <small>{l.country}{l.note ? ` · ${l.note}` : ""}</small>
                    </td>
                    <td data-label="Served by">
                      {l.servedBy.length
                        ? l.servedBy.map((a) => `${a.name}${a.status === "paused" ? " (paused)" : ""}`).join(", ")
                        : <span className="ap-muted">No SolusVM account: coming soon</span>}
                      {l.servedBy.length > 0 && activeServers.length === 0 && <small className="is-warn">Every account here is paused</small>}
                    </td>
                    <td data-label="Servers">{l.servers}</td>
                    <td data-label="Status"><span className={`cx-status ${l.active ? "is-active" : "is-stopped"}`}>{l.active ? "Shown" : "Hidden"}</span></td>
                    <td className="cx-actions">
                      {editable && (<>
                        <button type="button" className="cx-icon-btn" onClick={() => toggle(l)} title={l.active ? "Hide from customers" : "Show to customers"}>
                          {l.active ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                        <button type="button" className="cx-icon-btn" onClick={() => setEditing(l)} title="Edit"><Pencil size={15} /></button>
                      </>)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="ap-muted">
        Servers can be ordered in a location when it's shown, an active <a className="cx-link" href="?section=solus-accounts">SolusVM account</a> serves it with room to spare, and it has stock in VM stock.
      </p>

      {editing && (
        <LocationForm
          editing={editing !== "new"}
          initial={editing === "new" ? EMPTY : { ...editing, flagUrl: editing.flagUrl || "", sortOrder: editing.sortOrder }}
          onSaved={done}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
};

export default Locations;
