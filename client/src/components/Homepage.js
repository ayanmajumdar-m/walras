import React, { useEffect, useState } from "react";
import {
  ArrowRight, ArrowUpRight, Check, Database, DatabaseBackup, ShieldCheck, Zap, MapPin, Wallet, Headphones,
  ChevronDown, LayoutGrid, SquarePlus, BadgePercent, Boxes, Server, CreditCard, LifeBuoy, CircleUser, LogOut,
  Plus, RefreshCw, Layers, Globe, Copy, Eye, Trash2,
} from "lucide-react";
import WalrasScene from "./Landing/WalrasScene";
import { DEDICATED_URL } from "../data/site";
import { formatRam, formatStorage } from "../data/plans";
// The previous homepage's stylesheet still styles shared classes other public
// pages use (.cta, .cta-inner, .hero-title, .support-grid…), so it stays loaded.
import "./Homepage.css";
import "./Landing/Landing.css";

/*
  The homepage: Managed Database first, with the rest of the line-up beside it.
  Plans, prices, stock, backup retention and locations come from the same
  public endpoints as the Pricing page (/api/plans/database, /api/settings/public),
  so it never shows a plan or price that isn't real. The 3D illustrations are
  Landing/WalrasScene.js.
*/

const LOGO = "https://pub-21f943ee53a546c68c971a0df44cd3e0.r2.dev/logo/logo.png";
const CREATE_DB = "/dashboard/create?type=database";

const money = (n) => `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const unitSplit = (s) => { const m = String(s).match(/^([\d.,]+)\s*(.*)$/); return m ? [m[1], m[2]] : [s, ""]; };

const FEATURES = [
  { Icon: DatabaseBackup, title: "Daily backups", text: "Taken every day and kept for the retention shown on your plan." },
  { Icon: ShieldCheck, title: "Set up and looked after for you", text: "We set your database up and keep it running. You get the connection details." },
  { Icon: Zap, title: "99.9% uptime", text: "We back our network and hardware with a 99.9% uptime SLA, so your apps stay live." },
  { Icon: MapPin, title: "Hosted in India", text: "Our home region, close to customers across India." },
  { Icon: Wallet, title: "Paid from your account balance", text: "Top up with UPI, cards or net banking. Monthly invoices with GST, as PDF." },
  { Icon: Headphones, title: "24/7 support", text: "Email and ticket support around the clock, with a 60-minute response time." },
];

const CONSOLE_POINTS = [
  { title: "Connection details, one click to copy", text: "Host, port, database and user, with the password on request." },
  { title: "Know when it's ready", text: "A new database shows as provisioning until we've set it up, and we email you when it's ready." },
  { title: "Cancel or undo", text: "Cancelling ends it at the end of the paid month, and you can undo until then." },
  { title: "Work as a team", text: "Give teammates access to servers, billing or support." },
];

const ENGINES = {
  mysql: {
    label: "MySQL", port: 3306, uri: "mysql://app_user:••••••@<host>:3306/app",
    text: "The widely used open-source relational database behind many websites, online stores and content management systems.",
  },
  postgresql: {
    label: "PostgreSQL", port: 5432, uri: "postgresql://app_user:••••••@<host>:5432/app",
    text: "The open-source relational database known for standards compliance, rich data types and extensions.",
  },
};

const Check20 = () => <span className="lp-tick"><Check size={13} strokeWidth={2.5} aria-hidden="true" /></span>;

// A still picture of the console's Resources → Databases tab.
const ConsolePreview = () => (
  <div className="lp-console-frame" aria-hidden="true">
    <div className="lp-console">
      <aside className="lp-console-side">
        <span className="lp-console-brand"><img src={LOGO} alt="" />Walras Cloud</span>
        <span className="lp-console-kicker">Console</span>
        <nav>
          {[[LayoutGrid, "Overview"], [SquarePlus, "Create"], [BadgePercent, "Reserve & Save"], [Boxes, "Resources", true], [Server, "Dedicated"], [CreditCard, "Billing"]].map(([I, t, on]) => (
            <span key={t} className={on ? "is-on" : ""}><I size={18} />{t}</span>
          ))}
          <i />
          {[[LifeBuoy, "Support"], [CircleUser, "Account"]].map(([I, t]) => <span key={t}><I size={18} />{t}</span>)}
        </nav>
        <div className="lp-console-user"><b>AS</b><span><strong>Aarav Shah</strong><small>aarav@example.in</small></span><LogOut size={17} /></div>
      </aside>
      <div className="lp-console-main">
        <div className="lp-console-top">
          <span>Resources</span>
          <span className="lp-console-bal"><Wallet size={16} />₹2,450.00</span>
          <span className="lp-console-create"><Plus size={16} />Create</span>
        </div>
        <div className="lp-console-body">
          <div className="lp-console-head">
            <div><div className="lp-console-h">Resources</div><div className="lp-muted">Everything running on your account.</div></div>
            <span className="lp-console-btn"><RefreshCw size={15} />Refresh</span>
          </div>
          <div className="lp-console-tabs">
            <span><Layers size={16} />Virtual Machines<em>0</em></span>
            <span className="is-on"><Database size={16} />Databases<em>2</em></span>
            <span><Globe size={16} />Domains<em>0</em></span>
          </div>
          <div className="lp-console-db">
            <div className="lp-console-row">
              <span className="lp-console-ico"><Database size={18} /></span>
              <div><strong>orders-db</strong><small>PostgreSQL · General Purpose · Mumbai</small></div>
              <span className="lp-pill is-active"><i />Active</span>
              <span className="lp-console-icon"><Trash2 size={15} /></span>
            </div>
            <div className="lp-console-conn">
              {[["Host", "203.0.113.24", Copy], ["Port", "5432", Copy], ["Database", "orders", Copy], ["User", "orders_app", Copy], ["Password", "••••••••••", Eye]].map(([k, v, I]) => (
                <div key={k}><div className="lp-console-k">{k}</div><div className="lp-console-v"><code>{v}</code><span><I size={13} /></span></div></div>
              ))}
            </div>
          </div>
          <div className="lp-console-db">
            <div className="lp-console-row">
              <span className="lp-console-ico"><Database size={18} /></span>
              <div><strong>analytics-db</strong><small>MySQL · General Purpose · Mumbai</small></div>
              <span className="lp-pill is-pending"><i />Provisioning</span>
              <span className="lp-console-icon"><Trash2 size={15} /></span>
            </div>
            <p className="lp-muted">We're setting this database up. Its connection details will appear here, and we'll email you when it's ready.</p>
          </div>
        </div>
      </div>
    </div>
  </div>
);

const Homepage = () => {
  const [db, setDb] = useState(null); // { plans, locations, fromPrice }; false if it couldn't load
  const [stock, setStock] = useState({});
  const [engine, setEngine] = useState("mysql");
  const [faqOpen, setFaqOpen] = useState(0);

  useEffect(() => {
    fetch("/api/plans/database")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => setDb({ plans: d.plans || [], locations: d.locations || [], fromPrice: d.fromPrice }))
      .catch(() => setDb(false));
    fetch("/api/settings/public")
      .then((r) => r.json())
      .then((d) => setStock(d?.planAvailability?.database || {}))
      .catch(() => {});
  }, []);

  const plans = db ? db.plans : [];
  const offered = db ? db.locations.filter((l) => !l.comingSoon) : [];
  const soon = db ? db.locations.filter((l) => l.comingSoon) : [];
  const region = offered.length ? offered.map((l) => l.name).join(" · ") : "India";
  const backupDays = plans.map((p) => p.backupDays).filter((n) => n > 0);
  const backups = backupDays.length
    ? (Math.min(...backupDays) === Math.max(...backupDays) ? `Daily · ${backupDays[0]} days` : `Daily · ${Math.min(...backupDays)}–${Math.max(...backupDays)} days`)
    : "Daily";
  const from = db && db.fromPrice ? money(db.fromPrice) : null;

  const faqs = [
    ["Which engines can I choose?", "MySQL or PostgreSQL. You pick the engine for each database, and the price is the same for both."],
    ["How are backups handled?", "Every plan includes daily backups, kept for the number of days shown in the plan table."],
    ["Where is my database hosted?", offered.length ? `In ${offered.map((l) => l.name).join(" and ")}${offered.length === 1 ? " to start" : ""}: close to customers across India.` : "In India, close to customers across the country."],
    ["How does billing work?", "Databases are paid from your account balance. When you order, you pay for the rest of the month; after that, billing runs on the 1st. Prices exclude GST, and the final amount is shown at checkout."],
    ["Can I cancel?", "Yes. Your database keeps running until the end of the month you've paid for, then it's deleted with its data. You can undo the cancellation until then."],
    ["How fast is support?", "We're available 24/7 with a 60-minute response time, by email and ticket."],
  ];

  return (
    <div className="lp">
      {/* ── Hero ── */}
      <header className="lp-hero">
        <span className="lp-hero-grid" aria-hidden="true" />
        <div className="lp-wrap">
          <div className="lp-hero-row">
            <div className="lp-hero-copy">
              <span className="lp-kicker-dark">Managed Database</span>
              <h1>Your database, looked after.</h1>
              <p>MySQL or PostgreSQL, set up and looked after for you, with daily backups and monthly billing. Pick a location, an engine and a plan; the price is the same for both engines.</p>
              <div className="lp-hero-cta">
                <a href={CREATE_DB} className="lp-btn lp-btn-mint">Create a database<ArrowRight size={16} /></a>
                <a href="#plans" className="lp-btn lp-btn-outline-dark">View plans</a>
                {from && <span className="lp-hero-from">From<strong>{from}</strong>/mo, excl. GST</span>}
              </div>
            </div>
            <div className="lp-hero-art">
              <WalrasScene variant="hero" follow className="lp-hero-scene" />
            </div>
          </div>
          <figure className="lp-figures">
            <div className="lp-figures-grid">
              {[["Engines", "MySQL · PostgreSQL"], ["Backups", backups], ["Storage", "NVMe SSD"], ["Region", region], ["Support response", "60 min"], ["Entry plan", from ? `${from}/mo` : "—", true]].map(([k, v, accent]) => (
                <div key={k}><div className="lp-figures-k">{k}</div><div className={`lp-figures-v${accent ? " is-accent" : ""}`}>{v}</div></div>
              ))}
            </div>
            <figcaption>Figures guaranteed by Walras Cloud. Tax not included; final amount shown at checkout.</figcaption>
          </figure>
        </div>
      </header>

      {/* ── Product line-up ── */}
      <section className="lp-section lp-section-first">
        <div className="lp-wrap">
          <div className="lp-head">
            <span className="lp-kicker">Product line-up</span>
            <h2>Run it all from one console</h2>
            <p>Managed Database and Dedicated servers are available now. Domains and VPS Servers are on the way.</p>
          </div>
          <div className="lp-lineup">
            <article className="lp-card lp-card-feature">
              <div className="lp-card-art">
                <WalrasScene variant="database" className="lp-fill" />
                <span className="lp-badge">Available now</span>
              </div>
              <h3>Managed Database</h3>
              <p>MySQL or PostgreSQL, set up and looked after for you, with daily backups and monthly billing.</p>
              <ul className="lp-ticks">
                {["MySQL or PostgreSQL", "Daily backups", "Set up and looked after for you", "NVMe SSD storage"].map((t) => <li key={t}><Check20 />{t}</li>)}
              </ul>
              <div className="lp-card-foot">
                {from ? <span className="lp-from">From<strong>{from}</strong>/mo</span> : <span />}
                <a href="#plans" className="lp-btn lp-btn-mint lp-btn-sm">View plans<ArrowRight size={16} /></a>
              </div>
            </article>
            <article className="lp-card">
              <div className="lp-card-art">
                <WalrasScene variant="server" className="lp-fill" />
                <span className="lp-badge">Available now</span>
              </div>
              <h3>Dedicated Server</h3>
              <p>The whole machine. Yours. Single-tenant servers with dedicated cores, memory and storage, full root access and no neighbours. Priced monthly, in rupees.</p>
              <div className="lp-card-foot">
                <span className="lp-muted-sm">metal.walras.net</span>
                <a href={DEDICATED_URL} className="lp-btn lp-btn-ghost lp-btn-sm">Browse servers<ArrowUpRight size={16} /></a>
              </div>
            </article>
            <div className="lp-soon-col">
              <article className="lp-card lp-card-soon">
                <div className="lp-soon-top">
                  <WalrasScene variant="globe" tone="muted" className="lp-soon-scene" />
                  <span className="lp-badge-grey">Coming soon</span>
                </div>
                <h3>Domains</h3>
                <p>Register your name alongside your servers and manage it all from one dashboard.</p>
              </article>
              <article className="lp-card lp-card-soon">
                <div className="lp-soon-top">
                  <WalrasScene variant="layers" tone="muted" className="lp-soon-scene" />
                  <span className="lp-badge-grey">Coming soon</span>
                </div>
                <h3>VPS Servers</h3>
                <p>General purpose virtual machines on Intel or AMD, with NVMe SSD storage.</p>
              </article>
            </div>
          </div>
        </div>
      </section>

      {/* ── Engines ── */}
      <section className="lp-section">
        <div className="lp-wrap">
          <div className="lp-head">
            <span className="lp-kicker">Engines</span>
            <h2>MySQL or PostgreSQL. Same price.</h2>
            <p>Pick the engine for each database. Plans, backups and prices are the same for both.</p>
          </div>
          <div className="lp-engines">
            {Object.entries(ENGINES).map(([id, e]) => (
              <article key={id} className={`lp-card lp-engine${engine === id ? " is-on" : ""}`}>
                <div className="lp-engine-head">
                  <div className="lp-engine-name"><span className="lp-icon-box"><Database size={24} /></span><h3>{e.label}</h3></div>
                  <span className="lp-badge-grey lp-badge-plain">Port {e.port}</span>
                </div>
                <p>{e.text}</p>
                <code className="lp-code">{e.uri}</code>
                <div className="lp-engine-foot">
                  <span className="lp-muted-sm">Daily backups · Same plans and prices</span>
                  <button type="button" className="lp-btn lp-btn-ghost lp-btn-xs" onClick={() => setEngine(id)}>
                    {engine === id ? "Showing its prices" : "Show its prices"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="lp-section">
        <div className="lp-wrap">
          <div className="lp-head">
            <span className="lp-kicker">Features</span>
            <h2>Features tailored for you</h2>
            <p>Included with every Managed Database, whichever plan and engine you pick.</p>
          </div>
          <div className="lp-features">
            {FEATURES.map(({ Icon, title, text }) => (
              <div key={title} className="lp-card lp-feature">
                <span className="lp-feature-icon"><Icon size={26} /></span>
                <h3>{title === "Hosted in India" && offered.length ? `Hosted in ${offered[0].name}` : title}</h3>
                <p>{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Console ── */}
      <section className="lp-section">
        <div className="lp-wrap lp-console-row-wrap">
          <div className="lp-console-copy">
            <span className="lp-kicker">Console</span>
            <h2>Manage it from the console</h2>
            <p>Your databases sit next to the rest of your account: status, connection details and billing in one place.</p>
            <ul className="lp-points">
              {CONSOLE_POINTS.map((pt) => (
                <li key={pt.title}><Check20 /><span><strong>{pt.title}</strong><span>{pt.text}</span></span></li>
              ))}
            </ul>
            <a href="/dashboard" className="lp-btn lp-btn-ghost lp-btn-sm">Open the console<ArrowRight size={16} /></a>
          </div>
          <ConsolePreview />
        </div>
      </section>

      {/* ── Plans ── */}
      <section className="lp-section" id="plans">
        <div className="lp-wrap">
          <div className="lp-head">
            <span className="lp-kicker">Plans</span>
            <h2>Pick a plan</h2>
            <p>Every price in rupees. Pick a location, an engine and a plan; the engine doesn't change the price.</p>
          </div>
          <div className="lp-plans-bar">
            <h3>General Purpose</h3>
            <div className="lp-plans-segs">
              {db && db.locations.length > 0 && (
                <div className="lp-seg">
                  <span className="lp-seg-label">Location</span>
                  {offered.map((l) => <span key={l.name} className="lp-seg-item is-on"><MapPin size={14} />{l.name}</span>)}
                  {soon.map((l) => <span key={l.name} className="lp-seg-item is-soon">{l.name}<em>SOON</em></span>)}
                </div>
              )}
              <div className="lp-seg" role="group" aria-label="Engine">
                <span className="lp-seg-label">Engine</span>
                {Object.entries(ENGINES).map(([id, e]) => (
                  <button key={id} type="button" className={`lp-seg-item${engine === id ? " is-on" : ""}`} aria-pressed={engine === id} onClick={() => setEngine(id)}>{e.label}</button>
                ))}
              </div>
            </div>
          </div>
          <div className="lp-plans">
            {db === null ? (
              <p className="lp-plans-msg">Loading plans…</p>
            ) : db === false ? (
              <p className="lp-plans-msg">Plans couldn't be loaded right now. Please refresh the page in a moment.</p>
            ) : plans.length === 0 ? (
              <p className="lp-plans-msg">Managed Database plans are coming soon.</p>
            ) : (
              <div className="lp-plans-table">
                <div className="lp-plans-row lp-plans-th"><span>Plan</span><span>vCPU</span><span>Memory</span><span>Storage</span><span>Backups</span><span>Monthly</span><span>Availability</span></div>
                {plans.map((p) => {
                  const [ram, ramU] = unitSplit(formatRam(p.ram));
                  const [disk, diskU] = unitSplit(formatStorage(p.storage));
                  return (
                    <div key={p.name} className="lp-plans-row">
                      <span className="lp-plan-name">{p.name}</span>
                      <span><strong>{p.vcpu}</strong> <em>vCPU</em></span>
                      <span><strong>{ram}</strong> <em>{ramU}</em></span>
                      <span><strong>{disk}</strong> <em>{diskU}</em></span>
                      <span><strong>Daily</strong> <em>{p.backupDays}-day retention</em></span>
                      <span><strong>{money(p.monthly)}</strong> <em>/mo</em></span>
                      <span>{stock[p.name] ? <a href={CREATE_DB} className="lp-pill is-active">Available</a> : <span className="lp-pill">Out of stock</span>}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <p className="lp-note">Showing {ENGINES[engine].label} prices; both engines cost the same. Prices exclude tax; the final amount is shown at checkout. Billed monthly: the rest of the month when you order, then on the 1st.</p>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="lp-section lp-section-last">
        <div className="lp-wrap lp-faq-wrap">
          <div className="lp-faq-intro">
            <span className="lp-kicker">FAQ</span>
            <h2>Questions, answered</h2>
            <p>Anything else about Managed Database? We're available 24/7.</p>
            <a href="/contact" className="lp-btn lp-btn-ghost lp-btn-sm"><Headphones size={16} />Talk to us</a>
          </div>
          <div className="lp-card lp-faq">
            {faqs.map(([q, a], i) => (
              <div key={q} className="lp-faq-item">
                <button type="button" aria-expanded={faqOpen === i} onClick={() => setFaqOpen(faqOpen === i ? -1 : i)}>
                  {q}<ChevronDown size={20} className={faqOpen === i ? "is-open" : ""} />
                </button>
                {faqOpen === i && <p>{a}</p>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="lp-cta">
        <div className="lp-wrap lp-cta-row">
          <div>
            <h2>Not sure which plan fits?</h2>
            <p>Tell us about your workload and we'll point you to the right setup.</p>
          </div>
          <div className="lp-cta-btns">
            <a href={CREATE_DB} className="lp-btn lp-btn-outline-dark">Create a database</a>
            <a href="/contact" className="lp-btn lp-btn-mint">Talk to our team<ArrowRight size={16} /></a>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Homepage;
