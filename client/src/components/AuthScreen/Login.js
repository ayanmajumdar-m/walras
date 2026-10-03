import React, { useEffect, useState } from "react";
import { useLocation, useSearchParams, Link } from "react-router-dom";
import { UserPlus, LogIn, ArrowRight, Link2 } from "lucide-react";
import CloudMark from "./buttr-cloud-mark.png";
import ButtrMark from "./buttr-mark.png";
import "./Auth.css";

const API_URL = process.env.REACT_APP_API_URL || "https://buttr.cloud";

const SignIn = () => {
  const [error, setError] = useState("");
  const [redirecting, setRedirecting] = useState(false);
  const [webUrl, setWebUrl] = useState("https://id.buttrcrew.com");
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const returnTo = location.state?.from?.pathname || "/dashboard";

  useEffect(() => {
    fetch(`${API_URL}/api/auth/config`)
      .then((res) => res.json())
      .then((cfg) => {
        if (cfg?.webUrl) setWebUrl(cfg.webUrl.replace(/\/+$/, ""));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const failure = searchParams.get("error");
    if (failure) {
      setError(failure);
      return;
    }

    const expiredFlag = localStorage.getItem("sessionExpired");
    const expiredMessage = localStorage.getItem("sessionExpiredMessage");
    if (expiredFlag || expiredMessage) {
      setError(expiredMessage || "Your session has expired. Please sign in again.");
      localStorage.removeItem("sessionExpired");
      localStorage.removeItem("sessionExpiredMessage");
    }
  }, [searchParams]);

  const signIn = () => {
    setRedirecting(true);
    window.location.href = `${API_URL}/api/auth/buttr/start?returnTo=${encodeURIComponent(returnTo)}`;
  };

  return (
    <div className="auth-wrapper">
      {/* Background ambient golden butter lighting */}
      <div className="auth-glow auth-glow-amber" />
      <div className="auth-glow auth-glow-gold" />
      <div className="auth-glow auth-glow-center" />

      {/* Smooth wave line SVG overlay with golden yellow theme */}
      <svg
        className="auth-bg-svg"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        preserveAspectRatio="none"
        viewBox="0 0 1000 1000"
      >
        <path
          d="M 1000,0 C 750,180 620,40 400,280 C 180,520 80,720 0,900 L 0,1000 L 1000,1000 Z"
          fill="url(#authYellowGradient)"
          opacity="0.09"
        />
        <path
          d="M 1000,100 C 800,220 700,120 500,320 C 300,520 150,700 0,850"
          stroke="url(#authLineGradient)"
          strokeWidth="1.2"
          opacity="0.25"
        />
        <path
          d="M 0,600 C 200,680 380,780 600,840 C 800,900 900,920 1000,960"
          stroke="url(#authLineGradient)"
          strokeWidth="1"
          opacity="0.2"
        />
        <defs>
          <linearGradient id="authYellowGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffd400" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#b45309" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="authLineGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffe96b" stopOpacity="0.8" />
            <stop offset="50%" stopColor="#ffd400" stopOpacity="0.65" />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.5" />
          </linearGradient>
        </defs>
      </svg>

      {/* Top Header */}
      <header className="auth-header">
        <Link to="/" className="auth-header-logo">
          <img src={CloudMark} alt="Walras Cloud" className="auth-header-img" />
          <span className="auth-header-brand">WALRAS CLOUD</span>
        </Link>
        <div className="auth-header-tag">
          CLOUD HOSTING
          <br />
          FOR EVERYONE
        </div>
      </header>

      {/* Center Container */}
      <main className="auth-main">
        <div className="auth-card-modern">
          {/* Linked Badges */}
          <div className="auth-badges">
            {/* Walras Cloud Badge */}
            <div className="auth-badge-col">
              <div className="auth-badge auth-badge-cloud">
                <img
                  src={CloudMark}
                  alt="Walras Cloud"
                  className="auth-badge-img drop-shadow-cloud"
                />
              </div>
              <span className="auth-badge-label">WALRAS CLOUD</span>
            </div>

            {/* Connecting Bridge with Yellow Glow */}
            <div className="auth-bridge">
              <div className="auth-bridge-line" />
              <div className="auth-bridge-node">
                <Link2 className="auth-bridge-icon" />
              </div>
            </div>

            {/* Buttr ID Badge */}
            <div className="auth-badge-col">
              <div className="auth-badge auth-badge-buttr">
                <img
                  src={ButtrMark}
                  alt="Buttr"
                  className="auth-badge-img drop-shadow-buttr"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                    e.currentTarget.parentElement?.querySelector(".fallback-b")?.classList.remove("hidden");
                  }}
                />
                <span className="fallback-b hidden auth-buttr-fallback">B</span>
              </div>
              <span className="auth-badge-label">BUTTR</span>
            </div>
          </div>

          {/* Heading */}
          <div className="auth-headings">
            <h1 className="auth-hero-title">
              Access Walras Cloud <br />
              with <span className="auth-hero-gradient">Buttr ID.</span>
            </h1>
            <p className="auth-hero-sub">
              One account. Seamless access to your cloud hosting.
            </p>
          </div>

          {error && <div className="auth-error-banner">{error}</div>}

          {/* Buttons */}
          <div className="auth-actions">
            <a
              href={`${webUrl}/signup?client_id=buttr-cloud&return_to=${encodeURIComponent(window.location.origin)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="auth-btn-create"
            >
              <UserPlus className="auth-btn-icon" />
              <span className="auth-btn-text">Create Account</span>
              <ArrowRight className="auth-btn-icon auth-btn-arrow" />
            </a>

            <button
              type="button"
              className="auth-btn-login"
              onClick={signIn}
              disabled={redirecting}
            >
              <LogIn className="auth-btn-icon" />
              <span className="auth-btn-text">
                {redirecting ? "Connecting to Buttr…" : "Login"}
              </span>
              <ArrowRight className="auth-btn-icon auth-btn-arrow" />
            </button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="auth-footer">
        By continuing, you agree to our{" "}
        <Link to="/terms" className="auth-footer-link">
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link to="/privacy" className="auth-footer-link">
          Privacy Policy
        </Link>
        .
      </footer>
    </div>
  );
};

export default SignIn;
