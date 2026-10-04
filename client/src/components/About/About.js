import React from 'react';
import './About.css';
import { Shield, Zap, Server, Clock, Wallet, Globe, MapPin, ArrowRight, Headphones } from 'lucide-react';

const STATS = [
  { value: "99.9%", label: "Uptime guarantee" },
  { value: "2", label: "Regions: Mumbai and London" },
  { value: "24/7", label: "Email and ticket support" },
  { value: "₹", label: "Local pricing, billed in rupees" }
];

const FEATURES = [
  {
    Icon: Shield,
    title: "Enterprise Security",
    description: "Multiple layers of security with DDoS protection, firewalls, and automated backups."
  },
  {
    Icon: Zap,
    title: "Lightning Fast Performance",
    description: "Optimized infrastructure with low-latency networks and high-performance hardware."
  },
  {
    Icon: Server,
    title: "Auto Scaling",
    description: "Automatically scale your resources up or down based on demand."
  },
  {
    Icon: Clock,
    title: "99.9% Uptime",
    description: "We guarantee 99.9% uptime for your servers with redundant infrastructure."
  },
  {
    Icon: Wallet,
    title: "Cost Effective",
    description: "Save up to 40% compared to international providers with our local pricing."
  },
  {
    Icon: Globe,
    title: "Data Sovereignty",
    description: "Keep your data within India with our locally hosted infrastructure."
  }
];

const REGIONS = [
  { city: "Mumbai", country: "India", note: "Our home region, close to customers across India." },
  { city: "London", country: "United Kingdom", note: "Our region for customers in the UK and Europe." }
];

const About = () => (
  <div className="ab-page">
    {/* Hero */}
    <header className="ab-hero">
      <div className="ab-wrap">
        <span className="ab-kicker">About us</span>
        <h1 className="ab-hero-title">Cloud infrastructure, built in India for the world.</h1>
        <p className="ab-hero-sub">
          Built in India, for India and the world. We're on a mission to make enterprise-grade
          cloud computing accessible to everyone.
        </p>

        <dl className="ab-stats">
          {STATS.map(({ value, label }) => (
            <div className="ab-stat" key={label}>
              <dt>{value}</dt>
              <dd>{label}</dd>
            </div>
          ))}
        </dl>
      </div>
    </header>

    {/* Mission */}
    <section className="ab-section">
      <div className="ab-wrap ab-mission">
        <div>
          <span className="ab-eyebrow">Our mission</span>
          <h2 className="ab-title">Democratizing cloud computing.</h2>
        </div>
        <div className="ab-mission-body">
          <p>
            At Walras Cloud, we believe in democratizing cloud computing. Our mission is to provide
            enterprise-grade cloud infrastructure at local prices, making it accessible to businesses
            of all sizes.
          </p>
          <p>
            We're committed to supporting India's digital transformation by offering world-class
            technology with local expertise.
          </p>
        </div>
      </div>
    </section>

    {/* Why choose */}
    <section className="ab-section ab-section-tint">
      <div className="ab-wrap">
        <div className="ab-head">
          <span className="ab-eyebrow">Why Walras Cloud</span>
          <h2 className="ab-title">Performance, reliability and fair pricing.</h2>
          <p className="ab-lede">Everything you need to run production workloads, without the big-cloud bill.</p>
        </div>

        <div className="ab-feature-grid">
          {FEATURES.map(({ Icon, title, description }) => (
            <div className="ab-card ab-feature" key={title}>
              <span className="ab-icon"><Icon aria-hidden="true" /></span>
              <h3>{title}</h3>
              <p>{description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* Regions */}
    <section className="ab-section">
      <div className="ab-wrap">
        <div className="ab-head">
          <span className="ab-eyebrow">Where we run</span>
          <h2 className="ab-title">Data centers close to your users.</h2>
          <p className="ab-lede">Premium facilities with fast, secure and reliable infrastructure, local compliance and support.</p>
        </div>

        <div className="ab-region-grid">
          {REGIONS.map(({ city, country, note }) => (
            <div className="ab-card ab-region" key={city}>
              <span className="ab-icon"><MapPin aria-hidden="true" /></span>
              <div>
                <h3>{city}<span>{country}</span></h3>
                <p>{note}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* Company + CTA */}
    <section className="ab-cta">
      <div className="ab-wrap ab-cta-inner">
        <div>
          <h2>Ready to build on Walras Cloud?</h2>
          <p>Walras Cloud is operated by IOOGN TECHNOLOGIES (OPC) PVT LTD, from India for India and the world.</p>
        </div>
        <div className="ab-cta-actions">
          <a href="/pricing" className="ab-btn ab-btn-primary">
            See pricing <ArrowRight aria-hidden="true" />
          </a>
          <a href="/contact" className="ab-btn ab-btn-ghost">
            <Headphones aria-hidden="true" /> Contact us
          </a>
        </div>
      </div>
    </section>
  </div>
);

export default About;
