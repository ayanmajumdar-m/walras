/**
 * Billing → Invoices for customers (utils/monthlyBilling.js). Team members
 * need the Billing area (utils/team.js).
 */
const connection = require('../config/db');
const billing = require('../utils/monthlyBilling');
const ccavenue = require('../services/ccavenueService');
const { loadInvoice, sendInvoicePdf } = require('../services/invoicePdf');

const q = (sql, params = []) => new Promise((resolve, reject) => {
    connection.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
});

const handle = (fn) => async (req, res) => {
    try {
        if (req.params.id !== undefined && !/^\d{1,10}$/.test(req.params.id)) throw notFound();
        await fn(req, res);
    } catch (err) {
        if (err.status) return res.status(err.status).json({ error: err.message });
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
                payWithinHours: billing.PAY_WITHIN_HOURS,
                lateFeePercent: Math.round(billing.LATE_FEE_RATE * 100),
                suspendAfterHours: billing.SUSPEND_AFTER_HOURS,
                deleteAfterDays: billing.DELETE_AFTER_HOURS / 24,
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
                days: it.days, daysInMonth: it.days_in_month, monthlyPrice: Number(it.monthly_price) / 100, amount: Number(it.amount) / 100,
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
     * left goes through CCAvenue (the browser posts the returned form).
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

        const config = ccavenue.getConfig();
        if (!config.isConfigured) throw Object.assign(new Error('Online payment is not available right now. Please contact support.'), { status: 503 });
        const [user] = await q('SELECT name, email, phone FROM users WHERE id = ?', [userId]);
        let [wallet] = await q('SELECT id FROM wallets WHERE user_id = ?', [userId]);
        if (!wallet) {
            await q('INSERT INTO wallets (user_id, balance) VALUES (?, 0)', [userId]);
            [wallet] = await q('SELECT id FROM wallets WHERE user_id = ?', [userId]);
        }
        const orderId = `CCAI_${Date.now()}_${inv.id}`;
        // The payment lands in the balance and is applied to the invoice at once (payment callback).
        await q(
            `INSERT INTO wallet_transactions (wallet_id, type, amount, description, reference_id, status)
             VALUES (?, 'credit', ?, ?, ?, 'pending')`,
            [wallet.id, due, `Payment for invoice ${cur.invoice_number} (Order ${orderId})`, orderId],
        );
        const params = {
            merchant_id: config.merchantId,
            order_id: orderId,
            currency: 'INR',
            amount: (due / 100).toFixed(2),
            redirect_url: `${config.clientUrl}/api/payment/ccavenue/response`,
            cancel_url: `${config.clientUrl}/api/payment/ccavenue/cancel`,
            language: 'EN',
            billing_name: user?.name || 'Customer',
            billing_email: user?.email || '',
            billing_tel: user?.phone || '',
            merchant_param1: String(userId),
            merchant_param2: 'invoice_payment',
            merchant_param3: String(inv.id),
        };
        res.json({
            paid: false,
            fromBalance: fromBalance / 100,
            amount: (due / 100).toFixed(2),
            actionUrl: config.actionUrl,
            encRequest: ccavenue.encrypt(ccavenue.stringifyParams(params), config.workingKey),
            accessCode: config.accessCode,
        });
    }),
};
