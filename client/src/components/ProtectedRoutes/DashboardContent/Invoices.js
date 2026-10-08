import React, { useCallback, useEffect, useState } from "react";
import { Download, ChevronDown, ChevronUp, FileText, AlertTriangle } from "lucide-react";
import { api, authHeaders } from "../consoleApi";
import { useConsole } from "../ConsoleContext";

/*
  Billing → Invoices: the monthly invoices (utils/monthlyBilling.js on the
  server): one per new server (paid at purchase, pro rata) and a renewal on
  the 1st for the month ahead. Paying
  uses the account balance first, then CCAvenue for the rest.
*/

const inr = (n) => `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const when = (d) => new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
const dateOnly = (d) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
const monthName = (d) => new Date(d).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });

const STATUS = {
  paid: { label: "Paid", cls: "is-active" },
  pending: { label: "Due", cls: "is-pending" },
  overdue: { label: "Overdue", cls: "is-failed" },
};

const goToCheckout = ({ actionUrl, encRequest, accessCode }) => {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = actionUrl;
  for (const [name, value] of [["encRequest", encRequest], ["access_code", accessCode]]) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = value;
    form.appendChild(input);
  }
  document.body.appendChild(form);
  form.submit();
};

const downloadPdf = async (inv) => {
  const path = `/api/invoices/${inv.id}/pdf`;
  const res = await fetch(path, { headers: authHeaders(path) });
  if (!res.ok) throw new Error("Couldn't download the invoice.");
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = `${inv.number}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

/** What happens next for an unpaid invoice. */
const nextStep = (inv, policy) => {
  if (inv.status === "paid" || inv.due <= 0 || !inv.payBy) return null;
  const now = Date.now();
  if (now < new Date(inv.payBy)) return `Pay by ${when(inv.payBy)} to avoid a ${policy.lateFeePercent}% late fee.`;
  if (now < new Date(inv.suspendAt)) return `Overdue. Your servers will be suspended on ${when(inv.suspendAt)} unless it's paid.`;
  if (now < new Date(inv.deleteAt)) return `Your servers are suspended. They will be deleted on ${when(inv.deleteAt)} unless it's paid.`;
  return "Your servers were deleted because this invoice wasn't paid. It is still due.";
};

const Lines = ({ id }) => {
  const [data, setData] = useState(null);
  useEffect(() => { api(`/api/invoices/${id}`).then(setData).catch(() => setData({ items: [] })); }, [id]);
  if (!data) return <p className="cx-muted iv-lines-loading">Loading…</p>;
  const inv = data.invoice;
  return (
    <div className="iv-lines">
      <table className="cx-table">
        <thead><tr><th>Service</th><th>Period</th><th>Days</th><th className="iv-num">Amount</th></tr></thead>
        <tbody>
          {data.items.map((it, i) => (
            <tr key={i}>
              <td data-label="Service">{it.description}<small>{inr(it.monthlyPrice)}/month</small></td>
              <td data-label="Period">{dateOnly(it.periodStart)} – {dateOnly(it.periodEnd)}</td>
              <td data-label="Days">{it.days} of {it.daysInMonth}</td>
              <td data-label="Amount" className="iv-num">{inr(it.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {inv && inv.subtotal !== null && (
        <dl className="iv-totals">
          <div><dt>Subtotal</dt><dd>{inr(inv.subtotal)}</dd></div>
          <div><dt>GST</dt><dd>{inr(inv.tax)}</dd></div>
          {inv.lateFee > 0 && <div><dt>Late fee</dt><dd>{inr(inv.lateFee)}</dd></div>}
          {inv.lateFeeWaived && <div><dt>Late fee</dt><dd>Waived</dd></div>}
          <div className="is-total"><dt>Total</dt><dd>{inr(inv.total)}</dd></div>
          {inv.paid > 0 && <div><dt>Paid</dt><dd>−{inr(inv.paid)}</dd></div>}
          <div className="is-total"><dt>Due</dt><dd>{inr(inv.due)}</dd></div>
        </dl>
      )}
    </div>
  );
};

const Invoices = () => {
  const { refreshBalance } = useConsole();
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(null);
  const [busy, setBusy] = useState(null);
  const [notice, setNotice] = useState(null);

  const load = useCallback(() => {
    api("/api/invoices").then(setData).catch((e) => setNotice({ type: "error", text: e.message }));
  }, []);

  useEffect(() => {
    load();
    // Back from paying an invoice through CCAvenue.
    const params = new URLSearchParams(window.location.search);
    const result = params.get("invoice");
    if (result) {
      setNotice(result === "paid" ? { type: "success", text: "Thanks, your payment was received and applied to your invoice." }
        : result === "cancelled" ? { type: "info", text: "Payment cancelled. Nothing was charged." }
          : { type: "error", text: `Payment failed: ${params.get("reason") || "please try again."}` });
      ["invoice", "reason"].forEach((k) => params.delete(k));
      window.history.replaceState({}, document.title, `${window.location.pathname}${params.toString() ? `?${params}` : ""}`);
    }
  }, [load]);

  const pay = async (inv) => {
    setBusy(inv.id);
    setNotice(null);
    try {
      const d = await api(`/api/invoices/${inv.id}/pay`, { method: "POST" });
      if (d.paid) {
        setNotice({ type: "success", text: d.message });
        load();
        refreshBalance?.();
        setBusy(null);
        return;
      }
      goToCheckout(d); // leaves the page
    } catch (e) {
      setNotice({ type: "error", text: e.message });
      setBusy(null);
    }
  };

  const download = async (inv) => {
    try { await downloadPdf(inv); } catch (e) { setNotice({ type: "error", text: e.message }); }
  };

  if (!data) {
    return notice ? <div className={`cx-alert is-${notice.type}`}>{notice.text}</div> : <div className="cx-card cx-empty"><p>Loading invoices…</p></div>;
  }
  const { invoices, summary, policy } = data;

  return (
    <div className="iv-page">
      {notice && <div className={`cx-alert is-${notice.type}`} role="status">{notice.text}</div>}

      {summary.due > 0 && (
        <div className={`cx-alert ${summary.overdue ? "is-error" : "is-info"} iv-due`}>
          <AlertTriangle size={18} aria-hidden="true" />
          <div>
            <strong>{inr(summary.due)} due</strong>
            {summary.oldest && <span>{nextStep(summary.oldest, policy)}</span>}
          </div>
        </div>
      )}

      <p className="cx-muted iv-policy">
        Plans are prepaid. A new server is paid for the rest of its first month (pro rata per day) when you create it; after
        that, each month is invoiced on the 1st and paid from your account balance first. Anything left must be paid within
        {policy.payWithinHours} hours, or a {policy.lateFeePercent}% late fee is added. Unpaid after {policy.suspendAfterHours} hours,
        services are suspended; after {policy.deleteAfterDays} days they are deleted.
      </p>

      {invoices.length === 0 ? (
        <div className="cx-card cx-empty">
          <span className="cx-empty-icon"><FileText size={26} aria-hidden="true" /></span>
          <h4>No invoices yet</h4>
          <p>You get an invoice each time you create a server, and a renewal on the 1st of each month.</p>
        </div>
      ) : (
        <div className="iv-list">
          {invoices.map((inv) => {
            const st = STATUS[inv.status] || STATUS.pending;
            const step = nextStep(inv, policy);
            const isOpen = open === inv.id;
            return (
              <div key={inv.id} className="cx-card iv-item">
                <div className="iv-row">
                  <div className="iv-main">
                    <strong>{monthName(inv.month)}{inv.kind === "purchase" ? " · new server" : " · renewal"}</strong>
                    <small>{inv.number} · issued {dateOnly(inv.issuedAt)}</small>
                  </div>
                  <span className={`cx-status ${st.cls}`}>{inv.suspended ? "Suspended" : st.label}</span>
                  <div className="iv-amount">
                    <strong>{inr(inv.total)}</strong>
                    {inv.status !== "paid" && inv.paid > 0 && <small>{inr(inv.due)} left to pay</small>}
                  </div>
                  <div className="iv-actions">
                    {inv.status !== "paid" && inv.due > 0 && (
                      <button type="button" className="cx-btn cx-btn-primary cx-btn-sm" onClick={() => pay(inv)} disabled={busy === inv.id}>
                        {busy === inv.id ? "Opening…" : `Pay ${inr(inv.due)}`}
                      </button>
                    )}
                    <button type="button" className="cx-icon-btn" onClick={() => download(inv)} title="Download PDF" aria-label="Download PDF"><Download size={16} /></button>
                    <button type="button" className="cx-icon-btn" onClick={() => setOpen(isOpen ? null : inv.id)} aria-expanded={isOpen}
                      title={isOpen ? "Hide details" : "Show details"} aria-label={isOpen ? "Hide details" : "Show details"}>
                      {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                  </div>
                </div>
                {step && <p className={`iv-step${inv.status === "overdue" ? " is-overdue" : ""}`}>{step}</p>}
                {isOpen && <Lines id={inv.id} />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Invoices;
