import React, { useCallback, useEffect, useState } from "react";
import { UserPlus, Users, Mail, Trash2, Save, LogOut, Check, X, ArrowRight } from "lucide-react";
import { api, switchAccount } from "../consoleApi";
import { useConsole } from "../ConsoleContext";

/*
  Account → Team. Invite up to 5 people by email and choose what each can do
  in your account (servers, billing, support). Invitations waiting for you
  and teams you belong to are listed here too. Access is enforced by the
  server (utils/team.js); this page only manages it.
*/

const formatDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const AccessPicker = ({ access, value, onChange, disabled }) => (
  <div className="cx-access">
    {Object.entries(access).map(([key, { label, desc }]) => (
      <label key={key} className={`cx-access-item${value.includes(key) ? " is-on" : ""}`}>
        <input type="checkbox" checked={value.includes(key)} disabled={disabled}
          onChange={(e) => onChange(e.target.checked ? [...value, key] : value.filter((v) => v !== key))} />
        <span>
          <strong>{label}</strong>
          <small>{desc}</small>
        </span>
      </label>
    ))}
  </div>
);

const accessText = (access, perms) => perms.map((p) => access[p]?.label || p).join(", ") || "No access";

const MemberRow = ({ member, access, onSaved, notify }) => {
  const [perms, setPerms] = useState(member.permissions);
  const [busy, setBusy] = useState(false);
  const changed = perms.slice().sort().join() !== member.permissions.slice().sort().join();

  const save = async () => {
    setBusy(true);
    try {
      const d = await api(`/api/team/members/${member.id}`, { method: "PUT", body: { permissions: perms } });
      notify(d.message, "success");
      onSaved();
    } catch (e) { notify(e.message, "error"); } finally { setBusy(false); }
  };
  const remove = async () => {
    const what = member.status === "invited" ? `Cancel the invitation to ${member.email}?` : `Remove ${member.name || member.email} from your team? They lose access straight away.`;
    if (!window.confirm(what)) return;
    setBusy(true);
    try {
      const d = await api(`/api/team/members/${member.id}`, { method: "DELETE" });
      notify(d.message, "success");
      onSaved();
    } catch (e) { notify(e.message, "error"); setBusy(false); }
  };

  return (
    <div className="cx-card cx-member">
      <div className="cx-member-head">
        <span className="cx-avatar" aria-hidden="true">{(member.name || member.email)[0].toUpperCase()}</span>
        <span className="cx-member-who">
          <strong>{member.name || member.email}</strong>
          <small>{member.name ? member.email : ""}</small>
        </span>
        <span className={`cx-status ${member.status === "active" ? "is-active" : "is-pending"}`}>
          {member.status === "active" ? "Active" : "Invited"}
        </span>
      </div>
      <p className="cx-member-meta">
        {member.status === "active" ? `Joined ${formatDate(member.acceptedAt)}` : `Invited ${formatDate(member.invitedAt)} · waiting for them to sign in and accept`}
      </p>
      <AccessPicker access={access} value={perms} onChange={setPerms} disabled={busy} />
      <div className="cx-member-actions">
        <button type="button" className="cx-btn cx-btn-ghost cx-btn-sm is-danger" onClick={remove} disabled={busy}>
          <Trash2 size={14} /> {member.status === "invited" ? "Cancel invitation" : "Remove"}
        </button>
        <button type="button" className="cx-btn cx-btn-primary cx-btn-sm" onClick={save} disabled={busy || !changed || perms.length === 0}>
          <Save size={14} /> Save access
        </button>
      </div>
    </div>
  );
};

const Team = () => {
  const { account } = useConsole();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState(null);
  const [email, setEmail] = useState("");
  const [perms, setPerms] = useState(["servers"]);
  const [inviting, setInviting] = useState(false);

  const notify = (text, type) => setMessage({ text, type });

  const load = useCallback(() => {
    api("/api/team").then((d) => { setData(d); setError(""); }).catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  const invite = async (e) => {
    e.preventDefault();
    setInviting(true);
    try {
      const d = await api("/api/team/members", { method: "POST", body: { email: email.trim(), permissions: perms } });
      notify(d.message, "success");
      setEmail("");
      load();
    } catch (err) { notify(err.message, "error"); } finally { setInviting(false); }
  };

  const respond = async (inv, accept) => {
    try {
      const d = await api(`/api/team/invitations/${inv.id}${accept ? "/accept" : ""}`, { method: accept ? "POST" : "DELETE" });
      notify(d.message, "success");
      load();
    } catch (e) { notify(e.message, "error"); }
  };

  const leave = async (m) => {
    if (!window.confirm(`Leave ${m.ownerName || m.ownerEmail}'s team? You'll lose access to their account.`)) return;
    try {
      const d = await api(`/api/team/memberships/${m.ownerId}`, { method: "DELETE" });
      notify(d.message, "success");
      load();
    } catch (e) { notify(e.message, "error"); }
  };

  if (error) return <div className="cx-alert is-error">{error}</div>;
  if (!data) return <div className="cx-card cx-empty"><p>Loading your team…</p></div>;

  const full = data.members.length >= data.limit;

  return (
    <div className="cx-team">
      {message && (
        <div className={`cx-alert is-${message.type}`} role="status">
          <span>{message.text}</span>
          <button type="button" className="cx-icon-btn" onClick={() => setMessage(null)} aria-label="Dismiss"><X size={15} /></button>
        </div>
      )}

      {account && (
        <div className="cx-alert is-info">
          This is your own team. You're currently working in {account.ownerName || account.ownerEmail}'s account; switching back isn't needed to manage your team.
        </div>
      )}

      {data.invitations.length > 0 && (
        <section className="cx-section">
          <div className="cx-section-head"><h3>Invitations for you</h3></div>
          {data.invitations.map((inv) => (
            <div className="cx-card cx-invite" key={inv.id}>
              <Mail size={18} aria-hidden="true" />
              <span className="cx-invite-text">
                <strong>{inv.ownerName || inv.ownerEmail}</strong> invited you to their account
                <small>Access: {accessText(data.access, inv.permissions)} · {formatDate(inv.invitedAt)}</small>
              </span>
              <button type="button" className="cx-btn cx-btn-ghost cx-btn-sm" onClick={() => respond(inv, false)}><X size={14} /> Decline</button>
              <button type="button" className="cx-btn cx-btn-primary cx-btn-sm" onClick={() => respond(inv, true)}><Check size={14} /> Accept</button>
            </div>
          ))}
        </section>
      )}

      <section className="cx-section">
        <div className="cx-section-head">
          <h3>Your team</h3>
          <span className="cx-count">{data.members.length}/{data.limit}</span>
        </div>
        <p className="cx-step-help">
          Invite up to {data.limit} people to help run this account. Each signs in with their own email and password,
          and only sees what you give them access to. They can never change your profile, password or team.
        </p>

        <form className="cx-card cx-ticket-form" onSubmit={invite}>
          <h3><UserPlus size={18} aria-hidden="true" /> Invite someone</h3>
          <label className="cx-field">
            <span>Email address</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="colleague@company.com"
              disabled={full} autoComplete="off" required />
          </label>
          <div className="cx-field">
            <span>Access</span>
            <AccessPicker access={data.access} value={perms} onChange={setPerms} disabled={full} />
          </div>
          <div className="cx-ticket-actions">
            {full && <span className="cx-field-hint">Your team is full. Remove someone to invite another person.</span>}
            <button type="submit" className="cx-btn cx-btn-primary" disabled={full || inviting || !email.trim() || perms.length === 0}>
              <UserPlus size={15} /> {inviting ? "Sending…" : "Send invitation"}
            </button>
          </div>
        </form>

        {data.members.length > 0 && (
          <div className="cx-member-list">
            {data.members.map((m) => <MemberRow key={m.id} member={m} access={data.access} onSaved={load} notify={notify} />)}
          </div>
        )}
      </section>

      {data.memberships.length > 0 && (
        <section className="cx-section">
          <div className="cx-section-head"><h3>Teams you're in</h3></div>
          {data.memberships.map((m) => (
            <div className="cx-card cx-invite" key={m.ownerId}>
              <Users size={18} aria-hidden="true" />
              <span className="cx-invite-text">
                <strong>{m.company || m.ownerName || m.ownerEmail}</strong>
                <small>{m.ownerEmail} · Access: {accessText(data.access, m.permissions)}</small>
              </span>
              <button type="button" className="cx-btn cx-btn-ghost cx-btn-sm" onClick={() => leave(m)}><LogOut size={14} /> Leave</button>
              {String(account?.ownerId) !== String(m.ownerId) && (
                <button type="button" className="cx-btn cx-btn-primary cx-btn-sm" onClick={() => switchAccount(m.ownerId)}>
                  Open account <ArrowRight size={14} />
                </button>
              )}
            </div>
          ))}
        </section>
      )}
    </div>
  );
};

export default Team;
