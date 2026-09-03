import React, { useEffect, useState } from "react";
import "./Dashboard.css";

const Wallet = () => {
  const [balance, setBalance] = useState(0);
  const [unbilled, setUnbilled] = useState(0);
  const [nextInvoiceDate, setNextInvoiceDate] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("ccavenue");
  const [loading, setLoading] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [userData, setUserData] = useState(null);
  const API_URL = `https://buttr.cloud`

  const [promoLoading, setPromoLoading] = useState(false);

  const token = localStorage.getItem("token"); // get JWT token

  useEffect(() => {
    fetchWallet();
    fetchUserData();

    // Check for return status from CCAvenue
    const params = new URLSearchParams(window.location.search);
    const pStatus = params.get("payment_status");
    if (pStatus === "success") {
      const creditedAmt = params.get("amount");
      const trackingId = params.get("tracking_id");
      alert(`✅ Payment Successful! Your wallet has been credited ₹${creditedAmt || ""}. (Ref: ${trackingId || ""})`);
      window.history.replaceState({}, document.title, window.location.pathname);
      fetchWallet();
    } else if (pStatus === "failed") {
      const reason = params.get("reason") || "Transaction failed";
      alert(`❌ Payment Failed: ${reason}`);
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (pStatus === "cancelled") {
      alert("⚠️ Payment was cancelled.");
      window.history.replaceState({}, document.title, window.location.pathname);
    }
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

  // ✅ Convert INR to USD for PayPal
  const convertINRtoUSD = async (inrAmount) => {
    try {
      // You can use a currency conversion API or fixed rate
      // For now, using a fixed rate - replace with actual API call
      const response = await fetch(`https://api.exchangerate-api.com/v4/latest/INR`);
      const data = await response.json();
      const rate = data.rates.USD;
      return (inrAmount * rate).toFixed(2);
    } catch (error) {
      console.error("Error converting currency:", error);
      // Fallback rate
      return (inrAmount * 0.012).toFixed(2);
    }
  };

  // ✅ CCAvenue payment handler
  const handleCcavenuePayment = async (amt) => {
    try {
      const res = await fetch(`${API_URL}/api/payment/ccavenue/initiate-wallet`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ amount: amt }),
      });

      const data = await res.json();
      if (!res.ok || !data.encRequest) {
        alert(data.error || "Failed to initiate CCAvenue payment");
        setLoading(false);
        return;
      }

      // Create hidden dynamic form and auto-submit to CCAvenue
      const form = document.createElement("form");
      form.method = "POST";
      form.action = data.actionUrl;

      const encInput = document.createElement("input");
      encInput.type = "hidden";
      encInput.name = "encRequest";
      encInput.value = data.encRequest;
      form.appendChild(encInput);

      const accessInput = document.createElement("input");
      accessInput.type = "hidden";
      accessInput.name = "access_code";
      accessInput.value = data.accessCode;
      form.appendChild(accessInput);

      document.body.appendChild(form);
      form.submit();
    } catch (err) {
      console.error("[CCAvenue] Payment initiation error:", err);
      alert("Failed to start CCAvenue checkout");
      setLoading(false);
    }
  };

  // ✅ Razorpay payment handler
  const handleRazorpayPayment = async (amt) => {
    try {
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

      // Step 2: Open Razorpay checkout
      const options = {
        key: data.key,
        amount: data.amount,
        currency: data.currency,
        name: "Buttr Cloud Wallet",
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
            fetchWallet();
            setAmount("");
            // If user had entered BLACKFRIDAY promo and topped up ₹5000 or more, apply promo now
            if (promoCode.trim().toUpperCase() === 'BLACKFRIDAY' && parseFloat(amt) >= 5000) {
              // apply promo after top-up
              applyPromoAfterTopup('BLACKFRIDAY');
            }
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
    } catch (err) {
      console.error(err);
      alert("Failed to start Razorpay payment");
      throw err;
    }
  };

  // ✅ PayPal payment handler
  const handlePayPalPayment = async (amt) => {
    try {
      // Convert INR to USD
      const usdAmount = await convertINRtoUSD(amt);
      
      // Create PayPal order
      const res = await fetch(`${API_URL}/api/wallet/create-paypal-order`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ 
          amount: usdAmount,
          currency: "USD"
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.orderID) {
        alert(data.error || "Failed to create PayPal order");
        setLoading(false);
        return;
      }

      // Open PayPal checkout
      const paypal = window.paypal;
      if (!paypal) {
        alert("PayPal SDK not loaded");
        return;
      }

      paypal.Buttons({
        createOrder: function(data, actions) {
          return data.orderID;
        },
        onApprove: async function(data, actions) {
          try {
            const verifyRes = await fetch(`${API_URL}/api/wallet/verify-paypal`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                orderID: data.orderID,
                amount: amt, // Original INR amount for wallet credit
                usdAmount: usdAmount
              }),
            });
            
            const verifyData = await verifyRes.json();
            if (verifyRes.ok) {
              alert(`✅ Payment successful! Wallet credited ₹${amt}`);
              fetchWallet();
              setAmount("");
              // If user had entered BLACKFRIDAY promo and topped up ₹5000 or more, apply promo now
              if (promoCode.trim().toUpperCase() === 'BLACKFRIDAY' && parseFloat(amt) >= 5000) {
                applyPromoAfterTopup('BLACKFRIDAY');
              }
            } else {
              alert("❌ Payment verification failed: " + verifyData.error);
            }
          } catch (error) {
            console.error("PayPal verification error:", error);
            alert("Payment verification failed");
          }
        },
        onError: function(err) {
          console.error("PayPal error:", err);
          alert("PayPal payment failed");
        }
      }).render('#paypal-button-container');

    } catch (err) {
      console.error(err);
      alert("Failed to start PayPal payment");
      throw err;
    }
  };

  // ✅ Main payment handler
  const handleAddFunds = async () => {
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) return alert("Enter a valid amount (INR)");
    if (!token) return alert("Authentication token missing");

    try {
      setLoading(true);

      if (paymentMethod === "ccavenue") {
        await handleCcavenuePayment(amt);
      } else if (paymentMethod === "razorpay") {
        await handleRazorpayPayment(amt);
      } else if (paymentMethod === "paypal") {
        await handlePayPalPayment(amt);
      }

      setLoading(false);
    } catch (err) {
      setLoading(false);
    }
  };

  // ✅ Apply promo code handler
  const handleApplyPromoCode = async () => {
    if (!promoCode.trim()) {
      alert("Please enter a promo code");
      return;
    }

    // Special frontend-only rule: BLACKFRIDAY must be applied only when user is adding ₹5000
    if (promoCode.trim().toUpperCase() === 'BLACKFRIDAY') {
      const amt = parseFloat(amount);
      if (isNaN(amt) || amt < 5000) {
        alert("The BLACKFRIDAY promo requires you to add ₹5000 in the Add Funds section. Enter ₹5000 and complete the payment — the promo will be applied automatically after a successful top-up.");
        return;
      }
      // If amount is >= 5000, do not apply promo immediately here; it will be applied after successful payment.
      alert("You have a BLACKFRIDAY promo and are adding ₹" + amt + ". The promo will be applied automatically after successful payment.");
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

  // Helper: apply promo after successful top-up (frontend-triggered)
  const applyPromoAfterTopup = async (appliedPromoCode) => {
    if (!appliedPromoCode) return;
    try {
      const response = await fetch(`${API_URL}/api/wallet/apply-promo`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ promoCode: appliedPromoCode.trim().toUpperCase() })
      });
      const data = await response.json();
      if (response.ok) {
        alert(`✅ Promo applied: ${data.message}\nCredit: ₹${data.creditAmount}`);
        setPromoCode("");
        fetchWallet();
      } else {
        console.warn('Promo apply failed after topup:', data);
      }
    } catch (err) {
      console.error('Error applying promo after topup:', err);
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
            <option style={{color: 'black'}} value="ccavenue">CCAvenue (UPI, Cards, Net Banking)</option>
            <option style={{color: 'black'}} value="paypal">PayPal (International)</option>
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

        {/* PayPal Button Container */}
        {paymentMethod === "paypal" && (
          <div className="paypal-container">
            <p className="currency-note">
              💡 Amount will be converted to USD during payment
            </p>
            <div id="paypal-button-container"></div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Wallet;