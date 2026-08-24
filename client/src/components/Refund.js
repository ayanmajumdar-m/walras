import React from 'react';
import './Refund.css';
import { Clock, CreditCard, AlertTriangle, Wallet, Mail } from 'lucide-react';

const Refund = () => {
  const refundSections = [
    {
      icon: <Clock className="section-icon" />,
      title: "168-HOURS Trial",
      content: "All new users can start a 168-Hours trial by paying INR 100. This amount is credited to your Buttr Cloud wallet and can be used for any future purchases. During the trial period, you can evaluate our hosting services risk-free."
    },
    {
      icon: <CreditCard className="section-icon" />,
      title: "No Refunds After Purchase",
      content: "Once the trial period ends or any service is purchased, Buttr Cloud does not provide refunds for hosting services, add-ons, or domain registrations."
    },
    {
      icon: <Wallet className="section-icon" />,
      title: "Wallet Balance Transfers",
      content: "Any remaining balance in your Buttr Cloud wallet can be transferred to your bank account only if it was not credited through promotional offers, discounts, or other incentives. Wallet funds obtained via offers are non-transferable."
    },
    {
      icon: <AlertTriangle className="section-icon" />,
      title: "Policy Effective Date",
      content: "This policy is effective as of 03 August 2025. IOOGN TECHNOLOGIES (OPC) PVT LTD reserves the right to update or modify this policy at any time."
    },
    {
      icon: <Mail className="section-icon" />,
      title: "Contact Support",
      content: "For questions about your account, trial, or wallet balance, contact our support team at support@superflare.io."
    }
  ];

  return (
    <div className="terms-page">
      <div className="terms-hero">
        <div className="container">
          <div className="hero-content">
            <CreditCard className="hero-icon" />
            <h1 className="terms-title">Refund Policy</h1>
            <p className="terms-subtitle">
              At Buttr Cloud, we do not provide refunds after purchase. We offer a 168-HOURS trial for INR 100, which is added to your wallet balance for future purchases.
            </p>
          </div>
        </div>
      </div>

      <div className="terms-content">
        <div className="container">
          <div className="terms-sections">
            {refundSections.map((section, index) => (
              <div key={index} className="terms-section">
                <div className="section-header">
                  <div className="section-icon-wrapper">
                    {section.icon}
                  </div>
                  <h2 className="section-title">{section.title}</h2>
                </div>
                <div className="section-content">
                  {section.content}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Refund;