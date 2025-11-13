import React from 'react';
import './Pricing.css';
import { Server, Cpu, HardDrive, Wifi, Zap, Shield, Clock, HelpCircle } from 'lucide-react';

const Pricing = () => {
  const sharedPlans = [
    {
      name: "SFC-4GB",
      monthlyPrice: "₹900",
      hourlyPrice: "₹1.25/hr",
      ram: "4GB DDR4 RAM",
      cpu: "2 vCPU Cores",
      storage: "60GB SSD",
      bandwidth: "2TB BANDWIDTH @10 Gbps",
      ip: "1 IPv4 Address",
      popular: false
    },
    {
      name: "SFC-8GB",
      monthlyPrice: "₹1,800",
      hourlyPrice: "₹2.50/hr",
      ram: "8GB DDR4 RAM",
      cpu: "4 vCPU Cores",
      storage: "120GB SSD",
      bandwidth: "4TB BANDWIDTH @10 Gbps",
      ip: "1 IPv4 Address",
      popular: false
    },
    {
      name: "SFC-16GB",
      monthlyPrice: "₹3,600",
      hourlyPrice: "₹5.00/hr",
      ram: "16GB DDR4 RAM",
      cpu: "6 vCPU Cores",
      storage: "240GB SSD",
      bandwidth: "6TB BANDWIDTH @10 Gbps",
      ip: "1 IPv4 Address",
      popular: true
    },
    {
      name: "SFC-32GB",
      monthlyPrice: "₹5,400",
      hourlyPrice: "₹7.50/hr",
      ram: "32GB DDR4 RAM",
      cpu: "10 vCPU Cores",
      storage: "480GB SSD",
      bandwidth: "10TB BANDWIDTH @10 Gbps",
      ip: "1 IPv4 Address",
      popular: false
    }
  ];

  const features = [
    { icon: <Clock className="feature-icon" />, text: "24/7 Email and Ticket Support" },
    { icon: <Server className="feature-icon" />, text: "User Friendly Server Manager" },
    { icon: <Shield className="feature-icon" />, text: "99.99% Uptime Guarantee" },
    { icon: <Zap className="feature-icon" />, text: "168-HOURS Free Trial" },
    { icon: <HelpCircle className="feature-icon" />, text: "Complete Documentation & Video Tutorials" },
    // { icon: <Wifi className="feature-icon" />, text: "Live Chat Support Available as Addon" }
  ];

  return (
    <div className="pricing-page">
      {/* Hero Section */}
      <section className="pricing-hero">
        <div className="container">
          <h1 className="pricing-title">Scalable & Simplified Pricing</h1>
          <p className="pricing-subtitle">
            Simple, all-inclusive plans for server, storage, and transfer. No hidden fees, scale with confidence and pay only for the term you need.
          </p>
          <div className="pricing-actions">
            <a href="#plans-section" className="btn primary">View All Plans</a>
          </div>
        </div>
      </section>

      {/* Important Notice */}
      <section className="important-notice">
        <div className="container">
          <div className="notice-content">
            <Shield className="notice-icon" />
            <div>
              <h3>Important Notice</h3>
              <p>
                Our India-based servers are currently at full capacity and are not available for new deployments.
                We are working on expanding our capacity. All new deployments will be on our Singapore servers.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Plans Section */}
      <section className="plans-section" id='plans-section'>
        <div className="container">
          <div className="section-header">
            <h2 className="section-title">Shared CPU Plans</h2>
            <p className="section-subtitle">Choose the perfect plan for your workload</p>
          </div>

          {/* Currency Selector */}
          <div className="currency-selector">
            <span>Currency:</span>
            <div className="currency-buttons">
              <button className="currency-btn active">INR ₹</button>
              <button className="currency-btn">USD $</button>
            </div>
          </div>

          {/* Plans Grid */}
          <div className="plans-grid">
            {sharedPlans.map((plan, index) => (
              <div className={`plan-card ${plan.popular ? 'popular' : ''}`} key={index}>
                {plan.popular && <div className="popular-badge">Most Popular</div>}
                <div className="plan-header">
                  <h3 className="plan-name">{plan.name}</h3>
                  <div className="plan-price">
                    <span className="monthly-price">{plan.hourlyPrice} | {plan.monthlyPrice}/mo</span>
                  </div>
                </div>

                <div className="plan-features">
                  <div className="feature-item">
                    <Server className="feature-icon" />
                    <span>{plan.ram}</span>
                  </div>
                  <div className="feature-item">
                    <Cpu className="feature-icon" />
                    <span>{plan.cpu}</span>
                  </div>
                  <div className="feature-item">
                    <HardDrive className="feature-icon" />
                    <span>{plan.storage}</span>
                  </div>
                  <div className="feature-item">
                    <Wifi className="feature-icon" />
                    <span>{plan.bandwidth} Transfer</span>
                  </div>
                  {/* <div className="feature-item">
                    <Zap className="feature-icon" />
                    <span>{plan.speed}</span>
                  </div> */}
                </div>

                <button
                  onClick={() => {
                    window.location.href = "/login";
                  }}
                  className={`btn plan-btn  ${plan.popular ? 'primary' : 'secondary'}`}
                  aria-disabled="true"
                >
                  Deploy
                </button>
              </div>

            ))}

          </div>
          <div className='note' style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-evenly', height: '20px',marginBottom:'100px' }}>
            <p className="tax-note">Tax not included. Final amount shown at checkout</p>
            <p className="tax-note">@1Gbps for Asian locations</p>


          </div>




        </div>
      </section>

      {/* Services Section */}
      <section className="services-section">
        <div className="container">
          <div className="section-header">
            <h2 className="section-title">Additional Services</h2>
            <p className="section-subtitle">Enhance your cloud experience with our premium services</p>
          </div>

          <div className="services-grid">
            <div className="service-card">
              <div className="service-icon">
                <Server className="icon" />
              </div>
              <h3>Infrastructure Management</h3>
              <p>Managed by Us – Let us handle your server management for ₹15,000 per server per month. We take care of updates, monitoring, security, and technical support.</p>
              {/* <a className="btn secondary" href="/account/services">Add to My Account</a> */}
            </div>

            <div className="service-card">
              <div className="service-icon">
                <Zap className="icon" />
              </div>
              <h3>Cloud Consulting and Migration</h3>
              <p>Need Migration Help? Open a support ticket or email our team for guidance on moving your workloads to the cloud.</p>
              {/* <a className="btn secondary" href="/contact">Get a Quote</a> */}
            </div>

            <div className="service-card">
              <div className="service-icon">
                <Shield className="icon" />
              </div>
              <h3>Multiple Data Center Locations</h3>
              <p>Our premium data centers in Mumbai, India and London, UK offer fast, secure, and reliable cloud infrastructure with local compliance and support.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="features-section">
        <div className="features-container">
          <div className="features-header">
            <h2 className="features-title">All Plans Include</h2>
            <p className="features-subtitle">
              Everything you need to run your applications smoothly
            </p>
          </div>

          <div className="features-grid">
            {features.map((feature, index) => (
              <div className="feature-card" key={index}>
                <div className="feature-icon">{feature.icon}</div>
                <p className="feature-text">{feature.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

    </div>
  );
};

export default Pricing;