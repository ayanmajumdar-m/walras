import React, { useState } from 'react';
import './Pricing.css';
import { Server, Zap, Shield, Clock, HelpCircle, Layers, Globe, ChevronUp, ChevronDown } from 'lucide-react';

// All Cloud Compute plans: 1 IPv4 address, DDR4 RAM, SSD storage, transfer @10 Gbps.
const sharedPlans = [
  { name: "WSC-4GB", vcpu: 2, ram: 4, storage: 60, bandwidth: 2, monthly: 900, hourly: 1.25, popular: false },
  { name: "SFC-8GB", vcpu: 4, ram: 8, storage: 120, bandwidth: 4, monthly: 1800, hourly: 2.5, popular: false },
  { name: "SFC-16GB", vcpu: 6, ram: 16, storage: 240, bandwidth: 6, monthly: 3600, hourly: 5, popular: true },
  { name: "SFC-32GB", vcpu: 10, ram: 32, storage: 480, bandwidth: 10, monthly: 5400, hourly: 7.5, popular: false }
];

const PLAN_COLUMNS = [
  { key: "vcpu", label: "vCPUs", unit: (p) => (p.vcpu === 1 ? "vCPU" : "vCPUs") },
  { key: "ram", label: "Memory", unit: () => "GB" },
  { key: "bandwidth", label: "Bandwidth", unit: () => "TB" },
  { key: "storage", label: "SSD Storage", unit: () => "GB" },
  { key: "monthly", label: "Monthly Price", price: true },
  { key: "hourly", label: "Hourly Price", price: true }
];

const formatPrice = (key, value) =>
  key === "monthly"
    ? { amount: `₹${value.toLocaleString("en-IN")}`, per: "/mo" }
    : { amount: `₹${value.toFixed(2)}`, per: "/hr" };

// Left rail, Vultr style. Cloud Compute is the table on this page; the other
// products have their own pages.
const CATEGORIES = [
  { id: "cloud-compute", href: "#cloud-compute", Icon: Layers, title: "Cloud Compute", desc: "Easy-to-use, affordable VMs for many common workloads." },
  { id: "bare-metal", href: "/bare-metal", Icon: Server, title: "Bare Metal", desc: "Single-tenant dedicated servers. Coming soon." },
  { id: "domains", href: "/domains", Icon: Globe, title: "Domains", desc: "Register and manage domains with free WHOIS privacy." }
];

const Pricing = () => {
  const [sort, setSort] = useState({ key: "monthly", dir: "asc" });

  const sortedPlans = [...sharedPlans].sort((a, b) =>
    sort.dir === "asc" ? a[sort.key] - b[sort.key] : b[sort.key] - a[sort.key]
  );

  const toggleSort = (key) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));

  const features = [
    { icon: <Clock className="feature-icon" />, text: "24/7 Email and Ticket Support" },
    { icon: <Server className="feature-icon" />, text: "User Friendly Server Manager" },
    { icon: <Shield className="feature-icon" />, text: "99.99% Uptime Guarantee" },
    { icon: <Zap className="feature-icon" />, text: "168-HOURS Free Trial" },
    { icon: <HelpCircle className="feature-icon" />, text: "Complete Documentation & Video Tutorials" },
    // { icon: <Wifi className="feature-icon" />, text: "Live Chat Support Available as Addon" }
  ];

  return (
    <div className="pricing-page">
      {/* Hero Section */}
      <section className="pricing-hero">
        <div className="container">
          <h1 className="pricing-title">Scalable & Simplified Pricing</h1>
          <p className="pricing-subtitle">
            Simple, all-inclusive plans for server, storage, and transfer. No hidden fees, scale with confidence and pay only for the term you need.
          </p>
          <div className="pricing-actions">
            <a href="#plans-section" className="btn primary">View All Plans</a>
          </div>
        </div>
      </section>

      {/* Plans Section */}
      <section className="plans-section" id='plans-section'>
        <div className="container cc-layout">
          {/* Category rail */}
          <nav className="cc-rail" aria-label="Product categories">
            {CATEGORIES.map(({ id, href, Icon, title, desc }) => (
              <a key={id} href={href} className={`cc-rail-item ${id === "cloud-compute" ? "is-active" : ""}`}>
                <Icon className="cc-rail-icon" aria-hidden="true" />
                <span>
                  <span className="cc-rail-title">{title}</span>
                  <span className="cc-rail-desc">{desc}</span>
                </span>
              </a>
            ))}
          </nav>

          {/* Cloud Compute */}
          <div className="cc-content">
            <div className="cc-block" id="cloud-compute">
              <h2 className="cc-heading">
                <Layers className="cc-heading-icon" aria-hidden="true" />
                Cloud Compute
              </h2>
              <p className="cc-lede">
                Virtual machines with a balanced mix of CPU, memory and SSD storage, suitable for
                websites, apps and everyday workloads. Every plan includes one IPv4 address and
                transfer at 10 Gbps.
              </p>

              <div className="cc-table-card">
                <table className="cc-table">
                  <thead>
                    <tr>
                      <th scope="col">Plan</th>
                      {PLAN_COLUMNS.map(({ key, label }) => {
                        const active = sort.key === key;
                        return (
                          <th
                            scope="col"
                            key={key}
                            aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
                          >
                            <button
                              type="button"
                              className={`cc-sort ${active ? "is-active" : ""}`}
                              onClick={() => toggleSort(key)}
                            >
                              {label}
                              <span className="cc-sort-arrows" aria-hidden="true">
                                <ChevronUp className={active && sort.dir === "asc" ? "on" : ""} />
                                <ChevronDown className={active && sort.dir === "desc" ? "on" : ""} />
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
                      <tr key={plan.name}>
                        <td className="cc-plan-name">
                          {plan.name}
                          {plan.popular && <span className="cc-tag">Popular</span>}
                        </td>
                        {PLAN_COLUMNS.map(({ key, unit, price }) => {
                          const active = sort.key === key;
                          if (price) {
                            const { amount, per } = formatPrice(key, plan[key]);
                            return (
                              <td key={key} className={`cc-price ${active ? "is-active" : ""}`}>
                                <strong>{amount}</strong> <span className="cc-unit">{per}</span>
                              </td>
                            );
                          }
                          return (
                            <td key={key} className={active ? "is-active" : ""}>
                              <strong>{plan[key]}</strong> <span className="cc-unit">{unit(plan)}</span>
                            </td>
                          );
                        })}
                        <td>
                          <span className="cc-stock">Out of stock</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="cc-footnote">
                Prices exclude tax; the final amount is shown at checkout. Transfer runs at 10 Gbps,
                or 1 Gbps in Asian locations.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section className="services-section">
        <div className="container">
          <div className="section-header">
            <h2 className="section-title">Additional Services</h2>
            <p className="section-subtitle">Enhance your cloud experience with our premium services</p>
          </div>

          <div className="services-grid">
            <div className="service-card">
              <div className="service-icon">
                <Server className="icon" />
              </div>
              <h3>Infrastructure Management</h3>
              <p>Managed by Us – Let us handle your server management for ₹15,000 per server per month. We take care of updates, monitoring, security, and technical support.</p>
              {/* <a className="btn secondary" href="/account/services">Add to My Account</a> */}
            </div>

            <div className="service-card">
              <div className="service-icon">
                <Zap className="icon" />
              </div>
              <h3>Cloud Consulting and Migration</h3>
              <p>Need Migration Help? Open a support ticket or email our team for guidance on moving your workloads to the cloud.</p>
              {/* <a className="btn secondary" href="/contact">Get a Quote</a> */}
            </div>

            <div className="service-card">
              <div className="service-icon">
                <Shield className="icon" />
              </div>
              <h3>Multiple Data Center Locations</h3>
              <p>Our premium data centers in Mumbai, India and London, UK offer fast, secure, and reliable cloud infrastructure with local compliance and support.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="features-section">
        <div className="features-container">
          <div className="features-header">
            <h2 className="features-title">All Plans Include</h2>
            <p className="features-subtitle">
              Everything you need to run your applications smoothly
            </p>
          </div>

          <div className="features-grid">
            {features.map((feature, index) => (
              <div className="feature-card" key={index}>
                <div className="feature-icon">{feature.icon}</div>
                <p className="feature-text">{feature.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

    </div>
  );
};

export default Pricing;