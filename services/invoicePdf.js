/**
 * Monthly invoice PDF (pdfkit), for customers (Billing → Invoices) and
 * admins. One line per service with the days it ran (pro rata), then GST,
 * the late fee if any, what's been paid and what's due.
 */
const PDFDocument = require('pdfkit');
const connection = require('../config/db');
const { drawBrandHeader } = require('../utils/invoiceBrand');
const { getPlatform } = require('../utils/platformSettings');

const q = (sql, params = []) => new Promise((resolve, reject) => {
    connection.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
});

const money = (paise) => (Number(paise || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const day = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
const dayShort = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });
const month = (d) => new Date(d).toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });

/** Loads an invoice (optionally only the given user's) with its lines; null if not found. */
const loadInvoice = async (invoiceId, userId = null) => {
    const [inv] = await q(
        `SELECT mi.*, u.name AS user_name, u.email AS user_email, u.company, u.address
           FROM monthly_invoices mi LEFT JOIN users u ON u.id = mi.user_id
          WHERE mi.id = ? ${userId ? 'AND mi.user_id = ?' : ''}`,
        userId ? [invoiceId, userId] : [invoiceId],
    );
    if (!inv) return null;
    const items = await q('SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY id', [invoiceId]);
    return { inv, items };
};

/** Streams the invoice PDF into `res`. */
const sendInvoicePdf = async (res, { inv, items }) => {
    const { invoice: company } = await getPlatform();
    const doc = new PDFDocument({ margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${inv.invoice_number}.pdf"`);
    doc.pipe(res);

    const due = Math.max(0, Number(inv.total_amount) - Number(inv.amount_paid || 0));
    const status = inv.status === 'paid' ? 'PAID' : inv.status === 'overdue' ? 'OVERDUE' : 'DUE';
    const top = drawBrandHeader(doc, { title: 'TAX INVOICE', subtitle: `Status: ${status}` });

    doc.fontSize(10).fillColor('#000000');
    doc.text(`Invoice number: ${inv.invoice_number}`, 50, top)
        .text(`Invoice date: ${day(inv.generated_at)}`, 50, top + 15)
        .text(`Billing period: ${month(inv.billing_month)}`, 50, top + 30);
    doc.text(company.legalName, 330, top, { width: 220 })
        .text(`GSTIN: ${company.gstin}`, 330, doc.y + 2, { width: 220 })
        .text(company.email, 330, doc.y + 2, { width: 220 })
        .text(company.phone, 330, doc.y + 2, { width: 220 });

    const billTo = Math.max(doc.y, top + 50) + 20;
    doc.font('Helvetica-Bold').text('Bill to', 50, billTo).font('Helvetica')
        .text(inv.user_name || '', 50, billTo + 15)
        .text(inv.company || '', 50, doc.y)
        .text(inv.user_email || '', 50, doc.y)
        .text(inv.address || '', 50, doc.y, { width: 250 });

    // Lines
    let y = doc.y + 25;
    const head = () => {
        doc.fillColor('#0b2622').rect(50, y, 500, 22).fill().fillColor('#ffffff').fontSize(9)
            .text('Service', 58, y + 7).text('Period', 270, y + 7).text('Days', 390, y + 7)
            .text('Amount (INR)', 440, y + 7, { width: 102, align: 'right' });
        y += 28;
        doc.fillColor('#1d1f20');
    };
    head();
    const rows = items.length ? items : [{ description: inv.notes || 'Services', period_start: null, days: null, amount: inv.subtotal ?? inv.total_amount }];
    for (const it of rows) {
        if (y > 690) { doc.addPage(); y = 60; head(); }
        doc.fontSize(9);
        const period = it.period_start ? `${dayShort(it.period_start)} – ${dayShort(it.period_end)}` : '';
        const h = Math.max(doc.heightOfString(it.description, { width: 205 }), period ? doc.heightOfString(period, { width: 115 }) : 0, 12);
        doc.text(it.description, 58, y, { width: 205 });
        if (period) doc.text(period, 270, y, { width: 115 });
        if (it.days) doc.text(`${it.days}/${it.days_in_month}`, 390, y);
        doc.text(money(it.amount), 440, y, { width: 102, align: 'right' });
        y += h + 8;
    }

    // Totals
    y += 6;
    const total = (label, amount, bold = false) => {
        doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(10)
            .text(label, 300, y, { width: 140 }).text(money(amount), 440, y, { width: 102, align: 'right' });
        y += 18;
    };
    if (inv.subtotal !== null) {
        total('Subtotal', inv.subtotal);
        let breakdown = [];
        try { breakdown = JSON.parse(inv.tax_breakdown || '[]'); } catch { breakdown = []; }
        if (breakdown.length) breakdown.forEach((t) => total(t.description, t.amount));
        else if (Number(inv.tax_amount)) total('GST', inv.tax_amount);
        if (Number(inv.penalty_amount)) total('Late fee (10%)', inv.penalty_amount);
    }
    doc.moveTo(300, y).lineTo(542, y).strokeColor('#dcdce5').stroke();
    y += 6;
    total('Total', inv.total_amount, true);
    if (Number(inv.amount_paid)) total('Paid', inv.amount_paid);
    total(due ? 'Amount due' : 'Balance due', due, true);

    y += 20;
    doc.font('Helvetica').fontSize(9).fillColor('#3b3b42');
    if (company.bankName && company.accountNumber) {
        doc.text(`Bank: ${company.bankName} · Account: ${company.accountNumber} · IFSC: ${company.ifsc}`, 50, y);
        y = doc.y + 6;
    }
    doc.text('Pro rata: each service is billed for the days it existed in the month (monthly price ÷ days in month × days used).', 50, y, { width: 500 })
        .text(`Questions? ${company.email}. This is a computer-generated invoice.`, 50, doc.y + 6, { width: 500 });
    doc.end();
};

module.exports = { loadInvoice, sendInvoicePdf };
