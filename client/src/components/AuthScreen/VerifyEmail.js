import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, MailCheck } from "lucide-react";
import AuthLayout from "./AuthLayout";
import { authPost, saveSession, safeReturnTo } from "./authApi";

const COOLDOWN = 60;

const VerifyEmail = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const email = params.get("email") || "";

  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(location.state?.notice || "");
  const [cooldown, setCooldown] = useState(COOLDOWN);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const verify = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const session = await authPost("verify-email", { email, code });
      saveSession(session);
      navigate(safeReturnTo(location.state?.returnTo), { replace: true });
    } catch (err) {
      if (err.alreadyVerified) {
        navigate("/login", { state: { email, notice: err.message } });
        return;
      }
      setError(err.message);
      if (err.expired) setCode("");
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    setError("");
    setNotice("");
    try {
      await authPost("resend-code", { email, purpose: "verify" });
      setNotice("A new code is on its way. Check your inbox and spam folder.");
      setCooldown(COOLDOWN);
    } catch (err) {
      setError(err.message);
    }
  };

  if (!email) {
    return (
      <AuthLayout title="Verify your email" footer={<Link to="/register">Back to sign up</Link>}>
        <div className="au-alert is-error">This link is missing an email address. Start again from sign up or sign in.</div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Check your email"
      subtitle={<>We sent a 6-digit code to <strong>{email}</strong>. Enter it below to activate your account.</>}
      footer={<>Wrong email? <Link to="/register">Start over</Link></>}
    >
      <div className="au-mail-icon"><MailCheck aria-hidden="true" /></div>
      {notice && <div className="au-alert is-info" role="status">{notice}</div>}
      {error && <div className="au-alert is-error" role="alert">{error}</div>}

      <form className="au-form" onSubmit={verify}>
        <label className="au-field">
          <span>Verification code</span>
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

        <button type="submit" className="au-btn" disabled={loading || code.length !== 6}>
          {loading ? <Loader2 className="au-spin" aria-hidden="true" /> : "Verify and continue"}
        </button>
      </form>

      <p className="au-resend">
        Didn't get it?{" "}
        {cooldown > 0 ? (
          <span>Resend in {cooldown}s</span>
        ) : (
          <button type="button" className="au-text-btn" onClick={resend}>Resend code</button>
        )}
      </p>
    </AuthLayout>
  );
};

export default VerifyEmail;
