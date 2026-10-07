import React, { useCallback, useEffect, useState } from "react";
import { Save, RefreshCw } from "lucide-react";
import { adminApi } from "../adminApi";
import { formatRam } from "../../../data/plans";

/*
  Virtual Machine stock: how many of each plan may be sold in each location.
  Deploying takes one unit; deleting a server gives it back. "Running" counts
  live servers. Which SolusVM panel a server lands on (and how many each may
  hold) is set in SolusVM accounts.
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
        setDraft(Object.fromEntries(d.plans.map((p) => [p.name, { ...p.stock }])));
      })
      .catch((e) => setNotice({ type: "error", text: e.message }));
  }, []);

  useEffect(load, [load]);

  const setQty = (plan, loc, value) => setDraft((d) => ({ ...d, [plan]: { ...d[plan], [loc]: value } }));

  const save = async () => {
    const plans = data.plans.map((p) => ({
      name: p.name,
      // Only cells the admin changed, so saving a page loaded a while ago
      // doesn't undo units customers have bought since.
      stock: Object.fromEntries(data.locations
        .filter((l) => Number(draft[p.name][l.id] || 0) !== Number(p.stock[l.id] || 0))
        .map((l) => [l.id, Number(draft[p.name][l.id] || 0)])),
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

  const unserved = data.locations.filter((l) => !l.served).map((l) => l.name);
  const unlinked = data.plans.filter((p) => p.active && !p.linked).map((p) => p.name);

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

      {data.accounts === 0 && (
        <div className="cx-alert is-info">
          No SolusVM accounts yet, so nothing can be sold. Add one in <a className="cx-link" href="?section=solus-accounts">SolusVM accounts</a>.
        </div>
      )}
      {data.accounts > 0 && unserved.length > 0 && (
        <div className="cx-alert is-info">
          No active SolusVM account serves {unserved.join(", ")} yet, so stock there can't be sold. Link it in <a className="cx-link" href="?section=solus-accounts">SolusVM accounts</a>.
        </div>
      )}
      {data.accounts > 0 && unlinked.length > 0 && (
        <div className="cx-alert is-info">Not linked to a plan on any active SolusVM account: {unlinked.join(", ")}.</div>
      )}

      {data.locations.length === 0 ? (
        <div className="cx-alert is-info">No locations yet. Add one in <a className="cx-link" href="?section=locations">Locations</a>.</div>
      ) : (
        <>
          <div className="cx-card cx-table-wrap">
            <table className="cx-table ap-stock-table">
              <thead>
                <tr>
                  <th>Plan</th>
                  {data.locations.map((l) => <th key={l.id}>{l.name}{!l.served && <small className="ap-muted"> · not served</small>}</th>)}
                </tr>
              </thead>
              <tbody>
                {data.plans.map((p) => (
                  <tr key={p.name} className={p.active ? "" : "is-hidden-plan"}>
                    <td data-label="Plan">
                      <strong>{p.name}{p.active ? "" : " (hidden)"}</strong>
                      <small>{p.cpu === "amd" ? "AMD" : "Intel"} · {p.vcpu} vCPU · {formatRam(p.ram)} · {p.storage} GB NVMe · ₹{p.monthly.toLocaleString("en-IN")}/mo</small>
                    </td>
                    {data.locations.map((l) => (
                      <td key={l.id} data-label={l.name}>
                        <input type="number" min="0" max="100000" step="1" className="ap-stock-input" disabled={!editable}
                          value={draft[p.name][l.id] ?? 0} onChange={(e) => setQty(p.name, l.id, e.target.value)}
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
