import React, { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { LifeBuoy, Plus, RefreshCw, ArrowLeft, Paperclip, Send, X, Download, Mail } from "lucide-react";
import { api } from "../consoleApi";

/*
  Support tickets, backed by Zendesk through /api/support (like Fantom).
  The list, a new-ticket form and a ticket's conversation are one page; the
  open ticket lives in ?ticket=<id> so it can be linked and survives reloads.
*/

const MAX_FILES = 5;
const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPT = ".png,.jpg,.jpeg,.webp,.pdf,.zip,.txt";
const ALLOWED = ["image/png", "image/jpeg", "image/webp", "application/pdf", "application/zip", "application/x-zip-compressed", "text/plain"];

const STATUS_LABEL = { open: "Open", waiting: "Awaiting your reply", resolved: "Resolved", closed: "Closed" };

const formatDate = (d) =>
  d ? new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

const formatSize = (n) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

const readBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
  reader.onerror = () => reject(new Error(`Couldn't read ${file.name}`));
  reader.readAsDataURL(file);
});

const encodeFiles = (files) =>
  Promise.all(files.map(async (f) => ({ fileName: f.name, mimeType: f.type, data: await readBase64(f) })));

// ── Attachment picker ─────────────────────────────────────────────────────
const FilePicker = ({ files, setFiles, onError }) => {
  const input = useRef(null);
  const add = (list) => {
    const next = [...files];
    for (const f of list) {
      if (next.length >= MAX_FILES) { onError(`Attach up to ${MAX_FILES} files.`); break; }
      if (!ALLOWED.includes(f.type)) { onError(`${f.name}: use PNG, JPEG, WebP, PDF, ZIP or TXT.`); continue; }
      if (f.size > MAX_BYTES) { onError(`${f.name} is larger than 10 MB.`); continue; }
      next.push(f);
    }
    setFiles(next);
  };
  return (
    <div className="cx-attach">
      <input ref={input} type="file" multiple accept={ACCEPT} hidden
        onChange={(e) => { add(Array.from(e.target.files || [])); e.target.value = ""; }} />
      <button type="button" className="cx-btn cx-btn-ghost cx-btn-sm" onClick={() => input.current?.click()} disabled={files.length >= MAX_FILES}>
        <Paperclip size={14} /> Attach files
      </button>
      <span className="cx-attach-hint">Up to {MAX_FILES} files, 10 MB each</span>
      {files.length > 0 && (
        <ul className="cx-attach-list">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`}>
              <Paperclip size={13} aria-hidden="true" /> <span className="cx-ellipsis">{f.name}</span> <small>{formatSize(f.size)}</small>
              <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))} aria-label={`Remove ${f.name}`}><X size={14} /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

// ── New ticket ────────────────────────────────────────────────────────────
const NewTicket = ({ onCancel, onCreated, notify }) => {
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (subject.trim().length < 3) return notify("Give your ticket a short subject.", "error");
    if (description.trim().length < 10) return notify("Describe the problem in a little more detail (at least 10 characters).", "error");
    setBusy(true);
    try {
      const d = await api("/api/support/tickets", {
        method: "POST",
        body: { subject: subject.trim(), description: description.trim(), attachments: await encodeFiles(files) },
      });
      notify("Ticket opened. We'll reply here and by email.", "success");
      onCreated(d.id);
    } catch (err) {
      notify(err.message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="cx-card cx-ticket-form" onSubmit={submit}>
      <h3>New ticket</h3>
      <label className="cx-field">
        <span>Subject</span>
        <input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={160} placeholder="e.g. Can't reach cPanel for example.com" autoFocus />
      </label>
      <label className="cx-field">
        <span>How can we help?</span>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={4000} rows={7}
          placeholder="What happened, which service or domain it's about, and anything you've already tried." />
        <small className="cx-char-count">{description.length}/4000</small>
      </label>
      <FilePicker files={files} setFiles={setFiles} onError={(m) => notify(m, "error")} />
      <div className="cx-ticket-actions">
        <button type="button" className="cx-btn cx-btn-ghost" onClick={onCancel} disabled={busy}>Cancel</button>
        <button type="submit" className="cx-btn cx-btn-primary" disabled={busy}>
          {busy ? <RefreshCw size={15} className="cx-spin" /> : <Send size={15} />} Open ticket
        </button>
      </div>
    </form>
  );
};

// ── One ticket ────────────────────────────────────────────────────────────
const TicketView = ({ id, onBack, notify }) => {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [reply, setReply] = useState("");
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setError(null);
    api(`/api/support/tickets/${id}`)
      .then((d) => (d?.ticket ? setData(d) : setError("Ticket not found.")))
      .catch((e) => setError(e.message));
  }, [id]);

  useEffect(load, [load]);

  const download = async (att) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/support/tickets/${id}/attachments/${att.id}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Download failed");
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = att.fileName;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      notify(e.message, "error");
    }
  };

  const send = async (e) => {
    e.preventDefault();
    if (!reply.trim()) return;
    setBusy(true);
    try {
      await api(`/api/support/tickets/${id}/reply`, { method: "POST", body: { body: reply.trim(), attachments: await encodeFiles(files) } });
      setReply("");
      setFiles([]);
      notify("Reply sent.", "success");
      load();
    } catch (err) {
      notify(err.message, "error");
    } finally {
      setBusy(false);
    }
  };

  if (error) {
    return (
      <div className="cx-card cx-empty">
        <h4>Couldn't open this ticket</h4>
        <p>{error}</p>
        <button type="button" className="cx-btn cx-btn-ghost" onClick={onBack}><ArrowLeft size={15} /> All tickets</button>
      </div>
    );
  }
  if (!data) return <div className="cx-card cx-empty"><RefreshCw size={22} className="cx-spin" /></div>;

  const { ticket, messages } = data;
  return (
    <div className="cx-ticket">
      <div className="cx-ticket-head">
        <button type="button" className="cx-btn cx-btn-ghost cx-btn-sm" onClick={onBack}><ArrowLeft size={15} /> All tickets</button>
        <div className="cx-ticket-title">
          <h3>{ticket.subject}</h3>
          <span className="cx-ticket-meta">#{ticket.id} · opened {formatDate(ticket.created_at)}</span>
        </div>
        <span className={`cx-status is-ticket-${ticket.status}`}>{STATUS_LABEL[ticket.status]}</span>
      </div>

      <ol className="cx-thread">
        {messages.map((m) => (
          <li key={m.id} className={`cx-msg${m.fromMe ? " is-me" : ""}`}>
            <div className="cx-msg-meta">
              <strong>{m.fromMe ? "You" : "Walras Support"}</strong>
              <span>{formatDate(m.created_at)}</span>
            </div>
            <div className="cx-msg-body">{m.body}</div>
            {m.attachments.length > 0 && (
              <div className="cx-msg-files">
                {m.attachments.map((a) => (
                  <button key={a.id} type="button" onClick={() => download(a)} title={`Download ${a.fileName}`}>
                    <Download size={13} /> <span className="cx-ellipsis">{a.fileName}</span> <small>{formatSize(a.size)}</small>
                  </button>
                ))}
              </div>
            )}
          </li>
        ))}
      </ol>

      {ticket.canReply ? (
        <form className="cx-card cx-ticket-form" onSubmit={send}>
          <label className="cx-field">
            <span>{ticket.status === "resolved" ? "Still need help? Replying reopens the ticket." : "Reply"}</span>
            <textarea value={reply} onChange={(e) => setReply(e.target.value)} maxLength={4000} rows={4} placeholder="Write your reply…" />
          </label>
          <FilePicker files={files} setFiles={setFiles} onError={(m) => notify(m, "error")} />
          <div className="cx-ticket-actions">
            <button type="submit" className="cx-btn cx-btn-primary" disabled={busy || !reply.trim()}>
              {busy ? <RefreshCw size={15} className="cx-spin" /> : <Send size={15} />} Send reply
            </button>
          </div>
        </form>
      ) : (
        <div className="cx-alert is-info">This ticket is closed. If you still need help, please open a new ticket.</div>
      )}
    </div>
  );
};

// ── Page ──────────────────────────────────────────────────────────────────
const Support = () => {
  const [params, setParams] = useSearchParams();
  const openId = params.get("ticket");
  const composing = params.get("new") === "1";
  const [tickets, setTickets] = useState([]);
  const [configured, setConfigured] = useState(true);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState(null);
  const [message, setMessage] = useState(null);

  const notify = (text, type) => setMessage({ text, type });

  const load = useCallback(() => {
    setLoading(true);
    setListError(null);
    api("/api/support/tickets")
      .then((d) => { setConfigured(d.configured !== false); setTickets(d.tickets || []); })
      .catch((e) => setListError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const go = (next) => setParams(next, { replace: false });

  return (
    <div className="cx-page">
      <div className="cx-page-head cx-page-head-row">
        <div>
          <h2>Support</h2>
          <p>Open a ticket and our team will reply here and by email.</p>
        </div>
        {configured && !openId && !composing && (
          <div className="cx-welcome-actions">
            <button type="button" className="cx-btn cx-btn-ghost" onClick={load} disabled={loading}>
              <RefreshCw size={15} className={loading ? "cx-spin" : ""} /> Refresh
            </button>
            <button type="button" className="cx-btn cx-btn-primary" onClick={() => go({ new: "1" })}>
              <Plus size={16} /> New ticket
            </button>
          </div>
        )}
      </div>

      {message && (
        <div className={`cx-alert is-${message.type}`} role="status">
          <span>{message.text}</span>
          <button type="button" className="cx-icon-btn" onClick={() => setMessage(null)} aria-label="Dismiss"><X size={15} /></button>
        </div>
      )}

      {!configured ? (
        <div className="cx-card cx-empty">
          <span className="cx-empty-icon"><Mail size={26} aria-hidden="true" /></span>
          <h4>Email us for help</h4>
          <p>Ticketing in the console isn't available right now. Write to us and we'll get back to you.</p>
          <a href="mailto:support@walras.net" className="cx-btn cx-btn-primary"><Mail size={15} /> support@walras.net</a>
        </div>
      ) : openId ? (
        <TicketView key={openId} id={openId} onBack={() => { go({}); load(); }} notify={notify} />
      ) : composing ? (
        <NewTicket onCancel={() => go({})} onCreated={(id) => { go({ ticket: id }); load(); }} notify={notify} />
      ) : listError ? (
        <div className="cx-card cx-empty">
          <span className="cx-empty-icon"><LifeBuoy size={26} aria-hidden="true" /></span>
          <h4>Couldn't load your tickets</h4>
          <p>{listError}</p>
          <button type="button" className="cx-btn cx-btn-ghost" onClick={load}><RefreshCw size={15} /> Try again</button>
        </div>
      ) : !loading && tickets.length === 0 ? (
        <div className="cx-card cx-empty">
          <span className="cx-empty-icon"><LifeBuoy size={26} aria-hidden="true" /></span>
          <h4>No tickets yet</h4>
          <p>Something not working, or a question about billing? Open a ticket and we'll help.</p>
          <button type="button" className="cx-btn cx-btn-primary" onClick={() => go({ new: "1" })}><Plus size={16} /> New ticket</button>
        </div>
      ) : (
        <div className="cx-card cx-table-wrap">
          <table className="cx-table cx-table-select">
            <thead><tr><th>Subject</th><th>Ticket</th><th>Status</th><th>Last update</th></tr></thead>
            <tbody>
              {tickets.map((t) => (
                <tr key={t.id} tabIndex={0} onClick={() => go({ ticket: t.id })}
                  onKeyDown={(e) => { if (e.key === "Enter") go({ ticket: t.id }); }}>
                  <td data-label="Subject"><strong>{t.subject}</strong></td>
                  <td data-label="Ticket"><code>#{t.id}</code></td>
                  <td data-label="Status"><span className={`cx-status is-ticket-${t.status}`}>{STATUS_LABEL[t.status]}</span></td>
                  <td data-label="Last update">{formatDate(t.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Support;
