import React, { useEffect, useState } from "react";
import { Mail, Send, Save, Loader2 } from "lucide-react";
import "./Settings.css";

/**
 * Owner-only settings. Currently: who outgoing emails (verification codes,
 * password resets, purchase confirmations) are sent from.
 */
const Settings = () => {
  const token = localStorage.getItem("adminToken");
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  const [form, setForm] = useState({ fromName: "", fromAddress: "" });
  const [effective, setEffective] = useState(null);
  const [defaults, setDefaults] = useState(null);
  const [testTo, setTestTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState({ text: "", type: "" });

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/settings/mail", { headers });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Could not load settings");
        setForm({ fromName: data.fromName, fromAddress: data.fromAddress });
        setEffective(data.effective);
        setDefaults(data.defaults);
      } catch (err) {
        setMessage({ text: err.message, type: "error" });
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage({ text: "", type: "" });
    try {
      const res = await fetch("/api/admin/settings/mail", { method: "PUT", headers, body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save");
      setEffective(data.effective);
      setMessage({ text: "Saved. New emails will use this sender within a minute.", type: "success" });
    } catch (err) {
      setMessage({ text: err.message, type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const sendTest = async () => {
    setTesting(true);
    setMessage({ text: "", type: "" });
    try {
      const res = await fetch("/api/admin/settings/mail/test", { method: "POST", headers, body: JSON.stringify({ to: testTo }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Test failed");
      setMessage({ text: data.message, type: "success" });
    } catch (err) {
      setMessage({ text: err.message, type: "error" });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return <div className="st-wrap"><p className="st-muted">Loading settings…</p></div>;
  }

  return (
    <div className="st-wrap">
      <div className="st-head">
        <h2>Settings</h2>
        <p className="st-muted">Changes apply without a redeploy.</p>
      </div>

      {message.text && <div className={`st-alert is-${message.type}`} role="status">{message.text}</div>}

      <section className="st-card">
        <div className="st-card-head">
          <span className="st-icon"><Mail size={20} /></span>
          <div>
            <h3>Email sender</h3>
            <p className="st-muted">
              Used for verification codes, password resets and purchase confirmations.
              The address must be on a domain verified in Brevo (Senders &amp; Domains), or emails will be rejected.
            </p>
          </div>
        </div>

        {effective && (
          <p className="st-current">
            Currently sending as <strong>{effective.name} &lt;{effective.address}&gt;</strong>
          </p>
        )}

        <form className="st-form" onSubmit={save}>
          <label>
            <span>Sender name</span>
            <input
              type="text"
              value={form.fromName}
              maxLength={100}
              onChange={(e) => setForm({ ...form, fromName: e.target.value })}
              placeholder={defaults?.fromName || "Walras Cloud"}
            />
          </label>
          <label>
            <span>Sender email address</span>
            <input
              type="email"
              value={form.fromAddress}
              onChange={(e) => setForm({ ...form, fromAddress: e.target.value })}
              placeholder={defaults?.fromAddress || "noreply@walras.net"}
            />
          </label>
          <p className="st-hint">Leave a field empty to use the server default shown in grey.</p>
          <button type="submit" className="st-btn" disabled={saving}>
            {saving ? <Loader2 size={16} className="st-spin" /> : <Save size={16} />} Save sender
          </button>
        </form>

        <div className="st-test">
          <label>
            <span>Send a test email to</span>
            <input type="email" value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="you@example.com" />
          </label>
          <button type="button" className="st-btn st-btn-ghost" onClick={sendTest} disabled={testing || !testTo}>
            {testing ? <Loader2 size={16} className="st-spin" /> : <Send size={16} />} Send test
          </button>
        </div>
      </section>
    </div>
  );
};

export default Settings;
