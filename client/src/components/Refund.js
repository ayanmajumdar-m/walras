import React from 'react';
// Unused by this page now, but its global rules (.container, .section-title,
// .btn…) are still part of the cascade other pages see, so it stays loaded.
import './Refund.css';
import LegalPage from './Legal/LegalPage';

const SECTIONS = [
  {
    title: "1. General Refund Policy",
    content: `Walras Cloud follows a strict no-refund policy for purchased services. Payments for VPS hosting, cloud infrastructure, add-ons, domain registrations, and other services are non-refundable once the purchase is completed, subject to applicable law.
Customers should review service specifications, pricing, and billing terms before making a purchase.`
  },
  {
    title: "2. 24-Hour Trial",
    content: `Walras Cloud may offer a 24-hour trial for INR 100, subject to availability and applicable terms.
The INR 100 payment will be credited to the customer's Walras Cloud account balance and may be used for future purchases. Trial payments are non-refundable under the standard refund policy, subject to applicable law.`
  },
  {
    title: "3. Monthly Invoicing and Payment Deadlines",
    content: `Invoices for recurring services are generated on the 1st day of every month.
• Within 48 hours: The invoice must be paid within 48 hours of generation.
• After 48 hours: A one-time late-payment penalty of 10% of the original invoice value will apply.
• After 72 hours: Services associated with the unpaid invoice may be suspended.
• After 7 days overdue: The affected services may be terminated and associated data permanently deleted.
Customers are responsible for paying invoices on time.`
  },
  {
    title: "4. Service Suspension and Data Deletion",
    content: `Walras Cloud reserves the right to suspend services for overdue payments.
If an invoice remains unpaid for seven days, the affected services may be terminated and associated data deleted, subject to applicable law and any mandatory notice requirements.
Customers are responsible for maintaining independent backups of their data. Outstanding invoices and applicable penalties may need to be paid before service restoration. Restoration is subject to availability.`
  },
  {
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
    title: "6. Legal Exceptions",
    content: "Nothing in this policy limits any consumer rights or remedies that cannot legally be excluded under applicable law."
  },
  {
    title: "7. Policy Updates",
    content: "Noutikal Technologies reserves the right to update or modify this policy from time to time. Revised terms will be published on the Walras Cloud website and will take effect as specified, subject to applicable law."
  },
  {
    title: "8. Contact Support",
    content: `For questions regarding invoices, penalties, service suspension, account closure, or balance withdrawals, contact:
Email: support@walras.net`
  }
];

const INTRO = [];

const Refund = () => (
  <LegalPage
    path="/refund"
    title="Refund and Billing Policy"
    intro={INTRO}
    effective="9 October 2026"
    sections={SECTIONS}
  />
);

export default Refund;
