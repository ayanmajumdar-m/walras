import React from "react";
import "./Homepage.css";
import { useLocations } from "../data/locations";
import { Zap, Clock, Gauge, Globe, Cpu, Check, Database } from "lucide-react";

/*
  The homepage as a specification sheet.

  Two ideas carry it. First, the hero is a claim beside a plate of figures —
  the numbers a CTO comparing providers actually wants, on the screen before
  any scrolling. Second, everything below is a grid whose structure is
  visible: hairline rules, equal cells, registration marks. No cards floating
  on gradients, no emoji standing in for icons.

  The scroll-reveal IntersectionObserver that used to wrap every section is
  gone. It delayed first paint of real content to buy an effect, and on a
  wireframe page the effect reads as breakage.
*/

const COMMITMENTS = [
  {
    ref: "C-01",
    Icon: Zap,
    value: "99.9%",
    title: "High Uptime",
    desc: "We back our network and hardware with a 99.9% uptime SLA, so your apps stay live."
  },
  {
    ref: "C-02",
    Icon: Clock,
    value: "24/7",
    title: "Fastest Resolution",
    desc: "We're available 24/7 with a 60-minute response time, so you never have to worry about a thing."
  },
  {
    ref: "C-03",
    Icon: Gauge,
    value: "24 Hours",
    title: "Free Trial",
    desc: "Enjoy a 24-hour free trial on our Virtual Machines, experience worry-free performance!"
  }
];

const SERVICES = [
  {
    ref: "S-01",
    Icon: Globe,
    title: "Domains",
    description: "Comprehensive domain registration, transfer, and management with competitive pricing.",
    features: ["500+ TLDs Available", "Free WHOIS Protection", "Easy Domain Transfer", "Bulk Management"],
    action: { label: "Search Domain", href: "/pricing#domains" }
  },
  {
    ref: "S-02",
    Icon: Cpu,
    title: "Virtual Machine",
    description: "General purpose virtual machines on Intel or AMD, with NVMe SSD storage, prepaid monthly with the first month pro rata.",
    features: ["Intel or AMD CPUs", "NVMe SSD Storage", "Instant Deployment", "99.9% Uptime"],
    action: { label: "View plans", href: "/pricing#virtual-machine" }
  },
  {
    ref: "S-03",
    Icon: Database,
    title: "Managed Database",
    description: "MySQL or PostgreSQL, set up and looked after for you, with daily backups and monthly billing.",
    features: ["MySQL or PostgreSQL", "Daily Backups", "Same Locations as VMs", "From ₹199/month"],
    action: { label: "View plans", href: "/pricing#managed-database" }
  }
];

/* Every figure here is a commitment made elsewhere on the site — uptime from
   the commitments band, response and trial from support, regions and entry
   price from the pricing page. Nothing is invented for the plate. */
const SPEC_ROWS = [
  { k: "Uptime", v: "99.9%" },
  { k: "Support response", v: "60 min" },
  { k: "Free trial", v: "24 hrs" },
  { k: "Regions", v: null }, // from Admin → Locations
  { k: "Entry plan", v: "₹350/mo" }
];

const UPCOMING = [
  { ref: "G-01", title: "NVIDIA GPU Servers", desc: "High-performance computing with latest NVIDIA GPUs" },
  { ref: "G-02", title: "AI/ML Optimized", desc: "Perfect for training and inference workloads" },
  { ref: "G-03", title: "Research Ready", desc: "Built for scientific computing and research" }
];

const SUPPORT_STATS = [
  { number: "24/7", label: "Support Availability" },
  { number: "5min", label: "Avg Response Time" },
  { number: "99.9%", label: "Customer Satisfaction" }
];

const SUPPORT_FEATURES = [
  "Phone, Chat & Email Support",
  "Technical Experts",
  "Documentation & Tutorials"
];

const Corners = () => (
  <>
    <i className="corner tl" /><i className="corner tr" />
    <i className="corner bl" /><i className="corner br" />
  </>
);

const Homepage = () => {
  const locations = useLocations();
  const regions = String(locations.length); // how many, not their names
  return (
  <div className="homepage">
    <section className="section hero">
      <div className="container hero-grid">
        <div className="hero-text">
          <div className="hero-kicker">
            <span className="kicker">Sheet 01 / Introducing India's Own Cloud</span>
            <span className="rule" />
          </div>
          <h1 className="hero-title">The Straightforward Cloud</h1>
          <p className="hero-subtitle">
            Cloud infrastructure, without the complexity.
            <br />
            Simple, powerful, and built for everyone.
          </p>
          <div className="hero-actions">
            <a href="/login" className="btn btn-primary btn-lg blueprint">
              Get Started
              <Corners />
            </a>
            <a href="/contact" className="btn btn-secondary btn-lg">Contact Sales</a>
          </div>
        </div>

        <div className="hero-plate-wrap">
          <figure className="hero-plate blueprint">
            <Corners />
            <div className="plate-head">
              <span className="kicker plate-head-label">Service specification</span>
              <span className="plate-rev">REV. 2026.08</span>
            </div>
            {SPEC_ROWS.map((row) => (
              <div className="plate-row" key={row.k}>
                <span className="plate-key">{row.k}</span>
                <span className="plate-value">{row.k === "Regions" ? regions : row.v}</span>
              </div>
            ))}
            <figcaption className="plate-caption">
              Figures guaranteed by Walras Cloud. Tax not included; final amount shown at checkout.
            </figcaption>
          </figure>
        </div>
      </div>
    </section>
 
    <section className="section section-pad">
      <div className="container">
        <div className="rule-head">
          <h2>Our Commitments!</h2>
          <span className="rule" />
          <span className="note">Three promises that power every product we ship.</span>
        </div>
        <div className="commitments-grid">
          {COMMITMENTS.map(({ ref, Icon, value, title, desc }) => (
            <div className="commitment-card blueprint" key={ref}>
              <Corners />
              <div className="commitment-head">
                <span className="ref">{ref}</span>
                <Icon size={20} strokeWidth={1.5} />
              </div>
              <div className="figure-lg">{value}</div>
              <div className="commitment-title">{title}</div>
              <p className="commitment-desc">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>

    <section className="section section-pad">
      <div className="container">
        <div className="rule-head">
          <h2>Our Core Services</h2>
          <span className="rule" />
          <span className="note">Complete infrastructure solutions for businesses of all sizes</span>
        </div>
        <div className="services-grid" style={{ "--services-cols": SERVICES.length }}>
          {SERVICES.map(({ ref, Icon, title, description, features, action }) => (
            <div className="service-card blueprint" key={ref}>
              <Corners />
              <div className="service-head">
                <Icon size={24} strokeWidth={1.5} />
                <h3>{title}</h3>
                <span className="ref">{ref}</span>
              </div>
              <div className="service-body">
                <p className="service-description">{description}</p>
                <div className="service-features">
                  {features.map((f) => (
                    <div className="service-feature" key={f}>
                      <span className="feature-dot" />
                      {f}
                    </div>
                  ))}
                </div>
                <a href={action.href} className="btn btn-secondary">{action.label}</a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>

    <section className="section field-dark section-pad">
      <div className="container coming-soon-grid">
        <div>
          <span className="kicker">Coming Soon</span>
          <h2 className="coming-soon-title">GPU &amp; Bare Metal Servers</h2>
          <p className="coming-soon-desc">
            Get ready for GPU-accelerated bare metal servers built for AI, ML, and high-performance workloads.
          </p>
          <form className="notify-form" onSubmit={(e) => e.preventDefault()}>
            <input type="email" placeholder="Enter your email for early access" className="input" />
            <button type="submit" className="btn btn-primary">Notify Me</button>
          </form>
        </div>
        <div className="upcoming-list">
          {UPCOMING.map(({ ref, title, desc }) => (
            <div className="upcoming-row" key={ref}>
              <span className="upcoming-ref">{ref}</span>
              <div>
                <h4 className="upcoming-title">{title}</h4>
                <p className="upcoming-desc">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>

    <section className="section section-pad">
      <div className="container support-grid">
        <div>
          <h2 className="support-title">24×7 Expert Support</h2>
          <p className="support-desc">
            Our certified experts are available 24×7. Get instant support via chat, phone, or email.
          </p>
          <div className="support-features">
            {SUPPORT_FEATURES.map((f) => (
              <div className="support-feature" key={f}>
                <Check size={16} strokeWidth={1.5} />
                {f}
              </div>
            ))}
          </div>
        </div>
        <div className="cells cells-3 support-stats">
          {SUPPORT_STATS.map(({ number, label }) => (
            <div key={label}>
              <div className="figure-md">{number}</div>
              <div className="figure-label">{label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>

    <section className="section cta">
      <div className="container cta-inner">
        <div>
          <h2 className="cta-title">Ready to Get Started?</h2>
          <p className="cta-subtitle">Join thousands of developers and businesses who trust Walras Cloud.</p>
        </div>
        <div className="cta-actions">
          <a href="/login" className="btn btn-primary btn-lg blueprint">
            Get Started
            <Corners />
          </a>
          <a href="https://docs.walras.net" className="btn btn-secondary btn-lg">View Documentation</a>
        </div>
      </div>
    </section>
  </div>
  );
};

export default Homepage;
