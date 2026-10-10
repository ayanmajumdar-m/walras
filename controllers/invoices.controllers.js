/**
 * Billing → Invoices for customers (utils/monthlyBilling.js). Team members
 * need the Billing area (utils/team.js).
 */
const connection = require('../config/db');
const billing = require('../utils/monthlyBilling');
const payments = require('../utils/payments');
const { RazorpayError } = require('../services/razorpay');
const { loadInvoice, sendInvoicePdf } = require('../services/invoicePdf');

const q = (sql, params = []) => new Promise((resolve, reject) => {
    connection.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
});

const handle = (fn) => async (req, res) => {
    try {
        if (req.params.id !== undefined && !/^\d{1,10}$/.test(req.params.id)) throw notFound();
        await fn(req, res);
    } catch (err) {
        if (err.status && !(err instanceof RazorpayError)) return res.status(err.status).json({ error: err.message });
        if (err instanceof RazorpayError) {
            console.error(`Invoices ${req.method} ${req.path} (Razorpay) failed:`, err.message);
            return res.status(502).json({ error: "We couldn't reach the payment gateway. Please try again in a moment." });
        }
        console.error(`Invoices ${req.method} ${req.path} failed:`, err.message);
        res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
};
const notFound = () => Object.assign(new Error('Invoice not found'), { status: 404 });

module.exports = {
    // GET /api/invoices — the account's invoices and what's outstanding
    list: handle(async (req, res) => {
        const rows = await q('SELECT * FROM monthly_invoices WHERE user_id = ? ORDER BY billing_month DESC, id DESC LIMIT 36', [req.user.userId]);
        const invoices = rows.map(billing.publicInvoice);
        const unpaid = invoices.filter((i) => i.due > 0 && i.status !== 'paid');
        const oldest = unpaid.filter((i) => i.payBy).sort((a, b) => new Date(a.issuedAt) - new Date(b.issuedAt))[0] || null;
        res.json({
            invoices,
            summary: {
                due: unpaid.reduce((n, i) => n + i.due, 0),
                overdue: unpaid.some((i) => i.status === 'overdue'),
                suspended: unpaid.some((i) => i.suspended),
                oldest,
            },
            policy: {
                // Terms §5: due in 48 h, late fee then, suspension at 72 h, deletion 7 days after overdue.
                lateFeePercent: Math.round(billing.LATE_FEE_RATE * 100),
                dueHours: billing.DUE_HOURS,
                suspendHours: billing.SUSPEND_HOURS,
                deleteDaysAfterOverdue: billing.DELETE_DAYS_AFTER_OVERDUE,
            },
        });
    }),

    // GET /api/invoices/:id — one invoice with its lines
    get: handle(async (req, res) => {
        const found = await loadInvoice(req.params.id, req.user.userId);
        if (!found) throw notFound();
        res.json({
            invoice: billing.publicInvoice(found.inv),
            items: found.items.map((it) => ({
                description: it.description, periodStart: it.period_start, periodEnd: it.period_end,
                days: it.days, daysInMonth: it.days_in_month, months: it.months, monthlyPrice: Number(it.monthly_price) / 100, amount: Number(it.amount) / 100,
            })),
        });
    }),

    // GET /api/invoices/:id/pdf
    pdf: handle(async (req, res) => {
        const found = await loadInvoice(req.params.id, req.user.userId);
        if (!found) throw notFound();
        await sendInvoicePdf(res, found);
    }),

    /**
     * POST /api/invoices/:id/pay — the account balance first; whatever is
     * left is paid through Razorpay Checkout (the browser opens it with the
     * returned options and finishes at /api/payment/razorpay/verify).
     */
    pay: handle(async (req, res) => {
        const userId = req.user.userId;
        const [inv] = await q('SELECT * FROM monthly_invoices WHERE id = ? AND user_id = ?', [req.params.id, userId]);
        if (!inv) throw notFound();
        if (inv.status === 'paid') return res.json({ paid: true, message: 'This invoice is already paid.' });

        const fromBalance = await billing.applyBalance(userId);
        const [cur] = await q('SELECT * FROM monthly_invoices WHERE id = ?', [inv.id]);
        const due = Number(cur.total_amount) - Number(cur.amount_paid);
        if (cur.status === 'paid' || due <= 0) {
            return res.json({ paid: true, message: fromBalance ? 'Paid from your account balance.' : 'This invoice is paid.' });
        }

        // The payment lands in the balance and is applied to this invoice first (utils/payments.js).
        const checkout = await payments.startCheckout({
            userId, purpose: 'invoice', amount: due, invoiceId: inv.id, description: `Payment for invoice ${cur.invoice_number}`,
        });
        res.json({ paid: false, fromBalance: fromBalance / 100, amount: (due / 100).toFixed(2), checkout });
    }),
};
