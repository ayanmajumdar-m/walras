import React, { useCallback, useEffect, useState } from "react";
import { UserPlus, KeyRound, Trash2, X, ShieldCheck } from "lucide-react";
import { adminApi, fmtDate } from "../adminApi";

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

const Administrators = ({ me }) => {
  const [admins, setAdmins] = useState([]);
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [matrix, setMatrix] = useState({});
  const [notice, setNotice] = useState(null);
  const [modal, setModal] = useState(null); // { kind: 'create' } | { kind: 'reset', admin }
  const [form, setForm] = useState({ username: "", fullName: "", password: "", role: "support" });
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    adminApi("/admins").then((d) => { setAdmins(d.admins || []); setRoles(d.roles || []); }).catch((e) => setNotice({ type: "error", text: e.message }));
    adminApi("/roles").then((d) => { setPermissions(d.permissions || []); setMatrix(d.matrix || {}); }).catch(() => {});
  }, []);

  useEffect(load, [load]);

  const act = async (fn, success) => {
    setBusy(true);
    try {
      await fn();
      setNotice({ type: "success", text: success });
      setModal(null);
      setForm({ username: "", fullName: "", password: "", role: "support" });
      load();
    } catch (e) {
      setNotice({ type: "error", text: e.message });
    } finally {
      setBusy(false);
    }
  };

  const roleLabel = (id) => roles.find((r) => r.id === id)?.label || id;
  const assignable = roles.filter((r) => r.id !== "super_admin" || me.role === "super_admin");
  const groups = [...new Set(permissions.map((p) => p.group))];

  const togglePerm = async (role, permission, allowed) => {
    try {
      const d = await adminApi(`/roles/${role}/permissions`, { method: "PUT", body: { permission, allowed } });
      setMatrix(d.matrix);
    } catch (e) {
      setNotice({ type: "error", text: e.message });
    }
  };

  return (
    <div className="cx-page">
      <div className="cx-page-head cx-page-head-row">
        <div>
          <h2>Administrators</h2>
          <p>Who can sign in to this panel, and what each role is allowed to do.</p>
        </div>
        <button type="button" className="cx-btn cx-btn-primary" onClick={() => setModal({ kind: "create" })}><UserPlus size={16} /> Add administrator</button>
      </div>

      {notice && <div className={`cx-alert is-${notice.type}`} role="status">{notice.text}<button type="button" className="cx-icon-btn" onClick={() => setNotice(null)} aria-label="Dismiss"><X size={15} /></button></div>}

      <div className="cx-card cx-table-wrap">
        <table className="cx-table">
          <thead><tr><th>Administrator</th><th>Role</th><th>Status</th><th>Last sign-in</th><th /></tr></thead>
          <tbody>
            {admins.map((a) => {
              const self = a.id === me.id;
              const lockedSuper = a.role === "super_admin" && me.role !== "super_admin";
              return (
                <tr key={a.id}>
                  <td data-label="Administrator"><strong>{a.full_name || a.username}</strong><small>@{a.username}{self ? " · you" : ""}</small></td>
                  <td data-label="Role">
                    <select className="ap-select" value={a.role || ""} disabled={self || lockedSuper || busy}
                      onChange={(e) => act(() => adminApi(`/admins/${a.id}`, { method: "PATCH", body: { role: e.target.value } }), `${a.username} is now ${roleLabel(e.target.value)}`)}>
                      {(lockedSuper ? roles : assignable).map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
                    </select>
                  </td>
                  <td data-label="Status">
                    <label className="ap-switch">
                      <input type="checkbox" checked={a.is_active} disabled={self || lockedSuper || busy}
                        onChange={(e) => act(() => adminApi(`/admins/${a.id}`, { method: "PATCH", body: { isActive: e.target.checked } }), `${a.username} ${e.target.checked ? "activated" : "deactivated"}`)} />
                      <span>{a.is_active ? "Active" : "Disabled"}</span>
                    </label>
                  </td>
                  <td data-label="Last sign-in">{fmtDate(a.last_login_at, true)}</td>
                  <td className="cx-actions">
                    <button type="button" className="cx-icon-btn" title="Reset password" disabled={lockedSuper && !self}
                      onClick={() => setModal({ kind: "reset", admin: a })}><KeyRound size={15} /></button>
                    <button type="button" className="cx-icon-btn is-danger" title="Delete" disabled={self || lockedSuper || busy}
                      onClick={() => window.confirm(`Delete administrator ${a.username}? They lose access immediately.`) &&
                        act(() => adminApi(`/admins/${a.id}`, { method: "DELETE" }), `${a.username} deleted`)}><Trash2 size={15} /></button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <section className="cx-section">
        <div className="cx-section-head"><h3>Role permissions</h3></div>
        <p className="ap-muted">Changes apply to everyone with that role within 30 seconds. Super admins always have every permission.</p>
        <div className="cx-card cx-table-wrap">
          <table className="cx-table ap-matrix">
            <thead>
              <tr><th>Permission</th>{roles.map((r) => <th key={r.id} title={r.description}>{r.label}</th>)}</tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <React.Fragment key={g}>
                  <tr className="ap-matrix-group"><td colSpan={roles.length + 1}>{g}</td></tr>
                  {permissions.filter((p) => p.group === g).map((p) => (
                    <tr key={p.id}>
                      <td>{p.label}</td>
                      {roles.map((r) => {
                        const on = (matrix[r.id] || []).includes(p.id);
                        return (
                          <td key={r.id} className="ap-matrix-cell">
                            {r.id === "super_admin" ? <ShieldCheck size={16} className="ap-pos" aria-label="Always" />
                              : <input type="checkbox" checked={on} aria-label={`${r.label}: ${p.label}`} onChange={(e) => togglePerm(r.id, p.id, e.target.checked)} />}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {modal?.kind === "create" && (
        <Modal title="Add administrator" onClose={() => setModal(null)}>
          <label className="cx-field"><span>Full name</span><input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} placeholder="Priya Sharma" /></label>
          <label className="cx-field"><span>Username</span><input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase() })} placeholder="priya" autoComplete="off" /></label>
          <label className="cx-field"><span>Temporary password</span><input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="At least 10 characters, a letter and a number" autoComplete="new-password" /></label>
          <label className="cx-field"><span>Role</span>
            <select className="ap-select" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              {assignable.map((r) => <option key={r.id} value={r.id}>{r.label}: {r.description}</option>)}
            </select>
          </label>
          <button type="button" className="cx-btn cx-btn-primary cx-btn-block" disabled={busy || !form.username || !form.password}
            onClick={() => act(() => adminApi("/admins", { method: "POST", body: form }), `${form.username} added`)}>Create administrator</button>
        </Modal>
      )}

      {modal?.kind === "reset" && (
        <Modal title={`New password for ${modal.admin.username}`} onClose={() => setModal(null)}>
          <label className="cx-field"><span>New password</span><input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="At least 10 characters, a letter and a number" autoComplete="new-password" /></label>
          <button type="button" className="cx-btn cx-btn-primary cx-btn-block" disabled={busy || form.password.length < 10}
            onClick={() => act(() => adminApi(`/admins/${modal.admin.id}/reset-password`, { method: "POST", body: { password: form.password } }), "Password updated")}>Set password</button>
        </Modal>
      )}
    </div>
  );
};

export default Administrators;
