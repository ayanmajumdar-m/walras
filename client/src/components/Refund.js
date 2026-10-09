import React from 'react';
import './Refund.css';
import { Clock, CreditCard, AlertTriangle, Wallet, Mail, FileText, Scale, Server } from 'lucide-react';

const Refund = () => {
  const refundSections = [
    {
      icon: <CreditCard className="section-icon" />,
      title: "1. General Refund Policy",
      content: `Walras Cloud follows a strict no-refund policy for purchased services. Payments for VPS hosting, cloud infrastructure, add-ons, domain registrations, and other services are non-refundable once the purchase is completed, subject to applicable law.
Customers should review service specifications, pricing, and billing terms before making a purchase.`
    },
    {
      icon: <Clock className="section-icon" />,
      title: "2. 24-Hour Trial",
      content: `Walras Cloud may offer a 24-hour trial for INR 100, subject to availability and applicable terms.
The INR 100 payment will be credited to the customer's Walras Cloud account balance and may be used for future purchases. Trial payments are non-refundable under the standard refund policy, subject to applicable law.`
    },
    {
      icon: <FileText className="section-icon" />,
      title: "3. Monthly Invoicing and Payment Deadlines",
      content: `Invoices for recurring services are generated on the 1st day of every month.
• Within 48 hours: The invoice must be paid within 48 hours of generation.
• After 48 hours: A one-time late-payment penalty of 10% of the original invoice value will apply.
• After 72 hours: Services associated with the unpaid invoice may be suspended.
• After 7 days overdue: The affected services may be terminated and associated data permanently deleted.
Customers are responsible for paying invoices on time.`
    },
    {
      icon: <Server className="section-icon" />,
      title: "4. Service Suspension and Data Deletion",
      content: `Walras Cloud reserves the right to suspend services for overdue payments.
If an invoice remains unpaid for seven days, the affected services may be terminated and associated data deleted, subject to applicable law and any mandatory notice requirements.
Customers are responsible for maintaining independent backups of their data. Outstanding invoices and applicable penalties may need to be paid before service restoration. Restoration is subject to availability.`
    },
    {
      icon: <Wallet className="section-icon" />,
      title: "5. Account Balance Withdrawal",
      content: `Customers who permanently close their Walras Cloud accounts may request withdrawal of their unused, eligible account balance.
The following conditions apply:
• Only unused funds eligible for withdrawal may be considered.
• Promotional credits, bonuses, discounts, trial incentives, and other promotional funds are not withdrawable.
• Account closure and identity verification may be required.
• Eligible withdrawals will be processed through a supported withdrawal method, subject to verification and applicable law.
• Account balances cannot be transferred to another Walras Cloud account.
• Used credits, consumed services, and completed purchases are not refundable.`
    },
    {
      icon: <Scale className="section-icon" />,
      title: "6. Legal Exceptions",
      content: "Nothing in this policy limits any consumer rights or remedies that cannot legally be excluded under applicable law."
    },
    {
      icon: <AlertTriangle className="section-icon" />,
      title: "7. Policy Updates",
      content: "Noutikal Technologies reserves the right to update or modify this policy from time to time. Revised terms will be published on the Walras Cloud website and will take effect as specified, subject to applicable law."
    },
    {
      icon: <Mail className="section-icon" />,
      title: "8. Contact Support",
      content: `For questions regarding invoices, penalties, service suspension, account closure, or balance withdrawals, contact:
Email: support@walras.net`
    }
  ];

  return (
    <div className="terms-page">
      <div className="terms-hero">
        <div className="container">
          <div className="hero-content">
            <CreditCard className="hero-icon" />
            <h1 className="terms-title">Refund and Billing Policy</h1>
            <p className="terms-subtitle">
              Walras Cloud, operated by Noutikal Technologies. Effective Date: 9 October 2026.
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
                  {section.content.split('\n').map((paragraph, pIndex) => (
                    <p key={pIndex} className="terms-paragraph">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <p className="terms-paragraph">
            Walras Cloud — From India, for India and the world — enterprise-grade cloud with local pricing, built for you.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Refund;
