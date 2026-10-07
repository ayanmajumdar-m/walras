import React, { useCallback, useEffect, useState } from "react";
import { UserPlus, Users, Mail, Trash2, Save, LogOut, Check, X, ArrowRight, Lock } from "lucide-react";
import { api, switchAccount } from "../consoleApi";
import { useConsole } from "../ConsoleContext";

/*
  Account → Team. Invite up to 5 people by email, each as Write (use
  everything, delete nothing) or Admin (everything, including the team).
  In your own account this manages your team; working in a team account as
  an Admin, it manages that account's team. Invitations waiting for you and
  teams you belong to are always your own. The server enforces all of it
  (utils/team.js); this page only manages it.
*/

const formatDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const RolePicker = ({ roles, value, onChange, disabled, name }) => (
  <div className="cx-access cx-access-2">
    {Object.entries(roles).map(([key, { label, desc }]) => (
      <label key={key} className={`cx-access-item${value === key ? " is-on" : ""}`}>
        <input type="radio" name={name} checked={value === key} disabled={disabled} onChange={() => onChange(key)} />
        <span>
          <strong>{label}</strong>
          <small>{desc}</small>
        </span>
      </label>
    ))}
  </div>
);

const MemberRow = ({ member, roles, onSaved, notify, me }) => {
  const [role, setRole] = useState(member.role);
  const [busy, setBusy] = useState(false);
  const isMe = me && member.userId === me;

  const save = async () => {
    if (isMe && role !== "admin" && !window.confirm("Change your own role to Write? You won't be able to manage this team any more.")) return;
    setBusy(true);
    try {
      const d = await api(`/api/team/members/${member.id}`, { method: "PUT", body: { role } });
      notify(d.message, "success");
      onSaved();
    } catch (e) { notify(e.message, "error"); } finally { setBusy(false); }
  };
  const remove = async () => {
    const what = member.status === "invited"
      ? `Cancel the invitation to ${member.email}?`
      : `Remove ${isMe ? "yourself" : member.name || member.email} from the team? ${isMe ? "You" : "They"} lose access straight away.`;
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
          <strong>{member.name || member.email}{isMe ? " (you)" : ""}</strong>
          <small>{member.name ? member.email : ""}</small>
        </span>
        <span className="cx-pill is-brand">{roles[member.role]?.label}</span>
        <span className={`cx-status ${member.status === "active" ? "is-active" : "is-pending"}`}>
          {member.status === "active" ? "Active" : "Invited"}
        </span>
      </div>
      <p className="cx-member-meta">
        {member.status === "active" ? `Joined ${formatDate(member.acceptedAt)}` : `Invited ${formatDate(member.invitedAt)} · waiting for them to sign in and accept`}
      </p>
      <RolePicker roles={roles} value={role} onChange={setRole} disabled={busy} name={`role-${member.id}`} />
      <div className="cx-member-actions">
        <button type="button" className="cx-btn cx-btn-ghost cx-btn-sm is-danger" onClick={remove} disabled={busy}>
          <Trash2 size={14} /> {member.status === "invited" ? "Cancel invitation" : "Remove"}
        </button>
        <button type="button" className="cx-btn cx-btn-primary cx-btn-sm" onClick={save} disabled={busy || role === member.role}>
          <Save size={14} /> Save role
        </button>
      </div>
    </div>
  );
};

// The team of the account being worked in (yours, or one you're an Admin of).
const ManageTeam = ({ notify, me }) => {
  const { account } = useConsole();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("write");
  const [inviting, setInviting] = useState(false);

  const load = useCallback(() => {
    api("/api/team/members").then((d) => { setData(d); setError(""); }).catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  const invite = async (e) => {
    e.preventDefault();
    setInviting(true);
    try {
      const d = await api("/api/team/members", { method: "POST", body: { email: email.trim(), role } });
      notify(d.message, "success");
      setEmail("");
      load();
    } catch (err) { notify(err.message, "error"); } finally { setInviting(false); }
  };

  if (error) return <div className="cx-alert is-error">{error}</div>;
  if (!data) return <div className="cx-card cx-empty"><p>Loading the team…</p></div>;

  const full = data.members.length >= data.limit;
  const whose = account ? `${data.owner.name || data.owner.email}'s` : "your";

  return (
    <section className="cx-section">
      <div className="cx-section-head">
        <h3>{account ? `${data.owner.name || data.owner.email}'s team` : "Your team"}</h3>
        <span className="cx-count">{data.members.length}/{data.limit}</span>
      </div>
      <p className="cx-step-help">
        Invite up to {data.limit} people to help run {whose} account. Each signs in with their own email and password.
        Nobody on the team can change the account owner's profile or password.
      </p>

      <form className="cx-card cx-ticket-form" onSubmit={invite}>
        <h3><UserPlus size={18} aria-hidden="true" /> Invite someone</h3>
        <label className="cx-field">
          <span>Email address</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="colleague@company.com"
            disabled={full} autoComplete="off" required />
        </label>
        <div className="cx-field">
          <span>Role</span>
          <RolePicker roles={data.roles} value={role} onChange={setRole} disabled={full} name="invite-role" />
        </div>
        <div className="cx-ticket-actions">
          {full && <span className="cx-field-hint">The team is full. Remove someone to invite another person.</span>}
          <button type="submit" className="cx-btn cx-btn-primary" disabled={full || inviting || !email.trim()}>
            <UserPlus size={15} /> {inviting ? "Sending…" : "Send invitation"}
          </button>
        </div>
      </form>

      {data.members.length > 0 && (
        <div className="cx-member-list">
          {data.members.map((m) => <MemberRow key={`${m.id}-${m.role}`} member={m} roles={data.roles} onSaved={load} notify={notify} me={me} />)}
        </div>
      )}
    </section>
  );
};

const Team = () => {
  const { account, can, profile } = useConsole();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState(null);

  const notify = (text, type) => setMessage({ text, type });
  const me = Number(localStorage.getItem("userId")) || profile?.id || null;

  const load = useCallback(() => {
    api("/api/team").then((d) => { setData(d); setError(""); }).catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

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
      if (account && String(account.ownerId) === String(m.ownerId)) switchAccount(null);
      else load();
    } catch (e) { notify(e.message, "error"); }
  };

  if (error) return <div className="cx-alert is-error">{error}</div>;
  if (!data) return <div className="cx-card cx-empty"><p>Loading your team…</p></div>;

  const roleLabel = (r) => data.roles[r]?.label || "Write";

  return (
    <div className="cx-team">
      {message && (
        <div className={`cx-alert is-${message.type}`} role="status">
          <span>{message.text}</span>
          <button type="button" className="cx-icon-btn" onClick={() => setMessage(null)} aria-label="Dismiss"><X size={15} /></button>
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
                <small>Role: {roleLabel(inv.role)} · {formatDate(inv.invitedAt)}</small>
              </span>
              <button type="button" className="cx-btn cx-btn-ghost cx-btn-sm" onClick={() => respond(inv, false)}><X size={14} /> Decline</button>
              <button type="button" className="cx-btn cx-btn-primary cx-btn-sm" onClick={() => respond(inv, true)}><Check size={14} /> Accept</button>
            </div>
          ))}
        </section>
      )}

      {can("team") ? (
        <ManageTeam key={account ? account.ownerId : "own"} notify={notify} me={me} />
      ) : (
        <div className="cx-card cx-empty">
          <span className="cx-empty-icon"><Lock size={26} aria-hidden="true" /></span>
          <h4>Only admins manage this team</h4>
          <p>You have Write access in {account?.ownerName || "this"} account. Ask an account admin to change the team, or switch back to your own account to manage yours.</p>
          <button type="button" className="cx-btn cx-btn-ghost" onClick={() => switchAccount(null)}>Back to my account</button>
        </div>
      )}

      {data.memberships.length > 0 && (
        <section className="cx-section">
          <div className="cx-section-head"><h3>Teams you're in</h3></div>
          {data.memberships.map((m) => (
            <div className="cx-card cx-invite" key={m.ownerId}>
              <Users size={18} aria-hidden="true" />
              <span className="cx-invite-text">
                <strong>{m.company || m.ownerName || m.ownerEmail}</strong>
                <small>{m.ownerEmail} · Role: {roleLabel(m.role)}</small>
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
