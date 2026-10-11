import React, { useCallback, useEffect, useState } from "react";
import { RefreshCw, Search, ArrowLeft, ExternalLink, Paperclip, Lock } from "lucide-react";
import { adminApi } from "../adminApi";

/*
  Support → Tickets: customers' support tickets from Zendesk (Walras brand),
  read-only. The conversation shows internal notes too; agents reply in
  Zendesk, which each ticket links to.
*/

const TABS = [
  { id: "open", label: "Unsolved" },
  { id: "new", label: "New" },
  { id: "pending", label: "Awaiting customer" },
  { id: "hold", label: "On hold" },
  { id: "solved", label: "Solved" },
  { id: "closed", label: "Closed" },
  { id: "all", label: "All" },
];

const STATUS = {
  new: { label: "New", cls: "is-pending" },
  open: { label: "Open", cls: "is-ticket-open" },
  pending: { label: "Awaiting customer", cls: "is-ticket-waiting" },
  hold: { label: "On hold", cls: "is-ticket-waiting" },
  solved: { label: "Solved", cls: "is-ticket-resolved" },
  closed: { label: "Closed", cls: "is-ticket-closed" },
};
const statusOf = (s) => STATUS[s] || { label: s, cls: "" };

const when = (d) => (d ? new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }) : "—");
const size = (n) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

const Customer = ({ t, openCustomer }) => (t.customer ? (
  <>
    <button type="button" className="cx-link ap-link-btn" onClick={(e) => { e.stopPropagation(); openCustomer(t.customer.userId); }}>{t.customer.name}</button>
    <small>{t.customer.waladminId} · {t.customer.email}</small>
  </>
) : (
  <>
    <strong>{t.requester.name}</strong>
    <small>{t.requester.email || "no email"} · not a Walras account</small>
  </>
));

// ── One ticket ────────────────────────────────────────────────────────────
const TicketView = ({ id, onBack, openCustomer }) => {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    adminApi(`/support/tickets/${id}`).then(setData).catch((e) => setError(e.message));
  }, [id]);

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
  const st = statusOf(ticket.status);
  return (
    <div className="cx-ticket">
      <div className="cx-ticket-head">
        <button type="button" className="cx-btn cx-btn-ghost cx-btn-sm" onClick={onBack}><ArrowLeft size={15} /> All tickets</button>
        <div className="cx-ticket-title">
          <h3>{ticket.subject}</h3>
          <span className="cx-ticket-meta">
            #{ticket.id}{ticket.department ? ` · ${ticket.department}` : ""} · opened {when(ticket.createdAt)}
            {ticket.assignee ? ` · assigned to ${ticket.assignee}` : " · unassigned"}
          </span>
        </div>
        <span className={`cx-status ${st.cls}`}>{st.label}</span>
        {ticket.link && (
          <a href={ticket.link} target="_blank" rel="noreferrer" className="cx-btn cx-btn-primary cx-btn-sm"><ExternalLink size={14} /> Reply in Zendesk</a>
        )}
      </div>

      <div className="cx-card ap-tk-customer">
        <span className="ap-muted">Customer</span>
        <div><Customer t={ticket} openCustomer={openCustomer} /></div>
      </div>

      <ol className="cx-thread">
        {messages.map((m) => (
          <li key={m.id} className={`cx-msg${m.fromCustomer ? "" : " is-me"}${m.internal ? " ap-tk-internal" : ""}`}>
            <div className="cx-msg-meta">
              <strong>{m.author}{m.fromCustomer ? " (customer)" : ""}</strong>
              {m.internal && <span className="ap-tk-note-pill"><Lock size={11} aria-hidden="true" /> Internal note</span>}
              <span>{when(m.createdAt)}</span>
            </div>
            <div className="cx-msg-body">{m.body}</div>
            {m.attachments.length > 0 && (
              <div className="cx-msg-files">
                {m.attachments.map((a) => (
                  <span key={a.id} className="ap-tk-file"><Paperclip size={13} aria-hidden="true" /> {a.fileName} <small>{size(a.size)}</small></span>
                ))}
              </div>
            )}
          </li>
        ))}
      </ol>
      {ticket.link && <p className="ap-muted">Replies, status changes and attachments are handled in Zendesk.</p>}
    </div>
  );
};

// ── List ──────────────────────────────────────────────────────────────────
const Tickets = ({ openCustomer }) => {
  const [tab, setTab] = useState("open");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [openId, setOpenId] = useState(null);

  const load = useCallback(() => {
    setError(null);
    adminApi(`/support/tickets?status=${tab}&search=${encodeURIComponent(query)}`)
      .then(setData).catch((e) => setError(e.message));
  }, [tab, query]);

  useEffect(() => { setData(null); load(); }, [load]);
  useEffect(() => { const t = setTimeout(() => setQuery(search.trim()), 400); return () => clearTimeout(t); }, [search]);

  const more = async () => {
    setLoadingMore(true);
    try {
      const d = await adminApi(`/support/tickets?status=${tab}&search=${encodeURIComponent(query)}&page=${data.page + 1}`);
      setData({ ...d, tickets: [...data.tickets, ...d.tickets] });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoadingMore(false);
    }
  };

  if (openId) return <TicketView id={openId} onBack={() => { setOpenId(null); load(); }} openCustomer={openCustomer} />;

  return (
    <div className="cx-page">
      <div className="cx-page-head cx-page-head-row">
        <div>
          <h2>Support tickets</h2>
          <p>Tickets customers open from the console (and by email), from Zendesk. Open one to read the conversation; reply in Zendesk.</p>
        </div>
        <div className="cx-welcome-actions">
          <button type="button" className="cx-btn cx-btn-ghost" onClick={load}><RefreshCw size={15} /> Refresh</button>
          {data?.agentUrl && <a href={data.agentUrl} target="_blank" rel="noreferrer" className="cx-btn cx-btn-ghost"><ExternalLink size={15} /> Open Zendesk</a>}
        </div>
      </div>

      {data && data.configured === false ? (
        <div className="cx-card cx-empty">
          <h4>Zendesk isn't connected</h4>
          <p>Add the Zendesk subdomain and OAuth client in Settings → Integrations to see tickets here.</p>
        </div>
      ) : (
        <>
          <div className="ap-toolbar">
            <div className="ap-subtabs" role="tablist">
              {TABS.map((t) => (
                <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={`ap-subtab${tab === t.id ? " is-active" : ""}`}
                  onClick={() => setTab(t.id)}>{t.label}</button>
              ))}
            </div>
            <label className="ap-search">
              <Search size={16} aria-hidden="true" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search subject, message or customer email" />
            </label>
          </div>

          {error && <div className="cx-alert is-error" role="alert">{error}</div>}

          {!data ? (!error && <div className="cx-card cx-empty"><p>Loading tickets…</p></div>)
            : data.tickets.length === 0 ? <div className="cx-card cx-empty"><p>No tickets here.</p></div> : (
              <>
                <p className="ap-muted">{data.count} ticket{data.count === 1 ? "" : "s"}</p>
                <div className="cx-card cx-table-wrap">
                  <table className="cx-table cx-table-select ap-tk-table">
                    <thead><tr><th>Ticket</th><th>Customer</th><th>Status</th><th>Updated</th></tr></thead>
                    <tbody>
                      {data.tickets.map((t) => {
                        const st = statusOf(t.status);
                        return (
                          <tr key={t.id} tabIndex={0} onClick={() => setOpenId(t.id)} onKeyDown={(e) => { if (e.key === "Enter") setOpenId(t.id); }}>
                            <td data-label="Ticket">
                              <strong>{t.subject}</strong>
                              <small>#{t.id}{t.department ? ` · ${t.department}` : ""}{t.fromConsole ? " · from console" : ""}{t.priority ? ` · ${t.priority} priority` : ""}</small>
                            </td>
                            <td data-label="Customer"><Customer t={t} openCustomer={openCustomer} /></td>
                            <td data-label="Status"><span className={`cx-status ${st.cls}`}>{st.label}</span></td>
                            <td data-label="Updated">{when(t.updatedAt)}<small>opened {when(t.createdAt)}</small></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {data.hasMore && (
                  <button type="button" className="cx-btn cx-btn-ghost ap-tk-more" onClick={more} disabled={loadingMore}>
                    {loadingMore ? <RefreshCw size={15} className="cx-spin" /> : null} Load more
                  </button>
                )}
              </>
            )}
        </>
      )}
    </div>
  );
};

export default Tickets;
