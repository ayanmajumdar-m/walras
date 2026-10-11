import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Database, Trash2, Undo2, Eye, EyeOff, Copy, Check } from "lucide-react";
import { api } from "../consoleApi";
import { useConsole } from "../ConsoleContext";

/*
  Resources → Databases: the account's Managed Databases. A new one is
  "Provisioning" until our team sets it up; then its connection details show
  here (the password on request). Cancelling ends it at the end of the paid
  month, like a server.
*/

const until = (d) => new Date(new Date(d).getTime() - 1).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

const CopyButton = ({ value, label }) => {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(String(value));
      setDone(true);
      setTimeout(() => setDone(false), 1500);
    } catch { /* clipboard blocked: the value is on screen */ }
  };
  return (
    <button type="button" className="cx-icon-btn cx-db-copy" onClick={copy} title={`Copy ${label}`} aria-label={`Copy ${label}`}>
      {done ? <Check size={13} /> : <Copy size={13} />}
    </button>
  );
};

const Connection = ({ db, notify }) => {
  const [password, setPassword] = useState(null);
  const [show, setShow] = useState(false);
  const c = db.connection;
  const reveal = async () => {
    if (password) return setShow(!show);
    try {
      const d = await api(`/api/databases/${db.id}/password`);
      setPassword(d.password);
      setShow(true);
    } catch (e) { notify(e.message, "error"); }
  };
  const rows = [["Host", c.host], ["Port", c.port], ["Database", c.database], ["User", c.user]];
  return (
    <dl className="cx-db-conn">
      {rows.map(([k, v]) => (
        <div key={k}><dt>{k}</dt><dd><code>{v}</code><CopyButton value={v} label={k.toLowerCase()} /></dd></div>
      ))}
      {c.hasPassword && (
        <div>
          <dt>Password</dt>
          <dd>
            <code>{show && password ? password : "••••••••••"}</code>
            <button type="button" className="cx-icon-btn cx-db-copy" onClick={reveal} title={show ? "Hide password" : "Show password"} aria-label={show ? "Hide password" : "Show password"}>
              {show ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
            {show && password && <CopyButton value={password} label="password" />}
          </dd>
        </div>
      )}
    </dl>
  );
};

const DatabasesTab = ({ databases, reload, notify }) => {
  const canDelete = useConsole().can("delete");

  const cancel = async (d) => {
    const paid = d.paidUntil ? until(d.paidUntil) : "the end of this month";
    if (!window.confirm(`Cancel ${d.name}? It's paid until ${paid} and keeps running until then; it won't be renewed, and is then deleted with all its data. You can undo this until then.`)) return;
    try {
      const r = await api(`/api/databases/${d.id}`, { method: "DELETE" });
      notify(r.message, "success");
      reload();
    } catch (e) { notify(e.message, "error"); }
  };
  const keep = async (d) => {
    try {
      const r = await api(`/api/databases/${d.id}/keep`, { method: "POST" });
      notify(r.message, "success");
      reload();
    } catch (e) { notify(e.message, "error"); }
  };

  if (databases.length === 0) {
    return (
      <div className="cx-card cx-empty">
        <span className="cx-empty-icon"><Database size={26} aria-hidden="true" /></span>
        <h4>No databases yet</h4>
        <p>Managed MySQL or PostgreSQL with daily backups, set up for you.</p>
        <Link to="/dashboard/create?type=database" className="cx-btn cx-btn-ghost">See Managed Database plans</Link>
      </div>
    );
  }

  return (
    <div className="cx-db-list">
      {databases.map((d) => (
        <section key={d.id} className="cx-card cx-db-card">
          <div className="cx-db-head">
            <span className="cx-db-icon"><Database size={18} aria-hidden="true" /></span>
            <div className="cx-db-title">
              <strong>{d.name}</strong>
              <small>{d.engineLabel} · {d.plan} · {d.location} · ₹{Number(d.monthlyCost).toLocaleString("en-IN")}/mo</small>
            </div>
            {d.suspended ? <span className="cx-status is-suspended">suspended</span>
              : d.status === "provisioning" ? <span className="cx-status is-pending">provisioning</span>
                : <span className={`cx-status is-${d.status}`}>{d.status}</span>}
            {canDelete && (d.cancelAt
              ? <button type="button" className="cx-icon-btn" onClick={() => keep(d)} title="Undo cancellation"><Undo2 size={15} /></button>
              : <button type="button" className="cx-icon-btn is-danger" onClick={() => cancel(d)} title={d.status === "failed" ? "Remove" : "Cancel plan"}><Trash2 size={15} /></button>)}
          </div>
          {d.cancelAt && <p className="cx-db-line is-warn">Cancelled: runs until {until(d.cancelAt)}, then it's deleted.</p>}
          {d.suspended && <p className="cx-db-line is-danger">Suspended for an <Link to="/dashboard/billing?tab=invoices">unpaid invoice</Link>.</p>}
          {d.status === "provisioning" && (
            <p className="cx-db-line">We're setting this database up. Its connection details will appear here, and we'll email you when it's ready.</p>
          )}
          {d.connection && <Connection db={d} notify={notify} />}
          {d.note && <p className="cx-db-line"><strong>Note from Walras:</strong> {d.note}</p>}
        </section>
      ))}
    </div>
  );
};

export default DatabasesTab;
