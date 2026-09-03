import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import "./DeployDetails.css";

const Deploy = () => {
  const [currency, setCurrency] = useState("INR");
  const navigate = useNavigate();

  // Current conversion rate (1 USD = ~83 INR)
  const USD_TO_INR_RATE = 83;
  const HOURS_PER_MONTH = 720; // 24 hours × 30 days

  const calculateUSDPrice = (inrPrice) => {
    return Math.round((inrPrice / USD_TO_INR_RATE) * 100) / 100;
  };

  const calculateHourlyPrice = (monthlyPrice, isUSD = false) => {
    if (isUSD) {
      const hourly = monthlyPrice / HOURS_PER_MONTH;
      return Math.round(hourly * 1000) / 1000; // 3 decimal places for USD
    }
    return Math.round((monthlyPrice / HOURS_PER_MONTH) * 100) / 100; // 2 decimal places for INR
  };

  const plans = [
    {
      id: 1,
      name: "SFC-4GB",
      inr: 900,
      usd: calculateUSDPrice(900),
      ram: "4GB DDR4 RAM",
      vcpu: 2,
      storage: "60GB SSD",
      bandwidth: "2TB @10 Gbps",
      ip: "1 IPv4 Address",
      hourly_inr: calculateHourlyPrice(900),
      hourly_usd: calculateHourlyPrice(calculateUSDPrice(900), true)
    },
    {
      id: 2,
      name: "SFC-8GB",
      inr: 1800,
      usd: calculateUSDPrice(1800),
      ram: "8GB DDR4 RAM",
      vcpu: 4,
      storage: "120GB SSD",
      bandwidth: "4TB @10 Gbps",
      ip: "1 IPv4 Address",
      hourly_inr: calculateHourlyPrice(1800),
      hourly_usd: calculateHourlyPrice(calculateUSDPrice(1800), true)
    },
    {
      id: 3,
      name: "SFC-16GB",
      inr: 3600,
      usd: calculateUSDPrice(3600),
      ram: "16GB DDR4 RAM",
      vcpu: 6,
      storage: "240GB SSD",
      bandwidth: "6TB @10 Gbps",
      ip: "1 IPv4 Address",
      hourly_inr: calculateHourlyPrice(3600),
      hourly_usd: calculateHourlyPrice(calculateUSDPrice(3600), true)
    },
    {
      id: 4,
      name: "SFC-32GB",
      inr: 5400,
      usd: calculateUSDPrice(5400),
      ram: "32GB DDR4 RAM",
      vcpu: 10,
      storage: "480GB SSD",
      bandwidth: "10TB @10 Gbps",
      ip: "1 IPv4 Address",
      hourly_inr: calculateHourlyPrice(5400),
      hourly_usd: calculateHourlyPrice(calculateUSDPrice(5400), true)
    }
  ];

  const handleDeployClick = (plan) => {
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

      <div className="deploy-out-of-stock-alert">
        <AlertTriangle size={22} style={{ flexShrink: 0, marginTop: "2px", color: "#d97706" }} />
        <div>
          <h4>Cloud VPS Instances Currently Out of Stock</h4>
          <p>
            All shared CPU Cloud VPS instances are temporarily sold out due to high demand.
            Our infrastructure team is provisioning new server capacity. In the meantime, you can explore our <strong><a href="/dashboard/hosting" style={{ color: "#78350f", textDecoration: "underline" }}>Web Hosting & cPanel</a></strong> packages.
          </p>
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
              <th>Status</th>
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
                  <span className="stock-badge-pill out-of-stock">Out of Stock</span>
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
                    className="deploy-btn out-of-stock"
                    disabled={true}
                    title="This VPS plan is currently out of stock"
                  >
                    Out of Stock
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
          Prices are calculated based on {HOURS_PER_MONTH} hours per month (24 hours × 30 days)
        </p>
      </div>
    </div>
  );
};

export default Deploy;