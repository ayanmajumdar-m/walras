/**
 * Admin → Billing → Invoices (utils/monthlyBilling.js): purchase invoices
 * (paid at checkout) and monthly renewals. Admins can waive the late fee,
 * mark an invoice paid (money received outside Walras), download the PDF
 * and run this month's renewals now.
 */
const connection = require('../config/db');
const billing = require('../utils/monthlyBilling');
const { loadInvoice, sendInvoicePdf } = require('../services/invoicePdf');
const audit = require('../utils/audit');

const q = (sql, params = []) => new Promise((resolve, reject) => {
    connection.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
});

const handle = (fn) => async (req, res) => {
    try {
        if (req.params.id !== undefined && !/^\d{1,10}$/.test(req.params.id)) return res.status(404).json({ error: 'Invoice not found' });
        await fn(req, res);
    } catch (err) {
        if (err.status) return res.status(err.status).json({ error: err.message });
        console.error(`Admin invoices ${req.method} ${req.path} failed:`, err.message);
        res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
};

const withCustomer = (row) => ({
    ...billing.publicInvoice(row),
    userId: row.user_id,
    customer: row.user_name || row.user_email || `User ${row.user_id}`,
    email: row.user_email,
});

module.exports = {
    // GET /api/admin/monthly-invoices?status=unpaid|overdue|paid&userId=
    list: handle(async (req, res) => {
        const where = [];
        const params = [];
        if (req.query.status === 'unpaid') where.push("mi.status <> 'paid'");
        else if (['paid', 'overdue', 'pending'].includes(req.query.status)) { where.push('mi.status = ?'); params.push(req.query.status); }
        if (/^\d+$/.test(String(req.query.userId || ''))) { where.push('mi.user_id = ?'); params.push(Number(req.query.userId)); }
        const rows = await q(
            `SELECT mi.*, u.name AS user_name, u.email AS user_email
               FROM monthly_invoices mi LEFT JOIN users u ON u.id = mi.user_id
              ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
              ORDER BY mi.billing_month DESC, mi.id DESC LIMIT 500`,
            params,
        );
        const invoices = rows.map(withCustomer);
        const unpaid = invoices.filter((i) => i.status !== 'paid' && i.due > 0);
        res.json({
            invoices,
            summary: {
                unpaidCount: unpaid.length,
                unpaidTotal: unpaid.reduce((n, i) => n + i.due, 0),
                overdueCount: unpaid.filter((i) => i.status === 'overdue').length,
                suspendedCount: unpaid.filter((i) => i.suspended).length,
            },
        });
    }),

    // GET /api/admin/monthly-invoices/:id — with its lines
    get: handle(async (req, res) => {
        const found = await loadInvoice(req.params.id);
        if (!found) return res.status(404).json({ error: 'Invoice not found' });
        res.json({
            invoice: withCustomer(found.inv),
            items: found.items.map((it) => ({
                description: it.description, periodStart: it.period_start, periodEnd: it.period_end,
                days: it.days, daysInMonth: it.days_in_month, months: it.months, monthlyPrice: Number(it.monthly_price) / 100, amount: Number(it.amount) / 100,
            })),
        });
    }),

    // GET /api/admin/monthly-invoices/:id/download
    download: handle(async (req, res) => {
        const found = await loadInvoice(req.params.id);
        if (!found) return res.status(404).json({ error: 'Invoice not found' });
        await sendInvoicePdf(res, found);
    }),

    // POST /api/admin/monthly-invoices/:id/waive-fee
    waiveFee: handle(async (req, res) => {
        const r = await billing.waiveLateFee(Number(req.params.id));
        audit(req, 'invoice.waive_fee', 'invoice', req.params.id, { userId: r.userId, fee: r.fee / 100, refundedToBalance: r.refund / 100 });
        res.json({
            message: r.refund ? `Late fee waived. ₹${(r.refund / 100).toFixed(2)} already paid towards it was returned to the customer's balance.`
                : 'Late fee waived.',
        });
    }),

    // POST /api/admin/monthly-invoices/:id/mark-paid
    markPaid: handle(async (req, res) => {
        const r = await billing.markPaid(Number(req.params.id));
        audit(req, 'invoice.mark_paid', 'invoice', req.params.id, { userId: r.userId, note: String(req.body?.note || '').slice(0, 200) });
        res.json({ message: 'Invoice marked paid. Any suspended servers are being started again.' });
    }),

    // POST /api/admin/generate-monthly-invoices — renew servers not yet paid for this month
    generate: handle(async (req, res) => {
        const created = await billing.renewMonth();
        audit(req, 'invoice.generate', 'invoice', 'renewals', { created });
        res.json({ message: created ? `Issued ${created} renewal invoice(s) for this month.` : 'Every server is already renewed for this month.' });
    }),
};
