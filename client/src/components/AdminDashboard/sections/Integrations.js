import React, { useEffect, useState } from "react";
import { Save, RotateCcw } from "lucide-react";
import { adminApi } from "../adminApi";

/*
  Integrations: the keys, passwords and addresses for email, Zendesk,
  payments and domains. A value saved here wins over the server's environment
  variable of the same name; clearing it falls back to the environment.
  Secrets are write-only: only their last four characters are shown.
*/

const SOURCE = {
  admin: { label: "Set here", cls: "is-active" },
  env: { label: "From server env", cls: "is-pending" },
  unset: { label: "Not set", cls: "is-stopped" },
};

const Integrations = () => {
  const [groups, setGroups] = useState(null);
  const [draft, setDraft] = useState({}); // name -> value | null (clear)
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    adminApi("/integrations").then((d) => setGroups(d.groups)).catch((e) => setNotice({ type: "error", text: e.message }));
  }, []);

  const set = (name, value) => setDraft((d) => ({ ...d, [name]: value }));
  const changed = Object.keys(draft).length > 0;

  const save = async () => {
    // An untouched or empty secret field keeps the saved secret.
    const values = Object.fromEntries(Object.entries(draft).filter(([name, v]) => {
      const f = groups.flatMap((g) => g.fields).find((x) => x.name === name);
      return !(f?.secret && v === "");
    }));
    setBusy(true);
    try {
      const d = await adminApi("/integrations", { method: "PUT", body: { values } });
      setGroups(d.groups);
      setDraft({});
      setNotice({ type: "success", text: d.message });
    } catch (e) {
      setNotice({ type: "error", text: e.message });
    } finally {
      setBusy(false);
    }
  };

  if (!groups) {
    return <div className="cx-page">{notice ? <div className="cx-alert is-error">{notice.text}</div> : <div className="cx-card cx-empty"><p>Loading integrations…</p></div>}</div>;
  }

  return (
    <div className="cx-page">
      <div className="cx-page-head">
        <h2>Integrations</h2>
        <p>Keys and addresses for email, support, payments and domains. Values saved here replace the server's environment variables and take effect within a minute, no restart needed.</p>
      </div>

      {notice && <div className={`cx-alert is-${notice.type}`} role="status">{notice.text}</div>}
      <div className="cx-alert is-info">
        SolusVM panels are added in <a className="cx-link" href="?section=solus-accounts">SolusVM accounts</a>. The database address, JWT secret and port stay in the server environment.
      </div>

      {groups.map((g) => (
        <div key={g.id} className="cx-card ap-integration">
          <div className="ap-integration-head">
            <h3>{g.label}</h3>
            {g.desc && <p className="ap-muted">{g.desc}</p>}
          </div>
          <div className="ap-plan-grid">
            {g.fields.map((f) => {
              const pending = Object.prototype.hasOwnProperty.call(draft, f.name);
              const clearing = pending && draft[f.name] === null;
              const value = pending && !clearing ? draft[f.name] : f.secret ? "" : clearing ? "" : f.value ?? "";
              const src = SOURCE[f.source];
              return (
                <label key={f.name} className="cx-field">
                  <span className="ap-integration-label">
                    {f.label}
                    <span className={`cx-status ${clearing ? "is-pending" : src.cls}`}>{clearing ? "Will use env" : src.label}</span>
                  </span>
                  {f.options ? (
                    <select className="ap-select" value={value} onChange={(e) => set(f.name, e.target.value)}>
                      {!value && <option value="">Choose…</option>}
                      {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input
                      type={f.secret ? "password" : "text"}
                      value={value}
                      onChange={(e) => set(f.name, e.target.value)}
                      placeholder={f.secret && f.last4 ? `••••${f.last4} (leave empty to keep)` : f.placeholder}
                      autoComplete={f.secret ? "new-password" : "off"}
                      spellCheck={false}
                    />
                  )}
                  <small className="ap-muted">
                    <code>{f.name}</code>{f.hint ? ` · ${f.hint}` : ""}
                    {f.source === "admin" && !clearing && (
                      <button type="button" className="ap-text-btn" onClick={() => set(f.name, null)}>
                        <RotateCcw size={12} /> Use server env
                      </button>
                    )}
                  </small>
                </label>
              );
            })}
          </div>
        </div>
      ))}

      <div className="ap-card-foot ap-sticky-foot">
        {changed && <button type="button" className="cx-btn cx-btn-ghost" onClick={() => setDraft({})} disabled={busy}>Discard changes</button>}
        <button type="button" className="cx-btn cx-btn-primary" onClick={save} disabled={busy || !changed}>
          <Save size={15} /> {busy ? "Saving…" : "Save integrations"}
        </button>
      </div>
    </div>
  );
};

export default Integrations;
