import React, { useState } from "react";
import { Check, ChevronDown, ChevronUp, Zap, Shield, Globe, Server, Clock, HardDrive } from "lucide-react";
import ButtrGuarantee from "../Constants/ButtrGuarantee";
import "./WebHosting.css";

const WebHosting = () => {
  const [openFaq, setOpenFaq] = useState(null);
  const [selectedTerm, setSelectedTerm] = useState("12");

  const PAYMENT_TERMS = [
    { id: "1", label: "1 Month", discount: null },
    { id: "6", label: "6 Months", discount: "Save 5%" },
    { id: "12", label: "12 Months", discount: "Save 10% · Popular" },
    { id: "36", label: "36 Months", discount: "Save 15% · Best Value" }
  ];

  const TERM_PRICES = {
    Seed: {
      "1": { monthly: 99, was: 149, termNote: "Billed ₹99 for 1 Month" },
      "6": { monthly: 94, was: 149, termNote: "Billed ₹564 for 6 Months (5% off)" },
      "12": { monthly: 89, was: 149, termNote: "Billed ₹1,069 for 12 Months (10% off)" },
      "36": { monthly: 84, was: 149, termNote: "Billed ₹3,029 for 36 Months (15% off)" }
    },
    Tree: {
      "1": { monthly: 179, was: 299, termNote: "Billed ₹179 for 1 Month" },
      "6": { monthly: 170, was: 299, termNote: "Billed ₹1,020 for 6 Months (5% off)" },
      "12": { monthly: 161, was: 299, termNote: "Billed ₹1,933 for 12 Months (10% off)" },
      "36": { monthly: 152, was: 299, termNote: "Billed ₹5,477 for 36 Months (15% off)" }
    }
  };
  TERM_PRICES.Lite = TERM_PRICES.Seed;
  TERM_PRICES.Pro = TERM_PRICES.Tree;

  const toggleFaq = (index) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const handleGetStarted = (planName) => {
    const token = localStorage.getItem("token");
    if (token) {
      window.location.href = `/dashboard/hosting?plan=${encodeURIComponent(planName.toLowerCase())}&term=${selectedTerm}`;
    } else {
      window.location.href = "/login";
    }
  };

  const faqs = [
    {
      question: "What is Web Hosting and how does it work?",
      answer: "Web hosting is an online service that allows you to publish your website files onto the internet. When you purchase a web hosting plan, you rent space on a physical server to store all your website data."
    },
    {
      question: "Can I upgrade from the Lite plan to the Pro plan later?",
      answer: "Yes! You can upgrade your hosting plan anytime directly from your console dashboard without any downtime or loss of files."
    },
    {
      question: "Do you include free SSL certificates with all hosting plans?",
      answer: "Absolutely. All web hosting plans come with automated Let's Encrypt SSL certificates that keep your visitors safe and boost your Google SEO rankings."
    },
    {
      question: "How long does it take for my web hosting to activate?",
      answer: "Instant provisioning! As soon as you purchase your plan in the console, your hosting account is ready to use immediately."
    },
    {
      question: "What kind of customer support do you offer?",
      answer: "We provide 24/7 technical support via ticket and email. Our cloud engineers are always ready to help you with migrations, configurations, and inquiries."
    }
  ];

  const features = [
    {
      icon: <Zap size={24} />,
      title: "Ultra-Fast NVMe Storage",
      desc: "Blazing fast NVMe SSD storage delivers up to 10x faster page loading speeds for your websites."
    },
    {
      icon: <Shield size={24} />,
      title: "Free SSL & Security",
      desc: "Every website hosted on Buttr Cloud includes automated SSL protection and active DDoS defense."
    },
    {
      icon: <Server size={24} />,
      title: "99.9% Uptime Guarantee",
      desc: "Our high-availability infrastructure ensures your website stays accessible to customers around the clock."
    },
    {
      icon: <Globe size={24} />,
      title: "Custom Domain Support",
      desc: "Easily attach your existing custom domains or register new ones directly from your dashboard."
    },
    {
      icon: <HardDrive size={24} />,
      title: "Automated Daily Backups",
      desc: "Rest easy knowing your database and website files are backed up automatically every single day."
    },
    {
      icon: <Clock size={24} />,
      title: "24/7 Expert Support",
      desc: "Our dedicated support team is available 24/7 to solve your hosting issues quickly and efficiently."
    }
  ];

  return (
    <div className="webhosting-page">
      {/* Hero Section */}
      <section className="webhosting-hero">
        <div className="webhosting-container">
          <span className="webhosting-hero-badge">Web Hosting & Wordpress</span>
          <h1 className="webhosting-hero-title">
            Fast, Reliable & Managed Web Hosting
          </h1>
          <p className="webhosting-hero-subtitle">
            High performance NVMe SSD storage, free SSL certificates, 1-click site management, and 24/7 expert support built for modern websites.
          </p>
          <a href="#plans" className="webhosting-hero-cta">
            View Hosting Plans
          </a>
        </div>
      </section>

      {/* Buttr Guarantee Section */}
      <ButtrGuarantee />

      {/* Plans Section */}
      <section className="webhosting-plans-section" id="plans">
        <div className="webhosting-container">
          <h2 className="webhosting-section-title">Choose Your Hosting Plan</h2>
          <p className="webhosting-section-subtitle">
            Simple, transparent pricing designed to grow with your website.
          </p>

          {/* Payment Term Selector */}
          <div className="webhosting-term-selector-wrapper">
            <span className="webhosting-term-label">Payment Term:</span>
            <div className="webhosting-term-pills">
              {PAYMENT_TERMS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`webhosting-term-btn ${selectedTerm === t.id ? "active" : ""}`}
                  onClick={() => setSelectedTerm(t.id)}
                >
                  <span className="term-btn-title">{t.label}</span>
                  {t.discount && <span className="term-btn-badge">{t.discount}</span>}
                </button>
              ))}
            </div>
          </div>

          <div className="webhosting-plans-grid">
            {/* Seed Plan */}
            <div className="hosting-plan-card">
              <h3 className="hosting-plan-name">Seed</h3>
              <p className="hosting-plan-desc">
                Plant the seed for your online journey. Perfect for single websites, landing pages, and personal blogs.
              </p>

              <div className="hosting-price-container">
                <div className="hosting-was-price">Was ₹{TERM_PRICES.Seed[selectedTerm].was}</div>
                <div className="hosting-current-price">
                  <span className="hosting-price-amount">₹{TERM_PRICES.Seed[selectedTerm].monthly}</span>
                  <span className="hosting-price-period">/ month</span>
                </div>
                <div className="hosting-price-term">{TERM_PRICES.Seed[selectedTerm].termNote}</div>
              </div>

              <button
                className="hosting-btn hosting-btn-secondary"
                onClick={() => handleGetStarted("Seed")}
              >
                Get Started
              </button>

              <ul className="hosting-features-list">
                <li className="hosting-feature-item">
                  <span className="check-icon-circle"><Check size={13} strokeWidth={3} /></span>
                  <span><strong>1 website</strong></span>
                </li>
                <li className="hosting-feature-item">
                  <span className="check-icon-circle"><Check size={13} strokeWidth={3} /></span>
                  <span><strong>10GB NVMe SSD</strong> storage</span>
                </li>
                <li className="hosting-feature-item">
                  <span className="check-icon-circle"><Check size={13} strokeWidth={3} /></span>
                  <span><strong>Unlimited</strong> bandwidth</span>
                </li>
                <li className="hosting-feature-item">
                  <span className="check-icon-circle"><Check size={13} strokeWidth={3} /></span>
                  <span><strong>5 email</strong> accounts</span>
                </li>
                <li className="hosting-feature-item">
                  <span className="check-icon-circle"><Check size={13} strokeWidth={3} /></span>
                  <span><strong>1GB</strong> virtual memory</span>
                </li>
                <li className="hosting-feature-item">
                  <span className="check-icon-circle"><Check size={13} strokeWidth={3} /></span>
                  <span><strong>Free SSL</strong> certificate</span>
                </li>
                <li className="hosting-feature-item">
                  <span className="check-icon-circle"><Check size={13} strokeWidth={3} /></span>
                  <span>24/7 Support</span>
                </li>
              </ul>
            </div>

            {/* Tree Plan */}
            <div className="hosting-plan-card featured">
              <div className="hosting-card-badge">Special Offer</div>
              <h3 className="hosting-plan-name">Tree</h3>
              <p className="hosting-plan-desc">
                Branch out with more power. Ideal for growing businesses, portfolios, and multi-site projects.
              </p>

              <div className="hosting-price-container">
                <div className="hosting-was-price">Was ₹{TERM_PRICES.Tree[selectedTerm].was}</div>
                <div className="hosting-current-price">
                  <span className="hosting-price-amount">₹{TERM_PRICES.Tree[selectedTerm].monthly}</span>
                  <span className="hosting-price-period">/ month</span>
                </div>
                <div className="hosting-price-term">{TERM_PRICES.Tree[selectedTerm].termNote}</div>
              </div>

              <button
                className="hosting-btn hosting-btn-primary"
                onClick={() => handleGetStarted("Tree")}
              >
                Get Started
              </button>

              <ul className="hosting-features-list">
                <li className="hosting-feature-item">
                  <span className="check-icon-circle"><Check size={13} strokeWidth={3} /></span>
                  <span>Up to <strong>10 websites</strong></span>
                </li>
                <li className="hosting-feature-item">
                  <span className="check-icon-circle"><Check size={13} strokeWidth={3} /></span>
                  <span><strong>50GB NVMe SSD</strong> storage</span>
                </li>
                <li className="hosting-feature-item">
                  <span className="check-icon-circle"><Check size={13} strokeWidth={3} /></span>
                  <span><strong>Unlimited</strong> bandwidth</span>
                </li>
                <li className="hosting-feature-item">
                  <span className="check-icon-circle"><Check size={13} strokeWidth={3} /></span>
                  <span><strong>Unlimited email</strong> accounts</span>
                </li>
                <li className="hosting-feature-item">
                  <span className="check-icon-circle"><Check size={13} strokeWidth={3} /></span>
                  <span><strong>2GB</strong> virtual memory</span>
                </li>
                <li className="hosting-feature-item">
                  <span className="check-icon-circle"><Check size={13} strokeWidth={3} /></span>
                  <span><strong>Free SSL & Domain</strong> included</span>
                </li>
                <li className="hosting-feature-item">
                  <span className="check-icon-circle"><Check size={13} strokeWidth={3} /></span>
                  <span>24/7 Support & Auto-Backups</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="webhosting-features-section">
        <div className="webhosting-container">
          <h2 className="webhosting-section-title">Built for Performance & Peace of Mind</h2>
          <p className="webhosting-section-subtitle">Everything you need to run your website effortlessly.</p>

          <div className="features-grid-3col">
            {features.map((feature, idx) => (
              <div className="webhosting-feature-card" key={idx}>
                <div className="webhosting-feature-icon">{feature.icon}</div>
                <h3>{feature.title}</h3>
                <p>{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="webhosting-faq-section">
        <div className="webhosting-container">
          <h2 className="webhosting-section-title">Frequently Asked Questions</h2>
          <p className="webhosting-section-subtitle">Got questions about our web hosting? We've got answers.</p>

          <div className="faq-accordion">
            {faqs.map((faq, idx) => (
              <div className="faq-item" key={idx}>
                <button className="faq-question" onClick={() => toggleFaq(idx)}>
                  <span>{faq.question}</span>
                  {openFaq === idx ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </button>
                {openFaq === idx && (
                  <div className="faq-answer">
                    {faq.answer}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default WebHosting;
