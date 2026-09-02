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

  const plans = [
    {
      id: "lite",
      name: "Lite",
      price: 149,
      wasPrice: 299,
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
      price: 349,
      wasPrice: 599,
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

    if (walletBalance < plan.price) {
      setModalState({
        open: true,
        type: "low_balance",
        plan: plan
      });
      return;
    }

    setModalState({
      open: true,
      type: "confirm_buy",
      plan: plan
    });
  };

  const confirmPurchase = async () => {
    const plan = modalState.plan;
    if (!plan) return;

    setIsDeploying(true);
    const token = localStorage.getItem("token");
    const domain = domainNames[plan.name] || "my-web-hosting.com";

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
          billingCycle: "monthly"
        })
      });

      const result = await response.json();

      if (response.ok) {
        setModalState({ open: false, type: "", plan: null });
        setStatusMessage({
          type: "success",
          text: `🎉 Package activated! Your ${plan.name} Web Hosting for ${domain} is ready.`
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
        <p>Manage your active cPanel accounts or activate a new high-speed hosting package.</p>
        
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
              <span>My Active Hosting Packages</span>
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
                  <th>Plan & Package</th>
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
                        <span className="package-subtext">({acc.cpanel_package})</span>
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
            <span>{userAccounts.length > 0 ? "Activate Another Hosting Package" : "Select Your Hosting Plan"}</span>
          </h2>
        </div>

        <div className="hosting-console-grid">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`console-plan-card ${plan.featured ? "featured" : ""}`}
            >
              {plan.badge && <div className="console-plan-badge">{plan.badge}</div>}

              <h2 className="console-plan-name">{plan.name}</h2>
              <p className="console-plan-desc">{plan.description}</p>

              <div className="console-price-box">
                <div className="console-was-price">Was ₹{plan.wasPrice}</div>
                <div className="console-current-price">
                  <span className="console-price-amount">₹{plan.price}</span>
                  <span className="console-price-period">/ month</span>
                </div>
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
                <span>Buy {plan.name} Plan</span>
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
          ))}
        </div>
      </div>

      {/* Modals */}
      {modalState.open && modalState.type === "low_balance" && (
        <div className="console-modal-overlay">
          <div className="console-modal">
            <h3>Insufficient Wallet Balance</h3>
            <p>
              Your wallet balance is <strong>₹{walletBalance.toFixed(2)}</strong>. You need at least <strong>₹{modalState.plan?.price}</strong> to activate the {modalState.plan?.name} hosting plan.
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
              You are activating the <strong>{modalState.plan?.name} Package</strong> for domain <strong>{domainNames[modalState.plan?.name]}</strong> at <strong>₹{modalState.plan?.price}/month</strong>.
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
