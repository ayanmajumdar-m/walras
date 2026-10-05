import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import AuthLayout from "./AuthLayout";
import { authPost, saveSession } from "./authApi";

const COOLDOWN = 60;

/**
 * Two steps on one screen: ask for the email, then take the emailed code and
 * the new password together.
 */
const ForgotPassword = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [step, setStep] = useState("request");
  const [email, setEmail] = useState(location.state?.email || "");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const request = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await authPost("forgot-password", { email });
      setNotice(res.message);
      setStep("reset");
      setCooldown(COOLDOWN);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const reset = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const session = await authPost("reset-password", { email, code, password });
      saveSession(session);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err.message);
      if (err.expired) setCode("");
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    setError("");
    try {
      await authPost("resend-code", { email, purpose: "reset" });
      setNotice("A new code is on its way.");
      setCooldown(COOLDOWN);
    } catch (err) {
      setError(err.message);
    }
  };

  const footer = <>Remembered it? <Link to="/login">Back to sign in</Link></>;

  if (step === "request") {
    return (
      <AuthLayout
        title="Reset your password"
        subtitle="Enter the email you signed up with and we'll send you a code."
        footer={footer}
      >
        {error && <div className="au-alert is-error" role="alert">{error}</div>}
        <form className="au-form" onSubmit={request}>
          <label className="au-field">
            <span>Email address</span>
            <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoFocus />
          </label>
          <button type="submit" className="au-btn" disabled={loading || !email}>
            {loading ? <Loader2 className="au-spin" aria-hidden="true" /> : "Send reset code"}
          </button>
        </form>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Choose a new password"
      subtitle={<>Enter the code we sent to <strong>{email}</strong> and your new password.</>}
      footer={footer}
    >
      {notice && <div className="au-alert is-info" role="status">{notice}</div>}
      {error && <div className="au-alert is-error" role="alert">{error}</div>}

      <form className="au-form" onSubmit={reset}>
        <label className="au-field">
          <span>Reset code</span>
          <input
            className="au-code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            placeholder="000000"
            autoFocus
          />
        </label>

        <label className="au-field">
          <span>New password</span>
          <span className="au-password">
            <input
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters, a letter and a number"
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

        <button type="submit" className="au-btn" disabled={loading || code.length !== 6 || password.length < 8}>
          {loading ? <Loader2 className="au-spin" aria-hidden="true" /> : "Update password and sign in"}
        </button>
      </form>

      <p className="au-resend">
        Didn't get it?{" "}
        {cooldown > 0 ? (
          <span>Resend in {cooldown}s</span>
        ) : (
          <button type="button" className="au-text-btn" onClick={resend}>Resend code</button>
        )}
        {" · "}
        <button type="button" className="au-text-btn" onClick={() => { setStep("request"); setCode(""); setNotice(""); }}>
          Use a different email
        </button>
      </p>
    </AuthLayout>
  );
};

export default ForgotPassword;
