import React from "react";
import "./WalrasGuarantee.css";
import { Clock, RefreshCw, Sparkles, CheckCircle2 } from "lucide-react";

// Official AWS Logo SVG
const AwsLogo = () => (
  <svg viewBox="0 0 120 70" width="46" height="30" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* 'a' */}
    <path
      d="M27 38.5c0-4.6-1.4-8.2-4.3-10.8-2.9-2.6-7-3.9-12.3-3.9-3.5 0-6.6.6-9.1 1.8v6c2.5-1.4 5.3-2.1 8.3-2.1 2.6 0 4.6.7 5.9 2 1.3 1.3 2 3.1 2 5.4v1.2c-2.3 0-5.1.3-8.3.8-4.1.7-7 1.9-8.7 3.8-1.7 1.9-2.6 4.3-2.6 7.3 0 2.9 1 5.2 3 6.9 2 1.7 4.7 2.6 8.2 2.6 3.7 0 6.5-1 8.5-3v2.4h6.4V38.5h-.1zm-6.4 13.4c-.9 1.3-2.3 2.1-4.3 2.1-1.6 0-2.9-.5-3.8-1.4-.9-1-1.3-2.2-1.3-3.7 0-1.7.6-3 1.6-3.9 1-1 2.9-1.5 5.4-1.7 1.4-.1 2.1-.1 2.4-.1v8.7z"
      fill="#1fc4a2"
    />
    {/* 'w' */}
    <path
      d="M62.8 24.2h-7l-6.5 23.4-6.3-23.4h-7.3l-6.3 23.4-6.5-23.4h-7l9.4 32.3h7.2l6.3-22.8 6.3 22.8h7.2l9.4-32.3h-.9z"
      fill="#1fc4a2"
    />
    {/* 's' */}
    <path
      d="M98.8 37.6c-.5-4.1-2.1-7.4-4.9-9.7-2.8-2.3-6.5-3.5-11.3-3.5-4.3 0-8.1 1.2-11.2 3.5-3.1 2.3-4.6 5.6-4.6 9.8 0 3.2 1.1 5.8 3.2 7.7 2.1 1.9 5.1 3.5 8.9 4.6 2.7.9 4.6 1.6 5.7 2.4 1.1.8 1.5 1.7 1.5 2.9 0 1.4-.7 2.6-2 3.6-1.3 1-3.3 1.4-5.8 1.4-3.2 0-6.5-.9-10-2.7v6.1c3.4 1.5 7.1 2.3 11.2 2.3 5.1 0 9-1.2 11.8-3.7 2.8-2.5 4.1-5.8 4.1-9.8 0-3.2-1.1-5.8-3.1-7.8-2-2-5-3.7-9-4.8-2.6-.8-4.4-1.5-5.5-2.3-1.1-.8-1.5-1.7-1.5-2.9 0-1.3.6-2.3 1.8-3.1 1.2-.8 2.9-1.2 4.9-1.2 2.6 0 5.2.7 7.9 2l2.3-5.8z"
      fill="#1fc4a2"
    />
    {/* Smile Arrow */}
    <path
      d="M10.8 57.5c22.5 12.5 53.6 14.2 76.5 2.1 2.3-1.2 4.6-2.5 6.7-4 1.2-.9 2.5.8 1.4 1.8-8.2 6.8-19.2 10.8-30.2 11.8-18.8 1.7-38.4-3-55.8-13-1.1-.7.2-2.3 1.4-1.7z"
      fill="#ff9900"
    />
    <path
      d="M97.2 55.4c-2.4-.7-7.2-.5-9.4-.3-.7.1-.9-.7-.3-1.1 3.8-2.5 9.8-1.8 11.8.6.9 1.1.2 7.2-3.2 10.3-.6.6-1.2.2-1-.5.7-2.4 1.3-7-.9-9z"
      fill="#ff9900"
    />
  </svg>
);

const DEFAULT_GUARANTEES = [
  {
    id: "resolution",
    icon: <Clock size={26} className="guarantee-icon" />,
    badge: "PRIORITY SLA",
    title: "4 Hours Resolution Guaranteed",
    desc: "Fast, definitive resolutions. Our expert cloud engineers guarantee response and critical resolution within 4 hours."
  },
  {
    id: "renewal",
    icon: <RefreshCw size={26} className="guarantee-icon" />,
    badge: "PRICE LOCK",
    title: "Same Renewal, No Hike",
    desc: "Zero hidden bait-and-switch price hikes. Your renewal cost stays the exact same rate as the day you signed up."
  },
  {
    id: "aws",
    isAws: true,
    badge: "TIER-4 CLOUD",
    title: "AWS Infrastructure",
    desc: "Hosted directly on enterprise-grade Amazon Web Services cloud compute with 99.9% uptime and bulletproof reliability."
  }
];

const WalrasGuarantee = ({
  kicker = "THE WALRAS COMMITMENT",
  title = "Walras Guarantee",
  subtitle = "Four uncompromising promises built into every single service we deliver.",
  guarantees = DEFAULT_GUARANTEES
}) => {
  return (
    <section className="walras-guarantee-section">
      <div className="walras-guarantee-container">
        {/* Glow ambient background */}
        <div className="guarantee-ambient-glow" />

        <div className="guarantee-header">
          <span className="guarantee-kicker">
            <Sparkles size={14} />
            {kicker}
          </span>
          <h2 className="guarantee-title">{title}</h2>
          <p className="guarantee-subtitle">{subtitle}</p>
        </div>

        <div className="guarantee-grid">
          {guarantees.map((item) => (
            <div key={item.id} className="guarantee-card">
              <div className="guarantee-card-top">
                <div className="guarantee-icon-wrapper">
                  {item.isAws ? <AwsLogo /> : item.icon}
                </div>
                {item.badge && <span className="guarantee-badge">{item.badge}</span>}
              </div>

              <h3 className="guarantee-card-title">{item.title}</h3>
              <p className="guarantee-card-desc">{item.desc}</p>

              <div className="guarantee-card-footer">
                <CheckCircle2 size={15} className="guarantee-check" />
                <span>Guaranteed by Walras Cloud</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default WalrasGuarantee;
