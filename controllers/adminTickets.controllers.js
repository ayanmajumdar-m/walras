/**
 * Admin → Support → Tickets: the customers' support tickets from Zendesk
 * (services/zendesk.js), Walras brand only, read-only here. Agents answer
 * them in Zendesk; each ticket links there. Needs view_tickets.
 */
const connection = require('../config/db');
const zendesk = require('../services/zendesk');

const q = (sql, params = []) => new Promise((resolve, reject) => {
    connection.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
});

const STATUSES = ['open', 'new', 'pending', 'hold', 'solved', 'closed', 'all'];

const handle = (fn) => async (req, res) => {
    try {
        await fn(req, res);
    } catch (err) {
        if (err.status === 404 && !(err instanceof zendesk.ZendeskError)) return res.status(404).json({ error: err.message });
        if (err instanceof zendesk.ZendeskError) {
            console.error(`Admin tickets ${req.method} ${req.path} (Zendesk) failed:`, err.message);
            return res.status(502).json({ error: "Couldn't reach Zendesk. Please try again in a moment." });
        }
        console.error(`Admin tickets ${req.method} ${req.path} failed:`, err.message);
        res.status(500).json({ error: 'Something went wrong' });
    }
};
const notFound = () => Object.assign(new Error('Ticket not found'), { status: 404 });

/** Walras customers linked to these Zendesk users, by Zendesk user id. */
const customersFor = async (zendeskIds) => {
    const ids = [...new Set(zendeskIds.filter(Boolean).map(String))];
    if (!ids.length) return new Map();
    const rows = await q('SELECT id, name, email, waladmin_id, zendesk_user_id FROM users WHERE zendesk_user_id = ANY(?::bigint[])', [ids]);
    return new Map(rows.map((r) => [String(r.zendesk_user_id), { userId: r.id, name: r.name, email: r.email, waladminId: r.waladmin_id }]));
};

const groupNames = async () => new Map((await zendesk.listZendeskGroups().catch(() => [])).map((g) => [g.id, g.name]));
const ticketLink = (id) => (zendesk.zendeskAgentUrl() ? `${zendesk.zendeskAgentUrl()}/tickets/${id}` : null);

module.exports = {
    // GET /api/admin/support/tickets?status=open|new|pending|hold|solved|closed|all&search=&page=
    list: handle(async (req, res) => {
        if (!zendesk.zendeskConfigured()) return res.json({ configured: false, tickets: [], count: 0, hasMore: false });
        const status = STATUSES.includes(req.query.status) ? req.query.status : 'open';
        const page = Math.min(Math.max(parseInt(req.query.page, 10) || 1, 1), 20);
        const found = await zendesk.searchZendeskTickets({ status, text: req.query.search, page });
        const requesterIds = found.tickets.map((t) => t.requester_id);
        const [customers, groups] = await Promise.all([customersFor(requesterIds), groupNames()]);
        // Requesters who aren't linked to a Walras account (e.g. emailed in): their Zendesk name and email.
        const unknown = requesterIds.filter((id) => id && !customers.has(String(id)));
        const people = new Map((await zendesk.zendeskUsersById(unknown).catch(() => [])).map((u) => [u.id, u]));
        res.json({
            configured: true,
            count: found.count,
            hasMore: found.hasMore,
            page,
            agentUrl: zendesk.zendeskAgentUrl(),
            tickets: found.tickets.map((t) => {
                const customer = customers.get(String(t.requester_id)) || null;
                const person = people.get(t.requester_id);
                return {
                    id: String(t.id),
                    subject: t.subject || '(no subject)',
                    status: t.status,
                    priority: t.priority || null,
                    department: groups.get(t.group_id) || null,
                    customer,
                    requester: customer ? { name: customer.name, email: customer.email } : { name: person?.name || 'Unknown', email: person?.email || '' },
                    fromConsole: (t.tags || []).includes('walras_console'),
                    createdAt: t.created_at,
                    updatedAt: t.updated_at,
                    link: ticketLink(t.id),
                };
            }),
        });
    }),

    // GET /api/admin/support/tickets/:id — the whole conversation, internal notes included
    get: handle(async (req, res) => {
        if (!zendesk.zendeskConfigured()) throw notFound();
        if (!/^\d{1,15}$/.test(req.params.id)) throw notFound();
        const found = await zendesk.getZendeskTicket(Number(req.params.id));
        const brand = zendesk.zendeskBrandId();
        if (!found || (brand && found.ticket.brand_id !== brand)) throw notFound();
        const { ticket, comments } = found;
        const ids = [ticket.requester_id, ticket.assignee_id, ...comments.map((c) => c.author_id)];
        const [customers, groups, people] = await Promise.all([
            customersFor([ticket.requester_id]),
            groupNames(),
            zendesk.zendeskUsersById(ids).catch(() => []),
        ]);
        const byId = new Map(people.map((u) => [u.id, u]));
        const nameOf = (id) => byId.get(id)?.name || (id === ticket.requester_id ? 'Customer' : 'Agent');
        res.json({
            ticket: {
                id: String(ticket.id),
                subject: ticket.subject || '(no subject)',
                status: ticket.status,
                priority: ticket.priority || null,
                department: groups.get(ticket.group_id) || null,
                assignee: ticket.assignee_id ? nameOf(ticket.assignee_id) : null,
                customer: customers.get(String(ticket.requester_id)) || null,
                requester: { name: nameOf(ticket.requester_id), email: byId.get(ticket.requester_id)?.email || '' },
                createdAt: ticket.created_at,
                updatedAt: ticket.updated_at,
                link: ticketLink(ticket.id),
            },
            messages: comments.map((c) => ({
                id: String(c.id),
                author: nameOf(c.author_id),
                fromCustomer: c.author_id === ticket.requester_id,
                internal: c.public === false,
                body: c.plain_body || c.body || '',
                createdAt: c.created_at,
                attachments: (c.attachments || []).map((a) => ({ id: String(a.id), fileName: a.file_name, size: a.size })),
            })),
        });
    }),
};
