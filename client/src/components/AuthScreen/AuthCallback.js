import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Auth.css";

/**
 * The last hop of "Sign in with BUTTR ID".
 *
 * The backend has already exchanged the authorization code, verified the ID
 * token and resolved the Buttr Cloud account. All that arrives here is a
 * session token, and it arrives in the URL fragment — fragments are never sent
 * to a server, so the token stays out of access logs and Referer headers.
 */
const AuthCallback = () => {
  const navigate = useNavigate();
  const [error, setError] = useState("");

  useEffect(() => {
    const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const token = fragment.get("token");
    const userId = fragment.get("userId");
    const returnTo = fragment.get("returnTo") || "/dashboard";

    if (!token || !userId) {
      setError("Sign-in did not complete. Please try again.");
      return;
    }

    localStorage.setItem("token", token);
    localStorage.setItem("userId", userId);

    // Drop the fragment so the token is not left sitting in the address bar
    // or in the browser's session history.
    window.history.replaceState({}, document.title, window.location.pathname);

    // An absolute URL here would be an open redirect; only same-site paths.
    const safe = returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/dashboard";
    navigate(safe, { replace: true });
  }, [navigate]);

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <h2 className="auth-title">
          <span className="gradient-text">{error ? "Sign-in failed" : "Signing you in"}</span>
        </h2>
        {error ? (
          <>
            <div className="error-message">{error}</div>
            <div className="auth-links">
              <a href="/login">Back to sign in</a>
            </div>
          </>
        ) : (
          <p className="auth-subtitle">Finishing up with BUTTR ID...</p>
        )}
      </div>
    </div>
  );
};

export default AuthCallback;
