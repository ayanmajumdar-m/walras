import React, { useCallback, useEffect, useState } from "react";
import { RefreshCw, Search } from "lucide-react";
import { adminApi } from "../adminApi";

/*
  App Platform → Apps: every customer's apps (domain, plan, status, billing).
  There's no provisioning integration yet: an app is active once it's paid.
*/

const when = (d) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—");

const Apps = ({ openCustomer }) => {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");

  const load = useCallback(() => {
    adminApi("/apps").then(setData).catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  const term = search.trim().toLowerCase();
  const shown = (data?.apps || []).filter((a) => !term || [a.domain, a.customer, a.email, a.waladminId].some((v) => String(v || "").toLowerCase().includes(term)));

  return (
    <div className="cx-page">
      <div className="cx-page-head cx-page-head-row">
        <div>
          <h2>App Platform apps</h2>
          <p>Customers' apps and their domains. An app is active as soon as it's paid.</p>
        </div>
        <button type="button" className="cx-btn cx-btn-ghost" onClick={load}><RefreshCw size={15} /> Refresh</button>
      </div>
      {error && <div className="cx-alert is-error">{error}</div>}
      <div className="ap-toolbar">
        <label className="ap-search">
          <Search size={16} aria-hidden="true" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search domain, customer, email or WALADMIN ID" />
        </label>
      </div>
      {!data ? <div className="cx-card cx-empty"><p>Loading apps…</p></div> : shown.length === 0 ? (
        <div className="cx-card cx-empty"><p>{data.apps.length ? "No apps match." : "No apps yet."}</p></div>
      ) : (
        <div className="cx-card cx-table-wrap">
          <table className="cx-table">
            <thead><tr><th>Domain</th><th>Location</th><th>Customer</th><th>Plan</th><th>Status</th><th>Since</th></tr></thead>
            <tbody>
              {shown.map((a) => (
                <tr key={a.id}>
                  <td data-label="Domain"><strong>{a.domain}</strong></td>
                  <td data-label="Location">{a.location || "—"}</td>
                  <td data-label="Customer">
                    <button type="button" className="cx-link ap-link-btn" onClick={() => openCustomer(a.userId)}>{a.customer}</button>
                    <small>{a.waladminId} · {a.email}</small>
                  </td>
                  <td data-label="Plan">{a.plan}<small>{a.type === "dedicated" ? "Dedicated" : "Shared"} · ₹{a.monthlyCost.toLocaleString("en-IN")}/mo</small></td>
                  <td data-label="Status">
                    <span className={`cx-status ${a.suspended ? "is-suspended" : a.status === "active" ? "is-active" : "is-failed"}`}>{a.suspended ? "suspended" : a.status}</span>
                    {a.cancelAt && <small className="is-warn">cancelled, ends {when(a.cancelAt)}</small>}
                  </td>
                  <td data-label="Since">{when(a.createdAt)}<small>paid until {when(a.paidUntil)}</small></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Apps;
