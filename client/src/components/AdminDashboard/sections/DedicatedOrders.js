import React, { useCallback, useEffect, useState } from "react";
import { RefreshCw, Search, X, Pencil } from "lucide-react";
import { adminApi } from "../adminApi";
import { formatInr, processorLine } from "../../Dedicated/DedicatedCatalog";

/*
  Products → Dedicated → Orders: who bought which server and where it
  stands. Bought (being set up) → Active once it's handed over, or
  Cancelled (its stock goes back). The note is shown to the customer, e.g.
  the server's IP address. Nothing is charged or provisioned automatically.
*/

const STATUS = {
  pending: { label: "Bought", tone: "pending" },
  active: { label: "Active", tone: "active" },
  cancelled: { label: "Cancelled", tone: "stopped" },
};
const FILTERS = [["all", "All"], ["pending", "Bought"], ["active", "Active"], ["cancelled", "Cancelled"]];

const day = (d) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—");

const StatusModal = ({ order, onClose, onDone }) => {
  const [status, setStatus] = useState(order.status === "pending" ? "active" : order.status);
  const [note, setNote] = useState(order.note || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const save = async () => {
    setBusy(true);
    setError("");
    try {
      onDone((await adminApi(`/dedicated/orders/${order.id}`, { method: "PUT", body: { status, note } })).message);
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };
  return (
    <div className="cx-modal-scrim" onClick={onClose}>
      <div className="cx-modal" role="dialog" aria-modal="true" aria-label="Order status" onClick={(e) => e.stopPropagation()}>
        <div className="cx-modal-head">
          <h3>{order.spec.cpu || order.title} for {order.customer}</h3>
          <button type="button" className="cx-icon-btn" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <div className="ap-seg ap-seg-3">
          {Object.entries(STATUS).map(([id, s]) => (
            <button key={id} type="button" className={status === id ? "is-active" : ""} onClick={() => setStatus(id)}>{id === "pending" ? "Bought" : s.label}</button>
          ))}
        </div>
        <label className="cx-field"><span>Note for the customer (optional)</span>
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="IP 203.0.113.10 · login details sent by email" />
        </label>
        <p className="ap-muted">
          {status === "active" ? "Set it up first: marking it active only tells the customer it's ready."
            : status === "cancelled" ? "The server goes back into stock. Nothing was charged, so there's nothing to refund."
              : "Bought: the customer sees it's being set up."}
        </p>
        {error && <div className="cx-alert is-error">{error}</div>}
        <button type="button" className="cx-btn cx-btn-primary cx-btn-block" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save"}</button>
      </div>
    </div>
  );
};

const DedicatedOrders = ({ can, openCustomer }) => {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [editing, setEditing] = useState(null);
  const manage = can("manage_services");

  const load = useCallback(() => {
    adminApi("/dedicated/orders").then(setData).catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  const orders = data?.orders || [];
  const term = search.trim().toLowerCase();
  const shown = orders.filter((o) => (filter === "all" || o.status === filter)
    && (!term || [o.title, o.customer, o.email, o.waladminId, o.company, o.location].some((v) => String(v || "").toLowerCase().includes(term))));
  const count = (id) => (id === "all" ? orders.length : orders.filter((o) => o.status === id).length);

  return (
    <div className="cx-page">
      <div className="cx-page-head cx-page-head-row">
        <div>
          <h2>Dedicated server orders</h2>
          <p>Who bought which server. Set each one up by hand, then mark it active.</p>
        </div>
        <button type="button" className="cx-btn cx-btn-ghost" onClick={load}><RefreshCw size={15} /> Refresh</button>
      </div>
      {error && <div className="cx-alert is-error">{error}</div>}
      {notice && <div className={`cx-alert is-${notice.type}`} role="status">{notice.text}</div>}
      <div className="ap-toolbar">
        <label className="ap-search">
          <Search size={16} aria-hidden="true" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search server, customer, email or WALADMIN ID" />
        </label>
        <div className="ap-chips">
          {FILTERS.map(([id, label]) => (
            <button key={id} type="button" className={`ap-chip${filter === id ? " is-active" : ""}`} onClick={() => setFilter(id)}>{label} ({count(id)})</button>
          ))}
        </div>
      </div>
      {!data ? <div className="cx-card cx-empty"><p>Loading orders…</p></div> : shown.length === 0 ? (
        <div className="cx-card cx-empty"><p>{orders.length ? "No orders match." : "No dedicated servers ordered yet."}</p></div>
      ) : (
        <div className="cx-card cx-table-wrap">
          <table className="cx-table">
            <thead><tr><th>Server</th><th>Customer</th><th>Location</th><th>Price</th><th>Status</th><th>Ordered</th><th /></tr></thead>
            <tbody>
              {shown.map((o) => {
                const st = STATUS[o.status] || STATUS.pending;
                return (
                  <tr key={o.id}>
                    <td data-label="Server"><strong>{o.spec.cpu || o.title}</strong><small>{o.spec.cores ? `${processorLine(o.spec)} · ${o.spec.memoryGb}GB · ${o.spec.storage}` : o.title}</small></td>
                    <td data-label="Customer">
                      <button type="button" className="cx-link ap-link-btn" onClick={() => openCustomer(o.userId)}>{o.customer}</button>
                      <small>{o.waladminId} · {o.email}{o.company ? ` · ${o.company}` : ""}</small>
                    </td>
                    <td data-label="Location">{o.location}</td>
                    <td data-label="Price">{formatInr(o.monthly)}/mo</td>
                    <td data-label="Status">
                      <span className={`cx-status is-${st.tone}`}>{st.label}</span>
                      {o.note && <small>{o.note}</small>}
                    </td>
                    <td data-label="Ordered">{day(o.createdAt)}{o.status === "active" && o.activatedAt && <small>active {day(o.activatedAt)}</small>}</td>
                    <td className="cx-actions">
                      {manage && <button type="button" className="cx-icon-btn" onClick={() => setEditing(o)} title="Change status"><Pencil size={15} /></button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {editing && (
        <StatusModal order={editing} onClose={() => setEditing(null)}
          onDone={(text) => { setEditing(null); setNotice({ type: "success", text }); load(); }} />
      )}
    </div>
  );
};

export default DedicatedOrders;
