import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./DeployDetails.css";

const Deploy = () => {
  const [currency, setCurrency] = useState("INR");
  const navigate = useNavigate();

  // Current conversion rate (1 USD = ~83 INR)
  const USD_TO_INR_RATE = 83;

  const plans = [
    {
      id: 1,
      name: "SFC-4GB",
      inr: 900,
      usd: Math.round((900 / USD_TO_INR_RATE) * 100) / 100, // ~10.84
      ram: "4GB DDR4 RAM",
      vcpu: 2,
      storage: "60GB SSD",
      bandwidth: "2TB @10 Gbps",
      ip: "1 IPv4 Address",
      hourly_inr: Math.round((900 / (24 * 30)) * 100) / 100, // ~1.25
      hourly_usd: Math.round((900 / (24 * 30 * USD_TO_INR_RATE)) * 10000) / 100 // ~0.015
    },
    {
      id: 2,
      name: "SFC-8GB",
      inr: 1800,
      usd: Math.round((1800 / USD_TO_INR_RATE) * 100) / 100, // ~21.69
      ram: "8GB DDR4 RAM",
      vcpu: 4,
      storage: "120GB SSD",
      bandwidth: "4TB @10 Gbps",
      ip: "1 IPv4 Address",
      hourly_inr: Math.round((1800 / (24 * 30)) * 100) / 100, // ~2.50
      hourly_usd: Math.round((1800 / (24 * 30 * USD_TO_INR_RATE)) * 10000) / 100 // ~0.030
    },
    {
      id: 3,
      name: "SFC-16GB",
      inr: 3600,
      usd: Math.round((3600 / USD_TO_INR_RATE) * 100) / 100, // ~43.37
      ram: "16GB DDR4 RAM",
      vcpu: 6,
      storage: "240GB SSD",
      bandwidth: "6TB @10 Gbps",
      ip: "1 IPv4 Address",
      hourly_inr: Math.round((3600 / (24 * 30)) * 100) / 100, // ~5.00
      hourly_usd: Math.round((3600 / (24 * 30 * USD_TO_INR_RATE)) * 10000) / 100 // ~0.060
    },
    {
      id: 4,
      name: "SFC-32GB",
      inr: 5400,
      usd: Math.round((5400 / USD_TO_INR_RATE) * 100) / 100, // ~65.06
      ram: "32GB DDR4 RAM",
      vcpu: 10,
      storage: "480GB SSD",
      bandwidth: "10TB @10 Gbps",
      ip: "1 IPv4 Address",
      hourly_inr: Math.round((5400 / (24 * 30)) * 100) / 100, // ~7.50
      hourly_usd: Math.round((5400 / (24 * 30 * USD_TO_INR_RATE)) * 10000) / 100 // ~0.090
    }
  ];

  const handleDeployClick = (plan) => {
    // Navigate to deploy details page with plan data
    navigate('/deploy-details', { 
      state: { 
        selectedPlan: plan,
        currency: currency
      } 
    });
  };

  // Format currency display
  const formatPrice = (price, isUSD = false) => {
    if (isUSD) {
      return `$${price.toFixed(2)}`;
    }
    return `₹${Math.round(price)}`;
  };

  // Format hourly price display
  const formatHourlyPrice = (price, isUSD = false) => {
    if (isUSD) {
      return `$${price.toFixed(3)}`;
    }
    return `₹${price.toFixed(2)}`;
  };

  return (
    <div className="deploy-page">
      <div className="deploy-header">
        <h1>Shared CPU Plans</h1>
        <div className="currency-switch">
          <span
            className={currency === "INR" ? "active" : ""}
            onClick={() => setCurrency("INR")}
          >
            INR ₹
          </span>
          <span
            className={currency === "USD" ? "active" : ""}
            onClick={() => setCurrency("USD")}
          >
            USD $
          </span>
        </div>
      </div>

      <div className="deploy-table-container">
        <table className="deploy-table">
          <thead>
            <tr>
              <th>Plan</th>
              <th>{currency === "INR" ? "₹/Mo" : "$/Mo"}</th>
              <th>RAM</th>
              <th>vCPUs</th>
              <th>SSD Storage</th>
              <th>Bandwidth</th>
              <th>IPv4</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {plans.map((plan) => (
              <tr key={plan.id}>
                <td>
                  <div className="plan-name">{plan.name}</div>
                  <div className="hourly-price">
                    {currency === "INR" 
                      ? formatHourlyPrice(plan.hourly_inr) + "/hr"
                      : formatHourlyPrice(plan.hourly_usd, true) + "/hr"
                    }
                  </div>
                </td>
                <td className="price-cell">
                  <div className="monthly-price">
                    {currency === "INR" 
                      ? formatPrice(plan.inr)
                      : formatPrice(plan.usd, true)
                    }
                  </div>
                </td>
                <td>{plan.ram}</td>
                <td>{plan.vcpu} Cores</td>
                <td>{plan.storage}</td>
                <td>{plan.bandwidth}</td>
                <td>{plan.ip}</td>
                <td>
                  <button 
                    className="deploy-btn"
                    onClick={() => handleDeployClick(plan)}
                  >
                    Deploy
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Currency conversion note */}
      <div className="currency-note">
        <p>
          💡 Currency Conversion: 1 USD ≈ ₹{USD_TO_INR_RATE} | 
          Prices are calculated based on 720 hours per month (24 hours × 30 days)
        </p>
      </div>
    </div>
  );
};

export default Deploy;