import React, { useState, useEffect } from "react";
import { Server, Cpu, HardDrive, Zap, Clock, Mail, MemoryStick, Network } from "lucide-react";
import "./BareMetal.css";

const BareMetal = () => {
  const [email, setEmail] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [selectedServer, setSelectedServer] = useState(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (email) {
      console.log("Email submitted:", email);
      setIsSubmitted(true);
      setEmail("");
    }
  };

  const servers = [
    {
      id: 1,
      name: "BM1 - Starter",
      cpu: "Intel Xeon E-2388G",
      cpuCores: "8 Cores / 16 Threads",
      ram: "32GB DDR4 ECC",
      storage: "1TB NVMe SSD",
      bandwidth: "1Gbps Unmetered",
      price: "$199",
      interval: "month",
      status: "out-of-stock",
      features: ["3.2 GHz Base Clock", "ECC Memory Support", "IPMI Access"]
    },
    {
      id: 2,
      name: "BM2 - Performance",
      cpu: "AMD EPYC 7313",
      cpuCores: "16 Cores / 32 Threads",
      ram: "64GB DDR4 ECC",
      storage: "2TB NVMe SSD RAID 1",
      bandwidth: "10Gbps Unmetered",
      price: "$399",
      interval: "month",
      status: "out-of-stock",
      features: ["3.0 GHz Base Clock", "Dual NVMe Drives", "Redundant Power"]
    },
    {
      id: 3,
      name: "BM3 - Enterprise",
      cpu: "Intel Xeon Silver 4310",
      cpuCores: "12 Cores / 24 Threads",
      ram: "128GB DDR4 ECC",
      storage: "4TB NVMe SSD + 16TB HDD",
      bandwidth: "10Gbps Unmetered",
      price: "$599",
      interval: "month",
      status: "out-of-stock",
      features: ["Hybrid Storage", "Hardware RAID", "24/7 Monitoring"]
    },
    {
      id: 4,
      name: "BM4 - High Frequency",
      cpu: "AMD EPYC 7543P",
      cpuCores: "32 Cores / 64 Threads",
      ram: "256GB DDR4 ECC",
      storage: "8TB NVMe SSD RAID 10",
      bandwidth: "25Gbps Unmetered",
      price: "$899",
      interval: "month",
      status: "out-of-stock",
      features: ["3.7 GHz Boost Clock", "Quad Channel Memory", "Dual 25G NIC"]
    },
    {
      id: 5,
      name: "BM5 - Ultimate",
      cpu: "Dual Intel Xeon Gold 6314U",
      cpuCores: "64 Cores / 128 Threads",
      ram: "512GB DDR4 ECC",
      storage: "16TB NVMe SSD + 48TB HDD",
      bandwidth: "100Gbps Unmetered",
      price: "$1,499",
      interval: "month",
      status: "out-of-stock",
      features: ["Dual Processors", "All-Flash Array", "Tier IV Datacenter"]
    }
  ];

  return (
    <div className="bare-metal-servers">
      {/* Background Elements */}
      <div className="bm-background-elements">
        <div className="bm-orb bm-orb-1"></div>
        <div className="bm-orb bm-orb-2"></div>
        <div className="bm-orb bm-orb-3"></div>
      </div>

      <div className="bm-container">
        {/* Header Section */}
        <div className="bm-header">
          <div className="bm-badge">
            <Server size={20} />
            <span>Coming Soon...</span>
          </div>
          <h1 className="bm-title">
            <span className="bm-accent">Bare Metal</span>
          </h1>
          {/* <p className="bm-subtitle">
            Coming Soon...
          </p> */}
        </div>

        {/* Server Grid */}
        {/* <div className="bm-servers-grid">
          {servers.map((server) => (
            <div key={server.id} className={`bm-server-card ${server.status}`}>
              <div className="bm-server-header">
                <h3 className="bm-server-name">{server.name}</h3>
                <div className="bm-server-price">
                  <span className="bm-price-amount">{server.price}</span>
                  <span className="bm-price-interval">/{server.interval}</span>
                </div>
              </div>

              <div className="bm-server-specs">
                <div className="bm-spec-item">
                  <Cpu size={18} />
                  <div className="bm-spec-content">
                    <span className="bm-spec-label">Processor</span>
                    <span className="bm-spec-value">{server.cpu}</span>
                    <span className="bm-spec-detail">{server.cpuCores}</span>
                  </div>
                </div>

                <div className="bm-spec-item">
                  <MemoryStick size={18} />
                  <div className="bm-spec-content">
                    <span className="bm-spec-label">Memory</span>
                    <span className="bm-spec-value">{server.ram}</span>
                  </div>
                </div>

                <div className="bm-spec-item">
                  <HardDrive size={18} />
                  <div className="bm-spec-content">
                    <span className="bm-spec-label">Storage</span>
                    <span className="bm-spec-value">{server.storage}</span>
                  </div>
                </div>

                <div className="bm-spec-item">
                  <Network size={18} />
                  <div className="bm-spec-content">
                    <span className="bm-spec-label">Bandwidth</span>
                    <span className="bm-spec-value">{server.bandwidth}</span>
                  </div>
                </div>
              </div>

              <div className="bm-server-features">
                {server.features.map((feature, index) => (
                  <span key={index} className="bm-feature-tag">
                    {feature}
                  </span>
                ))}
              </div>

              <div className="bm-server-status">
                <div className="bm-status-indicator"></div>
                <span className="bm-status-text">Out of Stock</span>
              </div>

              <button 
                className="bm-server-btn bm-out-of-stock-btn"
                disabled
              >
                Notify When Available
              </button>
            </div>
          ))}
        </div> */}

        {/* Notification Form */}
        <div className="bm-notification">
          <div className="bm-notification-content">
            <div className="bm-notification-header">
              <Mail size={24} />
              <h3>Get Stock Notifications</h3>
            </div>
            <p className="bm-notification-text">
              Be the first to know when our Bare Metal servers become available. Limited inventory expected.
            </p>
            
            {isSubmitted ? (
              <div className="bm-success-message">
                <Mail size={20} />
                <span>Thank you! We'll notify you when servers are available.</span>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="bm-notification-form">
                <div className="bm-input-group">
                  <input
                    type="email"
                    placeholder="Enter your email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="bm-email-input"
                  />
                  <button type="submit" className="bm-notify-btn">
                    Notify Me
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Additional Info */}
        {/* <div className="bm-additional-info">
          <div className="bm-info-grid">
            <div className="bm-info-item">
              <div className="bm-info-number">99.9%</div>
              <div className="bm-info-label">Uptime SLA</div>
            </div>
            <div className="bm-info-item">
              <div className="bm-info-number">24/7</div>
              <div className="bm-info-label">Support</div>
            </div>
            <div className="bm-info-item">
              <div className="bm-info-number">Global</div>
              <div className="bm-info-label">Data Centers</div>
            </div>
          </div>
        </div> */}
      </div>
    </div>
  );
};

export default BareMetal;