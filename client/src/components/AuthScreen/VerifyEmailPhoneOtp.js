import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./Auth.css";

const VerifyEmailPhoneOtp = () => {
    const [formData, setFormData] = useState({ email: "", emailOtp: "" });
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const API_URL = `http://y0koc4ok88sk0cww0cwssco4.172.236.189.24.sslip.io`

    // Get tempEmail from localStorage
    const tempEmail = localStorage.getItem("tempEmail") || "";

    useEffect(() => {
        // Prefill email from tempEmail
        setFormData((prev) => ({ ...prev, email: tempEmail }));
    }, [tempEmail]);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
        setError("");
        setSuccess("");
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError("");
        setSuccess("");

        try {
            const res = await fetch(`${API_URL}/api/users/verify-email-otp`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...formData, email: tempEmail }), // Ensure tempEmail is sent
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error || "Verification failed. Please try again.");
                return;
            }

            setSuccess("Your email has been verified successfully!");

            // Remove tempEmail from localStorage
            localStorage.removeItem("tempEmail");

            setTimeout(() => navigate("/login"), 1500);
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
                    <span className="gradient-text">Verify Your Email</span>
                </h2>
                <p className="auth-subtitle">
                    Enter the 6-digit code we sent to your email
                </p>

                {error && <div className="error-message">{error}</div>}
                {success && <div className="success-message">{success}</div>}

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
                            readOnly
                        />
                    </div>

                    <div className="form-group">
                        <label>OTP</label>
                        <input
                            type="text"
                            name="emailOtp"
                            placeholder="Enter 6-digit code"
                            value={formData.emailOtp}
                            onChange={handleChange}
                            required
                        />
                    </div>

                    <button type="submit" className="auth-btn" disabled={loading}>
                        {loading ? "Verifying..." : "Verify"}
                    </button>
                </form>

                <div className="auth-links">
                    <a href="/login">Back to Login</a>
                </div>
            </div>
        </div>
    );
};

export default VerifyEmailPhoneOtp;
