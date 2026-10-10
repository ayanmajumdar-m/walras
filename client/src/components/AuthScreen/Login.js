import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import AuthLayout from "./AuthLayout";
import { authPost, saveSession, safeReturnTo } from "./authApi";

const SignIn = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const returnTo = safeReturnTo(location.state?.from?.pathname);

  const [email, setEmail] = useState(location.state?.email || "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(location.state?.notice || "");

  useEffect(() => {
    const expiredMessage = localStorage.getItem("sessionExpiredMessage");
    if (localStorage.getItem("sessionExpired") || expiredMessage) {
      setNotice(expiredMessage || "Login expired, please relogin");
      localStorage.removeItem("sessionExpired");
      localStorage.removeItem("sessionExpiredMessage");
    }
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const session = await authPost("login", { email, password });
      saveSession(session);
      navigate(returnTo, { replace: true });
    } catch (err) {
      if (err.needsVerification) {
        navigate(`/verify-email?email=${encodeURIComponent(err.email || email)}`, {
          state: { notice: err.message, returnTo },
        });
        return;
      }
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to your Walras Cloud console."
      footer={<>New to Walras Cloud? <Link to="/register">Create an account</Link></>}
    >
      {notice && <div className="au-alert is-info" role="status">{notice}</div>}
      {error && <div className="au-alert is-error" role="alert">{error}</div>}

      <form className="au-form" onSubmit={submit} noValidate>
        <label className="au-field">
          <span>Email address</span>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
          />
        </label>

        <label className="au-field">
          <span className="au-label-row">
            Password
            <Link to="/forgot-password" state={{ email }} className="au-small-link">Forgot password?</Link>
          </span>
          <span className="au-password">
            <input
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your password"
              required
            />
            <button
              type="button"
              className="au-eye"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
            </button>
          </span>
        </label>

        <button type="submit" className="au-btn" disabled={loading || !email || !password}>
          {loading ? <Loader2 className="au-spin" aria-hidden="true" /> : "Sign in"}
        </button>
      </form>
    </AuthLayout>
  );
};

export default SignIn;
