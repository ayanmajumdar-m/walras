import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import ReCAPTCHA from "react-google-recaptcha";
import { countryList } from "../ProtectedRoutes/DashboardContent/CountryList";
import { indiaStateList } from "../ProtectedRoutes/DashboardContent/IndiaState";
import "./Signup.css";

// SITE KEY
const SITE_KEY = "6LeJZAssAAAAALenQc9ski_qxBzEpAj0xNQJugn7";

// Password validation function
const validatePassword = (password) => {
  // At least 8 characters, 1 uppercase atleast, 1 digit and 1 spec character
  const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  return passwordRegex.test(password);
};

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
  const [formErrors, setFormErrors] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    company: "",
    role: "",
    addressLine1: "",
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

  // Validation functions
  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePhone = (phone) => {
    const phoneRegex = /^[0-9]{10}$/;
    return phoneRegex.test(phone.replace(/\D/g, ''));
  };

  const validatePincode = (pincode) => {
    const pincodeRegex = /^[0-9]{6}$/;
    return pincodeRegex.test(pincode);
  };

  const validateStep = (step) => {
    const errors = {};
    let isValid = true;

    if (step === 1) {
      if (!formData.name.trim()) {
        errors.name = "Full name is required";
        isValid = false;
      } else if (formData.name.trim().length < 2) {
        errors.name = "Name must be at least 2 characters";
        isValid = false;
      }

      if (!formData.email) {
        errors.email = "Email is required";
        isValid = false;
      } else if (!validateEmail(formData.email)) {
        errors.email = "Please enter a valid email address";
        isValid = false;
      }

      if (!formData.password) {
        errors.password = "Password is required";
        isValid = false;
      } else if (!validatePassword(formData.password)) {
        errors.password = "Password must be at least 8 characters with 1 uppercase letter, 1 number, and 1 special character";
        isValid = false;
      }

      if (!formData.phone) {
        errors.phone = "Phone number is required";
        isValid = false;
      } else if (!validatePhone(formData.phone)) {
        errors.phone = "Please enter a valid 10-digit phone number";
        isValid = false;
      }
    }

    if (step === 2) {
      if (!formData.company.trim()) {
        errors.company = "Company name is required";
        isValid = false;
      }

      if (!formData.role.trim()) {
        errors.role = "Role is required";
        isValid = false;
      }
    }

    if (step === 3) {
      if (!formData.addressLine1.trim()) {
        errors.addressLine1 = "Address line 1 is required";
        isValid = false;
      }

      if (!formData.city.trim()) {
        errors.city = "City is required";
        isValid = false;
      }

      if (!formData.country) {
        errors.country = "Country is required";
        isValid = false;
      }

      if (!formData.state) {
        errors.state = "State is required";
        isValid = false;
      }

      if (!formData.pincode) {
        errors.pincode = "Pin code is required";
        isValid = false;
      } else if (!validatePincode(formData.pincode)) {
        errors.pincode = "Please enter a valid 6-digit pin code";
        isValid = false;
      }
    }

    setFormErrors(errors);
    return isValid;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    // Clear error when user starts typing
    if (formErrors[name]) {
      setFormErrors({ ...formErrors, [name]: "" });
    }

    // If country changes, clear the state field and state error
    if (name === "country") {
      setFormData({ ...formData, [name]: value, state: "" });
      setFormErrors({ ...formErrors, state: "" });
    } else {
      setFormData({ ...formData, [name]: value });
    }

    // Clear general status error when user makes changes
    if (status.error) {
      setStatus({ error: "", success: "" });
    }
  };

  const handleCaptcha = (token) => {
    setCaptchaToken(token);
    // Clear captcha-related errors
    if (status.error && status.error.includes("captcha")) {
      setStatus({ error: "", success: "" });
    }
  };

  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(currentStep + 1);
      window.scrollTo(0, 0);
    }
  };

  const prevStep = () => {
    setCurrentStep(currentStep - 1);
    window.scrollTo(0, 0);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatus({ error: "", success: "" });

    // Validate all steps before submission
    if (!validateStep(1) || !validateStep(2) || !validateStep(3)) {
      setStatus({ error: "Please fix all validation errors before submitting" });
      setLoading(false);
      return;
    }

    if (!captchaToken) {
      setStatus({ error: "Please verify the captcha" });
      setLoading(false);
      return;
    }

    const API_URL = `https://superflare.io`;
    
    try {
      const res = await fetch(`${API_URL}/api/users/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, captchaToken }),
      });

      const data = await res.json();
      
      if (!res.ok) {
        // Handle specific backend errors
        if (data.error && data.error.includes("email")) {
          setFormErrors({ ...formErrors, email: data.error });
        } else if (data.error && data.error.includes("phone")) {
          setFormErrors({ ...formErrors, phone: data.error });
        } else {
          setStatus({ error: data.error || "Signup failed. Please try again." });
        }
        setLoading(false);
        return;
      }

      // Reset form and errors
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
      setFormErrors({
        name: "",
        email: "",
        password: "",
        phone: "",
        company: "",
        role: "",
        addressLine1: "",
        city: "",
        state: "",
        country: "",
        pincode: "",
      });
      setCaptchaToken("");

      localStorage.setItem("tempEmail", formData.email);
      setStatus({ success: "Account created successfully! Redirecting..." });

      setTimeout(() => navigate("/verify-email-otp"), 1500);
    } catch (error) {
      console.error("Signup error:", error);
      setStatus({ error: "Network error. Please check your connection and try again." });
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

  // Password strength indicator
  const getPasswordStrength = (password) => {
    if (!password) return { strength: 0, label: "", color: "" };
    
    let strength = 0;
    if (password.length >= 8) strength += 25;
    if (/[A-Z]/.test(password)) strength += 25;
    if (/[0-9]/.test(password)) strength += 25;
    if (/[@$!%*?&]/.test(password)) strength += 25;

    let label = "", color = "";
    if (strength <= 25) { label = "Weak"; color = "#ff4444"; }
    else if (strength <= 50) { label = "Fair"; color = "#ffaa00"; }
    else if (strength <= 75) { label = "Good"; color = "#00aa00"; }
    else { label = "Strong"; color = "#00ff00"; }

    return { strength, label, color };
  };

  const passwordStrength = getPasswordStrength(formData.password);

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
                    className={formErrors.name ? "error" : ""}
                  />
                  {formErrors.name && <span className="field-error">{formErrors.name}</span>}
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
                    className={formErrors.email ? "error" : ""}
                  />
                  {formErrors.email && <span className="field-error">{formErrors.email}</span>}
                </div>

                <div className="form-group">
                  <label>Password *</label>
                  <div className="password-input-wrapper">
                    <input
                      type="password"
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      placeholder="Create a strong password"
                      required
                      className={formErrors.password ? "error" : ""}
                    />
                    {formData.password && (
                      <div className="password-strength">
                        <div className="strength-bar">
                          <div 
                            className="strength-fill" 
                            style={{ 
                              width: `${passwordStrength.strength}%`,
                              backgroundColor: passwordStrength.color
                            }}
                          ></div>
                        </div>
                        <span className="strength-label" style={{ color: passwordStrength.color }}>
                          {passwordStrength.label}
                        </span>
                      </div>
                    )}
                  </div>
                  {formErrors.password ? (
                    <span className="field-error">{formErrors.password}</span>
                  ) : (
                    <span className="password-note">
                      8+ characters with uppercase, number, and special character (@$!%*?&)
                    </span>
                  )}
                </div>

                <div className="form-group">
                  <label>Phone Number *</label>
                  <input
                    type="text"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="Enter 10-digit phone number"
                    required
                    className={formErrors.phone ? "error" : ""}
                  />
                  {formErrors.phone && <span className="field-error">{formErrors.phone}</span>}
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
                    className={formErrors.company ? "error" : ""}
                  />
                  {formErrors.company && <span className="field-error">{formErrors.company}</span>}
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
                    className={formErrors.role ? "error" : ""}
                  />
                  {formErrors.role && <span className="field-error">{formErrors.role}</span>}
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
                    className={formErrors.addressLine1 ? "error" : ""}
                  />
                  {formErrors.addressLine1 && <span className="field-error">{formErrors.addressLine1}</span>}
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
                    className={formErrors.city ? "error" : ""}
                  />
                  {formErrors.city && <span className="field-error">{formErrors.city}</span>}
                </div>

                <div className="form-group">
                  <label>Country *</label>
                  <select
                    name="country"
                    value={formData.country}
                    onChange={handleChange}
                    required
                    className={formErrors.country ? "error" : ""}
                  >
                    <option value="">Select your country</option>
                    {countryList.map((country) => (
                      <option key={country.code} value={country.name}>
                        {country.name}
                      </option>
                    ))}
                  </select>
                  {formErrors.country && <span className="field-error">{formErrors.country}</span>}
                </div>

                <div className="form-group">
                  <label>State *</label>
                  {formData.country === "India" ? (
                    <select
                      name="state"
                      value={formData.state}
                      onChange={handleChange}
                      required
                      className={formErrors.state ? "error" : ""}
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
                      className={formErrors.state ? "error" : ""}
                    />
                  )}
                  {formErrors.state && <span className="field-error">{formErrors.state}</span>}
                </div>

                <div className="form-group">
                  <label>Pin Code *</label>
                  <input
                    type="text"
                    name="pincode"
                    value={formData.pincode}
                    onChange={handleChange}
                    placeholder="Enter 6-digit pin code"
                    required
                    className={formErrors.pincode ? "error" : ""}
                  />
                  {formErrors.pincode && <span className="field-error">{formErrors.pincode}</span>}
                </div>
              </div>

              <div className="security-section">
                <h3 className="step-heading">Security Verification</h3>
                <div className="captcha-box">
                  <ReCAPTCHA sitekey={SITE_KEY} onChange={handleCaptcha} />
                  {!captchaToken && status.error.includes("captcha") && (
                    <span className="field-error">Please complete the captcha verification</span>
                  )}
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