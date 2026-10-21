/**
 * Admin → Products → Dedicated Servers (utils/dedicated.js): the listings
 * customers can order (add, edit, hide, delete) and every order, with who
 * bought it and its status.
 */
const connection = require('../config/db');
const dedicated = require('../utils/dedicated');
const audit = require('../utils/audit');

const q = (sql, params = []) => new Promise((resolve, reject) => {
    connection.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
});

const { HttpError } = dedicated;

const handle = (fn) => async (req, res) => {
    try {
        await fn(req, res);
    } catch (err) {
        if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
        console.error(`Admin dedicated ${req.method} ${req.path} failed:`, err.message);
        res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
};

const toId = (v) => {
    const n = Number.parseInt(v, 10);
    if (!Number.isFinite(n) || n <= 0) throw new HttpError(400, 'Invalid id');
    return n;
};

const meta = () => ({ categories: dedicated.CATEGORIES, delivery: dedicated.DELIVERY });

module.exports = {
    // GET /api/admin/dedicated/servers — every listing, with how many orders each has
    listServers: handle(async (req, res) => {
        const [servers, counts] = await Promise.all([
            dedicated.listServers({ all: true }),
            q(`SELECT server_id, COUNT(*)::int AS n FROM dedicated_orders WHERE status <> 'cancelled' GROUP BY server_id`),
        ]);
        const byServer = new Map(counts.map((c) => [c.server_id, c.n]));
        res.json({ servers: servers.map((s) => ({ ...s, orders: byServer.get(s.id) || 0 })), ...meta() });
    }),

    createServer: handle(async (req, res) => {
        const v = dedicated.readServer(req.body);
        const cols = Object.keys(v);
        const created = await q(
            `INSERT INTO dedicated_servers (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')}) RETURNING id`,
            cols.map((c) => v[c])
        );
        audit(req, 'dedicated.server_create', 'dedicated_server', created.insertId, { cpu: v.cpu, price: v.price_inr });
        res.status(201).json({ message: `${v.cpu} added.` });
    }),

    updateServer: handle(async (req, res) => {
        const id = toId(req.params.id);
        const v = dedicated.readServer(req.body, { partial: true });
        const cols = Object.keys(v);
        if (!cols.length) throw new HttpError(400, 'Nothing to change.');
        const updated = await q(`UPDATE dedicated_servers SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`, [...cols.map((c) => v[c]), id]);
        if (!updated.affectedRows) throw new HttpError(404, 'Listing not found.');
        audit(req, 'dedicated.server_update', 'dedicated_server', id, v);
        res.json({ message: 'Listing saved.' });
    }),

    // A listing anyone ordered can only be hidden, so their order keeps its link.
    removeServer: handle(async (req, res) => {
        const id = toId(req.params.id);
        const [used] = await q('SELECT COUNT(*)::int AS n FROM dedicated_orders WHERE server_id = ?', [id]);
        if (used.n > 0) throw new HttpError(409, 'Customers have ordered this server. Hide it instead.');
        const removed = await q('DELETE FROM dedicated_servers WHERE id = ?', [id]);
        if (!removed.affectedRows) throw new HttpError(404, 'Listing not found.');
        audit(req, 'dedicated.server_delete', 'dedicated_server', id);
        res.json({ message: 'Listing deleted.' });
    }),

    // GET /api/admin/dedicated/orders
    listOrders: handle(async (req, res) => {
        res.json({ orders: await dedicated.adminOrders() });
    }),

    // PUT /api/admin/dedicated/orders/:id { status, note }
    setOrderStatus: handle(async (req, res) => {
        const id = toId(req.params.id);
        const order = await dedicated.setOrderStatus(id, req.body.status, req.body.note);
        audit(req, 'dedicated.order_status', 'dedicated_order', id, { status: order.status });
        res.json({ message: order.status === 'active' ? 'Marked active.' : order.status === 'cancelled' ? 'Order cancelled.' : 'Marked as bought (being set up).', order });
    }),
};
