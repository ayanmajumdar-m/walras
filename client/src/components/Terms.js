import React from 'react';
import './Terms.css';
import { FileText, Shield, Server, User, CreditCard, AlertTriangle, Database, Trash2, Crown, Scale, Mail } from 'lucide-react';

const Terms = () => {
  const termsSections = [
    {
      icon: <FileText className="section-icon" />,
      title: "1. Acceptance of Terms",
      content: "By registering or using Walras Cloud services, you agree to comply with these Terms. If you do not accept these Terms, you must not use our services."
    },
    {
      icon: <Server className="section-icon" />,
      title: "2. Services",
      content: "Walras Cloud provides cloud computing services including virtual private servers (VPS), dedicated compute instances, storage, networking, control panel access, monitoring, and management tools. Services may change or evolve at our discretion. Walras Cloud does not guarantee uninterrupted service but strives for maximum uptime."
    },
    {
      icon: <User className="section-icon" />,
      title: "3. Account Registration & Security",
      content: `Provide accurate, complete, and current information when registering.
Maintain confidentiality of your account credentials.
Immediately notify Walras Cloud of any unauthorized access or security breach.
All activity performed through your account is your responsibility.
KYC verification may be required to comply with Indian regulations. Users must provide valid identification when requested.`
    },
    {
      icon: <Shield className="section-icon" />,
      title: "4. Acceptable Use Policy",
      content: `You agree not to use Walras Cloud services for any unlawful, harmful, or abusive activity, including but not limited to:

• Hosting malware, phishing campaigns, ransomware, or spam
• Engaging in network abuse, DDoS attacks, port scanning, or attempts to breach security
• Hosting pornographic, adult, or offensive content
• Violating copyright, trademark, or other intellectual property rights
• Mining cryptocurrency without explicit permission
• Reselling services or servers without authorization
• Activities that degrade performance, compromise security, or affect other users`
    },
    {
      icon: <CreditCard className="section-icon" />,
      title: "5. Payments & Billing",
      content: `All fees are payable in advance as stated for your selected service plan.
Failure to pay may result in suspension or termination of services.
Wallet balances can only be withdrawn to your bank if not credited via promotions or offers.
Refunds are provided solely as described in our Refund Policy.`
    },
    {
      icon: <AlertTriangle className="section-icon" />,
      title: "6. Service Level & Uptime",
      content: "Walras Cloud aims for high availability, but does not guarantee continuous uptime. Scheduled maintenance, force majeure, or issues beyond our control may cause temporary service interruptions. We are not liable for downtime or data loss."
    },
    {
      icon: <Database className="section-icon" />,
      title: "7. User Content & Data Responsibility",
      content: `Users are solely responsible for content hosted on their cloud servers.
Walras Cloud may suspend or remove content violating these Terms or applicable laws.
Backup of user data is the responsibility of the account holder unless explicitly provided.
Walras Cloud is not liable for data loss, corruption, or unauthorized access.`
    },
    {
      icon: <Trash2 className="section-icon" />,
      title: "8. Termination & Suspension",
      content: "Walras Cloud reserves the right to suspend or terminate accounts for: violations of Terms, illegal activity, network abuse, unpaid fees, or activities jeopardizing infrastructure or other users. Termination may occur without prior notice in severe cases."
    },
    {
      icon: <Crown className="section-icon" />,
      title: "9. Intellectual Property",
      content: "Walras Cloud's software, designs, branding, and content are owned by Walras Cloud or its licensors. Users may not copy, distribute, modify, or create derivative works without authorization."
    },
    {
      icon: <Scale className="section-icon" />,
      title: "10. Limitation of Liability",
      content: "Walras Cloud is not liable for indirect, incidental, consequential, or special damages, including loss of data, revenue, or business opportunities. Maximum liability is limited to the fees paid in the 30 days prior to the claim."
    },
    {
      icon: <Shield className="section-icon" />,
      title: "11. Indemnification",
      content: "You agree to indemnify, defend, and hold harmless Walras Cloud, its affiliates, and personnel from claims, losses, damages, liabilities, or expenses arising from your use of services, violations of Terms, or unlawful activity."
    },
    {
      icon: <User className="section-icon" />,
      title: "12. Compliance & KYC",
      content: "All users must comply with applicable Indian laws. KYC verification may be required for account activation or continued service. Failure to provide KYC information may result in account suspension or termination."
    },
    {
      icon: <FileText className="section-icon" />,
      title: "13. Modifications to Terms",
      content: "Walras Cloud may update these Terms at any time. Continued use of the services constitutes acceptance of any changes. Users are encouraged to review Terms periodically."
    },
    {
      icon: <Scale className="section-icon" />,
      title: "14. Governing Law & Dispute Resolution",
      content: "These Terms are governed by the laws of India. Disputes will be subject to the exclusive jurisdiction of the courts of India."
    },
    {
      icon: <Mail className="section-icon" />,
      title: "15. Contact",
      content: "Questions or notices regarding these Terms may be sent to support@buttr.cloud."
    }
  ];

  return (
    <div className="terms-page">
      {/* Hero Section */}
      <section className="terms-hero">
        <div className="container">
          <div className="hero-content">
            <FileText className="hero-icon" />
            <h1 className="terms-title">Terms of Service</h1>
            <p className="terms-subtitle">
              These Terms govern your use of Walras Cloud's cloud server and infrastructure services, 
              operated by IOOGN TECHNOLOGIES (OPC) PVT LTD. By using Walras Cloud services, you agree to be bound by these Terms.
            </p>
          </div>
        </div>
      </section>

      {/* Terms Content */}
      <section className="terms-content">
        <div className="container">
          <div className="terms-sections">
            {termsSections.map((section, index) => (
              <div className="terms-section" key={index}>
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
        </div>
      </section>

      {/* Footer Section */}
      <section className="terms-footer">
        <div className="container">
          <div className="footer-card">
            <div className="footer-content">
              <div className="effective-date">
                <strong>Effective Date:</strong> 03 August 2025
              </div>
              <div className="company-info">
                Operated by IOOGN TECHNOLOGIES (OPC) PVT LTD
              </div>
            </div>
            <div className="footer-actions">
              <a href="/pricing" className="btn primary">See Our Plans</a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Terms;