import React, { useCallback, useEffect, useState } from "react";
import { Download, RefreshCw, BadgeCheck, Ban, FilePlus2, ChevronDown, ChevronUp } from "lucide-react";
import { adminApi } from "../adminApi";

/*
  Billing → Invoices: prepaid invoices (utils/monthlyBilling.js): a new
  server's (paid at purchase) and renewals issued on the 1st. Unpaid: 10% late fee after 48h,
  servers suspended after 72h, deleted after 5 days. Admins can waive the
  late fee and mark an invoice paid (money received outside Walras).
*/

const inr = (n) => `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const monthName = (d) => new Date(d).toLocaleDateString("en-IN", { month: "short", year: "numeric", timeZone: "UTC" });
const when = (d) => new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
const dateOnly = (d) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

const FILTERS = [
  { id: "unpaid", label: "Unpaid" },
  { id: "overdue", label: "Overdue" },
  { id: "paid", label: "Paid" },
  { id: "", label: "All" },
];

const statusOf = (i) => (i.status === "paid" ? { label: "Paid", cls: "is-active" }
  : i.suspended ? { label: "Suspended", cls: "is-failed" }
    : i.status === "overdue" ? { label: "Overdue", cls: "is-failed" } : { label: "Due", cls: "is-pending" });

const Lines = ({ id }) => {
  const [data, setData] = useState(null);
  useEffect(() => { adminApi(`/monthly-invoices/${id}`).then(setData).catch(() => setData({ items: [] })); }, [id]);
  if (!data) return <p className="ap-muted">Loading…</p>;
  if (!data.items.length) return <p className="ap-muted">No itemised lines (issued before monthly billing).</p>;
  return (
    <ul className="ap-inv-lines">
      {data.items.map((it, i) => (
        <li key={i}>
          <span>{it.description}</span>
          <span className="ap-muted">{dateOnly(it.periodStart)} – {dateOnly(it.periodEnd)} · {it.days}/{it.daysInMonth} days of {inr(it.monthlyPrice)}</span>
          <strong>{inr(it.amount)}</strong>
        </li>
      ))}
    </ul>
  );
};

const MonthlyInvoices = ({ can, openCustomer }) => {
  const [filter, setFilter] = useState("unpaid");
  const [data, setData] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(null);
  const [open, setOpen] = useState(null);
  const manage = can("manage_billing");

  const load = useCallback(() => {
    adminApi(`/monthly-invoices?status=${filter}`).then(setData).catch((e) => setNotice({ type: "error", text: e.message }));
  }, [filter]);
  useEffect(() => { setData(null); load(); }, [load]);

  const act = async (key, path, confirmText) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(key);
    try {
      const d = await adminApi(path, { method: "POST" });
      setNotice({ type: "success", text: d.message });
      load();
    } catch (e) {
      setNotice({ type: "error", text: e.message });
    } finally {
      setBusy(null);
    }
  };

  const download = async (inv) => {
    try {
      const res = await fetch(`/api/admin/monthly-invoices/${inv.id}/download`, { headers: { Authorization: `Bearer ${localStorage.getItem("adminToken")}` } });
      if (!res.ok) throw new Error("Couldn't download the invoice.");
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = `${inv.number}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) { setNotice({ type: "error", text: e.message }); }
  };

  return (
    <div className="cx-page">
      <div className="cx-page-head cx-page-head-row">
        <div>
          <h2>Invoices</h2>
          <p>Prepaid: a new server's invoice (rest of the month, pro rata) is paid at purchase; renewals are issued on the 1st for the month ahead. Unpaid: 10% late fee after 48 hours, servers suspended after 72 hours, deleted after 5 days.</p>
        </div>
        <div className="cx-welcome-actions">
          <button type="button" className="cx-btn cx-btn-ghost" onClick={load}><RefreshCw size={15} /> Refresh</button>
          {manage && (
            <button type="button" className="cx-btn cx-btn-ghost" disabled={busy === "gen"}
              onClick={() => act("gen", "/generate-monthly-invoices", "Renew now every server not yet paid for this month?")}>
              <FilePlus2 size={15} /> Run renewals
            </button>
          )}
        </div>
      </div>

      {notice && <div className={`cx-alert is-${notice.type}`} role="status">{notice.text}</div>}

      {data && (
        <div className="ap-inv-summary">
          <div className="cx-card"><small>Unpaid</small><strong>{data.summary.unpaidCount}</strong><span>{inr(data.summary.unpaidTotal)}</span></div>
          <div className="cx-card"><small>Overdue</small><strong>{data.summary.overdueCount}</strong><span>late fee stage</span></div>
          <div className="cx-card"><small>Suspended</small><strong>{data.summary.suspendedCount}</strong><span>servers stopped</span></div>
        </div>
      )}

      <div className="ap-subtabs" role="tablist">
        {FILTERS.map((f) => (
          <button key={f.id || "all"} type="button" role="tab" aria-selected={filter === f.id} className={`ap-subtab${filter === f.id ? " is-active" : ""}`}
            onClick={() => setFilter(f.id)}>{f.label}</button>
        ))}
      </div>

      {!data ? <div className="cx-card cx-empty"><p>Loading invoices…</p></div>
        : data.invoices.length === 0 ? <div className="cx-card cx-empty"><p>No invoices here.</p></div> : (
          <div className="cx-card cx-table-wrap">
            <table className="cx-table">
              <thead><tr><th>Invoice</th><th>Customer</th><th>Total</th><th>Due</th><th>Status</th><th /></tr></thead>
              <tbody>
                {data.invoices.map((inv) => {
                  const st = statusOf(inv);
                  const isOpen = open === inv.id;
                  const canWaive = manage && inv.subtotal !== null && !inv.lateFeeWaived && (inv.lateFee > 0 || inv.status !== "paid");
                  return (
                    <React.Fragment key={inv.id}>
                      <tr>
                        <td data-label="Invoice"><strong>{inv.number}</strong><small>{monthName(inv.month)} · {inv.kind === "purchase" ? "new server" : "renewal"} · issued {dateOnly(inv.issuedAt)}</small></td>
                        <td data-label="Customer">
                          <button type="button" className="cx-link ap-link-btn" onClick={() => openCustomer(inv.userId)}>{inv.customer}</button>
                          <small>{inv.email}</small>
                        </td>
                        <td data-label="Total">
                          {inr(inv.total)}
                          {inv.lateFee > 0 && <small className="is-warn">incl. late fee {inr(inv.lateFee)}</small>}
                          {inv.lateFeeWaived && <small>late fee waived</small>}
                        </td>
                        <td data-label="Due">
                          {inr(inv.due)}
                          {inv.status !== "paid" && inv.payBy && <small>{new Date() < new Date(inv.payBy) ? `pay by ${when(inv.payBy)}` : new Date() < new Date(inv.suspendAt) ? `suspends ${when(inv.suspendAt)}` : new Date() < new Date(inv.deleteAt) ? `deletes ${when(inv.deleteAt)}` : "servers deleted"}</small>}
                        </td>
                        <td data-label="Status"><span className={`cx-status ${st.cls}`}>{st.label}</span></td>
                        <td className="cx-actions">
                          <button type="button" className="cx-icon-btn" onClick={() => download(inv)} title="Download PDF"><Download size={15} /></button>
                          {canWaive && (
                            <button type="button" className="cx-icon-btn" disabled={busy === `w${inv.id}`} title={inv.lateFee > 0 ? "Waive late fee" : "Waive late fee (before it's added)"}
                              onClick={() => act(`w${inv.id}`, `/monthly-invoices/${inv.id}/waive-fee`,
                                inv.lateFee > 0 ? `Waive the ${inr(inv.lateFee)} late fee on ${inv.number}?` : `Waive the late fee on ${inv.number}? None will be added if it's paid late.`)}>
                              <Ban size={15} />
                            </button>
                          )}
                          {manage && inv.status !== "paid" && (
                            <button type="button" className="cx-icon-btn" disabled={busy === `p${inv.id}`} title="Mark paid"
                              onClick={() => act(`p${inv.id}`, `/monthly-invoices/${inv.id}/mark-paid`, `Mark ${inv.number} paid (${inr(inv.due)} received outside Walras)? Suspended servers start again.`)}>
                              <BadgeCheck size={15} />
                            </button>
                          )}
                          <button type="button" className="cx-icon-btn" onClick={() => setOpen(isOpen ? null : inv.id)} title={isOpen ? "Hide lines" : "Show lines"}>
                            {isOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                          </button>
                        </td>
                      </tr>
                      {isOpen && <tr className="ap-inv-detail"><td colSpan={6}><Lines id={inv.id} /></td></tr>}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
    </div>
  );
};

export default MonthlyInvoices;
