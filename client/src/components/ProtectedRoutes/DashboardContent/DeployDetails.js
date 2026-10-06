import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./Dashboard.css";

const DeployDetails = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { selectedPlan, currency } = location.state || {};
  
  const [formData, setFormData] = useState({
    hostname: "",
    rootPassword: "",
    location: "london",
    os: "ubuntu-22.04",
    notes: ""
  });
  
  const [walletBalance, setWalletBalance] = useState(0);
  const [showLowBalancePopup, setShowLowBalancePopup] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [deploymentProgress, setDeploymentProgress] = useState(0);
  const API_URL = ``

  useEffect(() => {
    const fetchWalletBalance = async () => {
      const token = localStorage.getItem("token");
      try {
        const response = await fetch(`${API_URL}/api/wallet`, {
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
          }
        });
        const data = await response.json();
        if (response.ok) {
          setWalletBalance(parseFloat(data.balance) || 0);
        }
      } catch (error) {
        console.error("Error fetching wallet balance:", error);
        setWalletBalance(0);
      }
    };
    
    fetchWalletBalance();
  }, []);

  useEffect(() => {
    if (!selectedPlan) {
      navigate('/dashboard/deploy');
    }
  }, [selectedPlan, navigate]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const calculateMonthlyCost = () => {
    if (!selectedPlan) return 0;
    return currency === "INR" ? selectedPlan.inr : selectedPlan.usd;
  };

  const calculateHourlyCost = () => {
    if (!selectedPlan) return 0;
    return currency === "INR" ? selectedPlan.hourly_inr : selectedPlan.hourly_usd;
  };

  const validateForm = () => {
    if (!formData.hostname.trim()) {
      alert("Please enter a hostname");
      return false;
    }
    if (!formData.rootPassword.trim()) {
      alert("Please enter a root password");
      return false;
    }
    if (formData.rootPassword.length < 8) {
      alert("Password must be at least 8 characters long");
      return false;
    }
    return true;
  };

  const checkWalletBalance = () => {
    const minimumBalance = 500;
    if (walletBalance < minimumBalance) {
      setShowLowBalancePopup(true);
      return false;
    }
    return true;
  };

  const simulateDeployment = async () => {
    setIsDeploying(true);
    
    try {
      const token = localStorage.getItem("token");
      const deploymentData = {
        plan: selectedPlan,
        hostname: formData.hostname,
        rootPassword: formData.rootPassword,
        location: formData.location,
        os: formData.os,
        notes: formData.notes,
        currency: currency
      };
      
      // Simulate deployment progress
      const steps = [10, 25, 50, 75, 100];
      for (let i = 0; i < steps.length; i++) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        setDeploymentProgress(steps[i]);
      }
      const API_URL = ``
      // Call actual deployment API
      const response = await fetch(`${API_URL}/api/servers/deploy`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(deploymentData)
      });
      
      const result = await response.json();
      
      if (response.ok) {
        navigate('/dashboard', { 
          state: { 
            deploymentSuccess: true,
            serverName: formData.hostname,
            serverId: result.serverId
          } 
        });
      } else {
        throw new Error(result.error || "Deployment failed");
      }
      
    } catch (error) {
      console.error("Deployment failed:", error);
      alert("Deployment failed: " + error.message);
    } finally {
      setIsDeploying(false);
    }
  };

  const handleDeploy = async () => {
    if (!validateForm()) return;
    if (!checkWalletBalance()) return;
    
    await simulateDeployment();
  };

  const handleAddMoney = () => {
    setShowLowBalancePopup(false);
    navigate('/wallet');
  };

  if (!selectedPlan) {
    return (
      <div className="deploy-details-do dark-theme">
        <div className="loading-container-do">
          <div className="loading-spinner-do"></div>
          <p>Loading deployment details...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="deploy-details-do dark-theme">
      {/* Header */}
      <div className="header-do dark-header">
        <div className="header-content-do">
          <button 
            className="back-button-do dark-back-button"
            onClick={() => navigate('/deploy')}
          >
            ← Back to Plans
          </button>
          <h1>Create Your Server</h1>
          <p className="subtitle-do dark-subtitle">
            Deploy a new cloud server in a few seconds. Choose an image and plan.
          </p>
        </div>
      </div>

      <div className="deploy-content-do">
        {/* Left Column - Configuration */}
        <div className="config-section-do">
          {/* Basic Details */}
          <div className="config-card-do dark-card">
            <h2 className="config-title-do">Basic Details</h2>
            <div className="form-fields-do">
              <div className="form-group-do">
                <label htmlFor="hostname" className="form-label-do">Hostname</label>
                <input
                  type="text"
                  id="hostname"
                  name="hostname"
                  value={formData.hostname}
                  onChange={handleInputChange}
                  placeholder="Enter a hostname"
                  className="form-input-do dark-input"
                  required
                />
                <div className="form-hint-do dark-hint">Choose a unique name for your server</div>
              </div>
              
              <div className="form-group-do">
                <label htmlFor="rootPassword" className="form-label-do">Root Password</label>
                <input
                  type="password"
                  id="rootPassword"
                  name="rootPassword"
                  value={formData.rootPassword}
                  onChange={handleInputChange}
                  placeholder="Enter root password"
                  className="form-input-do dark-input"
                  required
                />
                <div className="form-hint-do dark-hint">Must be at least 8 characters long</div>
              </div>
            </div>
          </div>

          {/* Region Selection */}
          <div className="config-card-do dark-card">
            <h2 className="config-title-do">Choose a Region</h2>
            <p className="config-description-do dark-description">
              Regions are physical data centers around the world. 
              <a href="#" className="link-do blue-link"> Learn more about regions</a>
            </p>
            
            <div className="region-grid-do">
              <div 
                className={`region-card-do dark-region-card ${formData.location === 'london' ? 'region-card-active-do blue-active' : ''}`}
                onClick={() => setFormData(prev => ({...prev, location: 'london'}))}
              >
                <div className="region-header-do">
                  <span className="region-name-do">London, UK</span>
                  <div className="region-badge-do blue-badge">Recommended</div>
                </div>
                <div className="region-info-do">
                  <span className="region-flag-do">🇬🇧</span>
                  <div className="region-details-do">
                    <div className="region-specs-do dark-specs">
                      <span>Low latency</span>
                      <span>•</span>
                      <span>High availability</span>
                    </div>
                    <div className="region-status-do dark-status">12ms avg latency</div>
                  </div>
                </div>
              </div>

              <div className="region-card-do dark-region-card region-card-disabled-do">
                <div className="region-header-do">
                  <span className="region-name-do">Mumbai, IN</span>
                  <div className="region-badge-do region-badge-disabled-do">Coming Soon</div>
                </div>
                <div className="region-info-do">
                  <span className="region-flag-do">🇮🇳</span>
                  <div className="region-details-do">
                    <div className="region-specs-do dark-specs">
                      <span>South Asia</span>
                      <span>•</span>
                      <span>Local CDN</span>
                    </div>
                    <div className="region-status-do dark-status">~25ms latency</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Image Selection */}
          <div className="config-card-do dark-card">
            <h2 className="config-title-do">Choose an Image</h2>
            <p className="config-description-do dark-description">
              Select an operating system or create a server from a snapshot.
            </p>
            
            <div className="image-tabs-do dark-tabs">
              <button className="image-tab-do dark-tab dark-tab-active">Distributions</button>
              <button className="image-tab-do dark-tab">Marketplace</button>
              <button className="image-tab-do dark-tab">Snapshots</button>
              <button className="image-tab-do dark-tab">Backups</button>
            </div>

            <div className="image-grid-do">
              <div 
                className={`image-card-do dark-image-card ${formData.os === 'ubuntu-22.04' ? 'image-card-active-do blue-active' : ''}`}
                onClick={() => setFormData(prev => ({...prev, os: 'ubuntu-22.04'}))}
              >
                <div className="image-logo-do">🅄</div>
                <div className="image-info-do">
                  <h3>Ubuntu 22.04 LTS</h3>
                  <p className="dark-description">Jammy Jellyfish</p>
                  <div className="image-meta-do dark-meta">
                    <span>Extended support until 2032</span>
                  </div>
                </div>
                <div className="image-selector-do">
                  <div className="radio-do dark-radio">
                    <div className="radio-inner-do blue-radio-inner"></div>
                  </div>
                </div>
              </div>

              <div 
                className={`image-card-do dark-image-card ${formData.os === 'ubuntu-24.04' ? 'image-card-active-do blue-active' : ''}`}
                onClick={() => setFormData(prev => ({...prev, os: 'ubuntu-24.04'}))}
              >
                <div className="image-logo-do">🅄</div>
                <div className="image-info-do">
                  <h3>Ubuntu 24.04 LTS</h3>
                  <p className="dark-description">Noble Numbat</p>
                  <div className="image-meta-do dark-meta">
                    <span>Latest LTS release</span>
                  </div>
                </div>
                <div className="image-selector-do">
                  <div className="radio-do dark-radio">
                    <div className="radio-inner-do blue-radio-inner"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Additional Options */}
          <div className="config-card-do dark-card">
            <h2 className="config-title-do">Additional Options</h2>
            <div className="form-group-do">
              <label htmlFor="notes" className="form-label-do">Notes (Optional)</label>
              <textarea
                id="notes"
                name="notes"
                value={formData.notes}
                onChange={handleInputChange}
                placeholder="Add deployment notes or tags..."
                rows="3"
                className="form-textarea-do dark-textarea"
              />
              <div className="form-hint-do dark-hint">Use for team communication or project tracking</div>
            </div>
          </div>
        </div>

        {/* Right Column - Summary */}
        <div className="summary-section-do">
          <div className="summary-card-do dark-card">
            <div className="summary-header-do dark-summary-header">
              <h3>Server Summary</h3>
            </div>

            {/* Selected Plan */}
            <div className="summary-plan-do">
              <div className="plan-header-do">
                <h4>{selectedPlan.name}</h4>
                <div className="plan-price-do blue-price">
                  {currency === "INR" ? "₹" : "$"}{calculateHourlyCost().toFixed(2)}/hour
                </div>
              </div>
              
              <div className="plan-specs-do dark-specs">
                <div className="spec-row-do">
                  <span className="spec-label-do">CPU</span>
                  <span className="spec-value-do">{selectedPlan.vcpu} vCPUs</span>
                </div>
                <div className="spec-row-do">
                  <span className="spec-label-do">RAM</span>
                  <span className="spec-value-do">{selectedPlan.ram}</span>
                </div>
                <div className="spec-row-do">
                  <span className="spec-label-do">Storage</span>
                  <span className="spec-value-do">{selectedPlan.storage} SSD</span>
                </div>
                <div className="spec-row-do">
                  <span className="spec-label-do">Transfer</span>
                  <span className="spec-value-do">{selectedPlan.bandwidth}</span>
                </div>
              </div>
            </div>

            {/* Cost Breakdown */}
            <div className="cost-breakdown-do">
              <h4>Cost Breakdown</h4>
              <div className="cost-rows-do">
                <div className="cost-row-do dark-cost-row">
                  <span>Server</span>
                  <span>{currency === "INR" ? "₹" : "$"}{calculateHourlyCost().toFixed(2)}/hour</span>
                </div>
                <div className="cost-row-do dark-cost-row">
                  <span>Estimated Monthly</span>
                  <span>{currency === "INR" ? "₹" : "$"}{calculateMonthlyCost().toFixed(2)}/month</span>
                </div>
              </div>
              
              <div className="cost-total-do dark-cost-total">
                <span>First Hour Charge</span>
                <span className="total-amount-do blue-total">
                  {currency === "INR" ? "₹" : "$"}{calculateHourlyCost().toFixed(2)}
                </span>
              </div>
            </div>

            {/* Wallet Info */}
            <div className="wallet-section-do">
              <div className="wallet-balance-do dark-wallet-balance">
                <span>Account Balance</span>
                <span className="balance-amount-do">₹{walletBalance.toFixed(2)}</span>
              </div>
              {walletBalance < 500 && (
                <div className="balance-warning-do dark-warning">
                  <div className="warning-icon-do">⚠️</div>
                  <div className="warning-text-do">
                    <strong>Add funds to deploy</strong>
                    <span>Minimum ₹500 required</span>
                  </div>
                </div>
              )}
            </div>

            {/* Deploy Action */}
            <div className="deploy-action-do">
              <button
                className={`deploy-button-do blue-button ${walletBalance < 500 ? 'deploy-button-disabled-do' : ''} ${isDeploying ? 'deploy-button-deploying-do' : ''}`}
                onClick={handleDeploy}
                disabled={isDeploying || walletBalance < 500}
              >
                {isDeploying ? (
                  <>
                    <div className="button-spinner-do"></div>
                    Creating Server... {deploymentProgress}%
                  </>
                ) : (
                  `Create Server - ${currency === "INR" ? "₹" : "$"}${calculateHourlyCost().toFixed(2)}/hr`
                )}
              </button>

              {isDeploying && (
                <div className="deployment-progress-do">
                  <div className="progress-bar-do dark-progress-bar">
                    <div 
                      className="progress-fill-do blue-progress" 
                      style={{ width: `${deploymentProgress}%` }}
                    ></div>
                  </div>
                  <div className="progress-labels-do dark-labels">
                    <span>Provisioning</span>
                    <span>Networking</span>
                    <span>Finalizing</span>
                  </div>
                </div>
              )}

              <div className="deploy-note-do dark-note">
                <p>You'll be billed hourly. Servers are created in 55 seconds.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Low Balance Popup */}
      {showLowBalancePopup && (
        <div className="popup-overlay-do dark-overlay">
          <div className="popup-do dark-popup">
            <div className="popup-header-do dark-popup-header">
              <h3>Insufficient Balance</h3>
            </div>
            <div className="popup-content-do dark-popup-content">
              <p>You need at least <strong>₹500</strong> in your account balance to deploy a Server.</p>
              <p>Current balance: <strong>₹{walletBalance.toFixed(2)}</strong></p>
            </div>
            <div className="popup-actions-do">
              <button 
                className="popup-button-secondary-do dark-secondary-btn"
                onClick={() => setShowLowBalancePopup(false)}
              >
                Cancel
              </button>
              <button 
                className="popup-button-primary-do blue-button"
                onClick={handleAddMoney}
              >
                Add Funds
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeployDetails;