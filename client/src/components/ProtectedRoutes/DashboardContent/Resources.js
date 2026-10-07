import React, { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Server, Layers, Globe, ExternalLink, KeyRound, Copy, Check, Play, Square, RotateCcw, Trash2, RefreshCw, Plus, X } from "lucide-react";
import { api } from "../consoleApi";
import { useConsole } from "../ConsoleContext";
import { WEB_HOSTING_ENABLED } from "../../../data/plans";
import EditNSModal from "./EditNSModal";
import TransferDomainModal from "./TransferDomainModal";

const TABS = [
  { id: "hosting", label: "Web Hosting", Icon: Server },
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

// ── Credentials modal ─────────────────────────────────────────────────────
const CopyField = ({ label, value, mono }) => {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="cx-copy">
      <span className="cx-copy-label">{label}</span>
      <span className="cx-copy-row">
        {mono ? <code>{value}</code> : <span>{value}</span>}
        <button type="button" onClick={copy} aria-label={`Copy ${label}`}>{copied ? <Check size={15} /> : <Copy size={15} />}</button>
      </span>
    </div>
  );
};

const CredentialsModal = ({ data, onClose }) => (
  <div className="cx-modal-scrim" onClick={onClose}>
    <div className="cx-modal" role="dialog" aria-modal="true" aria-label="Hosting details" onClick={(e) => e.stopPropagation()}>
      <div className="cx-modal-head">
        <h3>{data.domain}</h3>
        <button type="button" className="cx-icon-btn" onClick={onClose} aria-label="Close"><X size={18} /></button>
      </div>
      <CopyField label="cPanel username" value={data.username} mono />
      <CopyField label="cPanel password" value={data.password} mono />
      <div className="cx-copy">
        <span className="cx-copy-label">cPanel URL</span>
        <a href={data.cpanel_url} target="_blank" rel="noreferrer" className="cx-link">{data.cpanel_url}</a>
      </div>
      <div className="cx-copy">
        <span className="cx-copy-label">Point your domain to these nameservers</span>
        {(data.nameservers || []).map((ns) => <CopyField key={ns} label="" value={ns} mono />)}
      </div>
    </div>
  </div>
);

// ── Tabs ──────────────────────────────────────────────────────────────────
const HostingTab = ({ accounts, notify }) => {
  const [creds, setCreds] = useState(null);

  const login = async (id) => {
    try {
      const d = await api(`/api/hosting/${id}/login`);
      if (d.url) window.open(d.url, "_blank", "noopener");
    } catch (e) { notify(e.message, "error"); }
  };
  const details = async (id) => {
    try { setCreds(await api(`/api/hosting/${id}/credentials`)); } catch (e) { notify(e.message, "error"); }
  };

  if (accounts.length === 0) {
    return <Empty Icon={Server} title="No web hosting yet" text="Get cPanel hosting with free SSL and email, ready in minutes."
      cta={<Link to="/dashboard/create?type=hosting" className="cx-btn cx-btn-primary"><Plus size={16} /> Buy web hosting</Link>} />;
  }

  return (
    <>
      <div className="cx-card cx-table-wrap">
        <table className="cx-table">
          <thead><tr><th>Domain</th><th>Plan</th><th>cPanel user</th><th>Status</th><th>Expires</th><th /></tr></thead>
          <tbody>
            {accounts.map((a) => {
              const suspended = a.status === "suspended";
              return (
                <tr key={a.id}>
                  <td data-label="Domain"><strong>{a.domain}</strong><small>{a.billing_cycle}</small></td>
                  <td data-label="Plan">{a.plan_name}</td>
                  <td data-label="cPanel user"><code>{a.cpanel_username}</code></td>
                  <td data-label="Status">
                    <span className={`cx-status is-${a.status}`}>{a.status}</span>
                    {a.suspension_reason && <small>{a.suspension_reason}</small>}
                  </td>
                  <td data-label="Expires">{formatDate(a.expires_at)}</td>
                  <td className="cx-actions">
                    <button type="button" className="cx-btn cx-btn-primary cx-btn-sm" onClick={() => login(a.id)} disabled={suspended}
                      title={suspended ? "Suspended accounts can't sign in to cPanel" : "Open cPanel"}>
                      <ExternalLink size={14} /> cPanel
                    </button>
                    <button type="button" className="cx-btn cx-btn-ghost cx-btn-sm" onClick={() => details(a.id)}>
                      <KeyRound size={14} /> Details
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {creds && <CredentialsModal data={creds} onClose={() => setCreds(null)} />}
    </>
  );
};

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
  const remove = async (id, name) => {
    if (!window.confirm(`Delete ${name}? This permanently destroys the server and its data.`)) return;
    try {
      await api(`/api/servers/${id}`, { method: "DELETE" });
      notify("Server deleted", "success");
      reload();
    } catch (e) { notify(e.message, "error"); }
  };

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
              <td data-label="Status"><span className={`cx-status is-${s.status}`}>{s.status}</span></td>
              <td data-label="Cost">₹{Number(s.monthly_cost || 0).toLocaleString("en-IN")}/mo</td>
              <td className="cx-actions">
                {s.status === "active" && (<>
                  <button type="button" className="cx-icon-btn" onClick={() => manage(s.id, "stop")} title="Stop"><Square size={15} /></button>
                  <button type="button" className="cx-icon-btn" onClick={() => manage(s.id, "restart")} title="Restart"><RotateCcw size={15} /></button>
                </>)}
                {s.status === "stopped" && (
                  <button type="button" className="cx-icon-btn" onClick={() => manage(s.id, "start")} title="Start"><Play size={15} /></button>
                )}
                {canDelete && <button type="button" className="cx-icon-btn is-danger" onClick={() => remove(s.id, s.name)} title="Delete"><Trash2 size={15} /></button>}
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
  const [hosting, setHosting] = useState([]);
  // Web Hosting's tab only shows while it's sold, or for customers who have it.
  const tabs = TABS.filter((t) => t.id !== "hosting" || WEB_HOSTING_ENABLED || hosting.length > 0);
  const tab = tabs.some((t) => t.id === params.get("tab")) ? params.get("tab") : tabs[0].id;
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
      api("/api/hosting").then((d) => setHosting(d.hostingAccounts || [])),
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

  const counts = { hosting: hosting.length, servers: servers.length, domains: domains.length };

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
        {tabs.map(({ id, label, Icon }) => (
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
          {tab === "hosting" && <HostingTab accounts={hosting} notify={notify} />}
          {tab === "servers" && <ServersTab servers={servers} reload={load} notify={notify} />}
          {tab === "domains" && <DomainsTab domains={domains} reload={load} notify={notify} />}
        </>
      )}
    </div>
  );
};

export default Resources;
