import React, { useState } from 'react';
import { Check, Star, Mail, Zap, Shield, Users, Globe, Calculator, CreditCard } from 'lucide-react';
import './FlareMail.css';

const FlareMail = () => {
  const [emailCount, setEmailCount] = useState(10000);

  const features = [
    "Extensive dashboard",
    "Email segmentation",
    "Email API",
    "SMTP",
    "Domain management",
    "Detailed email logs",
    "Content preview",
    "Pre-built templates",
    "Email template editor",
    "Webhooks",
    "Open tracking",
    "Click tracking",
    "Attachment management",
    "Sender address restriction",
    "Email sending suppression",
    "Email tracking suppression",
    "Dedicated IP",
    "Email statistics",
    "Custom reports",
    "Bounce reports",
    "Auto top-up",
    "User-level permissions",
    "Activity logs",
    "Logs export",
    "IP restriction",
    "Third-party integrations"
  ];

  const calculateCost = (emails) => {
    const credits = Math.ceil(emails / 10000);
    return credits * 150;
  };

  return (
    <div className="flare-mail">
      {/* Header */}
      <header className="flare-header">
        <div className="container">
          <div className="header-content">
            <h1>Flare Mail</h1>
            <p>Transactional Email Delivery Service</p>
          </div>
        </div>
      </header>

      {/* Pricing Intro */}
      <section className="pricing-intro">
        <div className="container">
          <div className="intro-content">
            <h2>Flexible and affordable pricing</h2>
            <p>
              Are you paying your provider for emails you don't use and features you don't need? 
              If you are, you can save significantly with Flare Mail's flexible payment without 
              compromising deliverability. Pay only for what you consume and only when you consume it.
            </p>
            <div className="intro-buttons">
              <button className="btn btn-primary">
                Sign up now
              </button>
              <button className="btn btn-secondary">
                Contact sales
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Pay-as-you-go Pricing */}
      <section className="payg-pricing">
        <div className="container">
          <div className="pricing-card">
            <div className="pricing-header">
              <h3>Pay-as-you-go pricing</h3>
              <div className="price-display">
                <span className="price">₹150</span>
                <span className="period">per credit</span>
              </div>
              <p className="credit-info">1 credit* = 10,000 emails</p>
            </div>

            <div className="pricing-features">
              <div className="feature-item">
                <Check size={16} />
                <span>No monthly payment</span>
              </div>
              <div className="feature-item">
                <Check size={16} />
                <span>Purchases valid for 6 months</span>
              </div>
              <div className="feature-item">
                <Check size={16} />
                <span>No hidden costs</span>
              </div>
            </div>

            <div className="example-section">
              <h4>Example:</h4>
              <p>With 3 credits, you get 30000 emails that are valid for 6 months</p>
              <p className="note">*Each credit is valid up to 6 months from purchase</p>
            </div>
          </div>
        </div>
      </section>

      {/* Cost Calculator */}
      <section className="cost-calculator">
        <div className="container">
          <div className="calculator-header">
            <Calculator size={24} />
            <h3>Estimate your cost</h3>
          </div>
          <div className="calculator-content">
            <div className="email-input">
              <label>Number of emails</label>
              <input
                type="range"
                min="10000"
                max="100000"
                step="10000"
                value={emailCount}
                onChange={(e) => setEmailCount(parseInt(e.target.value))}
              />
              <div className="email-display">
                <span>{emailCount.toLocaleString()} emails</span>
              </div>
            </div>
            <div className="cost-result">
              <div className="cost-amount">₹{calculateCost(emailCount)}</div>
              <div className="cost-description">
                for {emailCount.toLocaleString()} transactional emails
              </div>
            </div>
          </div>
          <p className="tax-note">
            Local taxes (VAT, GST, etc.) will be charged in addition to the prices mentioned.
          </p>
          <p className="email-note">
            *Emails sent to each recipient is counted as an individual email.
          </p>
        </div>
      </section>

      {/* Features Grid */}
      <section className="features-grid-section">
        <div className="container">
          <h3>What does Flare Mail offer?</h3>
          <div className="features-grid">
            {features.map((feature, index) => (
              <div key={index} className="feature-item">
                <Check size={16} />
                <span>{feature}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Free Credit */}
      <section className="free-credit">
        <div className="container">
          <div className="credit-card">
            <div className="credit-icon">
              <Star size={24} />
            </div>
            <div className="credit-content">
              <h4>Your first credit is on us!</h4>
              <p>
                Learn the ropes with your first credit for free. With this credit, 
                you can send 10,000 free transactional emails from your account before you begin paying.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Add-ons */}
      <section className="addons-section">
        <div className="container">
          <h3>Add-on</h3>
          <div className="addon-card">
            <div className="addon-icon">
              <Globe size={24} />
            </div>
            <div className="addon-content">
              <h4>Dedicated IP addresses</h4>
              <div className="addon-price">₹1,800/month billed annually</div>
              <p>
                While our shared IPs are well managed and primed for high deliverability, 
                certain businesses with high email volume might require a dedicated IP. 
                It helps isolate your email reputation.
              </p>
              <p className="addon-note">
                Note: It's available only on annual basis and in some DCs. Contact support for more info.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="benefits-section">
        <div className="container">
          <h3>Why should you say yes to Flare Mail?</h3>
          <div className="benefits-grid">
            <div className="benefit-item">
              <Zap size={24} />
              <h4>Exclusive focus</h4>
              <p>Singular focus on transactional email delivery that allows us to optimize the delivery</p>
            </div>
            <div className="benefit-item">
              <Mail size={24} />
              <h4>Inbox placement</h4>
              <p>With well-maintained shared IPs, your emails are delivered to the inbox and not spam folder.</p>
            </div>
            <div className="benefit-item">
              <Shield size={24} />
              <h4>Instant delivery</h4>
              <p>Delivery of emails on time, every time for great customer satisfaction and trust</p>
            </div>
            <div className="benefit-item">
              <Users size={24} />
              <h4>Comprehensive logs</h4>
              <p>Detailed logs and reports to stay on top of your email performance and for troubleshooting</p>
            </div>
            <div className="benefit-item">
              <CreditCard size={24} />
              <h4>Extensive assistance</h4>
              <p>24/7 email and call assistance from well-equipped support engineers</p>
            </div>
          </div>
          <div className="benefits-cta">
            <button className="btn btn-secondary">See the full features list</button>
          </div>
        </div>
      </section>

      {/* Additional Reasons */}
      <section className="additional-reasons">
        <div className="container">
          <h3>Looking for more reasons?</h3>
          <div className="reasons-grid">
            <div className="reason-item">
              <h4>Extensive support</h4>
              <p>
                Great support at no extra cost. No matter which plan you're on, you get extensive 
                technical assistance from our team.
              </p>
            </div>
            <div className="reason-item">
              <h4>Custom Pricing</h4>
              <p>
                If you're a high volume sender, you can call us or drop us an email to discuss 
                custom pricing that would fit your sending volume.
              </p>
              <button className="btn btn-primary">Contact sales</button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default FlareMail;