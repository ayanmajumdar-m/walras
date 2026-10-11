/**
 * Which server locations Managed Database ('database') and App Platform
 * ('apps') are offered in (table product_locations). They start with Mumbai
 * only (config/db.js); admins change it on each product's admin page. A
 * location must also be active (Admin → Locations) to be offered.
 */
const connection = require('../config/db');
const serverLocations = require('./serverLocations');

const PRODUCTS = ['database', 'apps'];

const q = (sql, params = []) => new Promise((resolve, reject) => {
    connection.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
});

const cache = new Map(); // product -> { ids, until }

/** Location ids the product is offered in (active or not). */
const getLocationIds = async (product) => {
    const hit = cache.get(product);
    if (hit && hit.until > Date.now()) return hit.ids;
    const rows = await q('SELECT location_id FROM product_locations WHERE product = ?', [product]);
    const ids = new Set(rows.map((r) => Number(r.location_id)));
    cache.set(product, { ids, until: Date.now() + 30 * 1000 });
    return ids;
};

/** Active locations the product is offered in, in the usual order. */
const getLocations = async (product) => {
    const [ids, active] = await Promise.all([getLocationIds(product), serverLocations.getLocations()]);
    return active.filter((l) => ids.has(l.id));
};

/** An offered, active location by id, or null. */
const findLocation = async (product, id) => (await getLocations(product)).find((l) => l.id === Number(id)) || null;

/** Replaces the product's locations. */
const setLocations = async (product, locationIds) => {
    if (!PRODUCTS.includes(product)) throw new Error('Unknown product');
    await q('DELETE FROM product_locations WHERE product = ?', [product]);
    for (const id of locationIds) {
        await q('INSERT INTO product_locations (product, location_id) VALUES (?, ?) ON CONFLICT DO NOTHING RETURNING product', [product, id]);
    }
    cache.delete(product);
};

module.exports = { PRODUCTS, getLocationIds, getLocations, findLocation, setLocations };
