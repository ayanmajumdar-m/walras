const Razorpay = require('razorpay');
const crypto = require('crypto');

const integrations = require('../utils/integrations');

// Keys from Admin → Integrations (falling back to the env). The client is
// rebuilt when they change; without keys, Razorpay calls fail clearly.
let razorpay = null;
const buildClient = () => {
    const key_id = integrations.get('RAZORPAY_KEY_ID');
    const key_secret = integrations.get('RAZORPAY_KEY_SECRET');
    razorpay = null;
    if (!key_id || !key_secret) return;
    try {
        razorpay = new Razorpay({ key_id, key_secret });
    } catch (error) {
        console.error('Razorpay initialization failed:', error.message);
    }
};
buildClient();
integrations.onChange(buildClient);

exports.createOrder = async (options) => {
    try {
        const { amount, currency = 'INR', receipt, notes = {} } = options;
        
        console.log('Razorpay createOrder called with:', options);

        // Validate amount
        if (!amount || typeof amount !== 'number' || amount < 100) {
            throw new Error('Amount must be at least 100 paise (₹1)');
        }

        const orderOptions = {
            amount: Math.round(amount), // Ensure integer
            currency: currency.toUpperCase(),
            receipt: receipt || `receipt_${Date.now()}`,
            notes: notes,
            payment_capture: 1 // Auto capture payment
        };

        console.log('Razorpay order options:', orderOptions);

        if (!razorpay) {
            throw new Error('Razorpay not initialized');
        }

        const order = await razorpay.orders.create(orderOptions);
        console.log('Razorpay order created successfully:', order.id);
        
        return order;
    } catch (error) {
        console.error('Razorpay createOrder error:', {
            message: error.message,
            statusCode: error.statusCode,
            error: error.error
        });
        throw error; // Re-throw to handle in controller
    }
};

exports.verifyPaymentSignature = ({ order_id, payment_id, signature }) => {
    try {
        const body = order_id + '|' + payment_id;
        const expectedSignature = crypto
            .createHmac('sha256', integrations.get('RAZORPAY_KEY_SECRET'))
            .update(body.toString())
            .digest('hex');
        
        const isValid = expectedSignature === signature;
        console.log('Signature verification:', isValid);
        return isValid;
    } catch (error) {
        console.error('Signature verification error:', error);
        return false;
    }
};

exports.verifyWebhookSignature = (body, signature) => {
    try {
        const expectedSignature = crypto
            .createHmac('sha256', integrations.get('RAZORPAY_KEY_SECRET'))
            .update(body)
            .digest('hex');
        
        return expectedSignature === signature;
    } catch (error) {
        console.error('Webhook signature verification error:', error);
        return false;
    }
};