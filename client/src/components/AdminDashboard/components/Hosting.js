import React, { useState } from "react";
import { Server, ExternalLink, ShieldAlert, ShieldCheck, Trash2, Search, RefreshCw } from "lucide-react";

const Hosting = ({ hostingAccounts = [], onSuspend, onUnsuspend, onDelete, onLogin, onRefresh, formatDate }) => {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [actionLoading, setActionLoading] = useState(null);

  const safeAccounts = Array.isArray(hostingAccounts) ? hostingAccounts : [];

  const filtered = safeAccounts.filter((acc) => {
    const matchesFilter =
      filter === "all" ||
      (filter === "active" && acc.status === "active") ||
      (filter === "suspended" && acc.status === "suspended");

    const s = search.toLowerCase();
    const matchesSearch =
      !s ||
      acc.domain?.toLowerCase().includes(s) ||
      acc.user_name?.toLowerCase().includes(s) ||
      acc.user_email?.toLowerCase().includes(s) ||
      acc.cpanel_username?.toLowerCase().includes(s);

    return matchesFilter && matchesSearch;
  });

  const handleAction = async (actionType, id, ...args) => {
    setActionLoading(`${actionType}-${id}`);
    try {
      if (actionType === "suspend") await onSuspend(id, ...args);
      if (actionType === "unsuspend") await onUnsuspend(id);
      if (actionType === "delete") await onDelete(id);
      if (actionType === "login") await onLogin(id);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="servers-management hosting-management">
      <div className="section-header">
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <h3>Web Hosting & cPanel Accounts</h3>
          {onRefresh && (
            <button className="btn btn-secondary btn-sm" onClick={onRefresh} title="Refresh">
              <RefreshCw size={14} />
            </button>
          )}
        </div>
        <div className="servers-stats">
          <span>Total: {safeAccounts.length}</span>
          <span>Active: {safeAccounts.filter((a) => a.status === "active").length}</span>
          <span>Suspended: {safeAccounts.filter((a) => a.status === "suspended").length}</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "16px", gap: "12px", flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            className={`btn btn-sm ${filter === "all" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setFilter("all")}
          >
            All ({safeAccounts.length})
          </button>
          <button
            className={`btn btn-sm ${filter === "active" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setFilter("active")}
          >
            Active ({safeAccounts.filter((a) => a.status === "active").length})
          </button>
          <button
            className={`btn btn-sm ${filter === "suspended" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setFilter("suspended")}
          >
            Suspended ({safeAccounts.filter((a) => a.status === "suspended").length})
          </button>
        </div>

        <div style={{ position: "relative", minWidth: "240px" }}>
          <Search size={16} style={{ position: "absolute", left: "10px", top: "10px", color: "#94a3b8" }} />
          <input
            type="text"
            placeholder="Search domain, user, or cPanel..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              padding: "8px 12px 8px 34px",
              background: "#1e293b",
              border: "1px solid #334155",
              borderRadius: "6px",
              color: "#ffffff",
              fontSize: "13px",
              width: "100%"
            }}
          />
        </div>
      </div>

      <div className="servers-table">
        <div className="table-header">
          <div className="table-cell">Domain</div>
          <div className="table-cell">User</div>
          <div className="table-cell">Plan & Package</div>
          <div className="table-cell">cPanel User</div>
          <div className="table-cell">Status</div>
          <div className="table-cell">Expires</div>
          <div className="table-cell" style={{ textAlign: "right" }}>Actions</div>
        </div>
        <div className="table-body">
          {filtered.length === 0 ? (
            <div style={{ padding: "30px", textAlign: "center", color: "#94a3b8" }}>
              No hosting accounts found matching your criteria.
            </div>
          ) : (
            filtered.map((acc) => {
              const isSuspended = acc.status === "suspended";
              return (
                <div key={acc.id} className="table-row">
                  <div className="table-cell">
                    <strong>{acc.domain}</strong>
                  </div>
                  <div className="table-cell">
                    <div>{acc.user_name || "User #" + acc.user_id}</div>
                    <div style={{ fontSize: "11px", color: "#94a3b8" }}>{acc.user_email}</div>
                  </div>
                  <div className="table-cell">
                    <span style={{ fontWeight: "600", color: "#eab308" }}>{acc.plan_name}</span>
                    <span style={{ fontSize: "12px", color: "#94a3b8", marginLeft: "4px" }}>({acc.cpanel_package})</span>
                  </div>
                  <div className="table-cell">
                    <code style={{ background: "#0f172a", padding: "2px 6px", borderRadius: "4px", color: "#38bdf8" }}>
                      {acc.cpanel_username}
                    </code>
                  </div>
                  <div className="table-cell">
                    <span className={`status ${acc.status}`}>
                      {acc.status}
                    </span>
                    {acc.suspension_reason && (
                      <div style={{ fontSize: "10px", color: "#f87171", marginTop: "2px" }}>
                        {acc.suspension_reason}
                      </div>
                    )}
                  </div>
                  <div className="table-cell">
                    <span>{formatDate(acc.expires_at)}</span>
                  </div>
                  <div className="table-cell">
                    <div className="action-buttons" style={{ justifyContent: "flex-end", gap: "6px" }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleAction("login", acc.id)}
                        disabled={actionLoading === `login-${acc.id}`}
                        title="Login to cPanel"
                      >
                        <ExternalLink size={13} />
                        <span>cPanel</span>
                      </button>

                      {isSuspended ? (
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => handleAction("unsuspend", acc.id)}
                          disabled={actionLoading === `unsuspend-${acc.id}`}
                          title="Unsuspend cPanel Account"
                        >
                          <ShieldCheck size={13} />
                          <span>Unsuspend</span>
                        </button>
                      ) : (
                        <button
                          className="btn btn-warning btn-sm"
                          style={{ background: "#eab308", color: "#0f172a" }}
                          onClick={() => {
                            const reason = window.prompt("Enter reason for suspension:", "Administrative suspension");
                            if (reason !== null) {
                              handleAction("suspend", acc.id, reason);
                            }
                          }}
                          disabled={actionLoading === `suspend-${acc.id}`}
                          title="Suspend cPanel Account"
                        >
                          <ShieldAlert size={13} />
                          <span>Suspend</span>
                        </button>
                      )}

                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => {
                          if (window.confirm(`Are you sure you want to delete hosting account ${acc.domain} (${acc.cpanel_username}) from cPanel and database?`)) {
                            handleAction("delete", acc.id);
                          }
                        }}
                        disabled={actionLoading === `delete-${acc.id}`}
                        title="Delete Account from cPanel"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default Hosting;
