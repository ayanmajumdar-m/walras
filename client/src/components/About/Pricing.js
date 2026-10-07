import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import './Pricing.css';
import { CPU_TYPES, formatRam, formatBandwidth } from '../../data/plans';
import {
  Layers, Server, Globe, ChevronUp, ChevronDown, ArrowRight, Check, Cpu, MemoryStick,
  HardDrive, Network, Shield, Clock, BookOpen
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

const formatPrice = (key, value) => ({ amount: `₹${value.toLocaleString("en-IN")}`, per: "/mo" });

// ── Domains (coming soon) ─────────────────────────────────────────────────
const DOMAIN_INCLUDES = [
  "Free lifetime WHOIS privacy on every domain",
  "Registry lock against unauthorised transfers",
  "DNS management from the same dashboard"
];

// ── Rail ───────────────────────────────────────────────────────────────────
const SECTIONS = [
  { id: "virtual-machine", Icon: Layers, title: "Virtual Machine", desc: "General purpose VMs on Intel or AMD.", from: "from ₹350/mo" },
  { id: "bare-metal", Icon: Server, title: "Bare Metal", desc: "Single-tenant dedicated servers.", from: "Coming soon" },
  { id: "domains", Icon: Globe, title: "Domains", desc: "Register and protect your name.", from: "Coming soon" }
];

const PLATFORM_INCLUDES = [
  { Icon: Clock, text: "24/7 email and ticket support" },
  { Icon: Server, text: "User-friendly server manager" },
  { Icon: Shield, text: "99.9% uptime guarantee" },
  { Icon: Check, text: "168-hour trial" },
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

  useEffect(() => {
    fetch("/api/plans/vm")
      .then((r) => r.json())
      .then((d) => setVmPlans(d.plans || []))
      .catch(() => setVmPlans([]));
  }, []);

  useEffect(() => {
    fetch("/api/settings/public")
      .then((r) => r.json())
      .then((d) => setComputeStock(d?.planAvailability?.compute || {}))
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

  const sortedPlans = (vmPlans || []).filter((p) => p.cpu === cpu).sort((a, b) =>
    sort.dir === "asc" ? a[sort.key] - b[sort.key] : b[sort.key] - a[sort.key]
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
                    ? `from ₹${Math.min(...vmPlans.map((p) => p.monthly)).toLocaleString("en-IN")}/mo`
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
                          const { amount, per } = formatPrice(key, plan[key]);
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
              Prices exclude tax; the final amount is shown at checkout. Every plan includes one IPv4
              address and a 1 Gbps network port.
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
