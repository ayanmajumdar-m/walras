import React, { useCallback, useEffect, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Wallet as WalletIcon, CalendarClock, Receipt } from "lucide-react";
import { api } from "../consoleApi";

/*
  Billing → Usage & activity: balance, next renewal, wallet transactions and
  (for older accounts) usage charges. Refreshes by itself every 30 seconds
  and whenever the tab comes back into view.
*/

const REFRESH_MS = 30 * 1000;

const inr = (n) => `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const when = (d) => new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });

const STATUS = {
  completed: { label: "Completed", cls: "is-active" },
  pending: { label: "Pending", cls: "is-pending" },
  failed: { label: "Failed", cls: "is-failed" },
  cancelled: { label: "Failed", cls: "is-failed" },
};

const FILTERS = [
  { id: "all", label: "All" },
  { id: "completed", label: "Completed" },
  { id: "pending", label: "Pending" },
  { id: "failed", label: "Failed" },
];
// Older abandoned checkouts were saved as cancelled; they count as failed.
const statusGroup = (s) => (s === "cancelled" ? "failed" : s);

const Logs = () => {
  const [filter, setFilter] = useState("all");
  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState(null);
  const [usage, setUsage] = useState([]);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const [w, t, u] = await Promise.all([
        api("/api/wallet"),
        api("/api/wallet/transactions"),
        api("/api/users/wallet/billing-history").catch(() => ({ billingHistory: [] })),
      ]);
      setWallet(w);
      setTransactions(t.transactions || []);
      setUsage(u.billingHistory || []);
      setError("");
    } catch (e) {
      if (e.message !== "Session expired") setError(e.message);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(() => { if (!document.hidden) load(); }, REFRESH_MS);
    const onVisible = () => { if (!document.hidden) load(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", onVisible); };
  }, [load]);

  const count = (id) => (transactions || []).filter((t) => id === "all" || statusGroup(t.status) === id).length;
  const shown = (transactions || []).filter((t) => filter === "all" || statusGroup(t.status) === filter);
  const credits = (transactions || []).filter((t) => t.type === "credit" && t.status === "completed").reduce((n, t) => n + parseFloat(t.amount), 0);
  const debits = (transactions || []).filter((t) => t.type === "debit" && t.status === "completed").reduce((n, t) => n + parseFloat(t.amount), 0);

  return (
    <div className="lg-page">
      {error && <div className="cx-alert is-error">{error}</div>}

      <div className="lg-stats">
        <div className="cx-card lg-stat">
          <span className="lg-stat-icon"><WalletIcon size={18} aria-hidden="true" /></span>
          <small>Available balance</small>
          <strong>{wallet ? inr(wallet.balance) : "—"}</strong>
        </div>
        <div className="cx-card lg-stat">
          <span className="lg-stat-icon"><CalendarClock size={18} aria-hidden="true" /></span>
          <small>Next renewal</small>
          <strong>{wallet ? inr(wallet.nextRenewal) : "—"}</strong>
          <span className="lg-stat-note">{wallet?.nextInvoiceDate ? `+ GST on ${wallet.nextInvoiceDate}` : ""}</span>
        </div>
        <div className="cx-card lg-stat">
          <span className="lg-stat-icon"><ArrowDownLeft size={18} aria-hidden="true" /></span>
          <small>Added (last 100)</small>
          <strong>{inr(credits)}</strong>
        </div>
        <div className="cx-card lg-stat">
          <span className="lg-stat-icon"><ArrowUpRight size={18} aria-hidden="true" /></span>
          <small>Spent (last 100)</small>
          <strong>{inr(debits)}</strong>
        </div>
      </div>

      <section className="cx-card lg-section">
        <div className="lg-section-head">
          <h3>Wallet transactions</h3>
          <small>Money added to and spent from your account balance. A payment not completed within 3 hours is marked failed.</small>
        </div>
        {transactions?.length > 0 && (
          <div className="lg-filters" role="tablist" aria-label="Filter by status">
            {FILTERS.map((f) => (
              <button key={f.id} type="button" role="tab" aria-selected={filter === f.id}
                className={`lg-filter${filter === f.id ? " is-active" : ""}`} onClick={() => setFilter(f.id)}>
                {f.label} <span>{count(f.id)}</span>
              </button>
            ))}
          </div>
        )}
        {transactions === null ? (
          <p className="lg-empty">Loading…</p>
        ) : transactions.length === 0 ? (
          <p className="lg-empty">No wallet transactions yet. Top-ups, purchases and invoice payments appear here.</p>
        ) : shown.length === 0 ? (
          <p className="lg-empty">No {filter} transactions.</p>
        ) : (
          <div className="cx-table-wrap">
            <table className="cx-table">
              <thead><tr><th>Date</th><th>Description</th><th>Status</th><th className="lg-num">Amount</th></tr></thead>
              <tbody>
                {shown.map((t, i) => {
                  const st = STATUS[t.status] || STATUS.completed;
                  const credit = t.type === "credit";
                  return (
                    <tr key={`${t.created_at}-${i}`}>
                      <td data-label="Date">{when(t.created_at)}</td>
                      <td data-label="Description">{t.description}{t.payment_id && <small>Ref: {t.payment_id}</small>}</td>
                      <td data-label="Status"><span className={`cx-status ${st.cls}`}>{st.label}</span></td>
                      <td data-label="Amount" className={`lg-num ${t.status !== "completed" ? "is-void" : credit ? "is-credit" : "is-debit"}`}>{credit ? "+" : "−"}{inr(t.amount)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {usage.length > 0 && (
        <section className="cx-card lg-section">
          <div className="lg-section-head">
            <h3><Receipt size={16} aria-hidden="true" /> Earlier usage charges</h3>
            <small>Charges recorded before monthly billing. New charges are on your invoices.</small>
          </div>
          <div className="cx-table-wrap">
            <table className="cx-table">
              <thead><tr><th>Date</th><th>Description</th><th className="lg-num">Amount</th></tr></thead>
              <tbody>
                {usage.map((u, i) => (
                  <tr key={i}>
                    <td data-label="Date">{when(u.billing_period || u.created_at)}</td>
                    <td data-label="Description">{u.description}</td>
                    <td data-label="Amount" className="lg-num is-debit">−{inr(u.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
};

export default Logs;
