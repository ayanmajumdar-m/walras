import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Layers, Globe, Cpu, ArrowRight, Wallet, Plus, Boxes } from "lucide-react";
import { api } from "../consoleApi";
import { useConsole } from "../ConsoleContext";
import { PRODUCTS, productStatus } from "./products";

const formatDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const Overview = () => {
  const { profile, balance, platform, account, can } = useConsole();
  const hasServers = can("servers");
  const [servers, setServers] = useState([]);
  const [domains, setDomains] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!hasServers) { setLoading(false); return; }
    Promise.allSettled([
      api("/api/servers").then((d) => setServers(d.servers || [])),
      api("/api/users/domains/purchased").then((d) => setDomains(d.domains || [])),
    ]).finally(() => setLoading(false));
  }, [hasServers]);

  const firstName = (profile?.name || "").split(" ")[0];
  const activeServers = servers.filter((s) => s.status === "active").length;

  const STATS = [
    ...(hasServers ? [
    { label: "Virtual Machines", value: servers.length, note: `${activeServers} running`, Icon: Layers, to: "/dashboard/resources?tab=servers" },
    { label: "Domains", value: domains.length, note: "registered", Icon: Globe, to: "/dashboard/resources?tab=domains" },
    ] : []),
    ...(can("billing") ? [{ label: "Account balance", value: `₹${balance.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`, note: platform?.topUpsPaused ? "View billing" : "Add funds", Icon: Wallet, to: "/dashboard/billing" }] : []),
  ];

  // Newest first, across every kind of resource.
  const recent = [
    ...servers.map((s) => ({ key: `s${s.id}`, Icon: Cpu, name: s.name, kind: `Virtual Machine · ${s.plan_name}`, status: s.status, date: s.created_at, tab: "servers" })),
    ...domains.map((d) => ({ key: `d${d.id}`, Icon: Globe, name: d.full_domain || d.domain_name, kind: "Domain", status: d.status, date: d.created_at || d.registration_date, tab: "domains" })),
  ]
    .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
    .slice(0, 6);

  return (
    <div className="cx-page">
      <section className="cx-welcome">
        <div>
          <span className="cx-eyebrow cx-eyebrow-light">Welcome back</span>
          <h2>{firstName ? `Hi ${firstName}, what are we building today?` : "What are we building today?"}</h2>
          <p>{account ? `You're working in ${account.ownerName || account.ownerEmail}'s account.` : "Create cloud resources and manage everything from one place."}</p>
        </div>
        <div className="cx-welcome-actions">
          {hasServers && <Link to="/dashboard/create" className="cx-btn cx-btn-primary cx-btn-lg"><Plus size={18} /> Create resource</Link>}
          {!platform?.topUpsPaused && can("billing") && (
            <Link to="/dashboard/billing" className="cx-btn cx-btn-ghost-light cx-btn-lg"><Wallet size={18} /> Add funds</Link>
          )}
        </div>
      </section>

      {STATS.length > 0 && <section className="cx-stats" style={{ "--cx-stat-cols": STATS.length }}>
        {STATS.map(({ label, value, note, Icon, to }) => (
          <Link to={to} className="cx-stat" key={label}>
            <span className="cx-stat-icon"><Icon size={20} aria-hidden="true" /></span>
            <span className="cx-stat-value">{loading && typeof value === "number" ? "—" : value}</span>
            <span className="cx-stat-label">{label}</span>
            <span className="cx-stat-note">{note}</span>
          </Link>
        ))}
      </section>}

      {hasServers && (<>
      <section className="cx-section">
        <div className="cx-section-head">
          <h3>Create a new resource</h3>
        </div>
        <div className="cx-product-grid">
          {PRODUCTS.map((product) => {
            const { id, Icon, title, desc, to } = product;
            const { label, available } = productStatus(product, platform);
            return (
            <Link to={to} className={`cx-product${available ? "" : " is-muted"}`} key={id}>
              <span className="cx-product-icon"><Icon size={22} aria-hidden="true" /></span>
              <span className="cx-product-body">
                <span className="cx-product-title">{title} <ArrowRight size={15} aria-hidden="true" /></span>
                <span className="cx-product-desc">{desc}</span>
              </span>
              <span className={`cx-pill${available ? " is-brand" : ""}`}>{label}</span>
            </Link>
            );
          })}
        </div>
      </section>

      <section className="cx-section">
        <div className="cx-section-head">
          <h3>Recent resources</h3>
          {recent.length > 0 && <Link to="/dashboard/resources" className="cx-link">View all <ArrowRight size={14} /></Link>}
        </div>

        {loading ? (
          <div className="cx-card cx-empty"><p>Loading your resources…</p></div>
        ) : recent.length === 0 ? (
          <div className="cx-card cx-empty">
            <span className="cx-empty-icon"><Boxes size={26} aria-hidden="true" /></span>
            <h4>Nothing here yet</h4>
            <p>Your servers and domains will show up here once you create them.</p>
            <Link to="/dashboard/create" className="cx-btn cx-btn-primary"><Plus size={16} /> Create your first resource</Link>
          </div>
        ) : (
          <div className="cx-card cx-list">
            {recent.map(({ key, Icon, name, kind, status, date, tab }) => (
              <Link to={`/dashboard/resources?tab=${tab}`} className="cx-list-row" key={key}>
                <span className="cx-list-icon"><Icon size={18} aria-hidden="true" /></span>
                <span className="cx-list-main">
                  <strong>{name}</strong>
                  <small>{kind}</small>
                </span>
                <span className={`cx-status is-${status}`}>{status}</span>
                <span className="cx-list-date">{formatDate(date)}</span>
              </Link>
            ))}
          </div>
        )}
      </section>
      </>)}
    </div>
  );
};

export default Overview;
