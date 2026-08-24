import React, { useEffect, useRef } from "react";
import "./Homepage.css";

// Animation wrapper component
const AnimatedSection = ({ children, delay = 0 }) => {
  const ref = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          entry.target.style.animationDelay = `${delay}ms`;
          entry.target.classList.add('animate-in');
        }
      },
      { threshold: 0.1 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, [delay]);

  return (
    <div ref={ref} className="section-animate">
      {children}
    </div>
  );
};

const Homepage = () => {
  const services = [
    {
      icon: "🌐",
      title: "Domains",
      description: "Comprehensive domain registration, transfer, and management with competitive pricing.",
      features: ["500+ TLDs Available", "Free WHOIS Protection", "Easy Domain Transfer", "Bulk Management"],
      actions: [{
        label: "Search Domain",
        href: "/domains"
      }],
    },
    {
      icon: "🖥️",
      title: "Flare Compute",
      description: "High-performance cloud VPS with SSD storage and instant deployment.",
      features: ["Instant Deployment", "SSD Storage", "Auto Scaling", "99.9% Uptime"],
      actions: [{
        label: "View Plans",
        href: "/about/pricing"
      }],
    },
  ];

  const upcomingFeatures = [
    { icon: "🎯", title: "NVIDIA GPU Servers", desc: "High-performance computing with latest NVIDIA GPUs" },
    { icon: "⚡", title: "AI/ML Optimized", desc: "Perfect for training and inference workloads" },
    { icon: "🔬", title: "Research Ready", desc: "Built for scientific computing and research" },
  ];

  const features = [
    { icon: "🚀", title: "Lightning Fast Performance", desc: "Optimized infrastructure with low-latency networks and high-performance hardware." },
    { icon: "🛡️", title: "Enterprise Security", desc: "Multiple layers of security with DDoS protection, firewalls, and automated backups." },
    { icon: "💰", title: "Cost Effective", desc: "Competitive pricing without hidden costs. Save up to 40% vs international providers." },
    { icon: "🌍", title: "Data Sovereignty", desc: "Keep your data within India with our locally hosted infrastructure and compliance." },
    { icon: "⚙️", title: "Easy Management", desc: "Intuitive control panel and API for seamless management and automation." },
    { icon: "📈", title: "Auto Scaling", desc: "Automatically scale your resources up or down based on demand." },
  ];

  const supportStats = [
    { number: "24/7", label: "Support Availability" },
    { number: "5min", label: "Avg Response Time" },
    { number: "99.9%", label: "Customer Satisfaction" },
  ];

  return (
    <div className="homepage">
      {/* Hero Section - Enhanced with animations */}
      <section className="hero">
        <div className="hero-container">
          <div className="hero-text">
            <AnimatedSection delay={200}>
              <div
                style={{
                  display: "inline-block",
                  background: "#e0e0e0",
                  color: "#000",
                  padding: "6px 14px",
                  borderRadius: "8px",
                  fontWeight: "600",
                  fontSize: "14px",
                  boxShadow: "0 0 10px rgba(150,150,150,0.7), 0 0 20px rgba(180,180,180,0.5)",
                  animation: "pulseGlow 1.8s infinite ease-in-out",
                }}
              >
                🔥 Introducing India's Own Cloud
              </div>
            </AnimatedSection>

            <AnimatedSection delay={400}>
              <h1 className="hero-title">
                <span className="gradient-text animate-gradient">The Straightforward Cloud</span>
              </h1>
            </AnimatedSection>

            <AnimatedSection delay={600}>
              <p className="hero-subtitle">
                Tired of using AWS, DigitalOcean, or Akamai Cloud? Looking for a Desi alternative?
                Switch to Buttr Cloud and make the shift today!
              </p>
            </AnimatedSection>

            <AnimatedSection delay={800}>
              <div className="hero-actions">
                <a href="/login">
                  <button className="hero-btn btn-glow">Get Started</button>
                </a>
                <a href="/contact">
                  <button className="hero-btn secondary btn-float">Contact Sales</button>
                </a>
              </div>
            </AnimatedSection>
          </div>

          <AnimatedSection delay={1000}>
            <div className="hero-graphic">
              <div className="floating-graphic">
                <svg width="420" height="420" viewBox="0 0 420 420" fill="none">
                  <circle cx="210" cy="210" r="190" stroke="white" strokeOpacity="0.08" strokeWidth="40" className="spin-slow" />
                  <circle cx="210" cy="210" r="140" stroke="white" strokeOpacity="0.05" strokeWidth="30" className="spin-reverse" />
                  <polygon points="210,80 340,340 80,340" fill="url(#grad1)" opacity="0.15" className="float" />
                  <rect x="130" y="130" width="160" height="160" rx="40" fill="url(#grad2)" opacity="0.12" className="pulse-soft" />
                  <defs>
                    <linearGradient id="grad1" x1="80" y1="340" x2="340" y2="340">
                      <stop stopColor="#fff" stopOpacity="0.7" />
                      <stop offset="1" stopColor="#d1d5db" stopOpacity="0.3" />
                    </linearGradient>
                    <linearGradient id="grad2" x1="130" y1="130" x2="290" y2="290">
                      <stop stopColor="#fff" stopOpacity="0.5" />
                      <stop offset="1" stopColor="#d1d5db" stopOpacity="0.1" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>
            </div>
          </AnimatedSection>
        </div>

        {/* Animated background elements */}
        <div className="hero-bg-elements">
          <div className="bg-orb orb-1"></div>
          <div className="bg-orb orb-2"></div>
          <div className="bg-orb orb-3"></div>
        </div>
      </section>

      {/* Commitments Section */}
      <AnimatedSection>
        <section className="commitments">
          <div className="container">
            <div className="section-header-compact">
              <div className="badge pulse-glow">Guaranteed by Buttr Cloud</div>
              <h2 className="section-title">Our Commitments!</h2>
              <p className="section-subtitle">Three promises that power every product we ship.</p>
            </div>

            <div className="commitments-grid">
              <div className="commitment-card card-hover">
                <div className="commitment-icon icon-float">⚡</div>
                <h3 className="commitment-title">Uptime Promise</h3>
                <div className="commitment-value">99.9%</div>
                <p className="commitment-description">
                  We guarantee 99.9% uptime for your servers, that's the Buttr Cloud promise.
                </p>
              </div>

              <div className="commitment-card card-hover">
                <div className="commitment-icon icon-float">🎯</div>
                <h3 className="commitment-title">Fastest Resolution</h3>
                <div className="commitment-value">24/7</div>
                <p className="commitment-description">
                  We're available 24/7 with a 60-Minute Response Guarantee, so you never have to worry about a thing.
                </p>
              </div>

              <div className="commitment-card card-hover">
                <div className="commitment-icon icon-float">🎁</div>
                <h3 className="commitment-title">Free Trial</h3>
                <div className="commitment-value">168 Hours</div>
                <p className="commitment-description">
                  Enjoy a 168 Hours free trial on our Cloud VPS, experience worry-free performance!
                </p>
              </div>
            </div>
          </div>
        </section>
      </AnimatedSection>

      {/* Enhanced Services Section */}
      <AnimatedSection>
        <section className="services-compact">
          <div className="container">
            <div className="section-header-compact">
              <h2 className="section-title">Our Core Services</h2>
              <p className="section-subtitle">Complete infrastructure solutions for businesses of all sizes</p>
            </div>

            <div className="services-grid-compact">
              {services.map((srv, i) => (
                <div className="service-card-compact card-hover" key={i}>
                  <div className="service-header">
                    <div className="service-icon-compact icon-float">{srv.icon}</div>
                    <h3>{srv.title}</h3>
                  </div>
                  <p className="service-description">{srv.description}</p>
                  <div className="service-features-compact">
                    {srv.features.map((f, idx) => (
                      <span key={idx} className="feature-tag tag-pop">{f}</span>
                    ))}
                  </div>
                  <div className="service-actions-compact">
                    {srv.actions.map((a, idx) => (
                      <button
                        key={idx}
                        className={`service-btn-compact ${idx === 0 ? "primary btn-glow" : "secondary btn-float"}`}
                        onClick={() => window.location.href = a.href}
                      >
                        {a.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </AnimatedSection>

      {/* Enhanced Coming Soon Section */}
      <AnimatedSection>
        <section className="coming-soon-compact">
          <div className="container">
            <div className="coming-soon-content-compact">
              <div className="coming-soon-header">
                <div className="coming-soon-badge-compact pulse">
                  <span className="pulse">🚀</span> Coming Soon
                </div>
                <h2 className="coming-soon-title-compact">GPU & Bare Metal Servers</h2>
                <p className="coming-soon-description-compact">
                  Get ready for GPU-accelerated bare metal servers built for AI, ML, and high-performance workloads.
                </p>
              </div>

              <div className="upcoming-features-compact">
                {upcomingFeatures.map((f, i) => (
                  <div className="upcoming-feature-compact card-float" key={i}>
                    <div className="feature-icon-compact icon-bounce">{f.icon}</div>
                    <div className="feature-content">
                      <h4>{f.title}</h4>
                      <p>{f.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="notify-form-compact">
                <input type="email" placeholder="Enter your email for early access" className="notify-input-compact input-glow" />
                <button className="notify-btn-compact btn-glow">Notify Me</button>
              </div>
            </div>
          </div>
        </section>
      </AnimatedSection>

      {/* Enhanced Features Section */}
      {/* <AnimatedSection>
        <section className="features-compact">
          <div className="container">
            <div className="section-header-compact">
              <h2 className="section-title">Why Choose Buttr Cloud?</h2>
              <p className="section-subtitle">Enterprise-grade infrastructure with Indian roots</p>
            </div>
            <div className="features-grid-compact">
              {features.map((f, i) => (
                <div className="feature-item-compact card-hover" key={i}>
                  <div className="feature-icon-wrapper">
                    <div className="feature-icon-compact icon-spin">{f.icon}</div>
                  </div>
                  <div className="feature-content">
                    <h4>{f.title}</h4>
                    <p>{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </AnimatedSection> */}

      {/* Enhanced Support Section */}
      <AnimatedSection>
        <section className="support-compact">
          <div className="container">
            <div className="support-content-compact">
              <div className="support-text-compact">
                {/* <div
                  style={{
                    display: "inline-block",
                    background: "#e0e0e0",
                    color: "#000",
                    padding: "6px 14px",
                    borderRadius: "8px",
                    fontWeight: "600",
                    fontSize: "14px",
                    boxShadow: "0 0 10px rgba(150,150,150,0.7), 0 0 20px rgba(180,180,180,0.5)",
                    animation: "pulseGlow 1.8s infinite ease-in-out",
                  }}
                >
                  🔥 Always there for you
                </div>   */}
                              <h2 className="section-title">24×7 Expert Support</h2>
                <p className="support-description-compact">
                  Our certified experts are available 24×7. Get instant support via chat, phone, or email.
                </p>

                <div className="support-stats-compact">
                  {supportStats.map((s, i) => (
                    <div className="stat-compact stat-pop" key={i}>
                      <div className="stat-number-compact">{s.number}</div>
                      <div className="stat-label-compact">{s.label}</div>
                    </div>
                  ))}
                </div>

                <div className="support-features-compact">
                  <div className="support-feature-compact">
                    <span className="feature-check">✓</span> Phone, Chat & Email Support
                  </div>
                  <div className="support-feature-compact">
                    <span className="feature-check">✓</span> Technical Experts
                  </div>
                  <div className="support-feature-compact">
                    <span className="feature-check">✓</span> Documentation & Tutorials
                  </div>
                </div>
              </div>

              <div className="support-graphic-compact">
                <div className="support-chat chat-float">
                  <div className="chat-bubble type-animation">Hello! How can I help you today?</div>
                  <div className="chat-status">Connected • 24/7 Support</div>
                  <div className="chat-avatar avatar-bounce">👨‍💻</div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </AnimatedSection>

      {/* Enhanced CTA Section */}
      <AnimatedSection>
        <section className="cta-compact">
          <div className="container">
            <div className="cta-content-compact">
              <h2 className="cta-title-compact">Ready to Get Started?</h2>
              <p className="cta-subtitle-compact">
                Join thousands of developers and businesses who trust Buttr Cloud.
              </p>
              <div className="cta-actions-compact">
                <button className="cta-btn-compact primary btn-glow">Get Started</button>
                <button onClick={() => window.location.href = "https://help.buttr.cloud"} className="cta-btn-compact outline btn-float">View Documentation</button>
              </div>
            </div>
          </div>
        </section>
      </AnimatedSection>
    </div>
  );
};

export default Homepage;