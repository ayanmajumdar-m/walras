import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./DeployDetails.css";

const Deploy = () => {
  const [currency, setCurrency] = useState("INR");
  const navigate = useNavigate();

  const plans = [
    {
      id: 1,
      name: "SFC-4GB",
      inr: 900,
      usd: 10.8,
      ram: "4GB DDR4 RAM",
      vcpu: 2,
      storage: "60GB SSD",
      bandwidth: "2TB @10 Gbps",
      ip: "1 IPv4 Address",
      hourly_inr: 1.23,
      hourly_usd: 0.015
    },
    {
      id: 2,
      name: "SFC-8GB",
      inr: 1800,
      usd: 21.6,
      ram: "8GB DDR4 RAM",
      vcpu: 4,
      storage: "120GB SSD",
      bandwidth: "4TB @10 Gbps",
      ip: "1 IPv4 Address",
      hourly_inr: 2.47,
      hourly_usd: 0.030
    },
    {
      id: 3,
      name: "SFC-16GB",
      inr: 3600,
      usd: 43.2,
      ram: "16GB DDR4 RAM",
      vcpu: 6,
      storage: "240GB SSD",
      bandwidth: "6TB @10 Gbps",
      ip: "1 IPv4 Address",
      hourly_inr: 4.93,
      hourly_usd: 0.059
    },
    {
      id: 4,
      name: "SFC-32GB",
      inr: 5400,
      usd: 64.8,
      ram: "32GB DDR4 RAM",
      vcpu: 10,
      storage: "480GB SSD",
      bandwidth: "10TB @10 Gbps",
      ip: "1 IPv4 Address",
      hourly_inr: 7.40,
      hourly_usd: 0.089
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
                    {currency === "INR" ? `₹${plan.hourly_inr}/hr` : `$${plan.hourly_usd}/hr`}
                  </div>
                </td>
                <td className="price-cell">
                  <div className="monthly-price">
                    {currency === "INR" ? `₹${plan.inr}` : `$${plan.usd}`}
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
    </div>
  );
};

export default Deploy;