import React, { useEffect, useState } from "react";
import "./Dashboard.css";

const Wallet = () => {
  const [balance, setBalance] = useState(0);
  const [unbilled, setUnbilled] = useState(0);
  const [nextInvoiceDate, setNextInvoiceDate] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("UPI");
  const [loading, setLoading] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [userData, setUserData] = useState(null);
  const API_URL = `https://superflare.io`

  const [promoLoading, setPromoLoading] = useState(false);

  const token = localStorage.getItem("token"); // get JWT token

  useEffect(() => {
    fetchWallet();
    fetchUserData();
  }, []);

  // ✅ Get user ID from JWT token
  const getUserIdFromToken = () => {
    if (!token) return null;
    try {
      const payload = token.split('.')[1];
      const decoded = JSON.parse(atob(payload));
      return decoded.userId;
    } catch (error) {
      console.error('Error decoding token:', error);
      return null;
    }
  };

  // ✅ Fetch user data
  const fetchUserData = async () => {
    if (!token) return console.error("No auth token found");
    
    const userId = getUserIdFromToken();
    if (!userId) {
      console.error("No user ID found in token");
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/user/profile/${userId}`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (res.ok) {
        setUserData(data);
      } else {
        console.error("User data fetch failed:", data);
      }
    } catch (err) {
      console.error("Error fetching user data:", err);
    }
  };

  // ✅ Fetch wallet data
  const fetchWallet = async () => {
    if (!token) return console.error("No auth token found");
    try {
      const res = await fetch(`${API_URL}/api/wallet`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (res.ok) {
        setBalance(parseFloat(data.balance));
        setUnbilled(parseFloat(data.unbilled));
        setNextInvoiceDate(data.nextInvoiceDate);
      } else {
        console.error("Wallet fetch failed:", data);
      }
    } catch (err) {
      console.error("Error fetching wallet:", err);
    }
  };

  // ✅ Add money handler with Razorpay flow
  const handleAddFunds = async () => {
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) return alert("Enter a valid amount (INR)");
    if (!token) return alert("Authentication token missing");

    try {
      setLoading(true);
      // Step 1: Create order
      const res = await fetch(`${API_URL}/api/wallet/create-order`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ amount: amt }),
      });

      const data = await res.json();
      if (!res.ok || !data.orderId) {
        alert(data.error || "Failed to create Razorpay order");
        setLoading(false);
        return;
      }

      // Step 2: Open Razorpay checkout with real user data
      const options = {
        key: data.key,
        amount: data.amount,
        currency: data.currency,
        name: "Superflare Wallet",
        description: "Add funds to wallet",
        order_id: data.orderId,
        handler: async (response) => {
          // Step 3: Verify payment
          const verifyRes = await fetch(`${API_URL}/api/wallet/verify`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              ...response,
              amount: amt,
            }),
          });
          const verifyData = await verifyRes.json();
          if (verifyRes.ok) {
            alert("✅ Payment successful! Wallet credited ₹" + verifyData.amount);
            fetchWallet(); // refresh wallet
            setAmount("");
          } else {
            alert("❌ Verification failed: " + verifyData.error);
          }
        },
        prefill: {
          name: userData?.name || "Customer",
          email: userData?.email || "",
          contact: userData?.phone || "",
        },
        theme: { color: "#111" },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
      setLoading(false);
    } catch (err) {
      console.error(err);
      alert("Failed to start payment");
      setLoading(false);
    }
  };

  // ✅ Apply promo code handler
  const handleApplyPromoCode = async () => {
    if (!promoCode.trim()) {
      alert("Please enter a promo code");
      return;
    }

    try {
      setPromoLoading(true);
      const response = await fetch(`${API_URL}/api/wallet/apply-promo`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ promoCode: promoCode.trim() })
      });

      const data = await response.json();

      if (response.ok) {
        alert(`✅ ${data.message}\nCredit: ₹${data.creditAmount}\nNew Balance: ₹${data.newBalance}`);
        setPromoCode("");
        fetchWallet(); // Refresh wallet
      } else {
        alert("❌ " + data.error);
      }
    } catch (error) {
      console.error("Error applying promo code:", error);
      alert("Failed to apply promo code");
    } finally {
      setPromoLoading(false);
    }
  };

  return (
    <div className="wallet-container">
      {/* Header */}
      <div className="wallet-header">
        <h1>My Wallet</h1>
        {userData && (
          <p className="welcome-message">Welcome back, {userData.name}!</p>
        )}
      </div>

      {/* Wallet Summary */}
      <div className="wallet-summary">
        <div className="wallet-card">
          <h3>Available Balance</h3>
          <p className="wallet-value">₹{balance.toFixed(2)}</p>
        </div>
        <div className="wallet-card">
          <h3>Unbilled Amount</h3>
          <p className="wallet-value">₹{unbilled.toFixed(2)}</p>
        </div>
        <div className="wallet-card">
          <h3>Next Invoice Date</h3>
          <p className="wallet-value">{nextInvoiceDate}</p>
        </div>
      </div>

      {/* Promo Code Section */}
      <div className="wallet-promo-section">
        <h2>Promo Code</h2>
        <p>Enter a promo code to get credits added to your wallet.</p>

        <div className="wallet-input-row">
          <input
            type="text"
            placeholder="Enter promo code"
            name="promoCode"
            value={promoCode}
            onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
          />
          <button
            className="wallet-promo-btn"
            onClick={handleApplyPromoCode}
            disabled={promoLoading}
          >
            {promoLoading ? "Applying..." : "Apply Code"}
          </button>
        </div>
      </div>

      {/* Add Funds Section */}
      <div className="wallet-add-section">
        <h2>Add Funds</h2>
        <p>Select a payment method and enter the amount to add to your wallet.</p>

        <div className="wallet-payment-method">
          <label>Payment Method:</label>
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
          >
            <option value="UPI">UPI</option>
            <option value="Credit Card">Credit Card</option>
            <option value="Debit Card">Debit Card</option>
            <option value="Net Banking">Net Banking</option>
          </select>
        </div>

        <div className="wallet-input-row">
          <input
            type="number"
            placeholder="Enter amount (₹)"
            name="amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <button
            className="wallet-add-btn"
            onClick={handleAddFunds}
            disabled={loading}
          >
            {loading ? "Processing..." : "Add Funds"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Wallet;