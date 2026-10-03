import React from 'react';
import './About.css';
import { Shield, Zap, Server, Clock, Wallet, Globe } from 'lucide-react';

const About = () => {
  const features = [
    { 
      icon: <Shield className="feature-icon" />,
      title: "Enterprise Security",
      description: "Multiple layers of security with DDoS protection, firewalls, and automated backups."
    },
    {
      icon: <Zap className="feature-icon" />,
      title: "Lightning Fast Performance",
      description: "Optimized infrastructure with low-latency networks and high-performance hardware."
    },
    {
      icon: <Server className="feature-icon" />,
      title: "Auto Scaling",
      description: "Automatically scale your resources up or down based on demand."
    },
    {
      icon: <Clock className="feature-icon" />,
      title: "99.9% Uptime",
      description: "We guarantee 99.9% uptime for your servers with redundant infrastructure."
    },
    {
      icon: <Wallet className="feature-icon" />,
      title: "Cost Effective",
      description: "Save up to 40% compared to international providers with our local pricing."
    },
    {
      icon: <Globe className="feature-icon" />,
      title: "Data Sovereignty",
      description: "Keep your data within India with our locally hosted infrastructure."
    }
  ];

  return (
    <div className="about-page">
      <section className="about-hero">
        <div className="container">
          <h1 className="about-title">Why Walras Cloud?</h1>
          <p className="about-subtitle">
            Built in India, for India and the world. We're on a mission to make enterprise-grade cloud computing accessible to everyone.
          </p>
        </div>
      </section>

      {/* (Sub-navigation removed - Pricing is a separate route linked from the main navbar) */}

      <section className="why-choose-section">
        <div className="container">
          <div className="section-header">
            <h2 className="section-title">Why Choose Walras Cloud?</h2>
            <p className="section-subtitle">
              Experience the perfect blend of performance, reliability, and cost-effectiveness
            </p>
          </div>

          <div className="features-grid">
            {features.map((feature, index) => (
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

      <section className="mission-section">
        <div className="container">
          <div className="mission-content">
            <h2 className="section-title">Our Mission</h2>
            <p className="mission-text">
              At Walras Cloud, we believe in democratizing cloud computing. Our mission is to provide enterprise-grade cloud infrastructure at local prices, making it accessible to businesses of all sizes. We're committed to supporting India's digital transformation by offering world-class technology with local expertise.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default About;