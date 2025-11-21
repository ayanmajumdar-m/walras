import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import ReCAPTCHA from "react-google-recaptcha";
import "./Auth.css";

// SITE KEY
const SITE_KEY = "6LeJZAssAAAAALenQc9ski_qxBzEpAj0xNQJugn7";
const API_URL = `https://superflare.io`

const Login = () => {
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [captchaToken, setCaptchaToken] = useState(""); // ✅ store captcha
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // If redirected due to expired session, show message
  React.useEffect(() => {
    const expiredFlag = localStorage.getItem('sessionExpired');
    const expiredMessage = localStorage.getItem('sessionExpiredMessage');
    if (expiredFlag || expiredMessage) {
      setError(expiredMessage || 'Your session has expired. Please login again.');
      localStorage.removeItem('sessionExpired');
      localStorage.removeItem('sessionExpiredMessage');
    }
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError("");
  };

  const handleCaptcha = (token) => {
    setCaptchaToken(token);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (!captchaToken) {
      setError("Please verify the captcha");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/users/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, captchaToken }), // ✅ send captcha
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.needsVerification) {
          setError("Please verify your email before logging in.");
        } else {
          setError(data.error || "Login failed");
        }
        return;
      }

  localStorage.setItem("token", data.token);
  localStorage.setItem("userId", data.userId);

  // If redirected here by ProtectedRoute, go back to the original page
  const origin = location.state?.from?.pathname || "/dashboard";
  navigate(origin, { replace: true });
    } catch (err) {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <h2 className="auth-title">
          <span className="gradient-text">Welcome Back</span>
        </h2>
        <p className="auth-subtitle">Login to continue to your dashboard</p>

        {error && <div className="error-message">{error}</div>}

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              name="email"
              placeholder="Enter your email"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              name="password"
              placeholder="Enter your password"
              value={formData.password}
              onChange={handleChange}
              required
            />
          </div>

          {/* ✅ reCAPTCHA */}
          <div className="form-group captcha-box">
            <ReCAPTCHA sitekey={SITE_KEY} onChange={handleCaptcha} />
          </div>

          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        <div className="auth-links">
          <a href="/forgot-password">Forgot password?</a>
          <span> | </span>
          <a href="/register">Sign Up</a>
        </div>
      </div>
    </div>
  );
};

export default Login;
