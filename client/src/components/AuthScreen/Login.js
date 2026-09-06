import React, { useEffect, useState } from "react";
import { useLocation, useSearchParams, Link } from "react-router-dom";
import { UserPlus, LogIn, ArrowRight, Link2, Cloud } from "lucide-react";
import Logo from "../logo.png";
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
      {/* Background ambient lighting */}
      <div className="auth-glow auth-glow-purple" />
      <div className="auth-glow auth-glow-amber" />

      {/* Top Header */}
      <header className="auth-header">
        <Link to="/" className="auth-header-logo">
          <img src={Logo} alt="Buttr Cloud" className="auth-header-img" />
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
            {/* Buttr Cloud Badge */}
            <div className="auth-badge-col">
              <div className="auth-badge auth-badge-cloud">
                <Cloud className="auth-badge-icon text-indigo-300" />
              </div>
              <span className="auth-badge-label">BUTTR CLOUD</span>
            </div>

            {/* Glowing bridge */}
            <div className="auth-bridge">
              <div className="auth-bridge-line" />
              <div className="auth-bridge-node">
                <Link2 className="auth-bridge-icon" />
              </div>
            </div>

            {/* Buttr ID Badge */}
            <div className="auth-badge-col">
              <div className="auth-badge auth-badge-buttr">
                <span className="auth-buttr-mark">B</span>
              </div>
              <span className="auth-badge-label">BUTTR</span>
            </div>
          </div>

          {/* Heading */}
          <div className="auth-headings">
            <h1 className="auth-hero-title">
              Access Buttr Cloud <br />
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
