import React, { useCallback, useEffect, useState } from "react";
import { Save, RefreshCw, AlertTriangle } from "lucide-react";
import { adminApi } from "../adminApi";
import { formatRam } from "../../../data/plans";

/*
  Virtual Machine stock: how many of each plan may be sold in each SolusVM
  location, and which SolusVM plan each Walras plan creates. Deploying takes
  one unit; deleting a server gives it back. "Running" counts live servers.
*/
const ComputeStock = ({ can }) => {
  const [data, setData] = useState(null);
  const [draft, setDraft] = useState({});
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);
  const editable = can("manage_services");

  const load = useCallback(() => {
    setNotice(null);
    adminApi("/compute/stock")
      .then((d) => {
        setData(d);
        setDraft(Object.fromEntries(d.plans.map((p) => [p.name, { solusPlanId: p.solusPlanId || "", stock: { ...p.stock } }])));
      })
      .catch((e) => setNotice({ type: "error", text: e.message }));
  }, []);

  useEffect(load, [load]);

  const setQty = (plan, loc, value) =>
    setDraft((d) => ({ ...d, [plan]: { ...d[plan], stock: { ...d[plan].stock, [loc]: value } } }));
  const setPlanId = (plan, value) => setDraft((d) => ({ ...d, [plan]: { ...d[plan], solusPlanId: value } }));

  const save = async () => {
    const plans = data.plans.map((p) => ({
      name: p.name,
      solusPlanId: draft[p.name].solusPlanId === "" ? null : Number(draft[p.name].solusPlanId),
      // Only cells the admin changed, so saving a page loaded a while ago
      // doesn't undo units customers have bought since.
      stock: Object.fromEntries(data.locations
        .filter((l) => Number(draft[p.name].stock[l.id] || 0) !== Number(p.stock[l.id] || 0))
        .map((l) => [l.id, Number(draft[p.name].stock[l.id] || 0)])),
    }));
    setBusy(true);
    try {
      const d = await adminApi("/compute/stock", { method: "PUT", body: { plans } });
      load();
      setNotice({ type: "success", text: d.message });
    } catch (e) {
      setNotice({ type: "error", text: e.message });
    } finally {
      setBusy(false);
    }
  };

  if (!data) {
    return (
      <div className="cx-page">
        {notice ? <div className={`cx-alert is-${notice.type}`}>{notice.text}</div> : <div className="cx-card cx-empty"><p>Loading stock…</p></div>}
      </div>
    );
  }

  const unlinked = data.plans.filter((p) => !draft[p.name]?.solusPlanId).map((p) => p.name);

  return (
    <div className="cx-page">
      <div className="cx-page-head cx-page-head-row">
        <div>
          <h2>Virtual Machine stock</h2>
          <p>How many servers of each plan can be sold in each location. Deploying uses one; deleting a server returns it.</p>
        </div>
        <button type="button" className="cx-btn cx-btn-ghost" onClick={load}><RefreshCw size={15} /> Refresh</button>
      </div>

      {notice && <div className={`cx-alert is-${notice.type}`} role="status">{notice.text}</div>}

      {!data.configured ? (
        <div className="cx-alert is-error">
          <AlertTriangle size={16} /> SolusVM isn't connected. Set <code>SOLUSVM_URL</code> and <code>SOLUSVM_API_TOKEN</code> on the server and restart it. Until then Virtual Machines show Out of stock everywhere.
        </div>
      ) : data.solusError ? (
        <div className="cx-alert is-error"><AlertTriangle size={16} /> Couldn't load locations and plans from SolusVM: {data.solusError}</div>
      ) : data.locations.length === 0 ? (
        <div className="cx-alert is-info">SolusVM has no visible locations yet. Add one in SolusVM, then refresh.</div>
      ) : (
        <>
          {unlinked.length > 0 && (
            <div className="cx-alert is-info">
              Not on sale until linked to a SolusVM plan: {unlinked.join(", ")}.
            </div>
          )}
          <div className="cx-card cx-table-wrap">
            <table className="cx-table ap-stock-table">
              <thead>
                <tr>
                  <th>Plan</th>
                  <th>SolusVM plan</th>
                  {data.locations.map((l) => <th key={l.id}>{l.name}</th>)}
                </tr>
              </thead>
              <tbody>
                {data.plans.map((p) => (
                  <tr key={p.name}>
                    <td data-label="Plan">
                      <strong>{p.name}</strong>
                      <small>{p.cpu === "amd" ? "AMD" : "Intel"} · {p.vcpu} vCPU · {formatRam(p.ram)} · {p.storage} GB NVMe · ₹{p.monthly.toLocaleString("en-IN")}/mo</small>
                    </td>
                    <td data-label="SolusVM plan">
                      <select className="ap-select" value={draft[p.name].solusPlanId} disabled={!editable}
                        onChange={(e) => setPlanId(p.name, e.target.value)}>
                        <option value="">Not linked</option>
                        {data.solusPlans.map((sp) => <option key={sp.id} value={sp.id}>{sp.name} (#{sp.id})</option>)}
                      </select>
                    </td>
                    {data.locations.map((l) => (
                      <td key={l.id} data-label={l.name}>
                        <input type="number" min="0" max="100000" step="1" className="ap-stock-input" disabled={!editable}
                          value={draft[p.name].stock[l.id] ?? 0} onChange={(e) => setQty(p.name, l.id, e.target.value)}
                          aria-label={`${p.name} stock in ${l.name}`} />
                        <small>{p.inUse[l.id] || 0} running</small>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {editable && (
            <div className="ap-card-foot">
              <button type="button" className="cx-btn cx-btn-primary" onClick={save} disabled={busy}>
                <Save size={15} /> {busy ? "Saving…" : "Save stock"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ComputeStock;
