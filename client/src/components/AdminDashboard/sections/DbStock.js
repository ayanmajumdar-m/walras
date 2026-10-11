import React, { useCallback, useEffect, useState } from "react";
import { Save, RefreshCw } from "lucide-react";
import { adminApi } from "../adminApi";
import { formatRam, formatStorage } from "../../../data/plans";
import ProductLocations from "./ProductLocations";

/*
  Managed Database → Stock: how many databases of each plan may be sold in
  each location (any engine). An order takes one; deleting a database returns
  it. Set it to what your team can set up: there's no automatic provisioning yet.
*/
const DbStock = ({ can }) => {
  const [data, setData] = useState(null);
  const [draft, setDraft] = useState({});
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);
  const editable = can("manage_services");

  const load = useCallback(() => {
    adminApi("/db/stock")
      .then((d) => { setData(d); setDraft(Object.fromEntries(d.plans.map((p) => [p.name, { ...p.stock }]))); })
      .catch((e) => setNotice({ type: "error", text: e.message }));
  }, []);
  useEffect(load, [load]);

  const save = async () => {
    // Only cells the admin changed, so units customers bought since loading aren't undone.
    const plans = data.plans.map((p) => ({
      name: p.name,
      stock: Object.fromEntries(data.locations
        .filter((l) => Number(draft[p.name][l.id] || 0) !== Number(p.stock[l.id] || 0))
        .map((l) => [l.id, Number(draft[p.name][l.id] || 0)])),
    }));
    setBusy(true);
    try {
      const d = await adminApi("/db/stock", { method: "PUT", body: { plans } });
      load();
      setNotice({ type: "success", text: d.message });
    } catch (e) {
      setNotice({ type: "error", text: e.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="cx-page">
      <div className="cx-page-head cx-page-head-row">
        <div>
          <h2>Managed Database stock</h2>
          <p>How many databases of each plan can be sold in each location. An order uses one; deleting a database returns it.</p>
        </div>
        <button type="button" className="cx-btn cx-btn-ghost" onClick={load}><RefreshCw size={15} /> Refresh</button>
      </div>
      {notice && <div className={`cx-alert is-${notice.type}`} role="status">{notice.text}</div>}
      <ProductLocations product="database" label="Managed Database" editable={can("manage_plans")} onSaved={load} />
      <div className="cx-alert is-info">New databases are set up by your team (Databases tab), so keep stock to what you can provision. Stock is set for the locations above.</div>
      {!data ? <div className="cx-card cx-empty"><p>Loading stock…</p></div> : data.locations.length === 0 ? (
        <div className="cx-alert is-info">Managed Database isn't offered in any location. Tick one above.</div>
      ) : (<>
        <div className="cx-card cx-table-wrap">
          <table className="cx-table ap-stock-table">
            <thead><tr><th>Plan</th>{data.locations.map((l) => <th key={l.id}>{l.name}</th>)}</tr></thead>
            <tbody>
              {data.plans.map((p) => (
                <tr key={p.name} className={p.active ? "" : "is-hidden-plan"}>
                  <td data-label="Plan">
                    <strong>{p.name}{p.active ? "" : " (hidden)"}</strong>
                    <small>{p.vcpu} vCPU · {formatRam(p.ram)} · {formatStorage(p.storage)} · ₹{p.monthly.toLocaleString("en-IN")}/mo</small>
                  </td>
                  {data.locations.map((l) => (
                    <td key={l.id} data-label={l.name}>
                      <input type="number" min="0" max="100000" step="1" className="ap-stock-input" disabled={!editable}
                        value={draft[p.name][l.id] ?? 0} onChange={(e) => setDraft((d) => ({ ...d, [p.name]: { ...d[p.name], [l.id]: e.target.value } }))}
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
            <button type="button" className="cx-btn cx-btn-primary" onClick={save} disabled={busy}><Save size={15} /> {busy ? "Saving…" : "Save stock"}</button>
          </div>
        )}
      </>)}
    </div>
  );
};

export default DbStock;
