/**
 * Admin → Support → Support + (utils/supportPlus.js): call-back requests and
 * their status, and who subscribes. Needs the manage_callbacks permission.
 */
const plus = require('../utils/supportPlus');
const audit = require('../utils/audit');

const handle = (fn) => async (req, res) => {
    try {
        if (req.params.id !== undefined && !/^\d{1,10}$/.test(req.params.id)) {
            return res.status(404).json({ error: 'Request not found.' });
        }
        await fn(req, res);
    } catch (err) {
        if (err instanceof plus.HttpError) return res.status(err.status).json({ error: err.message });
        console.error(`Admin Support + ${req.method} ${req.path} failed:`, err.message);
        res.status(500).json({ error: 'Something went wrong' });
    }
};

module.exports = {
    // GET /api/admin/support-plus/callbacks?status=open|all|pending|…&search=
    list: handle(async (req, res) => {
        res.json(await plus.adminList({ status: String(req.query.status || 'open'), search: req.query.search }));
    }),

    // GET /api/admin/support-plus/subscribers
    subscribers: handle(async (req, res) => {
        res.json({ subscribers: await plus.adminSubscribers(), price: plus.MONTHLY_PRICE / 100 });
    }),

    // PUT /api/admin/support-plus/callbacks/:id { status, note }
    setStatus: handle(async (req, res) => {
        const { status, note } = req.body || {};
        const out = await plus.adminSetStatus({
            id: Number(req.params.id),
            status,
            note,
            admin: { id: req.admin.adminId, name: req.admin.fullName || req.admin.username },
        });
        audit(req, 'support_plus.callback_status', 'support_callback', req.params.id, { from: out.before, to: status });
        res.json({ message: `Marked ${plus.STATUS_WORDS[status].toLowerCase()}.`, request: out.request });
    }),
};
