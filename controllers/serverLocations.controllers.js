/**
 * Server locations (utils/serverLocations.js, table server_locations).
 *
 * Public: GET /api/locations lists the active locations for the site.
 * Admin (Admin → Locations): list, add, edit, hide, delete, and link each to
 * a SolusVM location. A location with servers can't be deleted or re-linked,
 * only hidden: its servers and stock refer to its SolusVM location.
 */
const connection = require('../config/db');
const locations = require('../utils/serverLocations');
const solusvm = require('../services/solusvm');
const audit = require('../utils/audit');

const q = (sql, params = []) => new Promise((resolve, reject) => {
    connection.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
});

class HttpError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

const handle = (fn) => async (req, res) => {
    try {
        await fn(req, res);
    } catch (err) {
        if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
        if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'That SolusVM location is already linked to another location.' });
        console.error(`Locations ${req.method} ${req.path} failed:`, err.message);
        res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
};

const text = (v, label, { max, required = true }) => {
    const s = String(v ?? '').trim();
    if (required && !s) throw new HttpError(400, `${label} is required.`);
    if (s.length > max) throw new HttpError(400, `${label} can be at most ${max} characters.`);
    return s;
};

/** Validated fields from the body; `partial` for edits. */
const readLocation = (body, { partial = false } = {}) => {
    const out = {};
    const given = (k) => body[k] !== undefined;
    if (!partial || given('name')) out.name = text(body.name, 'City', { max: 60 });
    if (!partial || given('country')) out.country = text(body.country, 'Country', { max: 60 });
    if (!partial || given('note')) out.note = text(body.note, 'Description', { max: 160, required: false });
    if (given('solusLocationId')) {
        if (body.solusLocationId === null || body.solusLocationId === '') out.solusLocationId = null;
        else {
            const id = Number(body.solusLocationId);
            if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, 'Choose a SolusVM location, or none.');
            out.solusLocationId = id;
        }
    }
    if (given('active')) out.active = Boolean(body.active);
    if (given('sortOrder') && body.sortOrder !== '') {
        const n = Number(body.sortOrder);
        if (!Number.isInteger(n) || Math.abs(n) > 100000) throw new HttpError(400, 'Order must be a whole number.');
        out.sortOrder = n;
    }
    return out;
};

const COLUMNS = { name: 'name', country: 'country', note: 'note', solusLocationId: 'solus_location_id', active: 'active', sortOrder: 'sort_order' };

const serversAt = async (solusId) => {
    if (!solusId) return 0;
    const [{ n }] = await q('SELECT COUNT(*) AS n FROM servers WHERE location_id = ?', [solusId]);
    return Number(n);
};

const LocationsController = {
    // GET /api/locations — public
    publicList: handle(async (req, res) => {
        res.json({ locations: (await locations.getLocations()).map(({ name, country, note }) => ({ name, country, note })) });
    }),

    // GET /api/admin/locations — every location, the SolusVM list for linking, and server counts
    list: handle(async (req, res) => {
        const all = await locations.getLocations({ all: true });
        let solusLocations = [];
        let solusError = null;
        if (solusvm.solusConfigured()) {
            solusvm.forgetCatalog();
            try { solusLocations = await solusvm.listLocations(); } catch (err) { solusError = err.message; }
        }
        const counts = await q('SELECT location_id, COUNT(*) AS n FROM servers WHERE location_id IS NOT NULL GROUP BY location_id');
        const byId = Object.fromEntries(counts.map((r) => [Number(r.location_id), Number(r.n)]));
        res.json({
            solusConfigured: solusvm.solusConfigured(),
            solusError,
            solusLocations,
            locations: all.map((l) => ({ ...l, servers: l.solusLocationId ? byId[l.solusLocationId] || 0 : 0 })),
        });
    }),

    // POST /api/admin/locations
    create: handle(async (req, res) => {
        const l = readLocation(req.body);
        const ins = await q(
            'INSERT INTO server_locations (name, country, note, solus_location_id, active, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
            [l.name, l.country, l.note, l.solusLocationId ?? null, l.active ?? true, l.sortOrder ?? 0],
        );
        locations.forgetLocations();
        audit(req, 'locations.create', 'location', ins.insertId, l);
        res.status(201).json({ id: ins.insertId, message: `${l.name} added.` });
    }),

    // PUT /api/admin/locations/:id
    update: handle(async (req, res) => {
        const id = Number(req.params.id);
        const before = (await locations.getLocations({ all: true })).find((l) => l.id === id);
        if (!before) throw new HttpError(404, 'Location not found.');
        const l = readLocation(req.body, { partial: true });
        if ('solusLocationId' in l && l.solusLocationId !== before.solusLocationId) {
            const n = await serversAt(before.solusLocationId);
            if (n > 0) throw new HttpError(409, `${before.name} has ${n} server${n === 1 ? '' : 's'}, so its SolusVM link can't change. Hide it instead.`);
        }
        const keys = Object.keys(l);
        if (!keys.length) throw new HttpError(400, 'Nothing to change.');
        await q(
            `UPDATE server_locations SET ${keys.map((k) => `${COLUMNS[k]} = ?`).join(', ')}, updated_at = NOW() WHERE id = ?`,
            [...keys.map((k) => l[k]), id],
        );
        // Unlinked from a SolusVM location: its stock there no longer applies.
        if ('solusLocationId' in l && before.solusLocationId && l.solusLocationId !== before.solusLocationId) {
            await q('DELETE FROM compute_stock WHERE location_id = ?', [before.solusLocationId]);
        }
        locations.forgetLocations();
        const changes = Object.fromEntries(keys.filter((k) => before[k] !== l[k]).map((k) => [k, { from: before[k], to: l[k] }]));
        audit(req, 'locations.update', 'location', id, { name: before.name, changes });
        res.json({ message: `${l.name || before.name} saved.` });
    }),

    // DELETE /api/admin/locations/:id — only when no servers are there
    remove: handle(async (req, res) => {
        const id = Number(req.params.id);
        const loc = (await locations.getLocations({ all: true })).find((l) => l.id === id);
        if (!loc) throw new HttpError(404, 'Location not found.');
        const n = await serversAt(loc.solusLocationId);
        if (n > 0) throw new HttpError(409, `${loc.name} has ${n} server${n === 1 ? '' : 's'}, so it can't be deleted. Hide it instead.`);
        if (loc.solusLocationId) await q('DELETE FROM compute_stock WHERE location_id = ?', [loc.solusLocationId]);
        await q('DELETE FROM server_locations WHERE id = ?', [id]);
        locations.forgetLocations();
        audit(req, 'locations.delete', 'location', id, { name: loc.name });
        res.json({ message: `${loc.name} deleted.` });
    }),
};

module.exports = LocationsController;
