import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { User, Building2, Eye, EyeOff, Loader2 } from "lucide-react";
import AuthLayout from "./AuthLayout";
import { authPost } from "./authApi";

const ACCOUNT_TYPES = [
  { id: "personal", Icon: User, title: "Personal", desc: "For individuals, freelancers and side projects." },
  { id: "business", Icon: Building2, title: "Business", desc: "For companies. Add your business name and GSTIN for invoices." },
];

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

// Mirrors the server's rules so people find out before submitting.
const passwordChecks = (pw) => [
  { ok: pw.length >= 8, label: "8+ characters" },
  { ok: /[A-Za-z]/.test(pw), label: "A letter" },
  { ok: /[0-9]/.test(pw), label: "A number" },
];

const Signup = () => {
  const navigate = useNavigate();
  const [accountType, setAccountType] = useState("personal");
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "", company: "", gstin: "", role: "" });
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  const isBusiness = accountType === "business";
  const checks = passwordChecks(form.password);

  const validate = () => {
    if (form.name.trim().length < 2) return "Enter your full name";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())) return "Enter a valid email address";
    if (!/^[0-9]{7,15}$/.test(form.phone.replace(/[\s-]/g, ""))) return "Enter a valid phone number (digits only)";
    if (!checks.every((c) => c.ok)) return "Choose a password with at least 8 characters, a letter and a number";
    if (isBusiness && form.company.trim().length < 2) return "Enter your business name";
    if (isBusiness && form.gstin.trim() && !GSTIN_RE.test(form.gstin.trim().toUpperCase())) {
      return "Enter a valid 15-character GSTIN, or leave it blank";
    }
    if (!acceptTerms) return "Please accept the Terms of Service and Privacy Policy";
    return "";
  };

  const submit = async (e) => {
    e.preventDefault();
    const problem = validate();
    if (problem) return setError(problem);

    setError("");
    setLoading(true);
    try {
      const { email } = await authPost("register", {
        accountType,
        name: form.name,
        email: form.email,
        phone: form.phone,
        password: form.password,
        company: isBusiness ? form.company : "",
        gstin: isBusiness ? form.gstin : "",
        role: isBusiness ? form.role : "",
        acceptTerms,
      });
      navigate(`/verify-email?email=${encodeURIComponent(email)}`, {
        state: { notice: "We've sent a 6-digit code to your email." },
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Create your account"
      subtitle="It takes a minute. We'll verify your email with a one-time code."
      footer={<>Already have an account? <Link to="/login">Sign in</Link></>}
    >
      {error && <div className="au-alert is-error" role="alert">{error}</div>}

      <form className="au-form" onSubmit={submit} noValidate>
        <fieldset className="au-types">
          <legend>Account type</legend>
          {ACCOUNT_TYPES.map(({ id, Icon, title, desc }) => (
            <label key={id} className={`au-type${accountType === id ? " is-selected" : ""}`}>
              <input
                type="radio"
                name="accountType"
                value={id}
                checked={accountType === id}
                onChange={() => setAccountType(id)}
              />
              <Icon className="au-type-icon" aria-hidden="true" />
              <span className="au-type-title">{title}</span>
              <span className="au-type-desc">{desc}</span>
            </label>
          ))}
        </fieldset>

        {isBusiness && (
          <div className="au-group">
            <label className="au-field">
              <span>Business name</span>
              <input type="text" autoComplete="organization" value={form.company} onChange={set("company")} placeholder="Acme Technologies Pvt Ltd" />
            </label>
            <div className="au-row">
              <label className="au-field">
                <span>GSTIN <em>Optional</em></span>
                <input
                  type="text"
                  value={form.gstin}
                  onChange={(e) => setForm((f) => ({ ...f, gstin: e.target.value.toUpperCase() }))}
                  placeholder="22AAAAA0000A1Z5"
                  maxLength={15}
                />
              </label>
              <label className="au-field">
                <span>Your job title <em>Optional</em></span>
                <input type="text" autoComplete="organization-title" value={form.role} onChange={set("role")} placeholder="CTO" maxLength={50} />
              </label>
            </div>
          </div>
        )}

        <label className="au-field">
          <span>Full name</span>
          <input type="text" autoComplete="name" value={form.name} onChange={set("name")} placeholder="Your full name" />
        </label>

        <div className="au-row">
          <label className="au-field">
            <span>{isBusiness ? "Work email" : "Email address"}</span>
            <input type="email" autoComplete="email" value={form.email} onChange={set("email")} placeholder="you@example.com" />
          </label>
          <label className="au-field">
            <span>Phone number</span>
            <input type="tel" autoComplete="tel" inputMode="numeric" value={form.phone} onChange={set("phone")} placeholder="9876543210" />
          </label>
        </div>

        <label className="au-field">
          <span>Password</span>
          <span className="au-password">
            <input
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              value={form.password}
              onChange={set("password")}
              placeholder="Create a password"
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
          <span className="au-checks" aria-live="polite">
            {checks.map((c) => (
              <span key={c.label} className={c.ok ? "is-ok" : ""}>{c.label}</span>
            ))}
          </span>
        </label>

        <label className="au-check">
          <input type="checkbox" checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)} />
          <span>
            I agree to the <Link to="/terms" target="_blank">Terms of Service</Link> and{" "}
            <Link to="/privacy" target="_blank">Privacy Policy</Link>.
          </span>
        </label>

        <button type="submit" className="au-btn" disabled={loading}>
          {loading ? <Loader2 className="au-spin" aria-hidden="true" /> : `Create ${isBusiness ? "business" : "personal"} account`}
        </button>
      </form>
    </AuthLayout>
  );
};

export default Signup;
