import React from 'react';
import './Contact.css';
import { Mail, Phone, MapPin, MessageCircle, Clock, Shield, Zap } from 'lucide-react';

const Contact = () => {
  const contactMethods = [
    {
      icon: <Mail className="contact-icon" />,
      title: "Email Support",
      description: "24/7 Available",
      details: "support@superflare.io",
      link: "mailto:support@superflare.io",
      color: "#3b82f6"
    },
    {
      icon: <Phone className="contact-icon" />,
      title: "Contact Sales",
      description: "Monday to Saturday 10 AM TO 6 PM",
      details: "+91 94296 94951",
      link: "tel:+919429694951",
      color: "#10b981"
    },
    {
      icon: <MapPin className="contact-icon" />,
      title: "Office Address",
      description: "Visit our headquarters",
      details: "IOOGNS HQ, Khudiram Sarani, Duttapukur, North 24 Parganas, Barasat I, West Bengal, India, 743248",
      link: "https://maps.google.com",
      color: "#8b5cf6"
    },
  ];

  const supportFeatures = [
    {
      icon: <Shield className="feature-icon" />,
      title: "24/7 Security Monitoring",
      description: "Round-the-clock monitoring to keep your infrastructure secure"
    },
    {
      icon: <Zap className="feature-icon" />,
      title: "Fast Response Times",
      description: "Average response time under 15 minutes for critical issues"
    },
    {
      icon: <Clock className="feature-icon" />,
      title: "99.9% Uptime Support",
      description: "Dedicated support team ensuring maximum uptime for your services"
    }
  ];

  return (
    <div className="contact-page">
      {/* Hero Section */}
      <section className="contact-hero">
        <div className="container">
          <h1 className="contact-title">Contact Us</h1>
          <p className="contact-subtitle">
            We'd love to hear from you. Reach us through any of the channels below and we'll get back to you quickly.
          </p>
        </div>
      </section>

      {/* Contact Methods Grid */}
      <section className="contact-methods-section">
        <div className="container">
          <div className="section-header">
            <h2 className="section-title">Get In Touch</h2>
            <p className="section-subtitle">
              Multiple ways to connect with our support team
            </p>
          </div>

          <div className="contact-grid">
            {contactMethods.map((method, index) => (
              <div className="contact-card" key={index}>
                <div 
                  className="contact-icon-wrapper"
                  style={{ '--icon-color': method.color }}
                >
                  {method.icon}
                </div>
                <h3 className="contact-method-title">{method.title}</h3>
                <p className="contact-method-description">{method.description}</p>
                <p className="contact-method-details">{method.details}</p>
                <a href={method.link} className="btn secondary">
                  {method.title.includes('Contact') && 'Call Now'}
                  {method.title.includes('Address') && 'Get Directions'}
                  {method.title.includes('Support') && ' Get Support'}
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Support Features */}
      <section className="support-features-section">
        <div className="container">
          <div className="section-header">
            <h2 className="section-title">Why Our Support Stands Out</h2>
            <p className="section-subtitle">
              Enterprise-grade support tailored to your needs
            </p>
          </div>

          <div className="features-grid">
            {supportFeatures.map((feature, index) => (
              <div className="feature-card" key={index}>
                <div className="feature-icon-wrapper">
                  {feature.icon}
                </div>
                <h3 className="feature-title">{feature.title}</h3>
                <p className="feature-description">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Additional Info Section */}
      <section className="info-section">
        <div className="container">
          <div className="info-grid">
            <div className="info-card">
              <h3>Response Time Guarantee</h3>
              <div className="response-times">
                <div className="time-item">
                  <span className="priority">Critical Issues</span>
                  <span className="time">Under 30 minutes</span>
                </div>
                <div className="time-item">
                  <span className="priority">High Priority</span>
                  <span className="time">Under 1 hour</span>
                </div>
                <div className="time-item">
                  <span className="priority">General Support</span>
                  <span className="time">Under 4 hours</span>
                </div>
              </div>
            </div>

            <div className="info-card">
              <h3>Support Coverage</h3>
              <ul className="coverage-list">
                <li>24/7 Email & Ticket Support</li>
                <li>Live Chat Add-on Available</li>
                <li>Comprehensive Documentation</li>
                <li>Video Tutorial Library</li>
                <li>Community Forum Access</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <div className="container">
          <div className="cta-content">
            <h2 className="cta-title">Ready to Get Started?</h2>
            <p className="cta-subtitle">
              Join thousands of satisfied customers using Buttr Cloud
            </p>
            <div className="cta-actions">
              <a href="/about/pricing" className="btn primary">Deploy Your Server</a>
              <a href="https://help.superflare.io" className="btn secondary">View Documentation</a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Contact;