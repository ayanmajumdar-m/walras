import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import './Pricing.css';
import { CPU_TYPES, formatRam, formatBandwidth, DB_ENGINES, formatStorage, APP_TYPES, APP_PLATFORM_ON } from '../../data/plans';
import {
  Layers, Server, Globe, ChevronUp, ChevronDown, ArrowRight, Check, Cpu, MemoryStick,
  HardDrive, Network, Shield, Clock, BookOpen, Database, DatabaseBackup, Rocket, Globe2
} from 'lucide-react';

/*
  One page for every price on the site. A sticky rail on the left jumps
  between sections (and follows the scroll); each section is a product.
  /domains, /bare-metal and /about/pricing redirect here with a hash.
*/

// ── Virtual Machine ────────────────────────────────────────────────────────
// Columns sort on the raw number; `show` formats it (e.g. 0.5 GB → 512 MB).
const splitUnit = (s) => { const [v, ...u] = s.split(" "); return [v, u.join(" ")]; };
const PLAN_COLUMNS = [
  { key: "vcpu", label: "vCPUs", show: (p) => [p.vcpu, p.vcpu === 1 ? "vCPU" : "vCPUs"] },
  { key: "ram", label: "Memory", show: (p) => splitUnit(formatRam(p.ram)) },
  { key: "storage", label: "NVMe SSD", show: (p) => [p.storage, "GB"] },
  { key: "bandwidth", label: "Bandwidth", show: (p) => splitUnit(formatBandwidth(p.bandwidth)) },
  { key: "monthly", label: "Monthly", price: true }
];

const COMPUTE_INCLUDES = [
  { Icon: Network, text: "1 IPv4 address" },
  { Icon: Cpu, text: "1 Gbps network" },
  { Icon: MemoryStick, text: "Intel or AMD CPUs" },
  { Icon: HardDrive, text: "NVMe SSD storage" }
];

// Monthly price in rupees, excluding GST.
const formatMoney = (value) =>
  value === null || value === undefined ? "—"
    : `₹${Number(value).toLocaleString("en-IN", { minimumFractionDigits: Number(value) % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;

// ── App Platform ───────────────────────────────────────────────────────────
const APP_INCLUDES = [
  { Icon: Globe2, text: "Your own domain" },
  { Icon: HardDrive, text: "NVMe SSD storage" },
  { Icon: Network, text: "Shared IP" },
  { Icon: Rocket, text: "Active as soon as it's paid" }
];

// ── Managed Database ───────────────────────────────────────────────────────
const DB_INCLUDES = [
  { Icon: Database, text: "MySQL or PostgreSQL" },
  { Icon: DatabaseBackup, text: "Daily backups" },
  { Icon: Shield, text: "Set up and looked after for you" },
  { Icon: HardDrive, text: "NVMe SSD storage" }
];

// ── Domains (coming soon) ─────────────────────────────────────────────────
const DOMAIN_INCLUDES = [
  "Free lifetime WHOIS privacy on every domain",
  "Registry lock against unauthorised transfers",
  "DNS management from the same dashboard"
];

// ── Rail ───────────────────────────────────────────────────────────────────
const SECTIONS = [
  { id: "virtual-machine", Icon: Layers, title: "Virtual Machine", desc: "General purpose VMs on Intel or AMD.", from: "from ₹350/mo" },
  { id: "app-platform", Icon: Rocket, title: "App Platform", desc: "Deploy your app on your own domain.", from: "from ₹349/mo" },
  { id: "managed-database", Icon: Database, title: "Managed Database", desc: "MySQL or PostgreSQL, managed for you.", from: "from ₹199/mo" },
  { id: "bare-metal", Icon: Server, title: "Bare Metal", desc: "Single-tenant dedicated servers.", from: "Coming soon" },
  { id: "domains", Icon: Globe, title: "Domains", desc: "Register and protect your name.", from: "Coming soon" }
].filter((s) => s.id !== "app-platform" || APP_PLATFORM_ON); // App Platform hidden for now (data/plans.js)

const PLATFORM_INCLUDES = [
  { Icon: Clock, text: "24/7 email and ticket support" },
  { Icon: Server, text: "User-friendly server manager" },
  { Icon: Shield, text: "99.9% uptime" },
  { Icon: Check, text: "24-hour trial" },
  { Icon: BookOpen, text: "Documentation and video tutorials" }
];

const scrollToSection = (id, smooth = true) => {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "start" });
};

const Pricing = () => {
  const location = useLocation();
  const [active, setActive] = useState(SECTIONS[0].id);
  const [sort, setSort] = useState({ key: "monthly", dir: "asc" });
  // Which Virtual Machine plans are in stock somewhere (set by admins).
  const [computeStock, setComputeStock] = useState({});
  const [cpu, setCpu] = useState(CPU_TYPES[0].id);
  // Plans and prices are managed in admin; null while loading.
  const [vmPlans, setVmPlans] = useState(null);
  // Managed Database plans (Admin → Managed Database → Plans); null while loading.
  const [dbPlans, setDbPlans] = useState(null);
  const [dbStock, setDbStock] = useState({});
  // App Platform plans; null while loading. Shared is on sale, Dedicated coming soon.
  const [appPlans, setAppPlans] = useState(null);
  const [appType, setAppType] = useState("shared");
  const [appStock, setAppStock] = useState({});

  useEffect(() => {
    fetch("/api/plans/vm")
      .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .then((d) => setVmPlans(d.plans || []))
      .catch(() => setVmPlans(false)); // false = couldn't load (not "no plans")
    fetch("/api/plans/database")
      .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .then((d) => setDbPlans(d.plans || []))
      .catch(() => setDbPlans(false));
    fetch("/api/plans/apps")
      .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .then((d) => setAppPlans(d.plans || []))
      .catch(() => setAppPlans(false));
  }, []);

  useEffect(() => {
    fetch("/api/settings/public")
      .then((r) => r.json())
      .then((d) => { setComputeStock(d?.planAvailability?.compute || {}); setDbStock(d?.planAvailability?.database || {}); setAppStock(d?.planAvailability?.apps || {}); })
      .catch(() => {});
  }, []);

  // Land on the right section when arriving via /pricing#domains etc. On a
  // fresh page load (e.g. the /domains redirect) the browser resets scroll
  // when loading finishes, so scroll again once it has.
  useEffect(() => {
    const hash = location.hash.replace("#", "");
    // Old links used #cloud-compute.
    const id = hash === "cloud-compute" ? "virtual-machine" : hash;
    if (!id) return;
    const go = () => scrollToSection(id, false);
    requestAnimationFrame(go);
    if (document.readyState !== "complete") {
      window.addEventListener("load", go, { once: true });
      return () => window.removeEventListener("load", go);
    }
  }, [location.hash]);

  // Scroll-spy: highlight the rail item for the section in view.
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActive(entry.target.id);
        });
      },
      { rootMargin: "-35% 0px -60% 0px" }
    );
    SECTIONS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  const jumpTo = (e, id) => {
    e.preventDefault();
    scrollToSection(id);
    window.history.replaceState(null, "", `#${id}`);
  };

  const sortValue = (p) => (sort.key === "monthly" ? p.monthly : p[sort.key]);
  const sortedPlans = (vmPlans || []).filter((p) => p.cpu === cpu).sort((a, b) =>
    sort.dir === "asc" ? sortValue(a) - sortValue(b) : sortValue(b) - sortValue(a)
  );

  const toggleSort = (key) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));

  return (
    <div className="pr-page">
      {/* Hero */}
      <header className="pr-hero">
        <div className="pr-wrap">
          <span className="pr-kicker">Pricing</span>
          <h1 className="pr-hero-title">Straightforward pricing. No surprises.</h1>
          <p className="pr-hero-sub">
            Every price on one page, in rupees. Pick what you need and pay only for that.
          </p>
          <div className="pr-hero-tiles">
            {SECTIONS.map(({ id, Icon, title, from }) => (
              <a key={id} href={`#${id}`} className="pr-hero-tile" onClick={(e) => jumpTo(e, id)}>
                <Icon className="pr-hero-tile-icon" aria-hidden="true" />
                <span className="pr-hero-tile-title">{title}</span>
                <span className="pr-hero-tile-from">
                  {id === "virtual-machine" && vmPlans?.length
                    ? `from ${formatMoney(Math.min(...vmPlans.map((p) => p.monthly)))}/mo`
                    : id === "app-platform" && appPlans?.length
                    ? `from ${formatMoney(Math.min(...appPlans.map((p) => p.monthly)))}/mo`
                    : id === "managed-database" && dbPlans?.length
                    ? `from ${formatMoney(Math.min(...dbPlans.map((p) => p.monthly)))}/mo`
                    : from}
                </span>
                <ArrowRight className="pr-hero-tile-arrow" aria-hidden="true" />
              </a>
            ))}
          </div>
        </div>
      </header>

      <div className="pr-wrap pr-layout">
        {/* Rail */}
        <nav className="pr-rail" aria-label="Pricing sections">
          {SECTIONS.map(({ id, Icon, title, desc }) => (
            <a
              key={id}
              href={`#${id}`}
              onClick={(e) => jumpTo(e, id)}
              className={`pr-rail-item${active === id ? " is-active" : ""}`}
              aria-current={active === id ? "true" : undefined}
            >
              <Icon className="pr-rail-icon" aria-hidden="true" />
              <span>
                <span className="pr-rail-title">{title}</span>
                <span className="pr-rail-desc">{desc}</span>
              </span>
            </a>
          ))}
        </nav>

        <main className="pr-content">
          {/* ── Virtual Machine ── */}
          <section className="pr-section" id="virtual-machine">
            <div className="pr-section-head">
              <span className="pr-section-icon"><Layers aria-hidden="true" /></span>
              <div>
                <h2 className="pr-section-title">Virtual Machine</h2>
                <p className="pr-section-lede">
                  Virtual machines with a balanced mix of CPU, memory and NVMe SSD storage, on Intel or
                  AMD, suitable for websites, apps and everyday workloads.
                </p>
              </div>
            </div>

            <ul className="pr-chips">
              {COMPUTE_INCLUDES.map(({ Icon, text }) => (
                <li key={text}><Icon aria-hidden="true" />{text}</li>
              ))}
            </ul>

            <div className="pr-family-head">
              <h3 className="pr-subtitle">General Purpose</h3>
              <div className="pr-seg" role="tablist" aria-label="CPU type">
                <span className="pr-seg-label">CPU type</span>
                {CPU_TYPES.map((c) => (
                  <button key={c.id} type="button" role="tab" aria-selected={cpu === c.id}
                    className={cpu === c.id ? "is-active" : ""} onClick={() => setCpu(c.id)}>
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
            {vmPlans === null ? (
              <div className="pr-card pr-soon-card"><span>Loading plans…</span></div>
            ) : vmPlans === false ? (
              <div className="pr-card pr-soon-card">
                <strong>Plans couldn't be loaded right now.</strong>
                <span>Please refresh the page in a moment.</span>
              </div>
            ) : sortedPlans.length === 0 ? (
              <div className="pr-card pr-soon-card">
                <strong>{CPU_TYPES.find((c) => c.id === cpu)?.label} plans are coming soon.</strong>
                <span>Choose Intel to see the plans available now.</span>
              </div>
            ) : (
            <div className="pr-card pr-table-card">
              <table className="pr-table">
                <thead>
                  <tr>
                    <th scope="col">Plan</th>
                    {PLAN_COLUMNS.map(({ key, label }) => {
                      const isSorted = sort.key === key;
                      return (
                        <th
                          scope="col"
                          key={key}
                          aria-sort={isSorted ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
                        >
                          <button
                            type="button"
                            className={`pr-sort${isSorted ? " is-active" : ""}`}
                            onClick={() => toggleSort(key)}
                          >
                            {label}
                            <span className="pr-sort-arrows" aria-hidden="true">
                              <ChevronUp className={isSorted && sort.dir === "asc" ? "on" : ""} />
                              <ChevronDown className={isSorted && sort.dir === "desc" ? "on" : ""} />
                            </span>
                          </button>
                        </th>
                      );
                    })}
                    <th scope="col">Availability</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedPlans.map((plan) => (
                    <tr key={plan.name} className={plan.popular ? "is-popular" : ""}>
                      <td className="pr-plan-name" data-label="Plan">
                        {plan.name}
                        {plan.popular && <span className="pr-tag">Popular</span>}
                      </td>
                      {PLAN_COLUMNS.map(({ key, label, show, price }) => {
                        const cls = sort.key === key ? "is-sorted" : "";
                        if (price) {
                          const amount = formatMoney(plan.monthly);
                          const per = "/mo";
                          return (
                            <td key={key} data-label={`${label} price`} className={`pr-price ${cls}`}>
                              <strong>{amount}</strong> <span className="pr-unit">{per}</span>
                            </td>
                          );
                        }
                        const [value, unit] = show(plan);
                        return (
                          <td key={key} data-label={label} className={cls}>
                            <strong>{value}</strong> <span className="pr-unit">{unit}</span>
                          </td>
                        );
                      })}
                      <td data-label="Availability">
                        {computeStock[plan.name]
                          ? <a href="/dashboard/create?type=compute" className="pr-stock is-in">Available</a>
                          : <span className="pr-stock">Out of stock</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            )}

            <p className="pr-footnote">
              Prices exclude tax; the final amount is shown at checkout.
              {" "}Every plan includes one IPv4 address and a 1 Gbps network port.
            </p>
          </section>

          {/* ── App Platform (hidden for now, data/plans.js) ── */}
          {APP_PLATFORM_ON && (
          <section className="pr-section" id="app-platform">
            <div className="pr-section-head">
              <span className="pr-section-icon"><Rocket aria-hidden="true" /></span>
              <div>
                <h2 className="pr-section-title">App Platform</h2>
                <p className="pr-section-lede">
                  Deploy your app on your own domain. Choose a plan and your domain, pay, and your plan is active.
                </p>
              </div>
            </div>

            <ul className="pr-chips">
              {APP_INCLUDES.map(({ Icon, text }) => (
                <li key={text}><Icon aria-hidden="true" />{text}</li>
              ))}
            </ul>

            <div className="pr-family-head">
              <div className="pr-seg" role="tablist" aria-label="App Platform type">
                {APP_TYPES.map((t) => (
                  <button key={t.id} type="button" role="tab" aria-selected={appType === t.id}
                    className={appType === t.id ? "is-active" : ""} onClick={() => setAppType(t.id)}>
                    {t.label}{!t.available && <span className="pr-term-soon"> · Coming soon</span>}
                  </button>
                ))}
              </div>
            </div>
            {appType === "dedicated" ? (
              <div className="pr-card pr-soon-card">
                <strong>Dedicated App Platform is coming soon.</strong>
                <span>Dedicated resources for your app. Shared plans are available now.</span>
              </div>
            ) : appPlans === null ? (
              <div className="pr-card pr-soon-card"><span>Loading plans…</span></div>
            ) : appPlans === false ? (
              <div className="pr-card pr-soon-card">
                <strong>Plans couldn't be loaded right now.</strong>
                <span>Please refresh the page in a moment.</span>
              </div>
            ) : appPlans.length === 0 ? (
              <div className="pr-card pr-soon-card"><strong>App Platform plans are coming soon.</strong></div>
            ) : (
            <div className="pr-card pr-table-card">
              <table className="pr-table">
                <thead>
                  <tr>
                    <th scope="col">Plan</th>
                    <th scope="col">vCPU</th>
                    <th scope="col">Memory</th>
                    <th scope="col">NVMe SSD</th>
                    <th scope="col">Bandwidth</th>
                    <th scope="col">IP</th>
                    <th scope="col">Monthly</th>
                    <th scope="col">Availability</th>
                  </tr>
                </thead>
                <tbody>
                  {appPlans.map((plan) => {
                    const [ram, ramUnit] = splitUnit(formatRam(plan.ram));
                    const [bw, bwUnit] = splitUnit(formatBandwidth(plan.bandwidth));
                    return (
                      <tr key={plan.name}>
                        <td className="pr-plan-name" data-label="Plan">{plan.name}</td>
                        <td data-label="vCPU"><strong>{plan.vcpu}</strong> <span className="pr-unit">vCPU</span></td>
                        <td data-label="Memory"><strong>{ram}</strong> <span className="pr-unit">{ramUnit}</span></td>
                        <td data-label="NVMe SSD"><strong>{plan.storage}</strong> <span className="pr-unit">GB</span></td>
                        <td data-label="Bandwidth"><strong>{bw}</strong> <span className="pr-unit">{bwUnit}</span></td>
                        <td data-label="IP">{plan.dedicatedIp ? "Dedicated" : "Shared"}</td>
                        <td data-label="Monthly price" className="pr-price">
                          <strong>{formatMoney(plan.monthly)}</strong> <span className="pr-unit">/mo</span>
                        </td>
                        <td data-label="Availability">
                          {appStock[plan.name]
                            ? <a href="/dashboard/create?type=apps" className="pr-stock is-in">Available</a>
                            : <span className="pr-stock">Out of stock</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            )}

            <p className="pr-footnote">
              Prices exclude tax; the final amount is shown at checkout. Billed monthly: the rest of the month when you
              deploy, then on the 1st.
            </p>
          </section>
          )}

          {/* ── Managed Database ── */}
          <section className="pr-section" id="managed-database">
            <div className="pr-section-head">
              <span className="pr-section-icon"><Database aria-hidden="true" /></span>
              <div>
                <h2 className="pr-section-title">Managed Database</h2>
                <p className="pr-section-lede">
                  MySQL or PostgreSQL, set up and looked after for you, with daily backups. Pick a location,
                  an engine and a plan; the price is the same for both engines.
                </p>
              </div>
            </div>

            <ul className="pr-chips">
              {DB_INCLUDES.map(({ Icon, text }) => (
                <li key={text}><Icon aria-hidden="true" />{text}</li>
              ))}
            </ul>

            <div className="pr-family-head">
              <h3 className="pr-subtitle">General Purpose</h3>
              <div className="pr-seg" role="group" aria-label="Engines">
                <span className="pr-seg-label">Engines</span>
                {DB_ENGINES.map((e) => <span key={e.id} className="pr-engine">{e.label}</span>)}
              </div>
            </div>
            {dbPlans === null ? (
              <div className="pr-card pr-soon-card"><span>Loading plans…</span></div>
            ) : dbPlans === false ? (
              <div className="pr-card pr-soon-card">
                <strong>Plans couldn't be loaded right now.</strong>
                <span>Please refresh the page in a moment.</span>
              </div>
            ) : dbPlans.length === 0 ? (
              <div className="pr-card pr-soon-card"><strong>Managed Database plans are coming soon.</strong></div>
            ) : (
            <div className="pr-card pr-table-card">
              <table className="pr-table">
                <thead>
                  <tr>
                    <th scope="col">Plan</th>
                    <th scope="col">vCPU</th>
                    <th scope="col">Memory</th>
                    <th scope="col">Storage</th>
                    <th scope="col">Backups</th>
                    <th scope="col">Monthly</th>
                    <th scope="col">Availability</th>
                  </tr>
                </thead>
                <tbody>
                  {dbPlans.map((plan) => {
                    const [ram, ramUnit] = splitUnit(formatRam(plan.ram));
                    const [disk, diskUnit] = splitUnit(formatStorage(plan.storage));
                    return (
                      <tr key={plan.name}>
                        <td className="pr-plan-name" data-label="Plan">{plan.name}</td>
                        <td data-label="vCPU"><strong>{plan.vcpu}</strong> <span className="pr-unit">vCPU</span></td>
                        <td data-label="Memory"><strong>{ram}</strong> <span className="pr-unit">{ramUnit}</span></td>
                        <td data-label="Storage"><strong>{disk}</strong> <span className="pr-unit">{diskUnit}</span></td>
                        <td data-label="Backups"><strong>Daily</strong> <span className="pr-unit">{plan.backupDays}-day retention</span></td>
                        <td data-label="Monthly price" className="pr-price">
                          <strong>{formatMoney(plan.monthly)}</strong> <span className="pr-unit">/mo</span>
                        </td>
                        <td data-label="Availability">
                          {dbStock[plan.name]
                            ? <a href="/dashboard/create?type=database" className="pr-stock is-in">Available</a>
                            : <span className="pr-stock">Out of stock</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            )}

            <p className="pr-footnote">
              Prices exclude tax; the final amount is shown at checkout.
              {" "}Billed monthly like Virtual Machines: the rest of the month when you order, then on the 1st.
            </p>
          </section>

          {/* ── Bare Metal ── */}
          <section className="pr-section" id="bare-metal">
            <div className="pr-section-head">
              <span className="pr-section-icon"><Server aria-hidden="true" /></span>
              <div>
                <h2 className="pr-section-title">Bare Metal <span className="pr-soon">Coming soon</span></h2>
                <p className="pr-section-lede">
                  Dedicated servers for workloads that need the whole machine: no hypervisor,
                  no neighbours.
                </p>
              </div>
            </div>

            <div className="pr-card pr-bm">
              <ul className="pr-checklist">
                <li><Check aria-hidden="true" />Single-tenant hardware: the entire server is yours</li>
                <li><Check aria-hidden="true" />Dedicated CPU cores, memory and storage</li>
                <li><Check aria-hidden="true" />Full root access to the machine</li>
              </ul>
              <div className="pr-bm-cta">
                <p>Plans and pricing are being finalised. Tell us what you need and we'll reach out when it launches.</p>
                <a href="/contact" className="pr-btn pr-btn-primary">
                  Talk to us <ArrowRight aria-hidden="true" />
                </a>
              </div>
            </div>
          </section>

          {/* ── Domains ── */}
          <section className="pr-section" id="domains">
            <div className="pr-section-head">
              <span className="pr-section-icon"><Globe aria-hidden="true" /></span>
              <div>
                <h2 className="pr-section-title">Domains <span className="pr-soon">Coming soon</span></h2>
                <p className="pr-section-lede">
                  Register your name alongside your servers and manage it all from one dashboard.
                </p>
              </div>
            </div>

            <div className="pr-card pr-bm">
              <ul className="pr-checklist">
                {DOMAIN_INCLUDES.map((text) => (
                  <li key={text}><Check aria-hidden="true" />{text}</li>
                ))}
              </ul>
              <div className="pr-bm-cta">
                <p>Domain registration is on its way. Get in touch and we'll let you know as soon as it opens.</p>
                <a href="/contact" className="pr-btn pr-btn-primary">
                  Talk to us <ArrowRight aria-hidden="true" />
                </a>
              </div>
            </div>
          </section>

          {/* Every plan includes */}
          <section className="pr-card pr-includes" aria-label="Included with every plan">
            <h2>Included with every plan</h2>
            <ul>
              {PLATFORM_INCLUDES.map(({ Icon, text }) => (
                <li key={text}><Icon aria-hidden="true" />{text}</li>
              ))}
            </ul>
          </section>
        </main>
      </div>

      {/* Closing CTA */}
      <section className="pr-cta">
        <div className="pr-wrap pr-cta-inner">
          <div>
            <h2>Not sure which plan fits?</h2>
            <p>Tell us about your workload and we'll point you to the right setup.</p>
          </div>
          <a href="/contact" className="pr-btn pr-btn-primary pr-btn-lg">
            Talk to our team <ArrowRight aria-hidden="true" />
          </a>
        </div>
      </section>
    </div>
  );
};

export default Pricing;
