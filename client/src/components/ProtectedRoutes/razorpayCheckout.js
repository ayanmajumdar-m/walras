import { api } from "./consoleApi";

/*
  Razorpay Checkout for console payments (top-ups, invoices, auto top-up
  setup). The server creates the order and returns `checkout`; this opens
  Razorpay's payment window and, on success, sends the signed result to
  /api/payment/razorpay/verify, which credits the balance. A failed attempt
  stays inside the window so the customer can retry; closing it rejects with
  { cancelled: true }.
*/

const SCRIPT = "https://checkout.razorpay.com/v1/checkout.js";
let loading = null;

const loadScript = () => {
  if (window.Razorpay) return Promise.resolve();
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = SCRIPT;
      s.async = true;
      s.onload = resolve;
      s.onerror = () => {
        loading = null;
        s.remove();
        reject(new Error("Couldn't load the payment window. Check your connection and try again."));
      };
      document.body.appendChild(s);
    });
  }
  return loading;
};

/** Opens Checkout for `checkout` (from the server) and verifies the payment. Resolves the verify result. */
export const payWithRazorpay = async (checkout) => {
  await loadScript();
  const result = await new Promise((resolve, reject) => {
    const rzp = new window.Razorpay({
      key: checkout.key,
      order_id: checkout.orderId,
      amount: checkout.amount,
      currency: checkout.currency || "INR",
      name: checkout.name || "Walras Cloud",
      description: checkout.description,
      image: `${window.location.origin}/logo192.png`,
      prefill: checkout.prefill,
      // Auto top-up setup: save the card for recurring charges.
      ...(checkout.customerId ? { customer_id: checkout.customerId, recurring: "1" } : {}),
      theme: { color: "#1fc4a2" },
      handler: resolve,
      modal: {
        ondismiss: () => reject(Object.assign(new Error("Payment cancelled. Nothing was charged."), { cancelled: true })),
      },
    });
    rzp.open();
  });
  return api("/api/payment/razorpay/verify", { method: "POST", body: result });
};
