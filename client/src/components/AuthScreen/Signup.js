import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import ReCAPTCHA from "react-google-recaptcha";
import { countryList } from "../ProtectedRoutes/DashboardContent/CountryList";
import { indiaStateList } from "../ProtectedRoutes/DashboardContent/IndiaState";
import "./Signup.css";

// SITE KEY
const SITE_KEY = "6LeJZAssAAAAALenQc9ski_qxBzEpAj0xNQJugn7";

const Signup = () => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    company: "",
    role: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    country: "",
    pincode: "",
  });
  const [captchaToken, setCaptchaToken] = useState("");
  const [status, setStatus] = useState({ error: "", success: "" });
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    // If country changes, clear the state field
    if (name === "country") {
      setFormData({ ...formData, [name]: value, state: "" });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleCaptcha = (token) => {
    setCaptchaToken(token);
  };

  const nextStep = () => {
    setCurrentStep(currentStep + 1);
    window.scrollTo(0, 0);
  };

  const prevStep = () => {
    setCurrentStep(currentStep - 1);
    window.scrollTo(0, 0);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatus({ error: "", success: "" });

    if (!captchaToken) {
      setStatus({ error: "Please verify the captcha" });
      setLoading(false);
      return;
    }
    const API_URL = `https://superflare.io`
    try {
      const res = await fetch(`${API_URL}/api/users/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, captchaToken }),
      });

      const data = await res.json();
      if (!res.ok) {
        return setStatus({ error: data.error || "Signup failed" });
      }

      // reset form
      setFormData({
        name: "",
        email: "",
        password: "",
        phone: "",
        company: "",
        role: "",
        addressLine1: "",
        addressLine2: "",
        city: "",
        state: "",
        country: "",
        pincode: "",
      });
      setCaptchaToken("");

      localStorage.setItem("tempEmail", formData.email);

      setTimeout(() => navigate("/verify-email-otp"), 1000);
    } catch {
      setStatus({ error: "Something went wrong. Please try again." });
    } finally {
      setLoading(false);
    }
  };

  // Progress steps
  const steps = [
    { number: 1, title: "Personal Info" },
    { number: 2, title: "Professional Info" },
    { number: 3, title: "Address & Security" }
  ];

  return (
    <div className="auth-wrapper">
      <div className="auth-card signup-card">
        {/* Progress Steps */}
        <div className="progress-steps">
          {steps.map((step) => (
            <div key={step.number} className={`step ${currentStep >= step.number ? 'active' : ''}`}>
              <div className="step-number">{step.number}</div>
              <span className="step-title">{step.title}</span>
            </div>
          ))}
        </div>

        <div className="auth-header">
          <h2 className="auth-title gradient-text">Create Account</h2>
          <p className="auth-subtitle">Join us and get started today 🚀</p>
        </div>

        {status.error && <div className="error-message">{status.error}</div>}
        {status.success && <div className="success-message">{status.success}</div>}

        <form className="auth-form" onSubmit={handleSubmit}>
          {/* Step 1: Personal Information */}
          {currentStep === 1 && (
            <div className="form-step">
              <h3 className="step-heading">Personal Information</h3>
              <div className="form-grid">
                <div className="form-group">
                  <label>Full Name *</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="Enter your full name"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Email Address *</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="Enter your email"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Password *</label>
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="Create a strong password"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Phone Number *</label>
                  <input
                    type="text"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="Enter your phone number"
                    required
                  />
                </div>
              </div>

              <div className="form-actions">
                <button type="button" className="auth-btn next-btn" onClick={nextStep}>
                  Next →
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Professional Information */}
          {currentStep === 2 && (
            <div className="form-step">
              <h3 className="step-heading">Professional Information</h3>
              <div className="form-grid">
                <div className="form-group">
                  <label>Company *</label>
                  <input
                    type="text"
                    name="company"
                    value={formData.company}
                    onChange={handleChange}
                    placeholder="Enter company name"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Role *</label>
                  <input
                    type="text"
                    name="role"
                    value={formData.role}
                    onChange={handleChange}
                    placeholder="Enter your role"
                    required
                  />
                </div>
              </div>

              <div className="form-actions">
                <button type="button" className="auth-btn prev-btn" onClick={prevStep}>
                  ← Back
                </button>
                <button type="button" className="auth-btn next-btn" onClick={nextStep}>
                  Next →
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Address & Security */}
          {currentStep === 3 && (
            <div className="form-step">
              <h3 className="step-heading">Address Information</h3>
              <div className="form-grid">
                <div className="form-group full-width">
                  <label>Address Line 1 *</label>
                  <input
                    type="text"
                    name="addressLine1"
                    value={formData.addressLine1}
                    onChange={handleChange}
                    placeholder="House number, street name"
                    required
                  />
                </div>

                <div className="form-group full-width">
                  <label>Address Line 2</label>
                  <input
                    type="text"
                    name="addressLine2"
                    value={formData.addressLine2}
                    onChange={handleChange}
                    placeholder="Area, sector, landmark"
                  />
                </div>

                <div className="form-group">
                  <label>City / Town *</label>
                  <input
                    type="text"
                    name="city"
                    value={formData.city}
                    onChange={handleChange}
                    placeholder="Enter your city"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Country *</label>
                  <select
                    name="country"
                    value={formData.country}
                    onChange={handleChange}
                    required
                  >
                    <option value="">Select your country</option>
                    {countryList.map((country) => (
                      <option key={country.code} value={country.name}>
                        {country.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>State *</label>
                  {formData.country === "India" ? (
                    <select
                      name="state"
                      value={formData.state}
                      onChange={handleChange}
                      required
                    >
                      <option value="">Select your state</option>
                      {Object.entries(indiaStateList).map(([code, name]) => (
                        <option key={code} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      name="state"
                      value={formData.state}
                      onChange={handleChange}
                      placeholder="Enter your state"
                      required
                    />
                  )}
                </div>

                <div className="form-group">
                  <label>Pin Code *</label>
                  <input
                    type="text"
                    name="pincode"
                    value={formData.pincode}
                    onChange={handleChange}
                    placeholder="Enter pin code"
                    required
                  />
                </div>
              </div>

              <div className="security-section">
                <h3 className="step-heading">Security Verification</h3>
                <div className="captcha-box">
                  <ReCAPTCHA sitekey={SITE_KEY} onChange={handleCaptcha} />
                </div>
              </div>

              <div className="form-actions">
                <button type="button" className="auth-btn prev-btn" onClick={prevStep}>
                  ← Back
                </button>
                <button 
                  className="auth-btn submit-btn" 
                  type="submit" 
                  disabled={loading || !captchaToken}
                >
                  {loading ? "Creating account..." : "Create Account"}
                </button>
              </div>
            </div>
          )}
        </form>

        <div className="auth-links">
          Already have an account? <a href="/login">Login</a>
        </div>
      </div>
    </div>
  );
};

export default Signup;