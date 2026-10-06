import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Check, Shield, Globe, Lock, CreditCard, ArrowRight, AlertCircle, CheckCircle2, RefreshCw } from "lucide-react";
import "./HostingPurchase.css";

const API_URL = process.env.REACT_APP_API_URL || "";

const PLANS = {
  seed: {
    id: "seed",
    name: "Seed",
    tagline: "Single site & starter projects",
    basePrice: 159,
    gstRate: 0.18,
    gstAmount: 28.62,
    totalPrice: 187.62,
    features: [
      "1 website hosted",
      "10GB SSD storage",
      "Unlimited bandwidth",
      "5 professional email accounts",
      "Free SSL certificate included",
      "24/7 technical support"
    ]
  },
  tree: {
    id: "tree",
    name: "Tree",
    tagline: "High power for growing & multi-site businesses",
    basePrice: 259,
    gstRate: 0.18,
    gstAmount: 46.62,
    totalPrice: 305.62,
    popular: true,
    features: [
      "Up to 10 websites hosted",
      "50GB SSD storage",
      "Unlimited bandwidth",
      "Unlimited email accounts",
      "Free SSL & Domain included",
      "24/7 priority support & auto-backups"
    ]
  }
};

const HostingPurchase = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Read URL query parameters
  const initialPlan = (searchParams.get("plan") || "seed").toLowerCase();
  const [selectedPlanKey, setSelectedPlanKey] = useState(PLANS[initialPlan] ? initialPlan : "seed");
  const [domain, setDomain] = useState(searchParams.get("domain") || "");
  const [domainError, setDomainError] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Payment status callback from CCAvenue
  const paymentStatus = searchParams.get("payment_status");
  const orderId = searchParams.get("order_id");
  const confirmedDomain = searchParams.get("domain");
  const confirmedPlan = searchParams.get("plan");
  const failureReason = searchParams.get("reason");

  // Admin plan availability (Settings → Plan availability / All plans out of stock).
  const [availability, setAvailability] = useState(null);
  useEffect(() => {
    fetch("/api/settings/public").then((r) => r.json()).then((s) => setAvailability(s.planAvailability?.hosting || null)).catch(() => {});
  }, []);
  const inStock = (p) => !availability || availability[p.name] !== false;
  const allOut = Boolean(availability) && !Object.values(PLANS).some(inStock);
  useEffect(() => {
    // If the chosen plan is out of stock, move to one that isn't.
    const current = PLANS[selectedPlanKey];
    if (current && !inStock(current)) {
      const next = Object.values(PLANS).find(inStock);
      if (next) setSelectedPlanKey(next.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availability]);

  const plan = PLANS[selectedPlanKey] || PLANS.seed;

  // Restore draft purchase if returning from sign-in
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem("pending_hosting_draft");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.plan && PLANS[parsed.plan]) setSelectedPlanKey(parsed.plan);
        if (parsed.domain && !domain) setDomain(parsed.domain);
        sessionStorage.removeItem("pending_hosting_draft");
      }
    } catch (e) {
      // Ignore parse errors
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const validateDomain = (d) => {
    const clean = (d || "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/+$/, "");
    if (!clean) return "Please enter your domain name";
    if (!clean.includes(".") || clean.length < 4) {
      return "Please enter a valid domain (e.g. yourdomain.com)";
    }
    const regex = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/;
    if (!regex.test(clean)) {
      return "Invalid domain format. Use alphanumeric characters and hyphens only.";
    }
    return "";
  };

  const handleDomainChange = (e) => {
    const val = e.target.value;
    setDomain(val);
    if (domainError) setDomainError("");
    if (errorMessage) setErrorMessage("");
  };

  const handleProceedToPayment = async () => {
    const validation = validateDomain(domain);
    if (validation) {
      setDomainError(validation);
      return;
    }

    const cleanDomain = domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/+$/, "");
    const token = localStorage.getItem("token");

    // If user is not logged in, preserve state and send to sign-in
    if (!token) {
      sessionStorage.setItem("pending_hosting_draft", JSON.stringify({
        plan: selectedPlanKey,
        domain: cleanDomain
      }));
      const returnUrl = `/web-hosting/purchase?plan=${selectedPlanKey}&domain=${encodeURIComponent(cleanDomain)}`;
      navigate(`/login?returnTo=${encodeURIComponent(returnUrl)}`);
      return;
    }

    setLoading(true);
    setErrorMessage("");

    try {
      const response = await fetch(`${API_URL}/api/hosting/initiate-payment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          planName: plan.name,
          domain: cleanDomain,
          billingCycle: "1 Month"
        })
      });

      const data = await response.json();

      if (!response.ok || !data.encRequest) {
        setErrorMessage(data.error || "Failed to initiate payment session. Please try again.");
        setLoading(false);
        return;
      }

      // Automatically construct and submit hidden form to CCAvenue
      const form = document.createElement("form");
      form.method = "POST";
      form.action = data.actionUrl;

      const encInput = document.createElement("input");
      encInput.type = "hidden";
      encInput.name = "encRequest";
      encInput.value = data.encRequest;
      form.appendChild(encInput);

      const accessInput = document.createElement("input");
      accessInput.type = "hidden";
      accessInput.name = "access_code";
      accessInput.value = data.accessCode;
      form.appendChild(accessInput);

      document.body.appendChild(form);
      form.submit();
    } catch (err) {
      console.error("[Hosting Direct Payment] Error:", err);
      setErrorMessage("Network error connecting to payment gateway. Please try again.");
      setLoading(false);
    }
  };

  // ==========================================================
  // SUCCESS SCREEN
  // ==========================================================
  if (paymentStatus === "success") {
    return (
      <div className="hosting-purchase-page">
        <div className="purchase-container">
          <div className="purchase-success-card">
            <div className="success-icon-wrap">
              <CheckCircle2 size={56} className="success-icon" />
            </div>
            <span className="success-kicker">Payment Successful</span>
            <h1 className="success-title">Web Hosting Activated!</h1>
            <p className="success-desc">
              Your <strong>{confirmedPlan || "Web"} Hosting</strong> account for <strong>{confirmedDomain || "your domain"}</strong> is ready and active.
            </p>

            <div className="success-details-box">
              <div className="success-detail-row">
                <span>Domain</span>
                <strong>{confirmedDomain || "Registered"}</strong>
              </div>
              <div className="success-detail-row">
                <span>Plan</span>
                <strong>{confirmedPlan || "Web Hosting"}</strong>
              </div>
              {orderId && (
                <div className="success-detail-row">
                  <span>Order Reference</span>
                  <code>{orderId}</code>
                </div>
              )}
              <div className="success-detail-row">
                <span>Provisioning</span>
                <span className="status-badge-active">Active</span>
              </div>
            </div>

            <div className="success-actions">
              <a href="/dashboard/hosting" className="purchase-cta-btn">
                <span>Go to Hosting Console</span>
                <ArrowRight size={18} />
              </a>
              <a href="/dashboard" className="purchase-link-btn">
                Dashboard Overview
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================================
  // MAIN PURCHASE CHECKOUT VIEW
  // ==========================================================
  return (
    <div className="hosting-purchase-page">
      <div className="purchase-container">
        {/* Header */}
        <div className="purchase-header">
          <span className="purchase-badge">Direct Hosting Purchase</span>
          <h1 className="purchase-title">Order High-Speed Web Hosting</h1>
          <p className="purchase-subtitle">
            Enter your domain, review your plan pricing, and pay directly via UPI, Net Banking, or Cards. No wallet balance needed.
          </p>
        </div>

        {/* Failure / Cancel Banner */}
        {paymentStatus === "failed" && (
          <div className="purchase-alert-banner alert-danger">
            <AlertCircle size={20} />
            <div className="alert-text">
              <strong>Payment Incomplete:</strong> {failureReason || "Transaction could not be completed."} You can try again below.
            </div>
          </div>
        )}

        {paymentStatus === "cancelled" && (
          <div className="purchase-alert-banner alert-warning">
            <AlertCircle size={20} />
            <div className="alert-text">
              <strong>Payment Cancelled:</strong> The transaction was cancelled on the payment gateway. You can re-enter your details and try again.
            </div>
          </div>
        )}

        {errorMessage && (
          <div className="purchase-alert-banner alert-danger">
            <AlertCircle size={20} />
            <div className="alert-text">{errorMessage}</div>
          </div>
        )}

        <div className="purchase-layout-grid">
          {/* LEFT: Plan Selector & Domain Input */}
          <div className="purchase-left-col">
            {/* Step 1: Select Plan */}
            <div className="purchase-section-card">
              <div className="step-header">
                <span className="step-number">1</span>
                <h2>Select Your Web Hosting Plan</h2>
              </div>

              <div className="plan-selection-toggle">
                {Object.values(PLANS).map((p) => {
                  const available = inStock(p);
                  const isSelected = selectedPlanKey === p.id && available;
                  return (
                    <div
                      key={p.id}
                      className={`plan-option-card ${isSelected ? "is-selected" : ""} ${p.popular ? "is-popular" : ""}`}
                      onClick={() => available && setSelectedPlanKey(p.id)}
                      style={available ? undefined : { opacity: 0.55, cursor: "not-allowed" }}
                      aria-disabled={!available}
                    >
                      {p.popular && available && <span className="option-popular-tag">Popular</span>}
                      {!available && <span className="option-popular-tag" style={{ background: "#e7e7ea", color: "#5d5d60" }}>Out of stock</span>}
                      <div className="plan-option-radio">
                        <div className={`radio-dot ${isSelected ? "checked" : ""}`} />
                      </div>
                      <div className="plan-option-info">
                        <div className="plan-option-name">{p.name}</div>
                        <div className="plan-option-tagline">{p.tagline}</div>
                      </div>
                      <div className="plan-option-price-col">
                        <div className="plan-option-price">₹{p.basePrice}</div>
                        <div className="plan-option-tax">+ GST / mo</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="plan-features-summary">
                <h4>Included in {plan.name} Plan:</h4>
                <ul className="features-checklist">
                  {plan.features.map((feat, idx) => (
                    <li key={idx}>
                      <Check size={15} className="feat-check-icon" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Step 2: Primary Domain */}
            <div className="purchase-section-card">
              <div className="step-header">
                <span className="step-number">2</span>
                <h2>Enter Your Primary Domain Name</h2>
              </div>
              <p className="step-helper-text">
                Enter the domain name you want this hosting plan attached to. You can point an existing domain or one registered anywhere.
              </p>

              <div className="domain-input-wrapper">
                <Globe size={18} className="domain-input-icon" />
                <input
                  type="text"
                  className={`domain-text-input ${domainError ? "has-error" : ""}`}
                  placeholder="e.g. mycompany.com or brandname.in"
                  value={domain}
                  onChange={handleDomainChange}
                  autoComplete="off"
                  autoFocus
                />
              </div>
              {domainError && <span className="domain-error-msg">{domainError}</span>}
            </div>
          </div>

          {/* RIGHT: Price & Checkout Summary */}
          <div className="purchase-right-col">
            <div className="checkout-summary-card">
              <h3 className="summary-title">Order Summary</h3>

              <div className="summary-plan-banner">
                <div>
                  <div className="summary-plan-name">{plan.name} Hosting</div>
                  <div className="summary-domain-preview">
                    {domain.trim() ? domain.trim().toLowerCase() : "No domain specified yet"}
                  </div>
                </div>
                <div className="summary-term-badge">Monthly</div>
              </div>

              <div className="price-breakdown-rows">
                <div className="breakdown-row">
                  <span>Plan Price</span>
                  <span>₹{plan.basePrice.toFixed(2)}</span>
                </div>

                <div className="breakdown-row gst-row">
                  <div className="gst-label-wrap">
                    <span>GST (18%)</span>
                    <span className="gst-tag">Web Hosting Only</span>
                  </div>
                  <span>₹{plan.gstAmount.toFixed(2)}</span>
                </div>

                <div className="breakdown-divider" />

                <div className="breakdown-row total-row">
                  <div>
                    <strong>Total Payable</strong>
                    <div className="total-note">Plan Price + 18% GST</div>
                  </div>
                  <div className="total-amount">₹{plan.totalPrice.toFixed(2)}</div>
                </div>
              </div>

              {/* Direct Payment Button */}
              <button
                type="button"
                className="purchase-cta-btn"
                onClick={handleProceedToPayment}
                disabled={loading || allOut || !inStock(plan)}
              >
                {allOut || !inStock(plan) ? (
                  <span>Out of stock</span>
                ) : loading ? (
                  <>
                    <RefreshCw size={18} className="spinning-icon" />
                    <span>Connecting to Payment...</span>
                  </>
                ) : (
                  <>
                    <CreditCard size={18} />
                    <span>Pay ₹{plan.totalPrice.toFixed(2)} & Activate</span>
                    <ArrowRight size={18} />
                  </>
                )}
              </button>

              <div className="payment-security-note">
                <Lock size={14} />
                <span>Instant activation via CCAvenue (UPI, Debit/Credit Card, Net Banking)</span>
              </div>

              <div className="guarantee-box">
                <Shield size={16} className="guarantee-icon" />
                <span>Zero wallet balance required. Direct, secure checkout with 30-day money-back guarantee.</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HostingPurchase;
