import React, { useState, useEffect } from "react";
import { Check, ShoppingCart, Wallet, ExternalLink, Key, Shield, AlertCircle, Server, RefreshCw, Copy } from "lucide-react";
import "./HostingConsole.css";

const HostingConsole = () => {
  const [walletBalance, setWalletBalance] = useState(0);
  const [userAccounts, setUserAccounts] = useState([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [domainNames, setDomainNames] = useState({ Lite: "", Pro: "" });
  const [isDeploying, setIsDeploying] = useState(false);
  const [modalState, setModalState] = useState({ open: false, type: "", plan: null, data: null });
  const [copiedField, setCopiedField] = useState(null);
  const [statusMessage, setStatusMessage] = useState(null);

  const API_URL = "https://buttr.cloud";

  useEffect(() => {
    fetchWalletBalance();
    fetchUserHosting();
  }, []);

  const fetchWalletBalance = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const response = await fetch(`${API_URL}/api/wallet`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });
      const data = await response.json();
      if (response.ok) {
        setWalletBalance(parseFloat(data.balance) || 0);
      }
    } catch (err) {
      console.error("Error fetching wallet:", err);
    }
  };

  const fetchUserHosting = async () => {
    setLoadingAccounts(true);
    const token = localStorage.getItem("token");
    if (!token) {
      setLoadingAccounts(false);
      return;
    }
    try {
      const response = await fetch(`${API_URL}/api/hosting`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });
      const data = await response.json();
      if (response.ok) {
        setUserAccounts(data.hostingAccounts || []);
      }
    } catch (err) {
      console.error("Error fetching hosting accounts:", err);
    } finally {
      setLoadingAccounts(false);
    }
  };

  const [selectedTerm, setSelectedTerm] = useState("12"); // "1", "6", "12", "36"

  const PAYMENT_TERMS = [
    { id: "1", label: "1 Month", months: 1, discount: null },
    { id: "6", label: "6 Months", months: 6, discount: "Save 5%" },
    { id: "12", label: "12 Months", months: 12, discount: "Save 10% · Popular" },
    { id: "36", label: "36 Months", months: 36, discount: "Save 15% · Best Value" }
  ];

  const TERM_PRICES = {
    Lite: {
      "1": { monthly: 99, wasMonthly: 149, total: 99, note: "Billed ₹99 for 1 Month" },
      "6": { monthly: 94, wasMonthly: 149, total: 564, note: "Billed ₹564 for 6 Months (5% off)" },
      "12": { monthly: 89, wasMonthly: 149, total: 1069, note: "Billed ₹1,069 for 12 Months (10% off)" },
      "36": { monthly: 84, wasMonthly: 149, total: 3029, note: "Billed ₹3,029 for 36 Months (15% off)" }
    },
    Pro: {
      "1": { monthly: 179, wasMonthly: 299, total: 179, note: "Billed ₹179 for 1 Month" },
      "6": { monthly: 170, wasMonthly: 299, total: 1020, note: "Billed ₹1,020 for 6 Months (5% off)" },
      "12": { monthly: 161, wasMonthly: 299, total: 1933, note: "Billed ₹1,933 for 12 Months (10% off)" },
      "36": { monthly: 152, wasMonthly: 299, total: 5477, note: "Billed ₹5,477 for 36 Months (15% off)" }
    }
  };

  const plans = [
    {
      id: "lite",
      name: "Lite",
      featured: false,
      description: "Good things come in small packages. Simple requirements don't need huge resources.",
      features: [
        "1 website",
        "10GB NVMe SSD storage",
        "Unlimited bandwidth",
        "5 email accounts",
        "1GB virtual memory",
        "Free SSL certificate",
        "24/7 Expert support"
      ]
    },
    {
      id: "pro",
      name: "Pro",
      featured: true,
      badge: "Special Offer",
      description: "Our most popular hosting plan. High speed and dedicated resources for growing sites.",
      features: [
        "Up to 10 websites",
        "50GB NVMe SSD storage",
        "Unlimited bandwidth",
        "Unlimited email accounts",
        "2GB virtual memory",
        "Free SSL & Domain included",
        "24/7 Support & Daily Backups"
      ]
    }
  ];

  const handleDomainChange = (planName, val) => {
    setDomainNames(prev => ({ ...prev, [planName]: val }));
  };

  const handleBuyClick = (plan) => {
    const domain = domainNames[plan.name] || "";
    if (!domain.trim()) {
      alert(`Please enter a domain name for your ${plan.name} Web Hosting plan.`);
      return;
    }

    const currentPricing = TERM_PRICES[plan.name][selectedTerm];
    const totalRequired = currentPricing.total;

    if (walletBalance < totalRequired) {
      setModalState({
        open: true,
        type: "low_balance",
        plan: plan,
        requiredAmount: totalRequired,
        term: PAYMENT_TERMS.find(t => t.id === selectedTerm)
      });
      return;
    }

    setModalState({
      open: true,
      type: "confirm_buy",
      plan: plan,
      pricing: currentPricing,
      term: PAYMENT_TERMS.find(t => t.id === selectedTerm)
    });
  };

  const confirmPurchase = async () => {
    const plan = modalState.plan;
    if (!plan) return;

    setIsDeploying(true);
    const token = localStorage.getItem("token");
    const domain = domainNames[plan.name] || "my-web-hosting.com";
    const termLabel = modalState.term?.label || "12 Months";

    try {
      const response = await fetch(`${API_URL}/api/hosting/buy`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          planName: plan.name,
          domain: domain,
          billingCycle: termLabel
        })
      });

      const result = await response.json();

      if (response.ok) {
        setModalState({ open: false, type: "", plan: null });
        setStatusMessage({
          type: "success",
          text: `🎉 Plan activated! Your ${plan.name} Web Hosting for ${domain} is ready.`
        });
        setDomainNames(prev => ({ ...prev, [plan.name]: "" }));
        fetchWalletBalance();
        fetchUserHosting();
      } else {
        alert(result.error || "Purchase failed. Please try again.");
      }
    } catch (err) {
      console.error("Hosting purchase failed:", err);
      alert("Error processing purchase. Please check your balance or try again.");
    } finally {
      setIsDeploying(false);
    }
  };

  const handleCpanelLogin = async (accountId) => {
    const token = localStorage.getItem("token");
    try {
      const response = await fetch(`${API_URL}/api/hosting/${accountId}/login`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });
      const data = await response.json();
      if (response.ok && data.url) {
        window.open(data.url, "_blank");
      } else {
        alert(data.error || "Unable to generate cPanel login session.");
      }
    } catch (err) {
      console.error("Login error:", err);
      alert("Error logging into cPanel.");
    }
  };

  const handleViewCredentials = async (accountId) => {
    const token = localStorage.getItem("token");
    try {
      const response = await fetch(`${API_URL}/api/hosting/${accountId}/credentials`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });
      const data = await response.json();
      if (response.ok) {
        setModalState({
          open: true,
          type: "credentials",
          data: data
        });
      } else {
        alert(data.error || "Could not retrieve credentials");
      }
    } catch (err) {
      console.error("Credentials error:", err);
    }
  };

  const copyToClipboard = (text, field) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "N/A";
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  };

  return (
    <div className="hosting-console">
      {/* Header */}
      <div className="hosting-console-header">
        <h1>Web Hosting & cPanel Management</h1>
        <p>Manage your active cPanel accounts or activate a new high-speed hosting plan.</p>
        
        <div className="hosting-console-wallet">
          <Wallet size={16} />
          <span>Available Wallet Balance: <strong>₹{walletBalance.toFixed(2)}</strong></span>
        </div>
      </div>

      {statusMessage && (
        <div className={`console-alert-banner ${statusMessage.type}`}>
          <span>{statusMessage.text}</span>
          <button onClick={() => setStatusMessage(null)}>✕</button>
        </div>
      )}

      {/* User's Purchased Hosting Accounts */}
      {userAccounts.length > 0 && (
        <div className="console-section">
          <div className="section-title-row">
            <h2>
              <Server size={20} />
              <span>My Active Hosting Plans</span>
            </h2>
            <button className="btn-refresh" onClick={fetchUserHosting} title="Refresh Accounts">
              <RefreshCw size={15} />
            </button>
          </div>

          <div className="hosting-table-container">
            <table className="hosting-accounts-table">
              <thead>
                <tr>
                  <th>Domain</th>
                  <th>Plan</th>
                  <th>cPanel Username</th>
                  <th>Status</th>
                  <th>Expires On</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {userAccounts.map((acc) => {
                  const isSuspended = acc.status === "suspended";
                  return (
                    <tr key={acc.id} className={isSuspended ? "row-suspended" : ""}>
                      <td>
                        <div className="domain-cell">
                          <strong className="domain-name">{acc.domain}</strong>
                          <span className="billing-cycle-tag">{acc.billing_cycle}</span>
                        </div>
                      </td>
                      <td>
                        <span className="plan-badge-tag">{acc.plan_name}</span>
                      </td>
                      <td>
                        <code className="cpanel-user-code">{acc.cpanel_username}</code>
                      </td>
                      <td>
                        <span className={`status-badge-pill ${acc.status}`}>
                          {acc.status === "active" ? "Active" : "Suspended"}
                        </span>
                        {acc.suspension_reason && (
                          <div className="suspend-reason-text">{acc.suspension_reason}</div>
                        )}
                      </td>
                      <td>
                        <span className="date-text">{formatDate(acc.expires_at)}</span>
                      </td>
                      <td>
                        <div className="action-buttons-group">
                          <button
                            className={`action-btn-cpanel ${isSuspended ? "disabled" : ""}`}
                            onClick={() => !isSuspended && handleCpanelLogin(acc.id)}
                            disabled={isSuspended}
                            title={isSuspended ? "Account suspended due to expiry" : "One-click login to cPanel"}
                          >
                            <ExternalLink size={14} />
                            <span>Login to cPanel</span>
                          </button>
                          <button
                            className="action-btn-creds"
                            onClick={() => handleViewCredentials(acc.id)}
                            title="View credentials & nameservers"
                          >
                            <Key size={14} />
                            <span>Details</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Available Plans Section */}
      <div className="console-section plans-available-section">
        <div className="section-title-row">
          <h2>
            <ShoppingCart size={20} />
            <span>{userAccounts.length > 0 ? "Activate Another Hosting Plan" : "Select Your Hosting Plan"}</span>
          </h2>
        </div>

        {/* Payment Term Selector */}
        <div className="payment-term-section">
          <span className="payment-term-label">Payment Term:</span>
          <div className="payment-term-pills">
            {PAYMENT_TERMS.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`payment-term-btn ${selectedTerm === t.id ? "active" : ""}`}
                onClick={() => setSelectedTerm(t.id)}
              >
                <span className="term-btn-title">{t.label}</span>
                {t.discount && <span className="term-btn-badge">{t.discount}</span>}
              </button>
            ))}
          </div>
        </div>

        <div className="hosting-console-grid">
          {plans.map((plan) => {
            const currentPricing = TERM_PRICES[plan.name][selectedTerm];
            return (
              <div
                key={plan.id}
                className={`console-plan-card ${plan.featured ? "featured" : ""}`}
              >
                {plan.badge && <div className="console-plan-badge">{plan.badge}</div>}

                <h2 className="console-plan-name">{plan.name}</h2>
                <p className="console-plan-desc">{plan.description}</p>

                <div className="console-price-box">
                  <div className="console-was-price">Was ₹{currentPricing.wasMonthly}</div>
                  <div className="console-current-price">
                    <span className="console-price-amount">₹{currentPricing.monthly}</span>
                    <span className="console-price-period">/ month</span>
                  </div>
                  <div className="console-term-billing-note">{currentPricing.note}</div>
                </div>

                <div className="console-input-group">
                  <label htmlFor={`domain-${plan.id}`}>Primary Domain Name</label>
                  <input
                    id={`domain-${plan.id}`}
                    type="text"
                    className="console-input"
                    placeholder="e.g. mywebsite.com"
                    value={domainNames[plan.name] || ""}
                    onChange={(e) => handleDomainChange(plan.name, e.target.value)}
                  />
                </div>

                <button
                  className={`console-buy-btn ${plan.featured ? "console-buy-btn-primary" : "console-buy-btn-secondary"}`}
                  onClick={() => handleBuyClick(plan)}
                >
                  <ShoppingCart size={18} />
                  <span>Buy {plan.name} Plan (₹{currentPricing.total})</span>
                </button>

                <ul className="console-features-list">
                  {plan.features.map((feat, idx) => (
                    <li key={idx} className="console-feature-item">
                      <span className="console-check-icon">
                        <Check size={12} strokeWidth={3} />
                      </span>
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modals */}
      {modalState.open && modalState.type === "low_balance" && (
        <div className="console-modal-overlay">
          <div className="console-modal">
            <h3>Insufficient Wallet Balance</h3>
            <p>
              Your wallet balance is <strong>₹{walletBalance.toFixed(2)}</strong>. You need at least <strong>₹{modalState.requiredAmount}</strong> to activate the {modalState.plan?.name} hosting plan for <strong>{modalState.term?.label}</strong>.
            </p>
            <div className="console-modal-actions">
              <button
                className="console-modal-btn console-modal-btn-cancel"
                onClick={() => setModalState({ open: false, type: "", plan: null })}
              >
                Cancel
              </button>
              <a
                href="/dashboard/wallet"
                className="console-modal-btn console-modal-btn-confirm"
              >
                Add Funds
              </a>
            </div>
          </div>
        </div>
      )}

      {modalState.open && modalState.type === "confirm_buy" && (
        <div className="console-modal-overlay">
          <div className="console-modal">
            <h3>Activate cPanel Hosting</h3>
            <p>
              You are activating the <strong>{modalState.plan?.name} Plan</strong> for domain <strong>{domainNames[modalState.plan?.name]}</strong> for <strong>{modalState.term?.label}</strong> at <strong>₹{modalState.pricing?.total}</strong> (₹{modalState.pricing?.monthly}/month).
            </p>
            <p className="cpanel-activation-note">
              Once paid, your cPanel account will be provisioned immediately and accessible directly from this page.
            </p>
            <div className="console-modal-actions">
              <button
                className="console-modal-btn console-modal-btn-cancel"
                onClick={() => setModalState({ open: false, type: "", plan: null })}
                disabled={isDeploying}
              >
                Cancel
              </button>
              <button
                className="console-modal-btn console-modal-btn-confirm"
                onClick={confirmPurchase}
                disabled={isDeploying}
              >
                {isDeploying ? "Provisioning cPanel..." : "Confirm & Pay"}
              </button>
            </div>
          </div>
        </div>
      )}

      {modalState.open && modalState.type === "credentials" && modalState.data && (
        <div className="console-modal-overlay">
          <div className="console-modal credentials-modal">
            <div className="modal-header-row">
              <h3>cPanel Credentials & Nameservers</h3>
              <button className="modal-close" onClick={() => setModalState({ open: false, type: "", data: null })}>✕</button>
            </div>

            <div className="creds-group">
              <label>Domain</label>
              <div className="creds-field">
                <span>{modalState.data.domain}</span>
              </div>
            </div>

            <div className="creds-group">
              <label>cPanel Username</label>
              <div className="creds-field">
                <code>{modalState.data.username}</code>
                <button
                  className="copy-btn"
                  onClick={() => copyToClipboard(modalState.data.username, "user")}
                >
                  {copiedField === "user" ? "Copied!" : <Copy size={14} />}
                </button>
              </div>
            </div>

            <div className="creds-group">
              <label>cPanel Password</label>
              <div className="creds-field">
                <code>{modalState.data.password}</code>
                <button
                  className="copy-btn"
                  onClick={() => copyToClipboard(modalState.data.password, "pass")}
                >
                  {copiedField === "pass" ? "Copied!" : <Copy size={14} />}
                </button>
              </div>
            </div>

            <div className="creds-group">
              <label>Direct cPanel URL</label>
              <div className="creds-field">
                <a href={modalState.data.cpanel_url} target="_blank" rel="noreferrer">
                  {modalState.data.cpanel_url}
                </a>
              </div>
            </div>

            <div className="creds-group">
              <label>Nameservers to point your domain</label>
              <div className="nameserver-box">
                {modalState.data.nameservers?.map((ns, i) => (
                  <div key={i} className="ns-item">
                    <span>{ns}</span>
                    <button
                      className="copy-btn"
                      onClick={() => copyToClipboard(ns, `ns${i}`)}
                    >
                      {copiedField === `ns${i}` ? "Copied!" : <Copy size={12} />}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="console-modal-actions">
              <button
                className="console-modal-btn console-modal-btn-confirm"
                onClick={() => setModalState({ open: false, type: "", data: null })}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HostingConsole;
