/**
 * Server locations (utils/serverLocations.js, table server_locations).
 *
 * Public: GET /api/locations lists the active locations for the site.
 * Admin (Admin → Locations): list, add, edit, hide, delete. Which SolusVM
 * accounts serve a location is set on each account (Admin → SolusVM
 * accounts). A location with servers can't be deleted, only hidden.
 */
const connection = require('../config/db');
const locations = require('../utils/serverLocations');
const solusAccounts = require('../utils/solusAccounts');
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
    if (!partial || given('flagUrl')) {
        out.flagUrl = text(body.flagUrl, 'Flag image link', { max: 500, required: false });
        if (out.flagUrl) {
            let url;
            try { url = new URL(out.flagUrl); } catch { url = null; }
            if (!url || !/^https?:$/.test(url.protocol)) throw new HttpError(400, 'Flag image link must be a full https:// address.');
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

const COLUMNS = { name: 'name', country: 'country', note: 'note', flagUrl: 'flag_url', active: 'active', sortOrder: 'sort_order' };

const serversAt = async (locationId) => {
    const [{ n }] = await q('SELECT COUNT(*) AS n FROM servers WHERE location_id = ?', [locationId]);
    return Number(n);
};

const LocationsController = {
    // GET /api/locations — public
    publicList: handle(async (req, res) => {
        res.json({ locations: (await locations.getLocations()).map(({ name, country, note, flagUrl }) => ({ name, country, note, flagUrl })) });
    }),

    // GET /api/admin/locations — every location, its server count and the accounts serving it
    list: handle(async (req, res) => {
        const [all, accounts, counts] = await Promise.all([
            locations.getLocations({ all: true }),
            solusAccounts.listAccounts(),
            q('SELECT location_id, COUNT(*) AS n FROM servers WHERE location_id IS NOT NULL GROUP BY location_id'),
        ]);
        const byId = Object.fromEntries(counts.map((r) => [Number(r.location_id), Number(r.n)]));
        res.json({
            locations: all.map((l) => ({
                ...l,
                servers: byId[l.id] || 0,
                servedBy: accounts.filter((a) => a.locations[l.id]).map((a) => ({ id: a.id, name: a.name, status: a.status })),
            })),
        });
    }),

    // POST /api/admin/locations
    create: handle(async (req, res) => {
        const l = readLocation(req.body);
        const ins = await q(
            'INSERT INTO server_locations (name, country, note, flag_url, active, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
            [l.name, l.country, l.note, l.flagUrl || '', l.active ?? true, l.sortOrder ?? 0],
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
        const keys = Object.keys(l);
        if (!keys.length) throw new HttpError(400, 'Nothing to change.');
        await q(
            `UPDATE server_locations SET ${keys.map((k) => `${COLUMNS[k]} = ?`).join(', ')}, updated_at = NOW() WHERE id = ?`,
            [...keys.map((k) => l[k]), id],
        );
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
        const n = await serversAt(id);
        if (n > 0) throw new HttpError(409, `${loc.name} has ${n} server${n === 1 ? '' : 's'}, so it can't be deleted. Hide it instead.`);
        await q('DELETE FROM compute_stock WHERE location_id = ?', [id]);
        await q('DELETE FROM server_locations WHERE id = ?', [id]); // account links go with it (ON DELETE CASCADE)
        locations.forgetLocations();
        solusAccounts.forgetAccounts();
        audit(req, 'locations.delete', 'location', id, { name: loc.name });
        res.json({ message: `${loc.name} deleted.` });
    }),
};

module.exports = LocationsController;
