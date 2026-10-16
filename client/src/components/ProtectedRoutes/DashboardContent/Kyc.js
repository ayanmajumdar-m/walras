import React, { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { BadgeCheck, Clock, FileText, Upload, X, ShieldCheck, AlertTriangle, Mail, Smartphone } from "lucide-react";
import { api } from "../consoleApi";
import { useConsole } from "../ConsoleContext";

/*
  Account → KYC verification. The customer picks Individual or Business,
  adds one file per document (saying which document it is) and sends them.
  That opens a "KYC VERIFICATION" support ticket listing every document by
  name; our team checks them and marks the account verified, which unlocks
  the services that need KYC (utils/kyc.js).
*/
const MAX_BYTES = 5 * 1024 * 1024;
const TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

const readBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
  reader.onerror = () => reject(new Error(`Couldn't read ${file.name}`));
  reader.readAsDataURL(file);
});

const formatSize = (n) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

// One document: which one it is, and its file.
const DocumentSlot = ({ slot, value, onChange, onError }) => {
  const input = useRef(null);
  const pick = (file) => {
    if (!file) return;
    if (!TYPES.includes(file.type)) return onError(`${file.name}: upload a PDF, JPG, PNG or WebP file.`);
    if (file.size > MAX_BYTES) return onError(`${file.name} is larger than 5 MB.`);
    onChange({ ...value, file });
  };
  return (
    <div className="cx-kyc-slot">
      <div className="cx-kyc-slot-head">
        <strong>{slot.label}</strong>
        <span className={slot.required ? "cx-pill" : "cx-kyc-optional"}>{slot.required ? "Required" : "Optional"}</span>
      </div>
      {slot.hint && <p className="cx-kyc-hint">{slot.hint}</p>}
      <p className="cx-kyc-hint">Accepted: {slot.options.join(", ")}.</p>
      <div className="cx-kyc-slot-row">
        {slot.options.length > 1 ? (
          <label className="cx-field">
            <span className="cx-visually-hidden">Which document</span>
            <select value={value.document || ""} onChange={(e) => onChange({ ...value, document: e.target.value })}>
              <option value="">Choose the document…</option>
              {slot.options.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </label>
        ) : <span className="cx-kyc-single">{slot.options[0]}</span>}
        {value.file ? (
          <span className="cx-kyc-file">
            <FileText size={14} aria-hidden="true" /> <span className="cx-ellipsis">{value.file.name}</span> <small>{formatSize(value.file.size)}</small>
            <button type="button" className="cx-icon-btn" onClick={() => onChange({ ...value, file: null })} aria-label={`Remove ${value.file.name}`}><X size={14} /></button>
          </span>
        ) : (
          <button type="button" className="cx-btn cx-btn-ghost cx-btn-sm" onClick={() => input.current?.click()}>
            <Upload size={14} /> Upload file
          </button>
        )}
        <input ref={input} type="file" accept={TYPES.join(",")} hidden onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
      </div>
    </div>
  );
};

const StatusCard = ({ kyc }) => {
  const locked = kyc.required.map((r) => r.label).join(", ");
  if (kyc.status === "verified") {
    return (
      <div className="cx-card cx-kyc-status is-verified">
        <BadgeCheck size={22} aria-hidden="true" />
        <div><h3>Your KYC is verified</h3><p>Every service is unlocked for your account.</p></div>
      </div>
    );
  }
  if (kyc.status === "pending") {
    return (
      <div className="cx-card cx-kyc-status is-pending">
        <Clock size={22} aria-hidden="true" />
        <div>
          <h3>We're checking your documents</h3>
          <p>
            You sent them {kyc.submittedAt ? new Date(kyc.submittedAt).toLocaleDateString("en-IN", { day: "numeric", month: "long" }) : "recently"}.
            {locked && ` ${locked} unlock once your KYC is verified.`} We'll email you when it's done.
          </p>
          {kyc.ticketId && (
            <p>To add or change a document, reply on your <Link className="cx-link" to={`/dashboard/support?ticket=${kyc.ticketId}`}>{kyc.ticketSubject} ticket</Link>.</p>
          )}
        </div>
      </div>
    );
  }
  return (
    <div className={`cx-card cx-kyc-status ${kyc.status === "rejected" ? "is-rejected" : "is-todo"}`}>
      {kyc.status === "rejected" ? <AlertTriangle size={22} aria-hidden="true" /> : <ShieldCheck size={22} aria-hidden="true" />}
      <div>
        <h3>{kyc.status === "rejected" ? "We couldn't verify your documents" : "Complete your KYC"}</h3>
        {kyc.status === "rejected" && kyc.note && <p><strong>Reason:</strong> {kyc.note}</p>}
        <p>
          {locked ? `${locked} can be ordered once your KYC is verified.` : "Verify your identity to keep your account in good standing."}
          {" "}Send the documents below and our team will check them.
        </p>
      </div>
    </div>
  );
};

const Kyc = () => {
  const { profile, kyc, refreshKyc } = useConsole();
  const [type, setType] = useState(null);
  const [docs, setDocs] = useState({});
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);

  if (!kyc) return <div className="cx-page"><div className="cx-card cx-empty"><p>Loading…</p></div></div>;

  const accountType = type || kyc.accountType;
  const spec = kyc.documents[accountType];
  const canSend = kyc.status === "unverified" || kyc.status === "rejected";

  const switchType = (t) => { setType(t); setDocs({}); setNotice(null); };

  const submit = async (e) => {
    e.preventDefault();
    setNotice(null);
    for (const slot of spec.slots) {
      const d = docs[slot.id] || {};
      const document = slot.options.length === 1 ? slot.options[0] : d.document;
      if (slot.required && !d.file) return setNotice({ type: "error", text: `Add your ${slot.label.toLowerCase()}.` });
      if (d.file && !document) return setNotice({ type: "error", text: `Choose which document your ${slot.label.toLowerCase()} is.` });
    }
    setBusy(true);
    try {
      const documents = {};
      for (const slot of spec.slots) {
        const d = docs[slot.id];
        if (!d?.file) continue;
        documents[slot.id] = {
          document: slot.options.length === 1 ? slot.options[0] : d.document,
          fileName: d.file.name, mimeType: d.file.type, data: await readBase64(d.file),
        };
      }
      await api("/api/kyc", { method: "POST", body: { type: accountType, documents, note: note.trim() } });
      setDocs({});
      setNote("");
      setNotice({ type: "success", text: "Documents sent. We'll email you once your KYC is verified." });
      refreshKyc();
    } catch (err) {
      setNotice({ type: "error", text: err.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="cx-page">
      <div className="cx-page-head">
        <h2>KYC verification</h2>
        <p>We verify who our customers are before some services can be ordered. Send your documents once and we check them by hand.</p>
      </div>

      {notice && <div className={`cx-alert is-${notice.type}`} role="status">{notice.text}</div>}
      <StatusCard kyc={kyc} />

      {canSend && (
        <form className="cx-card cx-kyc-form" onSubmit={submit}>
          <div className="cx-seg" role="tablist" aria-label="Customer type">
            <span className="cx-seg-label">I'm verifying as</span>
            {Object.entries(kyc.documents).map(([id, d]) => (
              <button key={id} type="button" role="tab" aria-selected={accountType === id}
                className={accountType === id ? "is-active" : ""} onClick={() => switchType(id)}>{d.label}</button>
            ))}
          </div>

          {accountType === "individual" && (
            <div className="cx-kyc-slot">
              <div className="cx-kyc-slot-head"><strong>Contact verification</strong><span className="cx-pill">Required</span></div>
              <p className="cx-kyc-hint">Mobile number and email address, verified by OTP.</p>
              <ul className="cx-kyc-contact">
                <li><Mail size={14} aria-hidden="true" /> {profile?.email || "Your email"}: {profile?.isemailverified || profile?.isEmailVerified ? "verified" : "not verified yet"}</li>
                <li><Smartphone size={14} aria-hidden="true" /> {profile?.phone || <>No mobile number yet. <Link className="cx-link" to="/dashboard/profile">Add one</Link></>}{profile?.phone && ": we'll verify it with an OTP while checking your documents"}</li>
              </ul>
            </div>
          )}

          {spec.slots.map((slot) => (
            <DocumentSlot key={`${accountType}-${slot.id}`} slot={slot} value={docs[slot.id] || {}}
              onChange={(v) => setDocs({ ...docs, [slot.id]: v })}
              onError={(text) => setNotice({ type: "error", text })} />
          ))}

          <label className="cx-field">
            <span>Anything we should know? (optional)</span>
            <textarea rows={3} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="For example, the name on your documents if it's different from your account" />
          </label>

          <p className="cx-kyc-hint">PDF, JPG, PNG or WebP, up to 5 MB each. Your documents go to our support team on a ticket titled {kyc.ticketSubject}, visible only to you and them.</p>
          {!kyc.supportConfigured && <div className="cx-alert is-info">Document upload is unavailable right now. Please email your documents to support@walras.net.</div>}
          <button type="submit" className="cx-btn cx-btn-primary" disabled={busy || !kyc.supportConfigured}>
            {busy ? "Sending…" : "Send documents"}
          </button>
        </form>
      )}
    </div>
  );
};

export default Kyc;

/** Whether ordering `product` waits on KYC for this account (the server checks too). */
export const kycLocked = (kyc, product) =>
  Boolean(kyc && kyc.status !== "verified" && kyc.required.some((r) => r.id === product));

/** Shown in place of an order form that needs KYC first. */
export const KycLocked = ({ product }) => {
  const { kyc, account } = useConsole();
  const label = kyc?.required.find((r) => r.id === product)?.label || "This service";
  return (
    <div className="cx-card cx-empty cx-kyc-locked">
      <span className="cx-empty-icon"><ShieldCheck size={26} aria-hidden="true" /></span>
      <h4>Complete KYC to order {label}</h4>
      {account ? (
        <p>{account.ownerName || "The account owner"} needs to complete KYC verification before {label} can be ordered in this account.</p>
      ) : kyc?.status === "pending" ? (
        <p>We're checking your documents. {label} unlocks as soon as your KYC is verified; we'll email you.</p>
      ) : (
        <>
          <p>Send your KYC documents once and we'll unlock {label} after checking them.</p>
          <Link to="/dashboard/kyc" className="cx-btn cx-btn-primary">Complete KYC</Link>
        </>
      )}
    </div>
  );
};
