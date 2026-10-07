import React, { useEffect, useState } from "react";
import { Power, PackageX, Package, FileText, Lock, Save, WalletCards } from "lucide-react";
import { adminApi } from "../adminApi";
import EmailSender from "../components/Settings";
import { WEB_HOSTING_ENABLED } from "../../../data/plans";
import SupportDepartments from "./SupportDepartments";

const INVOICE_FIELDS = [
  { key: "legalName", label: "Legal name", wide: true },
  { key: "registeredAddress", label: "Registered address", wide: true },
  { key: "gstAddress", label: "GST registered address", wide: true },
  { key: "gstin", label: "GSTIN" },
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
          <div className="ap-card-foot">
            <button type="button" className="cx-btn cx-btn-primary" disabled={busy === "platform"}
              onClick={() => save("platform", "/settings/platform", { maintenanceMode: s.maintenanceMode, paymentsPaused: s.paymentsPaused, topUpsPaused: s.topUpsPaused }, "Platform settings saved")}>
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
          {WEB_HOSTING_ENABLED && (<>
          <p className="ap-muted">Turn a plan off to mark it Out of stock. Customers who already have it aren't affected.</p>
          {s.lockedFamilies?.hosting ? (<>
            <h4 className="ap-subhead">Web Hosting <Lock size={13} /></h4>
            <p className="ap-locked">{s.lockedFamilies.hosting}</p>
          </>) : (<>
          <h4 className="ap-subhead">Web Hosting</h4>
          {Object.entries(s.planAvailability.hosting).map(([plan, on]) => (
            <Switch key={plan} Icon={Package} label={plan} hint={s.paymentsPaused ? "Out of stock (all plans switch is on)" : on ? "In stock" : "Out of stock"} checked={on}
              onChange={(v) => setS({ ...s, planAvailability: { ...s.planAvailability, hosting: { ...s.planAvailability.hosting, [plan]: v } } })} />
          ))}
          </>)}
          <div className="ap-card-foot">
            <button type="button" className="cx-btn cx-btn-primary" disabled={busy === "plans"}
              onClick={() => save("plans", "/settings/plans", { planAvailability: s.planAvailability }, "Plan availability saved")}>
              <Save size={15} /> Save
            </button>
          </div>
          </>)}
        </section>
      </div>

      <section className="cx-card ap-card">
        <h3><FileText size={18} /> Invoice details</h3>
        <p className="ap-muted">Printed on every tax invoice. Bank details are only shown once both bank name and account number are filled in.</p>
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
