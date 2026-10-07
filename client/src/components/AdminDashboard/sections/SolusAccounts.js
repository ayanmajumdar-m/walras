import React, { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2, X, RefreshCw, PlugZap, CheckCircle2, XCircle, Server } from "lucide-react";
import { adminApi } from "../adminApi";

/*
  SolusVM accounts, like Fantom's AWS accounts. Walras can use several
  SolusVM panels. New servers fill the active accounts in fill order, each up
  to its server limit; paused accounts keep their servers but get no new ones.
  Each account says which Walras locations it serves and which of its plans
  each Walras plan creates (ids differ from panel to panel). API tokens are
  stored encrypted and never shown again.
*/

const fmtDateTime = (d) =>
  d ? new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "";

const Modal = ({ title, onClose, children }) => (
  <div className="cx-modal-scrim" onClick={onClose}>
    <div className="cx-modal ap-plan-modal ap-account-modal" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
      <div className="cx-modal-head">
        <h3>{title}</h3>
        <button type="button" className="cx-icon-btn" onClick={onClose} aria-label="Close"><X size={18} /></button>
      </div>
      {children}
    </div>
  </div>
);

const Field = ({ label, hint, wide, children }) => (
  <label className={`cx-field${wide ? " ap-wide" : ""}`}>
    <span>{label}</span>
    {children}
    {hint && <small className="ap-muted">{hint}</small>}
  </label>
);

// Which panel location / plan each Walras location / plan uses on this account.
const Links = ({ accountId, data, value, onChange }) => {
  const [catalog, setCatalog] = useState(null);
  useEffect(() => {
    adminApi(`/solus-accounts/${accountId}/catalog`).then(setCatalog).catch((e) => setCatalog({ error: e.message, locations: [], plans: [] }));
  }, [accountId]);

  if (!catalog) return <p className="ap-muted">Loading this panel's locations and plans…</p>;
  const pick = (kind, key, v) => onChange({ ...value, [kind]: { ...value[kind], [key]: v } });

  return (
    <div className="ap-links">
      {catalog.error && <div className="cx-alert is-error">{catalog.error}</div>}
      <h4 className="ap-subhead">Locations it serves</h4>
      <p className="ap-muted">For each Walras location this panel can host, pick the panel's matching location.</p>
      <div className="ap-link-list">
        {data.locations.map((l) => (
          <label key={l.id} className="ap-link-row">
            <span>{l.name}{l.active ? "" : " (hidden)"}</span>
            <select className="ap-select" value={value.locations[l.id] ?? ""} onChange={(e) => pick("locations", l.id, e.target.value)}>
              <option value="">Doesn't serve it</option>
              {catalog.locations.map((s) => <option key={s.id} value={s.id}>{s.name} (#{s.id})</option>)}
              {value.locations[l.id] && !catalog.locations.some((s) => String(s.id) === String(value.locations[l.id])) && (
                <option value={value.locations[l.id]}>Location #{value.locations[l.id]} (not found on the panel)</option>
              )}
            </select>
          </label>
        ))}
      </div>
      <h4 className="ap-subhead">Plans</h4>
      <p className="ap-muted">For each Walras plan, the panel plan it creates. A plan that isn't linked can't go on this account.</p>
      <div className="ap-link-list">
        {data.plans.map((p) => (
          <label key={p.name} className="ap-link-row">
            <span>{p.name} <small className="ap-muted">{p.cpu === "amd" ? "AMD" : "Intel"}{p.active ? "" : " · hidden"}</small></span>
            <select className="ap-select" value={value.plans[p.name] ?? ""} onChange={(e) => pick("plans", p.name, e.target.value)}>
              <option value="">Not linked</option>
              {catalog.plans.map((s) => <option key={s.id} value={s.id}>{s.name} (#{s.id})</option>)}
              {value.plans[p.name] && !catalog.plans.some((s) => String(s.id) === String(value.plans[p.name])) && (
                <option value={value.plans[p.name]}>Plan #{value.plans[p.name]} (not found on the panel)</option>
              )}
            </select>
          </label>
        ))}
      </div>
    </div>
  );
};

const AccountForm = ({ account, data, onSaved, onClose }) => {
  const editing = Boolean(account);
  const [f, setF] = useState({
    name: account?.name || "",
    apiUrl: account?.apiUrl || "",
    token: "",
    priority: String(account?.priority ?? ""),
    limited: account ? account.maxServers !== null : true,
    maxServers: String(account?.maxServers ?? 50),
    paused: account?.status === "paused",
  });
  const [links, setLinks] = useState({ locations: { ...(account?.locations || {}) }, plans: { ...(account?.plans || {}) } });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const clean = (m) => Object.fromEntries(Object.entries(m).filter(([, v]) => v !== "" && v !== null && v !== undefined));
    const body = {
      name: f.name, apiUrl: f.apiUrl,
      ...(f.token.trim() ? { token: f.token.trim() } : {}),
      ...(f.priority !== "" ? { priority: f.priority } : {}),
      maxServers: f.limited ? f.maxServers : null,
      status: f.paused ? "paused" : "active",
      ...(editing ? { locations: clean(links.locations), plans: clean(links.plans) } : {}),
    };
    try {
      const d = editing
        ? await adminApi(`/solus-accounts/${account.id}`, { method: "PUT", body })
        : await adminApi("/solus-accounts", { method: "POST", body });
      onSaved(d.message, editing ? null : d.id);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <Modal title={editing ? `Edit ${account.name}` : "Add a SolusVM account"} onClose={onClose}>
      <form className="ap-plan-form" onSubmit={submit}>
        {error && <div className="cx-alert is-error">{error}</div>}
        <div className="ap-plan-grid">
          <Field label="Name"><input value={f.name} onChange={set("name")} maxLength={80} required placeholder="Mumbai panel" autoFocus={!editing} /></Field>
          <Field label="Panel address" hint="The SolusVM 2 panel URL."><input value={f.apiUrl} onChange={set("apiUrl")} required placeholder="https://cloud.example.com" /></Field>
          <Field label="API token" wide
            hint={editing ? (account.hasToken ? `Saved: ••••${account.tokenLast4}. Leave empty to keep it; paste a new one to replace it.` : "No token saved yet.") : "From the panel: Account → API Tokens. Stored encrypted and never shown again."}>
            <input type="password" value={f.token} onChange={set("token")} autoComplete="new-password" required={!editing} />
          </Field>
          <Field label="Fill order" hint="Lower fills first."><input type="number" step="1" value={f.priority} onChange={set("priority")} placeholder="Next" /></Field>
          <Field label="Max servers">
            <span className="ap-inline">
              <input type="number" min="0" step="1" value={f.maxServers} onChange={set("maxServers")} disabled={!f.limited} />
              <label className="ap-check"><input type="checkbox" checked={!f.limited} onChange={(e) => setF({ ...f, limited: !e.target.checked })} /> No limit</label>
            </span>
          </Field>
        </div>
        <label className="ap-plan-active">
          <input type="checkbox" checked={f.paused} onChange={set("paused")} />
          <span><strong>Paused</strong><small>Paused accounts keep their servers but get no new ones.</small></span>
        </label>
        {editing
          ? <Links accountId={account.id} data={data} value={links} onChange={setLinks} />
          : <p className="ap-muted">After adding it, edit the account to link its locations and plans.</p>}
        <div className="ap-plan-actions">
          <span className="ap-plan-spacer" />
          <button type="button" className="cx-btn cx-btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" className="cx-btn cx-btn-primary" disabled={busy}>{busy ? "Saving…" : editing ? "Save account" : "Add account"}</button>
        </div>
      </form>
    </Modal>
  );
};

const SolusAccounts = ({ can }) => {
  const [data, setData] = useState(null);
  const [notice, setNotice] = useState(null);
  const [editing, setEditing] = useState(null); // account, or "new"
  const [testing, setTesting] = useState(null);
  const [tests, setTests] = useState({}); // id -> checks
  const editable = can("manage_integrations");

  const load = useCallback(() => {
    return adminApi("/solus-accounts").then((d) => { setData(d); return d; }).catch((e) => setNotice({ type: "error", text: e.message }));
  }, []);
  useEffect(() => { load(); }, [load]);

  const saved = async (text, newId) => {
    setNotice({ type: "success", text });
    const d = await load();
    // A new account: open it straight away to link locations and plans.
    setEditing(newId && d ? d.accounts.find((a) => a.id === newId) || null : null);
  };

  const test = async (a) => {
    setTesting(a.id);
    try {
      const r = await adminApi(`/solus-accounts/${a.id}/test`, { method: "POST" });
      setTests((t) => ({ ...t, [a.id]: r.checks }));
      load();
    } catch (e) { setNotice({ type: "error", text: e.message }); } finally { setTesting(null); }
  };

  const remove = async (a) => {
    if (!window.confirm(`Remove ${a.name}? Its location and plan links are removed too.`)) return;
    try {
      const d = await adminApi(`/solus-accounts/${a.id}`, { method: "DELETE" });
      setNotice({ type: "success", text: d.message });
      load();
    } catch (e) { setNotice({ type: "error", text: e.message }); }
  };

  if (!data) {
    return <div className="cx-page">{notice ? <div className="cx-alert is-error">{notice.text}</div> : <div className="cx-card cx-empty"><p>Loading accounts…</p></div>}</div>;
  }

  const active = data.accounts.filter((a) => a.status === "active");
  const totalServers = data.accounts.reduce((n, a) => n + a.servers, 0);
  const unlimited = active.some((a) => a.maxServers === null);
  const room = active.reduce((n, a) => n + Math.max(0, (a.maxServers ?? 0) - a.servers), 0);
  const locName = (id) => data.locations.find((l) => String(l.id) === String(id))?.name || `#${id}`;

  return (
    <div className="cx-page">
      <div className="cx-page-head cx-page-head-row">
        <div>
          <h2>SolusVM accounts</h2>
          <p>Each server lives on one SolusVM panel. New servers fill the active accounts in order, each up to its server limit.</p>
        </div>
        <div className="cx-welcome-actions">
          <button type="button" className="cx-btn cx-btn-ghost" onClick={load}><RefreshCw size={15} /> Refresh</button>
          {editable && <button type="button" className="cx-btn cx-btn-primary" onClick={() => setEditing("new")}><Plus size={16} /> Add account</button>}
        </div>
      </div>

      {notice && <div className={`cx-alert is-${notice.type}`} role="status">{notice.text}</div>}
      {!editable && <div className="cx-alert is-info">You can view accounts. Changing them needs the "Manage SolusVM accounts and integration keys" permission.</div>}

      <p className="ap-muted">
        {data.accounts.length} account{data.accounts.length === 1 ? "" : "s"} · {totalServers} server{totalServers === 1 ? "" : "s"}
        {data.accounts.length > 0 && (unlimited ? " · at least one active account has no limit" : ` · room for ${room} more`)}
      </p>

      {data.accounts.length === 0 ? (
        <div className="cx-card cx-empty">
          <span className="cx-empty-icon"><Server size={26} aria-hidden="true" /></span>
          <h4>No SolusVM accounts yet</h4>
          <p>Add your SolusVM panel to start selling Virtual Machines. Until then every plan shows Out of stock.</p>
          {editable && <button type="button" className="cx-btn cx-btn-primary" onClick={() => setEditing("new")}><Plus size={16} /> Add account</button>}
        </div>
      ) : (
        <div className="ap-account-grid">
          {data.accounts.map((a) => {
            const full = a.status === "active" && a.maxServers !== null && a.servers >= a.maxServers;
            const pct = a.maxServers ? Math.min(100, Math.round((a.servers / a.maxServers) * 100)) : 0;
            const locs = Object.keys(a.locations).map(locName);
            return (
              <div key={a.id} className="cx-card ap-account">
                <div className="ap-account-head">
                  <div>
                    <h3>{a.name}</h3>
                    <small className="ap-muted">{a.apiUrl}</small>
                  </div>
                  <span className={`cx-status ${a.status === "paused" ? "is-stopped" : full ? "is-pending" : "is-active"}`}>
                    {a.status === "paused" ? "Paused" : full ? "Full" : "Taking servers"}
                  </span>
                </div>
                <div className="ap-account-usage">
                  <span><strong>{a.servers}</strong> / {a.maxServers ?? "no limit"} servers</span>
                  {a.maxServers !== null && <div className="ap-progress"><span style={{ width: `${pct}%` }} /></div>}
                </div>
                <dl className="ap-account-facts">
                  <div><dt>Fill order</dt><dd>{a.priority}</dd></div>
                  <div><dt>API token</dt><dd>{a.hasToken ? `••••${a.tokenLast4}` : "Not set"}</dd></div>
                  <div><dt>Locations</dt><dd>{locs.length ? locs.join(", ") : <span className="ap-muted">None linked</span>}</dd></div>
                  <div><dt>Plans linked</dt><dd>{Object.keys(a.plans).length} of {data.plans.length}</dd></div>
                </dl>
                <div className="ap-account-test">
                  {a.lastTestAt ? (
                    a.lastTestOk
                      ? <span className="ap-ok"><CheckCircle2 size={14} /> Works · checked {fmtDateTime(a.lastTestAt)}</span>
                      : <span className="ap-bad"><XCircle size={14} /> {a.lastTestError}</span>
                  ) : <span className="ap-muted">Not tested yet</span>}
                </div>
                {tests[a.id] && (
                  <ul className="ap-checks">
                    {tests[a.id].map((c) => (
                      <li key={c.label} className={c.ok ? "ap-ok" : "ap-bad"}>{c.ok ? "✓" : "✗"} {c.label}: <span className="ap-muted">{c.detail}</span></li>
                    ))}
                  </ul>
                )}
                {editable && (
                  <div className="ap-account-actions">
                    <button type="button" className="cx-btn cx-btn-ghost cx-btn-sm" onClick={() => test(a)} disabled={testing === a.id}>
                      <PlugZap size={14} /> {testing === a.id ? "Testing…" : "Test connection"}
                    </button>
                    <span className="ap-plan-spacer" />
                    <button type="button" className="cx-icon-btn" onClick={() => setEditing(a)} title="Edit"><Pencil size={15} /></button>
                    <button type="button" className="cx-icon-btn is-danger" onClick={() => remove(a)} disabled={a.servers > 0}
                      title={a.servers > 0 ? "Has servers: pause it instead" : "Remove"}><Trash2 size={15} /></button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {editing && (
        <AccountForm
          key={editing === "new" ? "new" : editing.id}
          account={editing === "new" ? null : editing}
          data={data}
          onSaved={saved}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
};

export default SolusAccounts;
