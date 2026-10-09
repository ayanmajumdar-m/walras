import React, { useEffect, useState } from "react";
import { Receipt, RefreshCw } from "lucide-react";
import { adminApi, inr, fmtDate } from "../adminApi";

const STATUSES = ["all", "completed", "pending", "failed", "cancelled"];

const statusClass = (s) => (s === "completed" ? "active" : s);

const Orders = ({ openCustomer }) => {
  const [orders, setOrders] = useState([]);
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = () => {
    setLoading(true);
    const qs = new URLSearchParams(status !== "all" ? { status } : {});
    adminApi(`/orders?${qs}`)
      .then((d) => { setOrders(d.orders || []); setError(""); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [status]);

  const paid = orders.filter((o) => o.status === "completed").reduce((s, o) => s + Number(o.amount || 0), 0);

  return (
    <div className="cx-page">
      <div className="cx-page-head cx-page-head-row">
        <div>
          <h2>Orders</h2>
          <p>CCAvenue payments: account balance top-ups and invoice payments. {orders.length} shown · {inr(paid)} paid</p>
        </div>
        <button type="button" className="cx-btn cx-btn-ghost" onClick={load} disabled={loading}><RefreshCw size={15} className={loading ? "cx-spin" : ""} /> Refresh</button>
      </div>

      <div className="ap-toolbar">
        <div className="ap-chips">
          {STATUSES.map((s) => <button key={s} type="button" className={`ap-chip${status === s ? " is-active" : ""}`} onClick={() => setStatus(s)}>{s === "all" ? "Any status" : s}</button>)}
        </div>
      </div>

      {error && <div className="cx-alert is-error">{error}</div>}

      {!loading && orders.length === 0 ? (
        <div className="cx-card cx-empty"><span className="cx-empty-icon"><Receipt size={24} /></span><h4>No orders</h4><p>Nothing matches these filters.</p></div>
      ) : (
        <div className="cx-card cx-table-wrap">
          <table className="cx-table ap-click-rows">
            <thead><tr><th>Order</th><th>Customer</th><th>Item</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.order_id} onClick={() => o.user_id && openCustomer(o.user_id)}>
                  <td data-label="Order"><code>{o.order_id}</code>{o.tracking_id && <small>Ref {o.tracking_id}</small>}</td>
                  <td data-label="Customer"><strong>{o.user_name || "—"}</strong><small>{o.email}</small></td>
                  <td data-label="Item">{o.item}</td>
                  <td data-label="Amount">{inr(o.amount)}</td>
                  <td data-label="Status"><span className={`cx-status is-${statusClass(o.status)}`}>{o.status}</span></td>
                  <td data-label="Date">{fmtDate(o.created_at, true)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Orders;
