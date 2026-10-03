const paypalService = require('./services/paypalService');

// Create PayPal order
exports.createPayPalOrder = async (req, res) => {
    try {
        const { amount, currency = 'USD' } = req.body;
        
        const order = await paypalService.createOrder({
            amount: amount,
            currency: currency,
            description: 'Add funds to Walras Cloud wallet'
        });

        res.json({
            success: true,
            orderID: order.id,
            amount: order.amount,
            currency: order.currency
        });
    } catch (error) {
        console.error('Create PayPal order error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// Capture PayPal payment
exports.capturePayPalPayment = async (req, res) => {
    try {
        const { orderID } = req.body;
        
        const capture = await paypalService.captureOrder(orderID);

        // Update user wallet here with equivalent INR amount
        // You'll need to store the original INR amount when creating the order

        res.json({
            success: true,
            captureID: capture.capture_id,
            amount: capture.amount,
            currency: capture.currency,
            status: capture.status
        });
    } catch (error) {
        console.error('Capture PayPal payment error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};