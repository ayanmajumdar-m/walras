import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import "./AuthScreen/Auth.css";

const ResetPassword = () => {
  const API_URL = `https://superflare.io`
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState({ success: "", error: "" });
  const [loading, setLoading] = useState(false);
  const { token } = useParams();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatus({ success: "", error: "" });

    if (newPassword !== confirmPassword) {
      setStatus({ error: "Passwords do not match" });
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/users/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        return setStatus({ error: data.message || "Something went wrong." });
      }

      setStatus({ success: data.message || "✅ Password has been reset!" });

      // Redirect to login after 3 seconds
      setTimeout(() => {
        navigate("/login");
      }, 3000);
    } catch {
      setStatus({
        error: "An error occurred while resetting your password.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <h2 className="auth-title gradient-text">Reset Password</h2>
        <p className="auth-subtitle">Enter your new password below.</p>

        {status.error && <p className="error-message">{status.error}</p>}
        {status.success && <p className="success-message">{status.success}</p>}

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label>New Password</label>
            <input
              type="password"
              name="newPassword"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label>Confirm Password</label>
            <input
              type="password"
              name="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>

          <button className="auth-btn" type="submit" disabled={loading}>
            {loading ? "Resetting..." : "Reset Password"}
          </button>
        </form>

        <div className="auth-links">
          <a href="/login">Back to Login</a>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
