import React, { useEffect, useState } from "react";
import { ScrollText, ChevronLeft, ChevronRight } from "lucide-react";
import { adminApi, fmtDate } from "../adminApi";

const ACTION_FILTERS = [
  { id: "", label: "Everything" },
  { id: "admin.", label: "Administrators" },
  { id: "role.", label: "Roles" },
  { id: "user.", label: "Customers" },
  { id: "wallet.", label: "Wallets" },
  { id: "hosting.", label: "Hosting" },
  { id: "promo.", label: "Promo codes" },
  { id: "invoice.", label: "Invoices" },
  { id: "settings.", label: "Settings" },
];

const describe = (m) => {
  if (!m || typeof m !== "object") return "";
  return Object.entries(m)
    .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`)
    .join(" · ");
};

const AuditLogs = ({ openCustomer }) => {
  const [action, setAction] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ logs: [], total: 0, limit: 50 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    const qs = new URLSearchParams({ page: String(page), limit: "50", ...(action && { action }) });
    adminApi(`/audit-logs?${qs}`)
      .then((d) => { setData(d); setError(""); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [action, page]);

  const pages = Math.max(1, Math.ceil(data.total / data.limit));

  return (
    <div className="cx-page">
      <div className="cx-page-head">
        <h2>Audit logs</h2>
        <p>Every change made from this admin panel: who, what, to which record, and from where.</p>
      </div>

      <div className="ap-toolbar">
        <div className="ap-chips">
          {ACTION_FILTERS.map((f) => (
            <button key={f.id || "all"} type="button" className={`ap-chip${action === f.id ? " is-active" : ""}`}
              onClick={() => { setAction(f.id); setPage(1); }}>{f.label}</button>
          ))}
        </div>
      </div>

      {error && <div className="cx-alert is-error">{error}</div>}

      {!loading && data.logs.length === 0 ? (
        <div className="cx-card cx-empty"><span className="cx-empty-icon"><ScrollText size={24} /></span><h4>No entries yet</h4><p>Admin actions will be recorded here as they happen.</p></div>
      ) : (
        <div className="cx-card cx-table-wrap">
          <table className="cx-table">
            <thead><tr><th>When</th><th>Admin</th><th>Action</th><th>Target</th><th>Details</th><th>IP</th></tr></thead>
            <tbody>
              {data.logs.map((l) => (
                <tr key={l.id}>
                  <td data-label="When">{fmtDate(l.created_at, true)}</td>
                  <td data-label="Admin"><strong>{l.admin_username || "—"}</strong></td>
                  <td data-label="Action"><code>{l.action}</code></td>
                  <td data-label="Target">
                    {l.target_type === "user" && l.target_id
                      ? <button type="button" className="ap-linkish" onClick={() => openCustomer(l.target_id)}>Customer #{l.target_id}</button>
                      : l.target_type ? `${l.target_type}${l.target_id ? ` #${l.target_id}` : ""}` : "—"}
                  </td>
                  <td data-label="Details" className="ap-details">{describe(l.metadata)}</td>
                  <td data-label="IP"><code>{l.ip || "—"}</code></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <div className="ap-pager">
          <button type="button" className="cx-btn cx-btn-ghost cx-btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft size={14} /> Newer</button>
          <span>Page {page} of {pages}</span>
          <button type="button" className="cx-btn cx-btn-ghost cx-btn-sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>Older <ChevronRight size={14} /></button>
        </div>
      )}
    </div>
  );
};

export default AuditLogs;
