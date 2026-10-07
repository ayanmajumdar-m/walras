/**
 * Customer support tickets, backed by Zendesk (services/zendesk.js). A
 * customer only ever sees tickets they requested, under the Walras brand,
 * and only public comments.
 */
const connection = require('../config/db');
const zendesk = require('../services/zendesk');
const departments = require('../utils/supportDepartments');

const SUPPORT_EMAIL = 'support@walras.net';
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf', 'application/zip', 'application/x-zip-compressed', 'text/plain'];
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_FILES = 5;

const q = (sql, params = []) => new Promise((resolve, reject) => {
    connection.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
});

class SupportError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

const unavailable = () => new SupportError(503, `Support is temporarily unavailable. Please email ${SUPPORT_EMAIL}.`);

// Zendesk's statuses, in the words the Support page uses.
const customerStatus = (s) => (s === 'pending' ? 'waiting' : s === 'solved' ? 'resolved' : s === 'closed' ? 'closed' : 'open');

const handle = (fn) => async (req, res) => {
    try {
        await fn(req, res);
    } catch (err) {
        if (err instanceof SupportError) return res.status(err.status).json({ error: err.message });
        if (err instanceof zendesk.ZendeskError) {
            console.error('Support (Zendesk) failed:', err.message);
            const e = unavailable();
            return res.status(e.status).json({ error: e.message });
        }
        console.error('Support failed:', err.message);
        res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
};

const ticketId = (raw) => {
    if (!/^\d{1,15}$/.test(String(raw))) throw new SupportError(404, 'Ticket not found.');
    return Number(raw);
};

const validateAttachments = (list) => {
    if (list === undefined) return [];
    if (!Array.isArray(list) || list.length > MAX_FILES) throw new SupportError(400, `Attach up to ${MAX_FILES} files.`);
    return list.map((f) => {
        const fileName = String(f?.fileName || '').trim().slice(0, 200);
        if (!fileName) throw new SupportError(400, 'Each file needs a name.');
        if (!ALLOWED_TYPES.includes(f?.mimeType)) throw new SupportError(400, `${fileName}: that file type isn't allowed.`);
        const data = Buffer.from(String(f?.data || ''), 'base64');
        if (!data.length) throw new SupportError(400, `${fileName} is empty.`);
        if (data.length > MAX_FILE_BYTES) throw new SupportError(400, `${fileName} is larger than 10 MB.`);
        return { fileName, mimeType: f.mimeType, data };
    });
};

const uploadAll = async (files) => {
    const tokens = [];
    for (const f of files) tokens.push(await zendesk.uploadToZendesk(f));
    return tokens;
};

// The customer's own ticket, or a 404 (never another customer's or brand's).
const ownTicket = async (userId, id) => {
    const me = await zendesk.zendeskUserFor(userId);
    const found = await zendesk.getZendeskTicket(id);
    const brand = zendesk.zendeskBrandId();
    if (!found || found.ticket.requester_id !== me || (brand && found.ticket.brand_id !== brand)) {
        throw new SupportError(404, 'Ticket not found.');
    }
    return { me, ...found };
};

/** Account summary for the agent, added to each new ticket as an internal note. */
const accountNote = async (userId) => {
    const [u] = await q('SELECT id, name, email, phone, account_type, company, gstin, createdat FROM users WHERE id = ?', [userId]);
    const hosting = await q('SELECT domain, plan_name, status, expires_at FROM hosting_accounts WHERE user_id = ? ORDER BY created_at DESC LIMIT 5', [userId]).catch(() => []);
    const servers = await q('SELECT name, plan_name, status FROM servers WHERE user_id = ? ORDER BY created_at DESC LIMIT 5', [userId]).catch(() => []);
    const [wallet] = await q('SELECT balance FROM wallets WHERE user_id = ?', [userId]).catch(() => []);
    const date = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '-');
    const base = (process.env.CLIENT_URL || 'https://www.walras.net').replace(/\/+$/, '');
    return [
        'Walras Cloud account (added automatically)',
        `Customer: ${u?.name || '-'} <${u?.email || '-'}> · ${u?.phone || 'no phone'}`,
        `Type: ${u?.account_type || 'personal'}${u?.company ? ` · ${u.company}` : ''}${u?.gstin ? ` · GSTIN ${u.gstin}` : ''}`,
        `Joined ${date(u?.createdat)} · Account balance ₹${(Number(wallet?.balance || 0) / 100).toFixed(2)}`,
        `Admin: ${base}/vadmin-1997/dashboard?section=customer&id=${userId}`,
        '',
        'Web hosting:',
        ...(hosting.length ? hosting.map((h) => `- ${h.domain} (${h.plan_name}): ${h.status}, expires ${date(h.expires_at)}`) : ['- none']),
        '',
        'Cloud Compute:',
        ...(servers.length ? servers.map((s) => `- ${s.name} (${s.plan_name}): ${s.status}`) : ['- none']),
    ].join('\n');
};

const SupportController = {
    // GET /api/support/status
    status: (req, res) => res.json({ configured: zendesk.zendeskConfigured(), email: SUPPORT_EMAIL }),

    // GET /api/support/departments — Zendesk groups a ticket can go to.
    departments: handle(async (req, res) => {
        res.json({ departments: await departments.getDepartments() });
    }),

    // GET /api/support/tickets
    list: handle(async (req, res) => {
        if (!zendesk.zendeskConfigured()) return res.json({ configured: false, tickets: [] });
        const me = await zendesk.zendeskUserFor(req.user.userId);
        const [tickets, depts] = await Promise.all([zendesk.listZendeskTicketsFor(me), departments.getDepartments()]);
        // Only customer-facing department names; internal groups stay hidden.
        const deptName = new Map(depts.map((d) => [d.id, d.name]));
        res.json({
            configured: true,
            tickets: tickets.map((t) => ({
                id: String(t.id),
                subject: t.subject || '(no subject)',
                status: customerStatus(t.status),
                department: deptName.get(t.group_id) || null,
                created_at: t.created_at,
                updated_at: t.updated_at,
            })),
        });
    }),

    // POST /api/support/tickets { subject, description, departmentId?, attachments? }
    create: handle(async (req, res) => {
        if (!zendesk.zendeskConfigured()) throw unavailable();
        const subject = String(req.body.subject || '').trim();
        const description = String(req.body.description || '').trim();
        if (subject.length < 3 || subject.length > 160) throw new SupportError(400, 'Give your ticket a short subject (3 to 160 characters).');
        if (description.length < 10 || description.length > 4000) throw new SupportError(400, 'Describe the problem in 10 to 4000 characters.');
        const files = validateAttachments(req.body.attachments);

        // A department is required whenever there are any to choose from.
        const depts = await departments.getDepartments();
        const department = depts.find((d) => d.id === Number(req.body.departmentId)) || null;
        if (depts.length && !department) throw new SupportError(400, 'Choose the department you need help from.');

        const requesterId = await zendesk.zendeskUserFor(req.user.userId);
        const ticket = await zendesk.createZendeskTicket({
            requesterId,
            subject,
            body: description,
            uploads: await uploadAll(files),
            tags: ['walras_console'],
            groupId: department?.id,
        });
        let note = await accountNote(req.user.userId);
        if (department) note = `Department chosen by the customer: ${department.name}\n\n${note}`;
        if (req.user.actorId) {
            const [actor] = await q('SELECT name, email FROM users WHERE id = ?', [req.user.actorId]).catch(() => []);
            note = `Opened by team member: ${actor?.name || '-'} <${actor?.email || '-'}>\n\n${note}`;
        }
        await zendesk.addZendeskNote(ticket.id, note)
            .catch((err) => console.warn(`Support note failed on ticket ${ticket.id}:`, err.message));
        res.status(201).json({ id: String(ticket.id) });
    }),

    // GET /api/support/tickets/:id
    get: handle(async (req, res) => {
        if (!zendesk.zendeskConfigured()) throw unavailable();
        const { me, ticket, comments } = await ownTicket(req.user.userId, ticketId(req.params.id));
        const dept = (await departments.getDepartments()).find((d) => d.id === ticket.group_id);
        res.json({
            ticket: {
                id: String(ticket.id),
                subject: ticket.subject || '(no subject)',
                status: customerStatus(ticket.status),
                department: dept ? dept.name : null,
                canReply: ticket.status !== 'closed',
                created_at: ticket.created_at,
            },
            messages: comments.filter((c) => c.public).map((c) => ({
                id: String(c.id),
                fromMe: c.author_id === me,
                body: c.plain_body || c.body,
                created_at: c.created_at,
                attachments: (c.attachments || []).map((a) => ({ id: String(a.id), fileName: a.file_name, mimeType: a.content_type, size: a.size })),
            })),
        });
    }),

    // POST /api/support/tickets/:id/reply { body, attachments? }
    reply: handle(async (req, res) => {
        if (!zendesk.zendeskConfigured()) throw unavailable();
        const body = String(req.body.body || '').trim();
        if (!body || body.length > 4000) throw new SupportError(400, 'Write a reply (up to 4000 characters).');
        const files = validateAttachments(req.body.attachments);
        const { me, ticket } = await ownTicket(req.user.userId, ticketId(req.params.id));
        if (ticket.status === 'closed') throw new SupportError(400, 'This ticket is closed. Please open a new one.');
        await zendesk.addZendeskReply(ticket.id, me, body, await uploadAll(files));
        res.json({ ok: true });
    }),

    // GET /api/support/tickets/:id/attachments/:attachmentId — streams the file
    attachment: handle(async (req, res) => {
        if (!zendesk.zendeskConfigured()) throw unavailable();
        if (!/^\d{1,20}$/.test(req.params.attachmentId)) throw new SupportError(404, 'Attachment not found.');
        const { comments } = await ownTicket(req.user.userId, ticketId(req.params.id));
        const att = comments.filter((c) => c.public).flatMap((c) => c.attachments || []).find((a) => String(a.id) === req.params.attachmentId);
        if (!att) throw new SupportError(404, 'Attachment not found.');
        const bytes = await zendesk.downloadZendeskAttachment(att.content_url, 25 * 1024 * 1024);
        res.setHeader('Content-Type', att.content_type || 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="${String(att.file_name).replace(/["\r\n]/g, '')}"`);
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.send(bytes);
    }),
};

module.exports = SupportController;
