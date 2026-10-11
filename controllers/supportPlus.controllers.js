/**
 * Support + for customers (utils/supportPlus.js): the subscription and
 * call-back requests. Routes are in routes/support.routes.js. In a team
 * account the Support area is needed (utils/team.js); turning Support + on
 * or off spends the owner's money, so that also needs Billing access.
 */
const connection = require('../config/db');
const plus = require('../utils/supportPlus');
const billing = require('../utils/monthlyBilling');

const q = (sql, params = []) => new Promise((resolve, reject) => {
    connection.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
});

const handle = (fn) => async (req, res) => {
    try {
        if (req.params.id !== undefined && !/^\d{1,10}$/.test(req.params.id)) {
            return res.status(404).json({ error: 'Request not found.' });
        }
        await fn(req, res);
    } catch (err) {
        if (err instanceof plus.HttpError) return res.status(err.status).json({ error: err.message, ...err.extra });
        console.error(`Support + ${req.method} ${req.path} failed:`, err.message);
        res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
};

// Team members need Billing access to turn Support + on or off.
const canManage = (req) => !req.user.actorId || (req.user.teamAreas || []).includes('billing');
const needManage = (req) => {
    if (!canManage(req)) throw new plus.HttpError(403, 'Turning Support + on or off needs Billing access in this account. Ask an account admin.', { teamAccessDenied: true });
};

module.exports = {
    // GET /api/support/plus — the subscription, today's price, who to call, recent requests
    overview: handle(async (req, res) => {
        const userId = req.user.userId;
        const [sub, [user], [person], callbacks, suspended] = await Promise.all([
            plus.subscriptionOf(userId),
            q('SELECT id, address, gstin FROM users WHERE id = ?', [userId]),
            q('SELECT name, phone FROM users WHERE id = ?', [req.user.actorId || userId]),
            plus.listCallbacks(userId),
            billing.isSuspended(userId),
        ]);
        res.json({
            subscription: plus.publicSubscription(sub),
            price: plus.MONTHLY_PRICE / 100,
            callWithinMinutes: plus.CALL_WITHIN_MINUTES,
            quote: sub?.status === 'active' ? null : plus.publicQuote(plus.quote(user, new Date())),
            contact: { name: person?.name || '', phone: person?.phone || '' },
            callbacks,
            open: callbacks.find((c) => c.status === 'pending' || c.status === 'accepted') || null,
            suspended,
            canManage: canManage(req),
        });
    }),

    // POST /api/support/plus — turn it on (full monthly price from the balance)
    enable: handle(async (req, res) => {
        needManage(req);
        const out = await plus.enable(req.user.userId);
        res.status(201).json({ message: 'Support + is on.', ...out });
    }),

    // DELETE /api/support/plus — cancel at the end of the paid month
    cancel: handle(async (req, res) => {
        needManage(req);
        const endsAt = await plus.cancel(req.user.userId);
        res.json({ message: 'Support + is cancelled.', endsAt });
    }),

    // POST /api/support/plus/keep — undo the cancellation
    keep: handle(async (req, res) => {
        needManage(req);
        await plus.keep(req.user.userId);
        res.json({ message: 'Support + will continue.' });
    }),

    // GET /api/support/callbacks
    callbacks: handle(async (req, res) => {
        res.json({ callbacks: await plus.listCallbacks(req.user.userId, 20) });
    }),

    // POST /api/support/callbacks { name, phone, note }
    requestCallback: handle(async (req, res) => {
        const { name, phone, note } = req.body || {};
        const callback = await plus.requestCallback({ userId: req.user.userId, actorId: req.user.actorId, name, phone, note });
        res.status(201).json({ message: "Call-back requested. We'll confirm shortly.", callback });
    }),

    // POST /api/support/callbacks/:id/cancel
    cancelCallback: handle(async (req, res) => {
        const callback = await plus.cancelCallback(req.user.userId, Number(req.params.id));
        res.json({ message: 'Request cancelled.', callback });
    }),
};
