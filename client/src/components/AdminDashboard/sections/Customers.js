import React, { useEffect, useMemo, useState } from "react";
import { Search, ChevronRight, Users as UsersIcon } from "lucide-react";
import { adminApi, inr, fmtDate } from "../adminApi";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "personal", label: "Personal" },
  { id: "business", label: "Business" },
  { id: "unverified", label: "Unverified" },
  { id: "suspended", label: "Suspended" },
];

const Customers = ({ openCustomer }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    adminApi("/getAllUsersWithDetails")
      .then((d) => setUsers(Array.isArray(d) ? d : []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((u) => {
      if (filter === "personal" && (u.account_type || "personal") !== "personal") return false;
      if (filter === "business" && u.account_type !== "business") return false;
      if (filter === "unverified" && (u.isemailverified ?? u.isEmailVerified)) return false;
      if (filter === "suspended" && !u.suspended_at) return false;
      if (!q) return true;
      return [u.name, u.email, u.phone, u.company, u.waladmin_id, String(u.id)].some((v) => (v || "").toLowerCase().includes(q));
    });
  }, [users, query, filter]);

  return (
    <div className="cx-page">
      <div className="cx-page-head cx-page-head-row">
        <div>
          <h2>Customers</h2>
          <p>{users.length} accounts</p>
        </div>
      </div>

      <div className="ap-toolbar">
        <label className="ap-search">
          <Search size={16} aria-hidden="true" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, email, phone, company or WALADMIN ID" />
        </label>
        <div className="ap-chips">
          {FILTERS.map((f) => (
            <button key={f.id} type="button" className={`ap-chip${filter === f.id ? " is-active" : ""}`} onClick={() => setFilter(f.id)}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="cx-alert is-error">{error}</div>}

      {loading ? (
        <div className="cx-card cx-empty"><p>Loading customers…</p></div>
      ) : shown.length === 0 ? (
        <div className="cx-card cx-empty">
          <span className="cx-empty-icon"><UsersIcon size={24} /></span>
          <h4>No customers match</h4>
        </div>
      ) : (
        <div className="cx-card cx-table-wrap">
          <table className="cx-table ap-click-rows">
            <thead>
              <tr><th>Customer</th><th>WALADMIN ID</th><th>Type</th><th>Status</th><th>Account balance</th><th>Cloud Compute</th><th>Joined</th><th /></tr>
            </thead>
            <tbody>
              {shown.map((u) => {
                const verified = u.isemailverified ?? u.isEmailVerified;
                return (
                  <tr key={u.id} onClick={() => openCustomer(u.id)}>
                    <td data-label="Customer"><strong>{u.name}</strong><small>{u.email}</small></td>
                    <td data-label="WALADMIN ID"><code className="ap-wid">{u.waladmin_id || "—"}</code></td>
                    <td data-label="Type">
                      <span className="cx-pill">{u.account_type === "business" ? "Business" : "Personal"}</span>
                      {u.company && <small>{u.company}</small>}
                    </td>
                    <td data-label="Status">
                      {u.suspended_at ? <span className="cx-status is-suspended">suspended</span>
                        : verified ? <span className="cx-status is-active">verified</span>
                        : <span className="cx-status is-pending">unverified</span>}
                    </td>
                    <td data-label="Account balance">{inr(u.balance)}</td>
                    <td data-label="Cloud Compute">{u.server_count ?? 0}</td>
                    <td data-label="Joined">{fmtDate(u.createdAt || u.createdat)}</td>
                    <td className="cx-actions"><ChevronRight size={16} aria-hidden="true" /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Customers;
