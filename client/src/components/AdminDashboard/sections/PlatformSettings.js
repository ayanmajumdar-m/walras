import React, { useEffect, useState } from "react";
import { Power, PackageX, FileText, Save, WalletCards, RefreshCw } from "lucide-react";
import { adminApi } from "../adminApi";
import EmailSender from "../components/Settings";
import SupportDepartments from "./SupportDepartments";

const INVOICE_FIELDS = [
  { key: "legalName", label: "Legal name", wide: true },
  { key: "registeredAddress", label: "Registered address", wide: true },
  { key: "gstAddress", label: "GST registered address", wide: true },
  { key: "gstin", label: "GSTIN" },
  { key: "sac", label: "SAC code" },
  { key: "email", label: "Billing email" },
  { key: "phone", label: "Billing phone" },
  { key: "bankName", label: "Bank name" },
  { key: "accountNumber", label: "Account number" },
  { key: "ifsc", label: "IFSC" },
];

const Switch = ({ checked, onChange, label, hint, Icon, tone }) => (
  <label className="ap-setting">
    <span className={`ap-setting-icon${tone ? ` is-${tone}` : ""}`}><Icon size={18} /></span>
    <span className="ap-setting-text">
      <strong>{label}</strong>
      <small>{hint}</small>
    </span>
    <span className="ap-toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span aria-hidden="true" />
    </span>
  </label>
);

const PlatformSettings = () => {
  const [s, setS] = useState(null);
  const [invoice, setInvoice] = useState({});
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState("");

  useEffect(() => {
    adminApi("/settings/platform")
      .then((d) => { setS(d); setInvoice(d.invoice); })
      .catch((e) => setNotice({ type: "error", text: e.message }));
  }, []);

  const save = async (key, path, body, success) => {
    setBusy(key);
    try {
      const d = await adminApi(path, { method: "PUT", body });
      setS(d);
      setInvoice(d.invoice);
      setNotice({ type: "success", text: success });
    } catch (e) {
      setNotice({ type: "error", text: e.message });
    } finally {
      setBusy("");
    }
  };

  if (!s) return <div className="cx-page">{notice ? <div className="cx-alert is-error">{notice.text}</div> : <div className="cx-card cx-empty"><p>Loading settings…</p></div>}</div>;

  return (
    <div className="cx-page ap-settings">
      <div className="cx-page-head">
        <h2>Settings</h2>
        <p>Platform switches, plan availability, invoice details and email. Every change is recorded in the audit log.</p>
      </div>

      {notice && <div className={`cx-alert is-${notice.type}`} role="status">{notice.text}</div>}

      <div className="ap-grid-2">
        <section className="cx-card ap-card">
          <h3>Platform</h3>
          <Switch Icon={Power} tone="warn" label="Maintenance mode"
            hint="Customers see a maintenance screen in the console and can't buy anything. Admins are unaffected."
            checked={s.maintenanceMode} onChange={(v) => setS({ ...s, maintenanceMode: v })} />
          <Switch Icon={PackageX} tone="warn" label="All plans out of stock"
            hint="Every plan shows Out of stock and can't be bought. Existing services keep running."
            checked={s.paymentsPaused} onChange={(v) => setS({ ...s, paymentsPaused: v })} />
          <Switch Icon={WalletCards} tone="warn" label="Pause account balance top-ups"
            hint="Customers can't add funds to their account balance. Their existing balance still works, and admins can still adjust balances."
            checked={s.topUpsPaused} onChange={(v) => setS({ ...s, topUpsPaused: v })} />
          {s.autoTopupReady ? (
            <Switch Icon={RefreshCw} label="Auto top-up"
              hint="Customers can save a card with Razorpay and have their balance topped up automatically. Paused while top-ups are paused."
              checked={s.autoTopupEnabled} onChange={(v) => setS({ ...s, autoTopupEnabled: v })} />
          ) : (
            <div className="ap-setting is-disabled">
              <span className="ap-setting-icon"><RefreshCw size={18} /></span>
              <span className="ap-setting-text">
                <strong>Auto top-up</strong>
                <small>Waiting for Razorpay to enable recurring payments on the account. Then set RAZORPAY_RECURRING=enabled (with the Razorpay keys and webhook secret) on the server, and it can be switched on here.</small>
              </span>
            </div>
          )}
          <div className="ap-card-foot">
            <button type="button" className="cx-btn cx-btn-primary" disabled={busy === "platform"}
              onClick={() => save("platform", "/settings/platform", { maintenanceMode: s.maintenanceMode, paymentsPaused: s.paymentsPaused, topUpsPaused: s.topUpsPaused, autoTopupEnabled: s.autoTopupEnabled }, "Platform settings saved")}>
              <Save size={15} /> Save
            </button>
          </div>
        </section>

        <section className="cx-card ap-card">
          <h3>Plan availability</h3>
          <h4 className="ap-subhead">Virtual Machines</h4>
          <p className="ap-muted">
            Set per plan and location in <a className="cx-link" href="?section=compute-stock">VM stock</a>.
            "All plans out of stock" above still overrides it.
          </p>
        </section>
      </div>

      <section className="cx-card ap-card">
        <h3><FileText size={18} /> Invoice details</h3>
        <p className="ap-muted">Printed on every tax invoice. The GSTIN's state decides GST: customers in the same state pay CGST + SGST, other states IGST. Bank details are only shown once both bank name and account number are filled in.</p>
        <div className="ap-form-grid">
          {INVOICE_FIELDS.map(({ key, label, wide }) => (
            <label key={key} className={`cx-field${wide ? " ap-wide" : ""}`}>
              <span>{label}</span>
              <input value={invoice[key] || ""} onChange={(e) => setInvoice({ ...invoice, [key]: key === "gstin" || key === "ifsc" ? e.target.value.toUpperCase() : e.target.value })} />
            </label>
          ))}
        </div>
        <div className="ap-card-foot">
          <button type="button" className="cx-btn cx-btn-primary" disabled={busy === "invoice"}
            onClick={() => save("invoice", "/settings/invoice", { invoice }, "Invoice details saved")}>
            <Save size={15} /> Save invoice details
          </button>
        </div>
      </section>

      <SupportDepartments />

      <EmailSender />
    </div>
  );
};

export default PlatformSettings;
