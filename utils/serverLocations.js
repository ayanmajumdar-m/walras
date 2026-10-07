/**
 * Server locations, managed in Admin → Locations (table server_locations).
 *
 * Each location has a customer-facing name and country, a short note (shown
 * on the About page), whether it's shown at all (active) and its order. Its
 * id is what stock (compute_stock.location_id) and servers
 * (servers.location_id) use. SolusVM accounts say which locations they serve
 * (Admin → SolusVM accounts); an active location no account serves is listed
 * on the site and shows as "coming soon" in the order form.
 */
const connection = require('../config/db');

const q = (sql, params = []) => new Promise((resolve, reject) => {
    connection.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
});

const toLocation = (r) => ({
    id: r.id,
    name: r.name,
    country: r.country,
    note: r.note || '',
    active: Boolean(r.active),
    sortOrder: Number(r.sort_order),
});

let cache = null;
const load = async () => {
    if (cache && cache.until > Date.now()) return cache.list;
    const rows = await q('SELECT * FROM server_locations ORDER BY sort_order, name');
    cache = { list: rows.map(toLocation), until: Date.now() + 30 * 1000 };
    return cache.list;
};
const forgetLocations = () => { cache = null; };

/** Active locations, or every location with { all: true }. */
const getLocations = async ({ all = false } = {}) => {
    const list = await load();
    return all ? list : list.filter((l) => l.active);
};

/** An active location by id, if any. */
const findLocation = async (id) => (await getLocations()).find((l) => l.id === Number(id)) || null;

module.exports = { getLocations, findLocation, forgetLocations };
