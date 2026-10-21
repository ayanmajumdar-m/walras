/**
 * Dedicated for customers (utils/dedicated.js): the public catalog
 * (metal.walras.net and the console) and the account's orders. Ordering
 * charges nothing and starts nothing yet: the server is recorded as bought
 * and our team sets it up.
 */
const dedicated = require('../utils/dedicated');

const handle = (fn) => async (req, res) => {
    try {
        await fn(req, res);
    } catch (err) {
        if (err instanceof dedicated.HttpError) return res.status(err.status).json({ error: err.message, ...err.extra });
        console.error(`Dedicated ${req.method} ${req.path} failed:`, err.message);
        res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
};

module.exports = {
    // GET /api/dedicated/catalog (public)
    catalog: handle(async (req, res) => {
        res.json(await dedicated.catalog());
    }),

    // GET /api/dedicated/orders
    orders: handle(async (req, res) => {
        res.json({ orders: await dedicated.ordersOf(req.user.userId) });
    }),

    // POST /api/dedicated/orders { serverId }
    order: handle(async (req, res) => {
        const order = await dedicated.placeOrder({ userId: req.user.userId, actorId: req.user.actorId, serverId: req.body.serverId });
        res.status(201).json({ order, message: "Ordered. We're setting up your server: it shows as Active here once it's ready." });
    }),
};
