import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import './Pricing.css';
import { CPU_TYPES, formatRam, formatBandwidth } from '../../data/plans';
import {
  Layers, Server, Globe, ChevronUp, ChevronDown, ArrowRight, Check, Cpu, MemoryStick,
  HardDrive, Network, Shield, Clock, BookOpen, BadgePercent
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

// Monthly price in the chosen currency. USD is shown for reference; plans
// without a $ price show a dash.
const CURRENCIES = [{ id: "inr", label: "₹ INR" }, { id: "usd", label: "$ USD" }];
const CURRENCY_KEY = "walrasCurrency";
const priceOf = (plan, currency) => (currency === "usd" ? plan.usd : plan.monthly);
const formatMoney = (value, currency) =>
  value === null || value === undefined ? "—"
    : currency === "usd" ? `$${Number(value).toLocaleString("en-US", { minimumFractionDigits: Number(value) % 1 ? 2 : 0, maximumFractionDigits: 2 })}`
    : `₹${Number(value).toLocaleString("en-IN", { minimumFractionDigits: Number(value) % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;

// ── Reserved VMs ──────────────────────────────────────────────────────────
// The same plans reserved for a term, paid up front. Discounts match the
// server's billing terms (utils/monthlyBilling.js TERMS) and checkout.
const RESERVE_TERMS = [
  { months: 3, savings: 0 },
  { months: 6, savings: 5 },
  { months: 12, savings: 10 },
  { months: 24, savings: 15 },
  { months: 36, savings: 25 },
];
const MAX_RESERVE_SAVINGS = Math.max(...RESERVE_TERMS.map((t) => t.savings));
const discounted = (value, savings) => (value == null ? null : Math.round(value * (100 - savings)) / 100);

// ── Domains (coming soon) ─────────────────────────────────────────────────
const DOMAIN_INCLUDES = [
  "Free lifetime WHOIS privacy on every domain",
  "Registry lock against unauthorised transfers",
  "DNS management from the same dashboard"
];

// ── Rail ───────────────────────────────────────────────────────────────────
const SECTIONS = [
  { id: "virtual-machine", Icon: Layers, title: "Virtual Machine", desc: "General purpose VMs on Intel or AMD.", from: "from ₹350/mo" },
  { id: "reserved-vm", Icon: BadgePercent, title: "Reserved VMs", desc: "Reserve for 3–36 months and save.", from: `Save up to ${MAX_RESERVE_SAVINGS}%` },
  { id: "bare-metal", Icon: Server, title: "Bare Metal", desc: "Single-tenant dedicated servers.", from: "Coming soon" },
  { id: "domains", Icon: Globe, title: "Domains", desc: "Register and protect your name.", from: "Coming soon" }
];

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
  // Reserved VMs: the term shown (12 months, the usual choice).
  const [reserveMonths, setReserveMonths] = useState(12);
  const reserveTerm = RESERVE_TERMS.find((t) => t.months === reserveMonths) || RESERVE_TERMS[0];
  // ₹ or $, remembered for next time.
  const [currency, setCurrency] = useState(() => {
    try { return localStorage.getItem(CURRENCY_KEY) === "usd" ? "usd" : "inr"; } catch { return "inr"; }
  });
  const chooseCurrency = (c) => {
    setCurrency(c);
    try { localStorage.setItem(CURRENCY_KEY, c); } catch { /* not remembered */ }
  };
  // Plans and prices are managed in admin; null while loading.
  const [vmPlans, setVmPlans] = useState(null);

  useEffect(() => {
    fetch("/api/plans/vm")
      .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .then((d) => setVmPlans(d.plans || []))
      .catch(() => setVmPlans(false)); // false = couldn't load (not "no plans")
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

  const sortValue = (p) => (sort.key === "monthly" ? (priceOf(p, currency) ?? Infinity) : p[sort.key]);
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
                  {id === "virtual-machine" && vmPlans?.length && vmPlans.some((p) => priceOf(p, currency) != null)
                    ? `from ${formatMoney(Math.min(...vmPlans.map((p) => priceOf(p, currency)).filter((v) => v != null)), currency)}/mo`
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
              <div className="pr-seg" role="group" aria-label="Currency">
                {CURRENCIES.map((c) => (
                  <button key={c.id} type="button" aria-pressed={currency === c.id}
                    className={currency === c.id ? "is-active" : ""} onClick={() => chooseCurrency(c.id)}>
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
                          const amount = formatMoney(priceOf(plan, currency), currency);
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
              {currency === "usd" && " US dollar prices are for reference; your account is billed in Indian rupees."}
              {" "}Every plan includes one IPv4 address and a 1 Gbps network port.
            </p>
          </section>

          {/* ── Reserved VMs ── */}
          <section className="pr-section" id="reserved-vm">
            <div className="pr-section-head">
              <span className="pr-section-icon"><BadgePercent aria-hidden="true" /></span>
              <div>
                <h2 className="pr-section-title">Reserved VMs</h2>
                <p className="pr-section-lede">
                  The same Virtual Machines, reserved for 3 to 36 months from the day you order and paid up
                  front. The longer the term, the more you save: up to {MAX_RESERVE_SAVINGS}% on the monthly price.
                </p>
              </div>
            </div>

            <div className="pr-family-head">
              <h3 className="pr-subtitle">Reservation term</h3>
              <div className="pr-seg pr-term-seg" role="tablist" aria-label="Reservation term">
                {RESERVE_TERMS.map((t) => (
                  <button key={t.months} type="button" role="tab" aria-selected={reserveMonths === t.months}
                    className={reserveMonths === t.months ? "is-active" : ""} onClick={() => setReserveMonths(t.months)}>
                    {t.months} mo{t.savings > 0 && <span className="pr-term-save">−{t.savings}%</span>}
                  </button>
                ))}
              </div>
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
                    <th scope="col">vCPUs</th>
                    <th scope="col">Memory</th>
                    <th scope="col">Monthly</th>
                    <th scope="col">Reserved</th>
                    <th scope="col">{reserveTerm.months} months total</th>
                    <th scope="col">Availability</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedPlans.map((plan) => {
                    const monthly = priceOf(plan, currency);
                    const perMonth = discounted(monthly, reserveTerm.savings);
                    const total = perMonth == null ? null : Math.round(perMonth * reserveTerm.months * 100) / 100;
                    const [vcpu, vcpuUnit] = PLAN_COLUMNS[0].show(plan);
                    const [ram, ramUnit] = PLAN_COLUMNS[1].show(plan);
                    return (
                      <tr key={plan.name}>
                        <td className="pr-plan-name" data-label="Plan">{plan.name}</td>
                        <td data-label="vCPUs"><strong>{vcpu}</strong> <span className="pr-unit">{vcpuUnit}</span></td>
                        <td data-label="Memory"><strong>{ram}</strong> <span className="pr-unit">{ramUnit}</span></td>
                        <td data-label="Monthly" className="pr-price">
                          {reserveTerm.savings > 0
                            ? <s className="pr-was">{formatMoney(monthly, currency)}</s>
                            : <span className="pr-unit">{formatMoney(monthly, currency)}</span>}
                        </td>
                        <td data-label="Reserved" className="pr-price is-sorted">
                          <strong>{formatMoney(perMonth, currency)}</strong> <span className="pr-unit">/mo</span>
                        </td>
                        <td data-label={`${reserveTerm.months} months total`} className="pr-price">
                          <strong>{formatMoney(total, currency)}</strong>
                        </td>
                        <td data-label="Availability">
                          {computeStock[plan.name]
                            ? <a href="/dashboard/reserve" className="pr-stock is-in">Reserve</a>
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
              Prices exclude tax; the final amount is shown at checkout. The whole term is paid up front and renews
              for the same term unless you cancel; a reservation cancelled early isn't refunded.
              {currency === "usd" && " US dollar prices are for reference; your account is billed in Indian rupees."}
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
