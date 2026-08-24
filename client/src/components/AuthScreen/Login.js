import React, { useEffect, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import "./Auth.css";

const API_URL = `https://buttr.cloud`;

/**
 * Buttr Cloud has no sign-in form. Identity belongs to BUTTR ID, so this page
 * does one thing: hand the browser to the identity provider. Nothing here ever
 * sees a password, which is the entire point of a central BUTTR ID.
 */
const SignIn = () => {
  const [error, setError] = useState("");
  const [redirecting, setRedirecting] = useState(false);
  const location = useLocation();
  const [searchParams] = useSearchParams();

  // Where to land after signing in — the page a ProtectedRoute bounced us
  // away from, or the dashboard.
  const returnTo = location.state?.from?.pathname || "/dashboard";

  useEffect(() => {
    // The backend redirects back here with ?error= when a sign-in fails or is
    // cancelled at BUTTR ID.
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
    // A full page navigation, not fetch: the user has to actually visit BUTTR
    // ID to authenticate, and the authorization code comes back as a redirect.
    window.location.href = `${API_URL}/api/auth/buttr/start?returnTo=${encodeURIComponent(returnTo)}`;
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <h2 className="auth-title">
          <span className="gradient-text">Welcome Back</span>
        </h2>
        <p className="auth-subtitle">Sign in with your BUTTR ID to continue</p>

        {error && <div className="error-message">{error}</div>}

        <button type="button" className="auth-btn" onClick={signIn} disabled={redirecting}>
          {redirecting ? "Taking you to BUTTR ID..." : "Sign in with BUTTR ID"}
        </button>

        <p className="auth-subtitle" style={{ marginTop: "1.25rem", fontSize: "0.85rem" }}>
          One BUTTR ID works across every BUTTR service. Buttr Cloud never sees
          your password.
        </p>

        <div className="auth-links">
          <span>No BUTTR ID yet? You can create one on the next screen.</span>
        </div>
      </div>
    </div>
  );
};

export default SignIn;
