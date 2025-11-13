import React, { useState } from "react";
import "./AuthScreen/Auth.css";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState({ success: "", error: "" });
  const [loading, setLoading] = useState(false);
  const API_URL = `https://superflare.io`

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatus({ success: "", error: "" });

    try {
      const res = await fetch(`${API_URL}/api/users/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) {
        return setStatus({ error: data.message || "Something went wrong." });
      }

      setStatus({ success: data.message || "✅ Reset link sent to your email!" });
      setEmail("");
    } catch {
      setStatus({ error: "An error occurred while processing your request." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <h2 className="auth-title gradient-text">Forgot Password</h2>
        <p className="auth-subtitle">
          Enter your email address and we’ll send you a reset link.
        </p>

        {status.error && <p className="error-message">{status.error}</p>}
        {status.success && <p className="success-message">{status.success}</p>}

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email Address</label>
            <input
              type="email"
              name="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <button className="auth-btn" type="submit" disabled={loading}>
            {loading ? "Sending..." : "Reset Password"}
          </button>
        </form>

        <div className="auth-links">
          <a href="/login">Back to Login</a>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
