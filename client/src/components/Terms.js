import React from 'react';
// Unused by this page now, but its global rules (.container, .section-title,
// .btn…) are still part of the cascade other pages see, so it stays loaded.
import './Terms.css';
import LegalPage from './Legal/LegalPage';

const SECTIONS = [
  {
    title: "1. Acceptance of Terms",
    content: "By creating an account or using Walras Cloud, you agree to these Terms, our Refund Policy, Acceptable Use Policy, and other applicable policies. If you do not agree, you must not use our services."
  },
  {
    title: "2. Services",
    content: `Walras Cloud provides cloud infrastructure services, including on-demand computing resources, virtual compute instances, storage, networking, resource management, monitoring, and related infrastructure tools.
Services, features, and resource availability may change as our platform evolves. We strive to provide reliable infrastructure but do not guarantee uninterrupted availability unless expressly stated in a separate Service Level Agreement (SLA).`
  },
  {
    title: "3. Account Registration and Security",
    content: `Customers must provide accurate registration information, protect their account credentials, promptly report suspected unauthorized access, and maintain current billing details.
Customers are responsible for activity conducted through their accounts, subject to applicable law.
Identity verification or Know Your Customer (KYC) documentation may be required for legal compliance, fraud prevention, payment verification, or account security.`
  },
  {
    title: "4. Acceptable Use",
    content: `Customers must use cloud infrastructure lawfully and responsibly. Prohibited activities include:
• Distributing malware, ransomware, phishing campaigns, or spam.
• Conducting DDoS attacks, unauthorized scanning, network abuse, or security breaches.
• Violating applicable laws or third-party intellectual property rights.
• Mining cryptocurrency without prior written authorization.
• Reselling or redistributing services without required authorization.
• Bypassing security controls, usage restrictions, or billing mechanisms.
• Activities that compromise infrastructure security or disrupt other customers.
• Using services to facilitate fraud or other unlawful activities.
Walras Cloud may investigate abuse and restrict, suspend, or terminate services where reasonably necessary.`
  },
  {
    title: "5. Payments and Billing",
    content: `Recurring cloud services are billed monthly in advance. Invoices are generated on the 1st day of every month, according to India Standard Time (IST).
New monthly subscriptions purchased during a month are charged on a pro-rata basis for the remaining days, including the purchase date, plus applicable taxes.
Customers must pay invoices within 48 hours of generation.
• After 48 hours: A one-time late-payment penalty of 10% of the original invoice value applies.
• After 72 hours: The affected cloud services may be suspended.
• After 7 days overdue: The affected services may be terminated and associated data permanently deleted.
The seven-day deletion period begins when the invoice first becomes overdue. Outstanding amounts remain payable after suspension or termination.
Where offered, eligible cloud services may be reserved for 3, 6, 12, 24, or 36 months with full advance payment. Applicable discounts are displayed at checkout. Reservations renew automatically for the same term unless cancelled before renewal.
Cancellation generally prevents the next renewal. Prepaid services remain available until the end of the paid period unless otherwise specified or required by law.
Domain registrations and other one-time purchases, where offered, must be paid for in advance.`
  },
  {
    title: "6. Refunds and Account Balance",
    content: `Refunds are governed by the Walras Cloud Refund Policy. Purchased services and consumed credits are generally non-refundable, subject to applicable law.
Customers closing their accounts may request withdrawal of eligible unused account funds. Promotional credits, bonuses, discounts, and incentive funds are not eligible for withdrawal. Account balances cannot be transferred to another Walras Cloud account.`
  },
  {
    title: "7. Availability and Maintenance",
    content: `Services may be interrupted by maintenance, infrastructure failures, network outages, security incidents, or events beyond our reasonable control.
Unless expressly stated in a separate SLA, Walras Cloud does not guarantee a specific uptime percentage. Nothing in these Terms excludes liability that cannot legally be excluded.`
  },
  {
    title: "8. Customer Data and Backups",
    content: `Customers are responsible for their data, applications, configurations, and workloads deployed on the infrastructure.
Customers must maintain independent backups unless a backup service is expressly included in their purchased plan. Data deleted following service termination may not be recoverable.`
  },
  {
    title: "9. Suspension and Termination",
    content: `Walras Cloud may suspend, restrict, or terminate services for non-payment, violations of these Terms, unlawful activity, fraud, security threats, or risks to infrastructure and other customers.
Where reasonably practicable, notice will be provided before suspension or termination. Immediate action may be taken when necessary to address urgent security threats, abuse, or legal obligations.
Termination does not eliminate outstanding payment obligations.`
  },
  {
    title: "10. Intellectual Property",
    content: `Walras Cloud and its licensors retain ownership of the platform's software, designs, branding, documentation, and proprietary materials.
Customers may not copy, distribute, or modify these materials without authorization, except where permitted by applicable law. Customers retain their rights to their own content.`
  },
  {
    title: "11. Limitation of Liability",
    content: `To the maximum extent permitted by applicable law, Walras Cloud will not be liable for indirect, incidental, special, or consequential damages, including loss of profits, revenue, business opportunities, or data.
To the maximum extent permitted by law, aggregate liability for a claim relating to a service will not exceed the fees paid or payable for the affected service during the 30 days preceding the event giving rise to the claim.
These limitations do not exclude liability that cannot legally be excluded.`
  },
  {
    title: "12. Indemnification",
    content: "To the extent permitted by law, customers agree to indemnify and hold harmless Walras Cloud, Noutikal Technologies, and their personnel against third-party claims and reasonable expenses arising directly from unlawful use of the services, infringement of third-party rights, or material violations of these Terms."
  },
  {
    title: "13. Legal Compliance and Verification",
    content: `Customers must comply with applicable Indian laws and regulations. Walras Cloud may request verification documents where reasonably necessary for compliance, security, fraud prevention, or payment verification.
Failure to meet lawful verification requirements may result in restricted access, suspension, or termination, subject to applicable law.`
  },
  {
    title: "14. Changes to These Terms",
    content: `Walras Cloud may update these Terms to reflect changes in services, security practices, operations, or applicable law. Material changes will be communicated through appropriate channels where required.
Continued use after the effective date of revised Terms constitutes acceptance where legally valid.`
  },
  {
    title: "15. Governing Law",
    content: "These Terms are governed by the laws of India. Disputes will be handled by competent courts having jurisdiction under applicable Indian law, without limiting mandatory legal rights."
  },
  {
    title: "16. Contact Information",
    content: `Walras Cloud
Operator: Noutikal Technologies
Email: support@walras.net`
  }
];

const INTRO = [
  "These Terms of Service govern your access to and use of Walras Cloud's cloud computing and infrastructure services. By registering for an account, purchasing a service, or using our platform, you agree to these Terms."
];

const Terms = () => (
  <LegalPage
    path="/terms"
    title="Terms of Service"
    intro={INTRO}
    effective="9 October 2026"
    sections={SECTIONS}
  />
);

export default Terms;
