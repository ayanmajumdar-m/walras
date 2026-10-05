import React, { useState } from "react";
import { Search, AlertCircle, CheckCircle, XCircle, Loader2, Copy, Globe, Shield, Settings, Mail, Lock, Star, Zap, Users, Cloud, Sparkles } from 'lucide-react';
import WalrasGuarantee from "./Constants/WalrasGuarantee";
import "./DomainCheck.css";

const DomainCheck = () => {
  const [domain, setDomain] = useState("");
  const [transferDomain, setTransferDomain] = useState("");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [transferLoading, setTransferLoading] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState([]);
  const [copied, setCopied] = useState("");

  const checkDomain = async (e) => {
    e.preventDefault();
    if (!domain.trim()) return setError("Please enter a domain name");

    setLoading(true);
    setError("");
    setResults(null);

    const API_URL = ``

    try {
      const response = await fetch(
        `${API_URL}/api/users/domain-check?domain=${encodeURIComponent(domain.trim())}`
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "WHOIS check failed");
      }

      // Expecting normalized array from backend
      const result = Array.isArray(data.results) ? data.results[0] : data;

      setResults(result);
      setHistory((prev) => [
        { domain: domain.trim(), result, time: new Date() },
        ...prev.slice(0, 4),
      ]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  const handleTransfer = async (e) => {
    e.preventDefault();
    if (!transferDomain.trim()) return setError("Please enter a domain to transfer");

    setTransferLoading(true);
    setError("");

    try {
      // Transfer domain logic here
      console.log("Transferring domain:", transferDomain);
      alert(`Transfer process initiated for ${transferDomain}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setTransferLoading(false);
    }
  };

  const copyText = async (text, field) => {
    await navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(""), 2000);
  };

  const quickSearch = (quickDomain) => setDomain(quickDomain);

  const addToCart = (domainItem) => {
    try {
      const existing = JSON.parse(localStorage.getItem('cart') || '[]');
      existing.push(domainItem);
      localStorage.setItem('cart', JSON.stringify(existing));
      alert(`${domainItem.domain} added to cart`);
    } catch (err) {
      console.error('Add to cart error', err);
      alert('Failed to add to cart');
    }
  };

  const getStatus = (result) => {
    if (!result?.status) return "unknown";
    const status = result.status.toUpperCase();
    if (status === "AVAILABLE") return "available";
    if (status === "UNAVAILABLE") return "unavailable";
    return "unknown";
  };


  const StatusIcon = ({ status }) => ({
    available: <CheckCircle size={24} className="text-blue-500" />,
    unavailable: <XCircle size={24} className="text-red-500" />,
    unknown: <AlertCircle size={24} className="text-yellow-500" />
  }[status]);

  const statusConfig = {
    available: { text: "This domain is available for registration!", color: "#1fc4a2" },
    unavailable: { text: "This domain is already registered", color: "#ef4444" },
    unknown: { text: "Unable to determine domain status", color: "#f59e0b" }
  };

  const quickDomains = [".com", ".in", ".org", ".net", ".io", ".co.in"];
  const tldPricing = [
    { name: ".com", price: "₹899/yr", popular: true },
    { name: ".in", price: "₹599/yr", popular: false },
    { name: ".org", price: "₹999/yr", popular: false },
    { name: ".dev", price: "₹1199/yr", popular: false },
    { name: ".co", price: "₹749/yr", popular: false },
    { name: ".ai", price: "₹5999/yr", popular: true }
  ];

  const features = [
    {
      icon: <Shield className="feature-icon" />,
      title: "Free WHOIS Privacy",
      description: "Mask your personal details from public directories with free lifetime privacy protection."
    },
    {
      icon: <Cloud className="feature-icon" />,
      title: "Easy DNS Management",
      description: "Complete control over DNS records with our intuitive control panel."
    },
    {
      icon: <Mail className="feature-icon" />,
      title: "Email Forwarding",
      description: "Create professional email aliases that forward to your existing inbox."
    },
    {
      icon: <Lock className="feature-icon" />,
      title: "Domain Lock",
      description: "Prevent unauthorized transfers with registry-level security lock."
    },
    {
      icon: <Zap className="feature-icon" />,
      title: "Fast Setup",
      description: "Get your domain up and running in minutes with instant activation."
    },
    {
      icon: <Users className="feature-icon" />,
      title: "24/7 Support",
      description: "Round-the-clock customer support to help you with any issues."
    }
  ];

  const DOMAIN_GUARANTEES = [
    {
      id: "privacy",
      icon: <Shield size={26} className="guarantee-icon" />,
      badge: "LIFETIME FREE",
      title: "Privacy Guaranteed",
      desc: "Free WHOIS privacy protection included with every domain. Keep your personal identity, contact details, and phone number 100% private from public scrapers and spammers."
    },
    {
      id: "lowest-price",
      icon: <Sparkles size={26} className="guarantee-icon" />,
      badge: "BEST RATE",
      title: "Lowest Price Possible",
      desc: "Rock-bottom prices across 500+ top-level domains. No hidden registration markups, transparent renewals, and no surprise price hikes."
    },
    {
      id: "dns-management",
      icon: <Settings size={26} className="guarantee-icon" />,
      badge: "COMING SOON",
      title: "DNS Management",
      desc: "Comprehensive Anycast DNS record management (A, CNAME, MX, TXT) with global edge propagation and 1-click cloud service linking coming soon."
    },
    {
      id: "business-mails",
      icon: <Mail size={26} className="guarantee-icon" />,
      badge: "COMING SOON",
      title: "Business Mails",
      desc: "Custom branded domain email addresses (you@yourdomain.com) with secure webmail, intelligent spam filters, and high inbox deliverability coming soon."
    }
  ];

  return (
    <div className="domain-check">
      {/* Hero Section */}
      <div className="domain-hero">
        <div className="hero-content">
          <div className="hero-icon-container">
            <Globe className="hero-icon" />
          </div>
          <h1>Claim Your Corner of the Internet</h1>
          <p>Fast, simple domain registration with free lifetime WHOIS privacy included.</p>
        </div>
      </div>

      {/* Main Search Section */}
      <div className="search-section">
        <form onSubmit={checkDomain} className="search-form">
          <div className="search-box">
            <div className="search-input-container">
              <Search size={20} className="search-icon" />
              <input
                type="text"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="Find your perfect domain name..."
                disabled={loading}
                className="search-input"
              />
            </div>
            <button type="submit" disabled={loading} className="search-btn">
              {loading ? <Loader2 className="spinner" size={16} /> : "Search Domain"}
            </button>
          </div>

          {/* <div className="quick-search">
            <span>Popular searches:</span>
            {quickDomains.map(ext => (
              <button key={ext} type="button" onClick={() => quickSearch(`example${ext}`)} className="quick-btn">
                example{ext}
              </button>
            ))}
          </div> */}
        </form>

        {/* Search Results - Appears below search bar */}
        {results && (
          <div className="search-results">
            <div className={`status-card ${getStatus(results)}`}>
              <div className="status-header">
                <StatusIcon status={getStatus(results)} />
                <div className="status-info">
                  <h3>{results.domain}</h3>
                  <p style={{ color: statusConfig[getStatus(results)].color }}>
                    {statusConfig[getStatus(results)].text}
                  </p>
                </div>
              </div>

              <div className="status-details">
                {results.registrar && (
                  <p><strong>Registrar:</strong> {results.registrar}</p>
                )}
                {results.createdDate && (
                  <p><strong>Created:</strong> {new Date(results.createdDate).toLocaleDateString()}</p>
                )}
                {results.expiresDate && (
                  <p><strong>Expires:</strong> {new Date(results.expiresDate).toLocaleDateString()}</p>
                )}
              </div>

              {getStatus(results) === "available" && (
                <div className="actions">
                  <button
                    className="primary-btn"
                    onClick={() => {
                      addToCart({
                        domain: results.domain,
                        price: results.price,
                        currency: results.currency,
                        period: results.period,
                      });
                      window.location.href = "/cart";
                    }}
                  >
                    Register Now – ₹{results.price}
                  </button>

                  <button
                    className="secondary-btn"
                    onClick={() =>
                      addToCart({
                        domain: results.domain,
                        price: results.price,
                        currency: results.currency,
                        period: results.period,
                      })
                    }
                  >
                    Add to Cart
                  </button>
                </div>
              )}
            </div>
          </div>
        )}


        {error && (
          <div className="error-message">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Walras Guarantee Section */}
      <WalrasGuarantee
        kicker="DOMAIN COMMITMENT"
        title="Walras Guarantee"
        subtitle="Our ironclad promises to secure, protect, and power your web presence."
        guarantees={DOMAIN_GUARANTEES}
      />

      {/* TLD Pricing */}
      <div className="tld-section">
        <div className="section-header">
          <h2>Transparent Pricing</h2>
          <p>No hidden fees. Simple upfront prices for your first year.</p>
        </div>
        <div className="tld-grid">
          {tldPricing.map((tld, index) => (
            <div key={index} className={`tld-card ${tld.popular ? 'popular' : ''}`}>
              {tld.popular && <div className="popular-badge">Most Popular</div>}
              <span className="tld-name">{tld.name}</span>
              <span className="tld-price">{tld.price}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Features */}
      <div className="domain-features-section">
        <div className="domain-section-header">
          <h2 className="domain-section-title">Everything Included</h2>
          <p className="domain-section-subtitle">All essential tools to manage your domain, completely free.</p>
        </div>
        <div className="domain-features-grid">
          {features.map((feature, index) => (
            <div key={index} className="domain-feature-card">
              <div className="domain-feature-icon">
                {feature.icon}
              </div>
              <h4 className="domain-feature-title">{feature.title}</h4>
              <p className="domain-feature-description">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Transfer Section */}
      <div className="transfer-section">
        <div className="section-header">
          <h2>Transfer Your Domain</h2>
          <p>Get an extra year free when you transfer to us.</p>
        </div>
        <form onSubmit={handleTransfer} className="search-form">
          <div className="search-box">
            <div className="search-input-container">
              <Search size={20} className="search-icon" />
              <input
                type="text"
                value={transferDomain}
                onChange={(e) => setTransferDomain(e.target.value)}
                placeholder="Enter domain to transfer..."
                disabled={transferLoading}
                className="search-input"
              />
            </div>
            <button type="submit" disabled={transferLoading} className="search-btn">
              {transferLoading ? <Loader2 className="spinner" size={16} /> : "Transfer"}
            </button>
          </div>
        </form>
      </div>

      {/* Recent Searches */}
      {history.length > 0 && (
        <div className="history-section">
          <h3>Recent Searches</h3>
          <div className="history-list">
            {history.map((search, i) => (
              <div key={i} className="history-item">
                <span className="domain-name">{search.domain}</span>
                <span className={`status-tag ${getStatus(search.result)}`}>
                  {getStatus(search.result) === "available" ? "Available" : "Taken"}
                </span>
                <button onClick={() => quickSearch(search.domain)} className="search-again-btn">
                  Search Again
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default DomainCheck;