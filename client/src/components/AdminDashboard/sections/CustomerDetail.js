import React, { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Wallet, ShieldOff, ShieldCheck, Trash2, BadgeCheck, X, Mail, Phone, Building2, MapPin, Copy, Check, FileCheck, ExternalLink } from "lucide-react";
import { adminApi, inr, fmtDate } from "../adminApi";

const TABS = [
  { id: "services", label: "Services" },
  { id: "billing", label: "Billing" },
  { id: "activity", label: "Activity" },
];

const Modal = ({ title, onClose, children }) => (
  <div className="cx-modal-scrim" onClick={onClose}>
    <div className="cx-modal" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
      <div className="cx-modal-head">
        <h3>{title}</h3>
        <button type="button" className="cx-icon-btn" onClick={onClose} aria-label="Close"><X size={18} /></button>
      </div>
      {children}
    </div>
  </div>
);

const Table = ({ head, rows, empty }) =>
  rows.length === 0 ? (
    <p className="ap-muted ap-pad">{empty}</p>
  ) : (
    <div className="cx-table-wrap">
      <table className="cx-table">
        <thead><tr>{head.map((h) => <th key={h}>{h}</th>)}</tr></thead>
        <tbody>{rows}</tbody>
      </table>
    </div>
  );

// WALADMIN ID with a copy button (e.g. to paste into Zendesk or a chat).
const WaladminId = ({ value }) => {
  const [copied, setCopied] = useState(false);
  if (!value) return null;
  const copy = () => {
    navigator.clipboard?.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => {});
  };
  return (
    <button type="button" className="ap-wid-chip" onClick={copy} title="Copy WALADMIN ID">
      <span>WALADMIN ID</span>
      <code>{value}</code>
      {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
    </button>
  );
};

// users.kyc_status, in admin words (utils/kyc.js).
const KYC = {
  unverified: { label: "KYC not sent", tone: "pending", text: "No KYC documents yet. Services that need KYC (Settings → KYC) are locked." },
  pending: { label: "KYC to check", tone: "pending", text: "Documents sent on their KYC VERIFICATION ticket. Check them, then verify or reject." },
  verified: { label: "KYC verified", tone: "active", text: "Every service is unlocked." },
  rejected: { label: "KYC rejected", tone: "suspended", text: "They can send their documents again." },
};

const CustomerDetail = ({ userId, can, onBack }) => {
  const [data, setData] = useState(null);
  const [audit, setAudit] = useState([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(null);
  const [tab, setTab] = useState("services");
  const [modal, setModal] = useState(null); // 'wallet' | 'suspend' | 'delete' | 'kyc'
  const [form, setForm] = useState({ type: "credit", amount: "", reason: "", confirm: "", kyc: "verified" });
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    adminApi(`/users/${userId}/overview`).then(setData).catch((e) => setError(e.message));
    if (can("view_audit_logs")) {
      adminApi(`/audit-logs?targetType=user&targetId=${userId}&limit=20`).then((d) => setAudit(d.logs || [])).catch(() => {});
    }
  }, [userId, can]);

  useEffect(load, [load]);

  const run = async (fn, success) => {
    setBusy(true);
    try {
      await fn();
      setNotice({ type: "success", text: success });
      setModal(null);
      setForm({ type: "credit", amount: "", reason: "", confirm: "", kyc: "verified" });
      load();
    } catch (e) {
      setNotice({ type: "error", text: e.message });
    } finally {
      setBusy(false);
    }
  };

  if (error) return <div className="cx-page"><button type="button" className="cx-btn cx-btn-ghost ap-back" onClick={onBack}><ArrowLeft size={16} /> Customers</button><div className="cx-alert is-error">{error}</div></div>;
  if (!data) return <div className="cx-page"><div className="cx-card cx-empty"><p>Loading customer…</p></div></div>;

  const { user, wallet, servers, domains, transactions, invoices, sessions, kycTicketUrl } = data;
  const dedicatedServers = data.dedicatedServers || [];
  const kyc = KYC[user.kyc_status] || KYC.unverified;
  const suspended = Boolean(user.suspended_at);
  const verified = user.isemailverified;
  const address = (user.address || "").split("\n").filter(Boolean).join(", ");

  return (
    <div className="cx-page">
      <button type="button" className="cx-btn cx-btn-ghost ap-back" onClick={onBack}><ArrowLeft size={16} /> Customers</button>

      <section className="cx-card ap-profile">
        <div className="ap-profile-main">
          <span className="ap-avatar">{(user.name || "?").split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("")}</span>
          <div>
            <h2>{user.name}</h2>
            <div className="ap-badges">
              <span className="cx-pill">{user.account_type === "business" ? "Business" : "Personal"}</span>
              {suspended ? <span className="cx-status is-suspended">suspended</span>
                : verified ? <span className="cx-status is-active">email verified</span>
                : <span className="cx-status is-pending">email unverified</span>}
              <span className={`cx-status is-${kyc.tone}`}>{kyc.label}</span>
              <span className="ap-muted">Joined {fmtDate(user.createdat)}</span>
            </div>
            <WaladminId value={user.waladmin_id} />
          </div>
        </div>
        <div className="ap-profile-actions">
          {can("manage_users") && !verified && (
            <button type="button" className="cx-btn cx-btn-ghost" disabled={busy}
              onClick={() => run(() => adminApi("/verifyUser", { method: "PUT", body: { userId: user.id } }), "Customer marked verified")}>
              <BadgeCheck size={16} /> Verify
            </button>
          )}
          {can("manage_wallets") && (
            <button type="button" className="cx-btn cx-btn-ghost" onClick={() => setModal("wallet")}><Wallet size={16} /> Adjust account balance</button>
          )}
          {can("manage_users") && (suspended ? (
            <button type="button" className="cx-btn cx-btn-ghost" disabled={busy}
              onClick={() => run(() => adminApi(`/users/${user.id}/unsuspend`, { method: "POST" }), "Customer reinstated")}>
              <ShieldCheck size={16} /> Reinstate
            </button>
          ) : (
            <button type="button" className="cx-btn cx-btn-ghost ap-danger" onClick={() => setModal("suspend")}><ShieldOff size={16} /> Suspend</button>
          ))}
          {can("manage_users") && (
            <button type="button" className="cx-icon-btn is-danger" onClick={() => setModal("delete")} title="Delete customer"><Trash2 size={16} /></button>
          )}
        </div>
      </section>

      {suspended && <div className="cx-alert is-error">Suspended {fmtDate(user.suspended_at, true)}{user.suspension_reason ? `: ${user.suspension_reason}` : ""}. They can't sign in or use the console.</div>}
      {notice && <div className={`cx-alert is-${notice.type}`} role="status">{notice.text}<button type="button" className="cx-icon-btn" onClick={() => setNotice(null)} aria-label="Dismiss"><X size={15} /></button></div>}

      <section className="cx-card ap-kyc">
        <div className="ap-kyc-main">
          <h3><FileCheck size={17} /> KYC <span className={`cx-status is-${kyc.tone}`}>{kyc.label}</span></h3>
          <p className="ap-muted">{kyc.text}</p>
          {(user.kyc_submitted_at || user.kyc_reviewed_at || user.kyc_note) && (
            <p className="ap-muted">
              {user.kyc_submitted_at && <>Documents sent {fmtDate(user.kyc_submitted_at, true)}. </>}
              {user.kyc_reviewed_at && <>Last set by {user.kyc_reviewed_by || "an admin"} on {fmtDate(user.kyc_reviewed_at, true)}. </>}
              {user.kyc_note && <>Note: {user.kyc_note}</>}
            </p>
          )}
        </div>
        <div className="ap-profile-actions">
          {user.kyc_ticket_id && (kycTicketUrl ? (
            <a className="cx-btn cx-btn-ghost" href={kycTicketUrl} target="_blank" rel="noreferrer"><ExternalLink size={15} /> Ticket #{user.kyc_ticket_id}</a>
          ) : <span className="ap-muted">Ticket #{user.kyc_ticket_id}</span>)}
          {can("manage_users") && (
            <button type="button" className="cx-btn cx-btn-ghost" onClick={() => { setForm({ ...form, kyc: user.kyc_status === "verified" ? "unverified" : "verified", reason: "" }); setModal("kyc"); }}>
              <BadgeCheck size={16} /> {user.kyc_status === "verified" ? "Change KYC" : "Review KYC"}
            </button>
          )}
        </div>
      </section>

      <div className="ap-grid-3">
        <div className="cx-card ap-kv">
          <h3>Contact</h3>
          <p><Mail size={15} /> {user.email}</p>
          <p><Phone size={15} /> {user.phone || "—"}</p>
          {address && <p><MapPin size={15} /> {address}</p>}
        </div>
        <div className="cx-card ap-kv">
          <h3>Business</h3>
          <p><Building2 size={15} /> {user.company || "—"}</p>
          <p>GSTIN: {user.gstin || "—"}</p>
          <p>Role: {user.role || "—"}</p>
        </div>
        <div className="cx-card ap-kv">
          <h3>Account balance</h3>
          <p className="ap-big">{inr(wallet?.balance)}</p>
          <p className="ap-muted">Last sign-in {fmtDate(user.lastloginat, true)}{user.lastloginip ? ` from ${user.lastloginip}` : ""}</p>
        </div>
      </div>

      <div className="cx-tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={`cx-tab${tab === t.id ? " is-active" : ""}`} onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </div>

      {tab === "services" && (
        <div className="ap-stack">
          <div className="cx-card"><h3 className="ap-card-title">Virtual Machines ({servers.length})</h3>
            <Table head={["Name", "IP", "Plan", "Location", "Status"]} empty="No servers."
              rows={servers.map((s) => <tr key={s.id}><td><strong>{s.name}</strong></td><td><code>{s.ip_address || "—"}</code></td><td>{s.plan_name}</td><td>{s.location}</td><td><span className={`cx-status is-${s.status}`}>{s.status}</span></td></tr>)} />
          </div>
          <div className="cx-card"><h3 className="ap-card-title">Dedicated Servers ({dedicatedServers.length})</h3>
            <Table head={["Server", "Location", "Price", "Status", "Ordered"]} empty="No dedicated servers."
              rows={dedicatedServers.map((d) => <tr key={d.id}><td><strong>{d.title}</strong></td><td>{d.location}</td><td>{inr(Number(d.monthly_price) * 100)}/mo</td><td><span className={`cx-status is-${d.status === "active" ? "active" : d.status === "cancelled" ? "stopped" : "pending"}`}>{d.status === "pending" ? "bought" : d.status}</span></td><td>{fmtDate(d.created_at)}</td></tr>)} />
          </div>
          <div className="cx-card"><h3 className="ap-card-title">Domains ({domains.length})</h3>
            <Table head={["Domain", "Status", "Registered", "Expires"]} empty="No domains."
              rows={domains.map((d) => <tr key={d.id}><td><strong>{d.full_domain}</strong></td><td><span className={`cx-status is-${d.status}`}>{d.status}</span></td><td>{fmtDate(d.registration_date)}</td><td>{fmtDate(d.expiration_date)}</td></tr>)} />
          </div>
        </div>
      )}

      {tab === "billing" && (
        <div className="ap-stack">
          <div className="cx-card"><h3 className="ap-card-title">Account balance transactions</h3>
            <Table head={["Description", "Type", "Amount", "Status", "Date"]} empty="No transactions."
              rows={transactions.map((t) => <tr key={t.id}><td>{t.description}</td><td>{t.type}</td><td className={t.type === "credit" ? "ap-pos" : "ap-neg"}>{t.type === "credit" ? "+" : "−"}{inr(t.amount)}</td><td><span className={`cx-status is-${t.status === "completed" ? "active" : t.status}`}>{t.status}</span></td><td>{fmtDate(t.created_at, true)}</td></tr>)} />
          </div>
          <div className="cx-card"><h3 className="ap-card-title">Invoices</h3>
            <Table head={["Invoice", "Month", "Amount", "Status"]} empty="No invoices."
              rows={invoices.map((i) => <tr key={i.id}><td><code>{i.invoice_number}</code></td><td>{fmtDate(i.billing_month)}</td><td>{inr(i.total_amount)}</td><td>{i.status}</td></tr>)} />
          </div>
        </div>
      )}

      {tab === "activity" && (
        <div className="ap-stack">
          <div className="cx-card"><h3 className="ap-card-title">Recent sign-ins</h3>
            <Table head={["When", "IP", "Device"]} empty="No sign-ins recorded."
              rows={sessions.map((s, i) => <tr key={i}><td>{fmtDate(s.login_time, true)}</td><td><code>{s.ip_address}</code></td><td className="ap-ellipsis">{s.user_agent}</td></tr>)} />
          </div>
          {can("view_audit_logs") && (
            <div className="cx-card"><h3 className="ap-card-title">Admin actions on this customer</h3>
              <Table head={["When", "Admin", "Action", "Details"]} empty="No admin actions yet."
                rows={audit.map((a) => <tr key={a.id}><td>{fmtDate(a.created_at, true)}</td><td>{a.admin_username}</td><td><code>{a.action}</code></td><td className="ap-ellipsis">{a.metadata && Object.keys(a.metadata).length ? JSON.stringify(a.metadata) : ""}</td></tr>)} />
            </div>
          )}
        </div>
      )}

      {modal === "wallet" && (
        <Modal title="Adjust account balance" onClose={() => setModal(null)}>
          <div className="ap-seg">
            {["credit", "debit"].map((t) => (
              <button key={t} type="button" className={form.type === t ? "is-active" : ""} onClick={() => setForm({ ...form, type: t })}>{t === "credit" ? "Credit (add)" : "Debit (remove)"}</button>
            ))}
          </div>
          <label className="cx-field"><span>Amount (₹)</span>
            <input type="number" min="0.01" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="500" />
          </label>
          <label className="cx-field"><span>Reason (shown on the customer's transaction)</span>
            <input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Goodwill credit for downtime on 3 Oct" maxLength={200} />
          </label>
          <p className="ap-muted">Current balance {inr(wallet?.balance)}. Debits can't take the balance below zero.</p>
          <button type="button" className="cx-btn cx-btn-primary cx-btn-block" disabled={busy || !form.amount || form.reason.trim().length < 3}
            onClick={() => run(() => adminApi(`/users/${user.id}/wallet-adjust`, { method: "POST", body: { type: form.type, amount: Number(form.amount), reason: form.reason } }), `Account balance ${form.type === "credit" ? "credited" : "debited"}`)}>
            {form.type === "credit" ? "Credit" : "Debit"} ₹{form.amount || "0"}
          </button>
        </Modal>
      )}

      {modal === "kyc" && (
        <Modal title={`KYC for ${user.name}`} onClose={() => setModal(null)}>
          <p className="ap-muted">Check the documents on their KYC VERIFICATION ticket first. Verified unlocks the services that need KYC; the customer is emailed for verified and rejected.</p>
          <div className="ap-seg ap-seg-3">
            {[["verified", "Verified"], ["rejected", "Rejected"], ["unverified", "Unverified"]].map(([id, label]) => (
              <button key={id} type="button" className={form.kyc === id ? "is-active" : ""} onClick={() => setForm({ ...form, kyc: id })}>{label}</button>
            ))}
          </div>
          <label className="cx-field"><span>{form.kyc === "rejected" ? "Reason (the customer sees this)" : "Note (optional, for admins)"}</span>
            <input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} maxLength={500}
              placeholder={form.kyc === "rejected" ? "Address proof is older than 3 months" : "Checked PAN and Aadhaar"} />
          </label>
          <button type="button" className="cx-btn cx-btn-primary cx-btn-block" disabled={busy || (form.kyc === "rejected" && form.reason.trim().length < 3)}
            onClick={() => run(() => adminApi(`/users/${user.id}/kyc`, { method: "PUT", body: { status: form.kyc, note: form.reason } }), form.kyc === "verified" ? "KYC verified" : form.kyc === "rejected" ? "KYC rejected" : "KYC set to unverified")}>
            {form.kyc === "verified" ? "Mark KYC verified" : form.kyc === "rejected" ? "Reject KYC" : "Mark KYC unverified"}
          </button>
        </Modal>
      )}

      {modal === "suspend" && (
        <Modal title={`Suspend ${user.name}?`} onClose={() => setModal(null)}>
          <p className="ap-muted">They'll be signed out and blocked from the console and API until reinstated. Their services keep running.</p>
          <label className="cx-field"><span>Reason</span>
            <input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Payment dispute / abuse report #123" maxLength={255} />
          </label>
          <button type="button" className="cx-btn cx-btn-primary cx-btn-block ap-danger-fill" disabled={busy || form.reason.trim().length < 3}
            onClick={() => run(() => adminApi(`/users/${user.id}/suspend`, { method: "POST", body: { reason: form.reason } }), "Customer suspended")}>
            Suspend customer
          </button>
        </Modal>
      )}

      {modal === "delete" && (
        <Modal title="Delete customer permanently?" onClose={() => setModal(null)}>
          <p className="ap-muted">This deletes {user.email} and everything attached: account balance, servers, domains, transactions and invoices. It can't be undone.</p>
          <label className="cx-field"><span>Type the customer's email to confirm</span>
            <input value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} placeholder={user.email} />
          </label>
          <button type="button" className="cx-btn cx-btn-primary cx-btn-block ap-danger-fill" disabled={busy || form.confirm.trim().toLowerCase() !== (user.email || "").toLowerCase()}
            onClick={async () => {
              setBusy(true);
              try {
                await adminApi(`/deleteUser/${user.id}`, { method: "DELETE" });
                onBack("Customer deleted");
              } catch (e) {
                setNotice({ type: "error", text: e.message });
                setBusy(false);
              }
            }}>
            Delete permanently
          </button>
        </Modal>
      )}
    </div>
  );
};

export default CustomerDetail;
