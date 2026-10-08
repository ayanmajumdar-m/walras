import React from 'react';
import './Contact.css';
import { Mail, Phone, MapPin, Clock, Shield, Zap, Check, ArrowRight, BookOpen } from 'lucide-react';

const ADDRESS = "IOOGNS HQ, Khudiram Sarani, Duttapukur, North 24 Parganas, Barasat I, West Bengal, India, 743248";

const CONTACT_METHODS = [
  {
    Icon: Mail,
    title: "Email Support",
    meta: "Available 24/7",
    detail: "support@walras.net",
    href: "mailto:support@walras.net",
    action: "Get support"
  },
  {
    Icon: Phone,
    title: "Contact Sales",
    meta: "Monday to Saturday, 10 AM to 6 PM",
    detail: "+91 94296 94951",
    href: "tel:+919429694951",
    action: "Call now"
  },
  {
    Icon: MapPin,
    title: "Office Address",
    meta: "Visit our headquarters",
    detail: ADDRESS,
    href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ADDRESS)}`,
    action: "Get directions",
    external: true
  }
];

const RESPONSE_TIMES = [
  { priority: "Critical issues", time: "Under 30 minutes", level: "critical" },
  { priority: "High priority", time: "Under 1 hour", level: "high" },
  { priority: "General support", time: "Under 4 hours", level: "general" }
];

const COVERAGE = [
  "24/7 email and ticket support",
  "Live chat add-on available",
  "Comprehensive documentation",
  "Video tutorial library",
  "Community forum access"
];

const SUPPORT_FEATURES = [
  { Icon: Shield, title: "24/7 security monitoring", description: "Round-the-clock monitoring to keep your infrastructure secure." },
  { Icon: Zap, title: "Fast response times", description: "Critical issues answered in under 30 minutes." },
  { Icon: Clock, title: "99.9% uptime support", description: "A dedicated support team ensuring maximum uptime for your services." }
];

const Contact = () => (
  <div className="ct-page">
    {/* Hero */}
    <header className="ct-hero">
      <div className="ct-wrap">
        <span className="ct-kicker">Contact us</span>
        <h1 className="ct-hero-title">We'd love to hear from you.</h1>
        <p className="ct-hero-sub">
          Reach us through any of the channels below and we'll get back to you quickly.
        </p>
      </div>
    </header>

    {/* Contact methods */}
    <section className="ct-wrap ct-methods" aria-label="Ways to reach us">
      {CONTACT_METHODS.map(({ Icon, title, meta, detail, href, action, external }) => (
        <div className="ct-card ct-method" key={title}>
          <span className="ct-icon"><Icon aria-hidden="true" /></span>
          <h2>{title}</h2>
          <p className="ct-meta">{meta}</p>
          <p className="ct-detail">{detail}</p>
          <a
            href={href}
            className="ct-link"
            {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          >
            {action} <ArrowRight aria-hidden="true" />
          </a>
        </div>
      ))}
    </section>

    {/* Response times + coverage */}
    <section className="ct-section">
      <div className="ct-wrap">
        <div className="ct-head">
          <span className="ct-eyebrow">Support</span>
          <h2 className="ct-title">Help when you need it.</h2>
          <p className="ct-lede">Enterprise-grade support tailored to your needs.</p>
        </div>

        <div className="ct-support-grid">
          <div className="ct-card ct-panel">
            <h3>Response time</h3>
            <ul className="ct-times">
              {RESPONSE_TIMES.map(({ priority, time, level }) => (
                <li key={priority}>
                  <span className={`ct-priority is-${level}`}>{priority}</span>
                  <strong>{time}</strong>
                </li>
              ))}
            </ul>
          </div>

          <div className="ct-card ct-panel">
            <h3>Support coverage</h3>
            <ul className="ct-checklist">
              {COVERAGE.map((item) => (
                <li key={item}><Check aria-hidden="true" />{item}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="ct-feature-row">
          {SUPPORT_FEATURES.map(({ Icon, title, description }) => (
            <div className="ct-feature" key={title}>
              <span className="ct-icon ct-icon-sm"><Icon aria-hidden="true" /></span>
              <div>
                <h3>{title}</h3>
                <p>{description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* CTA */}
    <section className="ct-cta">
      <div className="ct-wrap ct-cta-inner">
        <div>
          <h2>Ready to get started?</h2>
          <p>Join thousands of satisfied customers using Walras Cloud.</p>
        </div>
        <div className="ct-cta-actions">
          <a href="/pricing" className="ct-btn ct-btn-primary">
            See pricing <ArrowRight aria-hidden="true" />
          </a>
          <a href="https://docs.walras.net" className="ct-btn ct-btn-ghost">
            <BookOpen aria-hidden="true" /> View documentation
          </a>
        </div>
      </div>
    </section>
  </div>
);

export default Contact;
