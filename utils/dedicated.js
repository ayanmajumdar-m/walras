/**
 * Dedicated Servers: listings (dedicated_servers) managed in Admin →
 * Products → Dedicated Servers, shown on metal.walras.net and in the console
 * (Dedicated Servers), and customers' orders (dedicated_orders).
 *
 * Nothing is charged or provisioned yet. Ordering records the server as
 * bought (status 'pending') and takes one from the listing's stock; an admin
 * sets it up by hand and marks the order active, or cancelled (the stock
 * comes back).
 */
const connection = require('../config/db');

const q = (sql, params = []) => new Promise((resolve, reject) => {
    connection.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
});

class HttpError extends Error {
    constructor(status, message, extra = {}) {
        super(message);
        this.status = status;
        this.extra = extra;
    }
}

// Category pills on the catalog, in their order.
const CATEGORIES = {
    deals: 'Deals',
    storage: 'Storage',
    virtualization: 'Virtualization',
    devops: 'DevOps',
    ai: 'AI / ML',
    database: 'Database',
    gaming: 'Gaming',
};

const DELIVERY = {
    instant: '2 hours - Instant delivery',
    '24h': '24 hours',
    '7d': '7 days - Custom delivery',
};

const STATUSES = ['pending', 'active', 'cancelled'];

const toServer = (r) => ({
    id: r.id,
    brand: r.brand,
    model: r.model,
    cpu: r.cpu,
    cores: Number(r.cores),
    threads: Number(r.threads),
    ghz: Number(r.ghz),
    memoryGb: Number(r.memory_gb),
    storage: r.storage,
    network: r.network,
    uplinkGbps: Number(r.uplink_gbps),
    trafficTb: Number(r.traffic_tb),
    countryCode: String(r.country_code || '').trim().toUpperCase(),
    location: r.location,
    delivery: r.delivery,
    categories: String(r.categories || '').split(',').filter((c) => CATEGORIES[c]),
    badge: r.badge || '',
    monthly: Number(r.price_inr),
    stock: Number(r.stock),
    active: Boolean(r.active),
    sortOrder: Number(r.sort_order),
});

/** What a customer sees: no stock count beyond "only a few left". */
const toPublic = (s) => {
    const { stock, active, sortOrder, ...rest } = s;
    return { ...rest, inStock: stock > 0, fewLeft: stock > 0 && stock <= 3 ? stock : null };
};

const listServers = async ({ all = false } = {}) => (await q(
    `SELECT * FROM dedicated_servers ${all ? '' : 'WHERE active = TRUE'} ORDER BY sort_order, price_inr, id`
)).map(toServer);

const catalog = async () => ({
    servers: (await listServers()).map(toPublic),
    categories: CATEGORIES,
    delivery: DELIVERY,
});

// ── Validation (admin) ─────────────────────────────────────────────────────
const readServer = (body, { partial = false } = {}) => {
    const out = {};
    const has = (k) => body[k] !== undefined && body[k] !== null && body[k] !== '';
    const text = (k, col, label, { max, required = true, re }) => {
        const given = !partial || body[k] !== undefined;
        if (!has(k) || !String(body[k]).trim()) {
            if (required && given) throw new HttpError(400, `${label} is required.`);
            if (given) out[col] = '';
            return;
        }
        const v = String(body[k]).trim();
        if (v.length > max) throw new HttpError(400, `${label} must be at most ${max} characters.`);
        if (re && !re.test(v)) throw new HttpError(400, `${label} isn't valid.`);
        out[col] = v;
    };
    const num = (k, col, label, { min, max, int = false }) => {
        if (!has(k)) {
            if (!partial) throw new HttpError(400, `${label} is required.`);
            return;
        }
        const v = Number(body[k]);
        if (!Number.isFinite(v) || v < min || v > max || (int && !Number.isInteger(v))) {
            throw new HttpError(400, `${label} must be ${int ? 'a whole number' : 'a number'} from ${min} to ${max}.`);
        }
        out[col] = v;
    };
    text('brand', 'brand', 'Brand', { max: 40, required: false });
    text('model', 'model', 'Model', { max: 60, required: false });
    text('cpu', 'cpu', 'Processor', { max: 80 });
    num('cores', 'cores', 'Cores', { min: 1, max: 1024, int: true });
    num('threads', 'threads', 'Threads', { min: 1, max: 2048, int: true });
    num('ghz', 'ghz', 'Clock speed (GHz)', { min: 0.1, max: 9.99 });
    num('memoryGb', 'memory_gb', 'Memory (GB)', { min: 1, max: 65536, int: true });
    text('storage', 'storage', 'Storage', { max: 120 });
    text('network', 'network', 'Network', { max: 80 });
    num('uplinkGbps', 'uplink_gbps', 'Uplink (Gbit/s)', { min: 0.1, max: 400 });
    num('trafficTb', 'traffic_tb', 'Traffic (TB / month)', { min: 0, max: 100000, int: true });
    if (has('countryCode') || !partial) {
        const cc = String(body.countryCode || '').trim().toUpperCase();
        if (!/^[A-Z]{2}$/.test(cc)) throw new HttpError(400, 'Country code must be two letters, e.g. NL or IN.');
        out.country_code = cc;
    }
    text('location', 'location', 'Location', { max: 60 });
    if (has('delivery') || !partial) {
        if (!DELIVERY[body.delivery]) throw new HttpError(400, 'Choose a delivery time.');
        out.delivery = body.delivery;
    }
    if (body.categories !== undefined) {
        const list = Array.isArray(body.categories) ? body.categories : [];
        out.categories = Object.keys(CATEGORIES).filter((c) => list.includes(c)).join(',');
    }
    text('badge', 'badge', 'Ribbon', { max: 30, required: false });
    num('monthly', 'price_inr', 'Price (₹ / month)', { min: 1, max: 100000000 });
    num('stock', 'stock', 'Stock', { min: 0, max: 100000, int: true });
    if (has('sortOrder')) num('sortOrder', 'sort_order', 'Order', { min: -100000, max: 100000, int: true });
    if (body.active !== undefined) out.active = Boolean(body.active);
    if ((out.threads ?? Infinity) < (out.cores ?? 0)) throw new HttpError(400, 'Threads can\'t be fewer than cores.');
    return out;
};

const title = (s) => {
    const hardware = [s.brand, s.model].filter(Boolean).join(' ');
    return hardware ? `${s.cpu} · ${hardware}` : s.cpu;
};

// ── Orders ─────────────────────────────────────────────────────────────────
const toOrder = (r) => ({
    id: r.id,
    serverId: r.server_id,
    title: r.title,
    spec: r.spec || {},
    location: r.location,
    monthly: Number(r.monthly_price),
    status: r.status,
    note: r.admin_note || '',
    createdAt: r.created_at,
    activatedAt: r.activated_at,
    cancelledAt: r.cancelled_at,
});

const ordersOf = async (userId) => (await q(
    'SELECT * FROM dedicated_orders WHERE user_id = ? ORDER BY created_at DESC', [userId]
)).map(toOrder);

/**
 * Records the order (bought, being set up) and takes one from stock, in one
 * statement so two customers can't both get the last one.
 */
const placeOrder = async ({ userId, actorId, serverId }) => {
    const id = Number(serverId);
    if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, 'Choose a server.');
    const taken = await q(
        `UPDATE dedicated_servers SET stock = stock - 1
          WHERE id = ? AND active = TRUE AND stock > 0
          RETURNING *`,
        [id]
    );
    const row = taken.rows?.[0];
    if (!row) {
        const [exists] = await q('SELECT active FROM dedicated_servers WHERE id = ?', [id]);
        throw exists?.active
            ? new HttpError(409, 'This server is out of stock right now.', { outOfStock: true })
            : new HttpError(404, "That server isn't available.");
    }
    const s = toServer(row);
    const spec = {
        brand: s.brand, model: s.model, cpu: s.cpu, cores: s.cores, threads: s.threads, ghz: s.ghz,
        memoryGb: s.memoryGb, storage: s.storage, network: s.network, uplinkGbps: s.uplinkGbps,
        trafficTb: s.trafficTb, countryCode: s.countryCode, delivery: s.delivery,
    };
    try {
        const created = await q(
            `INSERT INTO dedicated_orders (user_id, ordered_by, server_id, title, spec, location, monthly_price)
             VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *`,
            [userId, actorId || null, s.id, title(s), JSON.stringify(spec), s.location, s.monthly]
        );
        return toOrder(created.rows[0]);
    } catch (err) {
        await q('UPDATE dedicated_servers SET stock = stock + 1 WHERE id = ?', [s.id]).catch(() => {});
        throw err;
    }
};

/** Every order with its customer, newest first (Admin → Dedicated Servers → Orders). */
const adminOrders = async () => (await q(
    `SELECT o.*, u.name AS customer, u.email, u.waladmin_id, u.company
       FROM dedicated_orders o JOIN users u ON u.id = o.user_id
      ORDER BY o.created_at DESC`
)).map((r) => ({ ...toOrder(r), userId: r.user_id, customer: r.customer, email: r.email, waladminId: r.waladmin_id, company: r.company || '' }));

/**
 * Admin sets an order active (set up and handed over) or cancelled. The note
 * is shown to the customer (e.g. the server's IP). Cancelling gives the
 * stock back; reactivating a cancelled order takes it again.
 */
const setOrderStatus = async (orderId, status, note) => {
    if (!STATUSES.includes(status)) throw new HttpError(400, 'Choose bought, active or cancelled.');
    const [order] = await q('SELECT * FROM dedicated_orders WHERE id = ?', [orderId]);
    if (!order) throw new HttpError(404, 'Order not found.');
    const wasCancelled = order.status === 'cancelled';
    const nowCancelled = status === 'cancelled';
    if (order.server_id && wasCancelled !== nowCancelled) {
        if (nowCancelled) {
            await q('UPDATE dedicated_servers SET stock = stock + 1 WHERE id = ?', [order.server_id]);
        } else {
            const back = await q('UPDATE dedicated_servers SET stock = stock - 1 WHERE id = ? AND stock > 0 RETURNING id', [order.server_id]);
            if (!back.rows?.length) throw new HttpError(409, "That server is out of stock, so this order can't be reopened. Add stock to the listing first.");
        }
    }
    const updated = await q(
        `UPDATE dedicated_orders
            SET status = ?, admin_note = ?,
                activated_at = CASE WHEN ? = 'active' THEN COALESCE(activated_at, NOW()) ELSE activated_at END,
                cancelled_at = CASE WHEN ? = 'cancelled' THEN NOW() ELSE NULL END
          WHERE id = ? RETURNING *`,
        [status, note ? String(note).trim().slice(0, 500) : null, status, status, orderId]
    );
    return toOrder(updated.rows[0]);
};

module.exports = {
    HttpError, CATEGORIES, DELIVERY, STATUSES,
    listServers, catalog, readServer, ordersOf, placeOrder, adminOrders, setOrderStatus, toServer,
};
