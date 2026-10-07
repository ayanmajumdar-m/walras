import React, { useCallback, useEffect, useState } from "react";
import { LifeBuoy, Save, RefreshCw } from "lucide-react";
import { adminApi } from "../adminApi";

/*
  Settings → Support departments. The departments customers choose from
  when opening a ticket are Zendesk agent groups, read live from Zendesk.
  Tick the groups customers may pick and, optionally, give each a friendlier
  name. "Use default" goes back to General Queries, Sales & Billing, Tech
  Support and Abuse (utils/supportDepartments.js).
*/
const SupportDepartments = () => {
  const [data, setData] = useState(null);
  const [rows, setRows] = useState({}); // groupId -> { on, label }
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    adminApi("/settings/support-departments")
      .then((d) => {
        setData(d);
        const chosen = new Map((d.choice || []).map((c) => [c.groupId, c.label]));
        const defaults = new Set(d.defaultIds || []);
        setRows(Object.fromEntries(d.groups.map((g) => [g.id, {
          on: d.choice ? chosen.has(g.id) : defaults.has(g.id),
          label: chosen.get(g.id) || "",
        }])));
      })
      .catch((e) => setNotice({ type: "error", text: e.message }));
  }, []);
  useEffect(load, [load]);

  const save = async (all) => {
    setBusy(true);
    setNotice(null);
    try {
      const departments = all ? null : data.groups
        .filter((g) => rows[g.id]?.on)
        .map((g) => ({ groupId: g.id, label: rows[g.id].label.trim() }));
      const d = await adminApi("/settings/support-departments", { method: "PUT", body: { departments } });
      setNotice({ type: "success", text: d.message });
      load();
    } catch (e) {
      setNotice({ type: "error", text: e.message });
    } finally {
      setBusy(false);
    }
  };

  const set = (id, patch) => setRows((r) => ({ ...r, [id]: { ...r[id], ...patch } }));
  const onCount = Object.values(rows).filter((r) => r.on).length;

  return (
    <section className="cx-card ap-card">
      <h3><LifeBuoy size={18} /> Support departments</h3>
      <p className="ap-muted">
        Customers pick one of these when they open a ticket, and the ticket goes to that Zendesk group.
        Departments are your Zendesk agent groups; add or rename groups in Zendesk (Admin Center → People → Groups).
      </p>

      {notice && <div className={`cx-alert is-${notice.type}`} role="status">{notice.text}</div>}

      {!data ? (
        <p className="ap-muted">Loading groups from Zendesk…</p>
      ) : !data.configured ? (
        <div className="cx-alert is-info">Zendesk isn't connected, so there are no departments yet. Set the ZENDESK_* variables on the server.</div>
      ) : data.error ? (
        <div className="cx-alert is-error">{data.error}</div>
      ) : data.groups.length === 0 ? (
        <div className="cx-alert is-info">Your Zendesk has no groups yet. Create groups in Zendesk, then refresh.</div>
      ) : (
        <>
          <p className="ap-muted">
            {data.choice
              ? `${data.choice.length} of ${data.groups.length} groups are offered.`
              : `Default: ${(data.defaultIds || []).length} of ${data.groups.length} groups are offered under their Zendesk names.`}
          </p>
          <div className="ap-dept-list">
            {data.groups.map((g) => (
              <div key={g.id} className={`ap-dept${rows[g.id]?.on ? " is-on" : ""}`}>
                <label className="ap-dept-check">
                  <input type="checkbox" checked={Boolean(rows[g.id]?.on)} onChange={(e) => set(g.id, { on: e.target.checked })} />
                  <span><strong>{g.name}</strong><small>Zendesk group #{g.id}</small></span>
                </label>
                <input className="ap-dept-label" value={rows[g.id]?.label || ""} disabled={!rows[g.id]?.on} maxLength={60}
                  onChange={(e) => set(g.id, { label: e.target.value })} placeholder={`Shown as "${g.name}"`} aria-label={`Name customers see for ${g.name}`} />
              </div>
            ))}
          </div>
          <div className="ap-card-foot ap-dept-foot">
            <button type="button" className="cx-btn cx-btn-ghost" onClick={load} disabled={busy}><RefreshCw size={15} /> Refresh</button>
            <button type="button" className="cx-btn cx-btn-ghost" onClick={() => save(true)} disabled={busy || !data.choice}>Use default</button>
            <button type="button" className="cx-btn cx-btn-primary" onClick={() => save(false)} disabled={busy || onCount === 0}>
              <Save size={15} /> Save departments
            </button>
          </div>
        </>
      )}
    </section>
  );
};

export default SupportDepartments;
