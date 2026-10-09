import React from 'react';
import './Privacy.css';
import { Shield, FileText, Lock, Eye, Cookie, UserCheck, Scale, Share2, Globe, Clock, AlertTriangle, Link2, Baby } from 'lucide-react';

const Privacy = () => {
  const policySections = [
    {
      icon: <FileText className="section-icon" />,
      title: "1. Information We Collect",
      content: `We collect only the information reasonably necessary to operate our platform, provide our services, protect our infrastructure, and meet legal obligations.
1.1 Account and Contact Information
• Name and email address.
• Phone number, where provided or required.
• Account credentials and authentication-related information.
• Account preferences and communication settings.
1.2 Billing and Transaction Information
• Billing details and transaction records.
• Invoice history, payment status, and account balance records.
• Payment references and related verification information.
Payment card or banking details may be processed directly by third-party payment providers. We do not intentionally store complete payment card details unless explicitly disclosed and appropriately secured.
1.3 Technical and Infrastructure Information
When you access or use Walras Cloud, we may collect:
• IP addresses and connection metadata.
• Browser type, operating system, and device information.
• Login timestamps, access logs, and security events.
• Cloud resource consumption, compute usage, storage usage, and network activity.
• Service configurations and operational logs necessary to deliver or secure the infrastructure.
We do not intentionally inspect customer workloads or content except where reasonably necessary for service operation, troubleshooting, security, abuse investigation, or legal compliance.
1.4 Identity Verification Information
Where required for identity verification, fraud prevention, payment verification, or legal compliance, we may collect government-issued identification, proof of address, or other relevant verification information.
We will limit collection to information reasonably necessary for the stated purpose.
1.5 Cookies and Similar Technologies
We may use cookies, local storage, and similar technologies to maintain sessions, remember preferences, protect accounts, and understand website performance.
Optional analytics or advertising technologies, if used, will be handled in accordance with applicable consent requirements.`
    },
    {
      icon: <Eye className="section-icon" />,
      title: "2. How We Use Your Information",
      content: `We use personal information for the following purposes:
• Creating and managing customer accounts.
• Providing and maintaining cloud infrastructure services.
• Processing payments, invoices, renewals, and account balance transactions.
• Providing technical support and responding to customer enquiries.
• Monitoring performance, reliability, and infrastructure security.
• Detecting fraud, abuse, unauthorized access, and violations of our policies.
• Verifying identity where necessary.
• Sending essential service notifications, billing notices, and security alerts.
• Improving platform functionality, reliability, and user experience.
• Complying with legal obligations and responding to lawful requests.
We do not use personal information for purposes incompatible with those disclosed to you unless permitted by applicable law.`
    },
    {
      icon: <Scale className="section-icon" />,
      title: "3. Legal Basis for Processing",
      content: `Depending on the applicable law and circumstances, we process personal information based on one or more of the following grounds:
• Contractual necessity: To create accounts and provide services you request.
• Consent: Where you have provided valid consent and consent is required.
• Legal obligations: To comply with applicable laws, regulatory requirements, and lawful orders.
• Legitimate interests or other permitted grounds: Where recognized by applicable law, including protecting infrastructure, preventing fraud, and securing accounts.
Where processing relies on consent, you may withdraw that consent as permitted by applicable law. Withdrawal does not affect processing lawfully performed before withdrawal.`
    },
    {
      icon: <UserCheck className="section-icon" />,
      title: "4. KYC and Identity Verification",
      content: `Walras Cloud may require identity verification where reasonably necessary for compliance, security, fraud prevention, or payment verification.
Verification information is used for the purpose for which it was collected and for related lawful purposes.
Access is restricted to authorized personnel and service providers who require the information to perform their duties. We retain verification records only for as long as necessary to fulfil the relevant purpose or satisfy applicable legal requirements.
Where verification is performed by a third-party provider, that provider's processing may also be subject to its own privacy terms.`
    },
    {
      icon: <Share2 className="section-icon" />,
      title: "5. Sharing and Disclosure",
      content: `We do not sell personal information to third parties.
We may share relevant information with the following categories of recipients:
• Payment providers: To process payments, refunds where applicable, and transaction verification.
• Infrastructure and technology providers: To operate, secure, and maintain our platform.
• Security and fraud-prevention providers: To identify threats, investigate abuse, and protect accounts.
• Professional advisers: Including legal, accounting, and compliance advisers where necessary.
• Authorities and regulators: Where disclosure is required by law, valid legal process, or necessary to protect rights and safety.
• Business successors: In connection with a merger, acquisition, restructuring, or transfer of business, subject to applicable privacy requirements.
We require appropriate confidentiality and data-protection safeguards from service providers where applicable.`
    },
    {
      icon: <Globe className="section-icon" />,
      title: "6. International Data Transfers",
      content: `Walras Cloud may use service providers or infrastructure located in countries other than your country of residence.
Where personal information is transferred internationally, we will apply safeguards and comply with applicable transfer restrictions and legal requirements.
The protections applicable to your information may depend on your location, the recipient, and the relevant law.`
    },
    {
      icon: <Lock className="section-icon" />,
      title: "7. Data Security",
      content: `We use appropriate technical and organizational safeguards designed to protect personal information against unauthorized access, disclosure, alteration, loss, or destruction.
Depending on the processing activity, these measures may include:
• Access controls and least-privilege permissions.
• Encryption in transit and, where appropriate, at rest.
• Authentication and account security controls.
• Logging, monitoring, and security incident detection.
• Restricted access to identity verification records.
• Backup, recovery, and incident-response procedures.
No internet-based system can be guaranteed completely secure. We continually assess and improve our safeguards in line with operational needs and applicable requirements.`
    },
    {
      icon: <Clock className="section-icon" />,
      title: "8. Data Retention and Deletion",
      content: `We retain personal information only for as long as reasonably necessary for the purposes described in this Policy, including providing services, maintaining financial records, resolving disputes, preventing fraud, and complying with legal obligations.
Retention periods vary by data category:
• Account information: While the account remains active and for a reasonable period afterward where necessary.
• Billing and transaction records: For the period required by applicable financial, tax, and legal requirements.
• Technical and security logs: For a period appropriate to operational, security, and investigation needs.
• Identity verification records: For the period necessary for verification, compliance, and legally required recordkeeping.
When information is no longer required, we will take appropriate steps to delete it or anonymize it, subject to legal retention requirements and legitimate security needs.
Deleting an account does not necessarily result in the immediate deletion of every record. Certain records may need to be retained as required by law.`
    },
    {
      icon: <UserCheck className="section-icon" />,
      title: "9. Your Privacy Rights",
      content: `Depending on your location and applicable law, you may have the right to:
• Request access to personal information we hold about you.
• Correct inaccurate or incomplete information.
• Request deletion of personal information where applicable.
• Withdraw consent where processing relies on consent.
• Request a copy of certain information in a portable format.
• Object to or request restriction of certain processing activities.
• Raise a complaint with the appropriate privacy regulator.
• Exercise other rights provided by applicable law.
These rights are subject to applicable legal conditions and exceptions.
To submit a request, contact support@walras.net. We may request reasonable information to verify your identity before processing the request.
We will respond within the timeframe required by applicable law.`
    },
    {
      icon: <Cookie className="section-icon" />,
      title: "10. Cookies and Website Analytics",
      content: `Cookies and similar technologies help us maintain secure sessions, remember preferences, understand website usage, and improve performance.
You can manage cookies through your browser settings. Disabling essential cookies may affect login, account security, or other platform functionality.
Where consent is required for optional cookies or analytics, we will seek consent before using them.`
    },
    {
      icon: <Baby className="section-icon" />,
      title: "11. Children's Privacy",
      content: `Walras Cloud is intended for individuals and organizations legally capable of entering into the relevant service agreement. Our services are not directed to children.
We do not knowingly collect children's personal information in violation of applicable law. If we discover that such information has been collected unlawfully, we will take appropriate steps to address it.`
    },
    {
      icon: <Link2 className="section-icon" />,
      title: "12. Third-Party Websites and Services",
      content: `Our website or platform may contain links to third-party websites or integrate third-party services.
We are not responsible for the privacy practices of independent third parties. We encourage customers to review the applicable privacy policies before providing information directly to those providers.`
    },
    {
      icon: <AlertTriangle className="section-icon" />,
      title: "13. Personal Data Breaches",
      content: `If a personal data breach occurs, we will assess and respond to the incident in accordance with applicable law.
Where notification is legally required, we will notify affected individuals and relevant authorities within the applicable timeframe and provide information about the incident and recommended protective steps as required.`
    },
    {
      icon: <Shield className="section-icon" />,
      title: "14. International Privacy Compliance",
      content: `Walras Cloud is committed to following applicable privacy and data-protection requirements in the jurisdictions where relevant services are offered or personal information is processed.
These may include, where applicable:
• India's Digital Personal Data Protection Act, 2023, and applicable rules and regulations.
• India's Information Technology Act, 2000, and applicable provisions and rules.
• The European Union and United Kingdom General Data Protection Regulation (GDPR), where applicable.
• Other applicable regional or national privacy and data-protection laws.
The rights and obligations applicable to a particular individual depend on the relevant law and circumstances. This Policy does not claim that every law applies to every customer.`
    },
    {
      icon: <FileText className="section-icon" />,
      title: "15. Changes to This Privacy Policy",
      content: `We may update this Policy to reflect changes in our services, data-handling practices, security measures, or legal obligations.
The latest version will be published on our website with its updated effective date. Where required, we will notify affected users of material changes or obtain consent before introducing processing that requires it.`
    }
  ];

  // "1.1 Account and Contact Information" lines are sub-headings.
  const isSubheading = (line) => /^\d+\.\d+ /.test(line);

  return (
    <div className="privacy-page">
      {/* Hero Section */}
      <section className="privacy-hero">
        <div className="container">
          <div className="hero-content">
            <Shield className="hero-icon" />
            <h1 className="privacy-title">Privacy Policy</h1>
            <p className="privacy-subtitle">
              Walras Cloud, operated by Noutikal Technologies. Effective Date: 9 October 2026 · Last Updated: 9 October 2026
            </p>
            <p className="privacy-subtitle">
              This Privacy Policy explains how Walras Cloud ("we", "us", or "our") collects, uses, stores, shares, and protects personal information when you visit our website, create an account, or use our cloud infrastructure services.
            </p>
            <p className="privacy-subtitle">
              We are committed to protecting your privacy through transparency, responsible data handling, appropriate security safeguards, and respect for applicable privacy laws.
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
                      {isSubheading(paragraph) ? <strong>{paragraph}</strong> : paragraph}
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
            <h2 className="contact-title">16. Contact Us</h2>
            <p className="contact-description">
              For privacy questions, access or deletion requests, complaints, or other data-protection matters, contact:
            </p>
            <div className="contact-info">
              <p className="contact-company">Walras Cloud · Operator: Noutikal Technologies</p>
              <p className="contact-email">Email: <strong>support@walras.net</strong></p>
              <p className="contact-description">
                Please include sufficient information for us to understand and verify your request. Do not send passwords or unnecessary sensitive information by email.
              </p>
              <p className="contact-description">
                From India, for India and the world — enterprise-grade cloud with local pricing, built for you.
              </p>
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
