/**
 * Support departments: the Zendesk agent groups a customer can send a ticket
 * to. Read live from Zendesk; an admin chooses which groups customers see and
 * what each is called (Admin → Settings → Support departments), stored in
 * app_settings as support.departments = [{ groupId, label }].
 *
 * Until an admin chooses, the groups named in DEFAULT_DEPARTMENTS are offered
 * (in that order, under their Zendesk names). If none of those exist, every
 * group is offered, so customers always have something to pick.
 */
const appSettings = require('./appSettings');
const zendesk = require('../services/zendesk');

const KEY = 'support.departments';

// Walras's Zendesk groups that customers should see by default. "Support" is
// deliberately left out (it sits too close to "Tech Support").
const DEFAULT_DEPARTMENTS = ['General Queries', 'Sales & Billing', 'Tech Support', 'Abuse'];

const defaultGroups = (groups) => {
    const byName = new Map(groups.map((g) => [g.name.trim().toLowerCase(), g]));
    const picked = DEFAULT_DEPARTMENTS.map((n) => byName.get(n.toLowerCase())).filter(Boolean);
    return picked.length ? picked : groups;
};

const readChoice = async () => {
    try {
        const raw = (await appSettings.getAll())[KEY];
        const list = raw ? JSON.parse(raw) : null;
        return Array.isArray(list) ? list : null;
    } catch {
        return null;
    }
};

/** [{ id, name }] customers can pick from. Empty if Zendesk is unavailable. */
const getDepartments = async () => {
    if (!zendesk.zendeskConfigured()) return [];
    let groups;
    try {
        groups = await zendesk.listZendeskGroups();
    } catch (err) {
        console.warn('Zendesk groups unavailable:', err.message);
        return [];
    }
    const choice = await readChoice();
    if (!choice) return defaultGroups(groups).map((g) => ({ id: g.id, name: g.name }));
    const byId = new Map(groups.map((g) => [g.id, g]));
    // Groups deleted in Zendesk since drop out on their own.
    return choice
        .filter((c) => byId.has(c.groupId))
        .map((c) => ({ id: c.groupId, name: (c.label || '').trim() || byId.get(c.groupId).name }));
};

/** For the admin page: every Zendesk group, the saved choice (null = default) and the default. */
const getAdminView = async () => {
    const groups = await zendesk.listZendeskGroups({ fresh: true });
    return { groups, choice: await readChoice(), defaultIds: defaultGroups(groups).map((g) => g.id) };
};

/** Saves the choice; null goes back to the default set. */
const setChoice = async (list) => {
    if (list === null) return appSettings.setMany({ [KEY]: '' });
    const clean = [];
    const seen = new Set();
    for (const item of Array.isArray(list) ? list : []) {
        const groupId = Number(item?.groupId);
        if (!Number.isInteger(groupId) || groupId <= 0 || seen.has(groupId)) continue;
        seen.add(groupId);
        clean.push({ groupId, label: String(item.label || '').trim().slice(0, 60) });
    }
    return appSettings.setMany({ [KEY]: JSON.stringify(clean) });
};

module.exports = { getDepartments, getAdminView, setChoice };
