import React from 'react';
import './Privacy.css';
import { Shield, FileText, Lock, Eye, Cookie, UserCheck } from 'lucide-react';

const Privacy = () => {
  const policySections = [
    {
      icon: <FileText className="section-icon" />,
      title: "Information We Collect",
      content: `Personal details such as name, email, phone number, and billing information
Technical information including IP address, device and browser type, and access times
Hosting usage data such as resource consumption, storage usage, and server activity
Cookies and similar tracking technologies to enhance your experience
KYC information, if required for legal compliance or identity verification`
    },
    {
      icon: <UserCheck className="section-icon" />,
      title: "KYC and Identity Verification",
      content: `To comply with Indian laws, Walras Cloud may require users to complete a Know Your Customer (KYC) process. This may include government-issued ID, proof of address, or other necessary documentation. Your KYC information is used solely for verification, fraud prevention, and legal compliance. All KYC data is securely stored and accessed only by authorized personnel. Users may request access to, correction of, or deletion of their KYC information, subject to legal obligations.`
    },
    {
      icon: <Eye className="section-icon" />,
      title: "How We Use Your Information",
      content: `To provide, manage, and improve our hosting services
To communicate with you regarding support, billing, or updates
To ensure the security of our platform and prevent fraud or abuse
To comply with legal requirements and enforce our terms of service`
    },
    {
      icon: <Shield className="section-icon" />,
      title: "Legal Compliance in India",
      content: `Walras Cloud operates in accordance with Indian laws, including the Information Technology Act, 2000 (as amended) and related regulations. We follow reasonable security practices to protect sensitive personal information and ensure data is stored and processed in compliance with Indian legal standards.`
    },
    {
      icon: <Lock className="section-icon" />,
      title: "How We Protect Your Data",
      content: `We use encryption, access controls, and monitoring systems to safeguard your personal and KYC information. Only authorized personnel can access this data, and it is handled securely at all times.`
    },
    {
      icon: <FileText className="section-icon" />,
      title: "Sharing and Disclosure",
      content: `We do not sell your personal data. Information may be shared with trusted third-party providers, such as payment gateways or infrastructure services, under strict confidentiality. Data may also be disclosed if legally required by Indian authorities.`
    },
    {
      icon: <UserCheck className="section-icon" />,
      title: "Your Rights",
      content: `Access, update, or request deletion of your personal information
Object to or restrict certain processing of your data
Request a copy of your data for your records
Withdraw consent for data processing, where applicable`
    },
    {
      icon: <Cookie className="section-icon" />,
      title: "Cookies",
      content: `We use cookies to enhance your experience, analyze website traffic, and improve our services. You can manage cookie preferences via your browser settings.`
    },
    {
      icon: <Shield className="section-icon" />,
      title: "Children's Privacy",
      content: `Our services are not directed to individuals under 18. We do not knowingly collect personal information from children.`
    },
    {
      icon: <FileText className="section-icon" />,
      title: "Changes to This Policy",
      content: `We may update this Privacy Policy from time to time. The effective date of the current policy is 03 August 2025.`
    }
  ];

  return (
    <div className="privacy-page">
      {/* Hero Section */}
      <section className="privacy-hero">
        <div className="container">
          <div className="hero-content">
            <Shield className="hero-icon" />
            <h1 className="privacy-title">Privacy Policy</h1>
            <p className="privacy-subtitle">
              This Privacy Policy explains how Walras Cloud, operated by IOOGN TECHNOLOGIES (OPC) PVT LTD, 
              collects, uses, stores, and protects your personal information in accordance with Indian laws and regulations.
            </p>
          </div>
        </div>
      </section>

      {/* Policy Content */}
      <section className="policy-content">
        <div className="container">
          <div className="policy-sections">
            {policySections.map((section, index) => (
              <div className="policy-section" key={index}>
                <div className="section-header">
                  <div className="section-icon-wrapper">
                    {section.icon}
                  </div>
                  <h2 className="section-title">{section.title}</h2>
                </div>
                <div className="section-content">
                  {section.content.split('\n').map((paragraph, pIndex) => (
                    <p key={pIndex} className="policy-paragraph">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="privacy-contact">
        <div className="container">
          <div className="contact-card">
            <h2 className="contact-title">Contact Us</h2>
            <p className="contact-description">
              For questions, concerns, or requests regarding this Privacy Policy, contact our support team.
            </p>
            <div className="contact-info">
              <p className="contact-email">Our support email is <strong>support@walras.net</strong></p>
              <p className="contact-company">Operated by IOOGN TECHNOLOGIES (OPC) PVT LTD</p>
            </div>
            <div className="contact-actions">
              <a href="/pricing" className="btn primary">See Our Plans</a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Privacy;