import React, { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Layers, Globe, Play, Square, RotateCcw, Trash2, RefreshCw, X, Undo2 } from "lucide-react";
import { api } from "../consoleApi";
import { useConsole } from "../ConsoleContext";
import EditNSModal from "./EditNSModal";
import TransferDomainModal from "./TransferDomainModal";

const TABS = [
  { id: "servers", label: "Virtual Machines", Icon: Layers },
  { id: "domains", label: "Domains", Icon: Globe },
];

const formatDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const daysUntil = (d) => Math.ceil((new Date(d) - new Date()) / 86400000);

const Empty = ({ Icon, title, text, cta }) => (
  <div className="cx-card cx-empty">
    <span className="cx-empty-icon"><Icon size={26} aria-hidden="true" /></span>
    <h4>{title}</h4>
    <p>{text}</p>
    {cta}
  </div>
);

// ── Tabs ──────────────────────────────────────────────────────────────────
const ServersTab = ({ servers, reload, notify }) => {
  // Team members with Write access can't delete.
  const canDelete = useConsole().can("delete");
  const manage = async (serverId, action) => {
    try {
      await api("/api/servers/manage", { method: "POST", body: { serverId, action } });
      notify(`Server ${action} requested`, "success");
      reload();
    } catch (e) { notify(e.message, "error"); }
  };
  // Cancelling takes effect at the end of the paid month (prepaid billing):
  // the server keeps running until then and isn't renewed.
  const cancel = async (s) => {
    const failed = s.status === "failed" || s.status === "deploying";
    // Paid until: the end of the month, or of the reservation.
    const paidThrough = s.paid_until
      ? new Date(new Date(s.paid_until).getTime() - 1).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })
      : new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toLocaleDateString("en-IN", { day: "numeric", month: "long" });
    if (!window.confirm(failed
      ? `Remove ${s.name}?`
      : `Cancel ${s.name}? It's paid until ${paidThrough} and keeps running until then; it won't be renewed, and is then deleted with all its data.${Number(s.term_months) > 1 ? " The rest of the reservation isn't refunded." : ""} You can undo this until then.`)) return;
    try {
      const d = await api(`/api/servers/${s.id}`, { method: "DELETE" });
      notify(d.message, "success");
      reload();
    } catch (e) { notify(e.message, "error"); }
  };
  const keep = async (s) => {
    try {
      const d = await api(`/api/servers/${s.id}/keep`, { method: "POST" });
      notify(d.message, "success");
      reload();
    } catch (e) { notify(e.message, "error"); }
  };
  const until = (d) => new Date(new Date(d).getTime() - 1).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

  if (servers.length === 0) {
    return <Empty Icon={Layers} title="No virtual machines yet" text="General purpose VMs for apps and workloads, on Intel or AMD."
      cta={<Link to="/dashboard/create?type=compute" className="cx-btn cx-btn-ghost">See Virtual Machine plans</Link>} />;
  }

  return (
    <div className="cx-card cx-table-wrap">
      <table className="cx-table">
        <thead><tr><th>Name</th><th>IP address</th><th>Plan</th><th>Location</th><th>Status</th><th>Cost</th><th /></tr></thead>
        <tbody>
          {servers.map((s) => (
            <tr key={s.id}>
              <td data-label="Name"><strong>{s.name}</strong></td>
              <td data-label="IP address"><code>{s.ip_address || "—"}</code></td>
              <td data-label="Plan">{s.plan_name}</td>
              <td data-label="Location">{s.location}</td>
              <td data-label="Status">
                {s.suspended_at ? <span className="cx-status is-suspended">suspended</span> : <span className={`cx-status is-${s.status}`}>{s.status}</span>}
                {s.cancel_at && <small className="is-warn">Cancelled: runs until {until(s.cancel_at)}</small>}
                {!s.cancel_at && Number(s.term_months) > 1 && s.paid_until && <small>Reserved {s.term_months} months · until {new Date(new Date(s.paid_until).getTime() - 1).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}, renews</small>}
                {s.suspended_at && <small className="is-danger"><Link to="/dashboard/billing?tab=invoices">Unpaid invoice</Link></small>}
              </td>
              <td data-label="Cost">₹{Number(s.monthly_cost || 0).toLocaleString("en-IN")}/mo</td>
              <td className="cx-actions">
                {s.status === "active" && (<>
                  <button type="button" className="cx-icon-btn" onClick={() => manage(s.id, "stop")} title="Stop"><Square size={15} /></button>
                  <button type="button" className="cx-icon-btn" onClick={() => manage(s.id, "restart")} title="Restart"><RotateCcw size={15} /></button>
                </>)}
                {s.status === "stopped" && !s.suspended_at && (
                  <button type="button" className="cx-icon-btn" onClick={() => manage(s.id, "start")} title="Start"><Play size={15} /></button>
                )}
                {canDelete && (s.cancel_at
                  ? <button type="button" className="cx-icon-btn" onClick={() => keep(s)} title="Undo cancellation"><Undo2 size={15} /></button>
                  : <button type="button" className="cx-icon-btn is-danger" onClick={() => cancel(s)} title="Cancel plan"><Trash2 size={15} /></button>)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const DomainsTab = ({ domains, reload, notify }) => {
  const [nsDomain, setNsDomain] = useState(null);
  const [transferDomain, setTransferDomain] = useState(null);
  const fullName = (d) => d.full_domain || `${d.domain_name || ""}${d.domain_extension ? "." + d.domain_extension : ""}`;

  const saveNs = async (nameservers) => {
    const d = await api("/api/users/openprovider/update-nameservers", {
      method: "POST",
      body: {
        openprovider_domain_id: nsDomain.openprovider_domain_id || nsDomain.openprovider_id || null,
        full_domain: fullName(nsDomain),
        nameservers,
      },
    });
    notify(d.message || "Nameservers updated", "success");
    setNsDomain(null);
    reload();
  };

  const transfer = async ({ auth_code, nameservers, handles }) => {
    const d = await api("/api/users/openprovider/transfer-domain", {
      method: "POST",
      body: { domainName: fullName(transferDomain), auth_code, nameservers, handles },
    });
    notify(d.message || "Transfer started", "success");
    setTransferDomain(null);
    reload();
  };

  if (domains.length === 0) {
    return <Empty Icon={Globe} title="No domains yet" text="Domain registration is coming soon to Walras Cloud."
      cta={<Link to="/dashboard/create?type=domains" className="cx-btn cx-btn-ghost">Learn more</Link>} />;
  }

  return (
    <>
      <div className="cx-card cx-table-wrap">
        <table className="cx-table">
          <thead><tr><th>Domain</th><th>Status</th><th>Registered</th><th>Expires</th><th /></tr></thead>
          <tbody>
            {domains.map((d) => {
              const left = daysUntil(d.expiration_date);
              return (
                <tr key={d.id}>
                  <td data-label="Domain"><strong>{fullName(d) || d.domain_name}</strong></td>
                  <td data-label="Status"><span className={`cx-status is-${d.status}`}>{d.status}</span></td>
                  <td data-label="Registered">{formatDate(d.registration_date)}</td>
                  <td data-label="Expires">
                    {formatDate(d.expiration_date)}
                    {left <= 0 ? <small className="is-danger">Expired</small> : left <= 30 ? <small className="is-warn">{left} days left</small> : null}
                  </td>
                  <td className="cx-actions">
                    <button type="button" className="cx-btn cx-btn-ghost cx-btn-sm" onClick={() => setNsDomain(d)}>Nameservers</button>
                    <button type="button" className="cx-btn cx-btn-ghost cx-btn-sm" onClick={() => setTransferDomain(d)}>Transfer</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <EditNSModal
        open={Boolean(nsDomain)}
        onClose={() => setNsDomain(null)}
        onSave={saveNs}
        initialNs={nsDomain ? (nsDomain.name_servers?.map((n) => n.name) || nsDomain.nameservers || nsDomain.ns || []) : []}
      />
      <TransferDomainModal
        open={Boolean(transferDomain)}
        onClose={() => setTransferDomain(null)}
        onTransfer={transfer}
        domainName={transferDomain ? fullName(transferDomain) : ""}
      />
    </>
  );
};

// ── Page ──────────────────────────────────────────────────────────────────
const Resources = () => {
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((t) => t.id === params.get("tab")) ? params.get("tab") : TABS[0].id;
  const [servers, setServers] = useState([]);
  const [domains, setDomains] = useState([]);
  const [loading, setLoading] = useState(true);
  // Arriving from Create after ordering a server.
  const [message, setMessage] = useState(() => params.get("created")
    ? { text: "Your server is being created. It shows as Deploying here and is usually ready in a few minutes.", type: "success" }
    : null);

  const notify = (text, type) => setMessage({ text, type });

  const load = useCallback(() => {
    setLoading(true);
    Promise.allSettled([
      api("/api/servers").then((d) => setServers(d.servers || [])),
      api("/api/users/domains/purchased").then((d) => setDomains(d.domains || [])),
    ]).finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  // While a server is being built, check its status every 10 seconds.
  const building = servers.some((s) => s.status === "deploying");
  useEffect(() => {
    if (!building) return undefined;
    const timer = setInterval(() => {
      api("/api/servers").then((d) => setServers(d.servers || [])).catch(() => {});
    }, 10000);
    return () => clearInterval(timer);
  }, [building]);

  const counts = { servers: servers.length, domains: domains.length };

  return (
    <div className="cx-page">
      <div className="cx-page-head cx-page-head-row">
        <div>
          <h2>Resources</h2>
          <p>Everything running on your account.</p>
        </div>
        <button type="button" className="cx-btn cx-btn-ghost" onClick={load} disabled={loading}>
          <RefreshCw size={15} className={loading ? "cx-spin" : ""} /> Refresh
        </button>
      </div>

      <div className="cx-tabs" role="tablist">
        {TABS.map(({ id, label, Icon }) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id}
            className={`cx-tab${tab === id ? " is-active" : ""}`} onClick={() => setParams({ tab: id }, { replace: true })}>
            <Icon size={16} aria-hidden="true" /> {label} <span className="cx-count">{counts[id]}</span>
          </button>
        ))}
      </div>

      {message && (
        <div className={`cx-alert is-${message.type}`} role="status">
          {message.text}
          <button type="button" className="cx-icon-btn" onClick={() => setMessage(null)} aria-label="Dismiss"><X size={15} /></button>
        </div>
      )}

      {loading && counts[tab] === 0 ? (
        <div className="cx-card cx-empty"><p>Loading…</p></div>
      ) : (
        <>
          {tab === "servers" && <ServersTab servers={servers} reload={load} notify={notify} />}
          {tab === "domains" && <DomainsTab domains={domains} reload={load} notify={notify} />}
        </>
      )}
    </div>
  );
};

export default Resources;
