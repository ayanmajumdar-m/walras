const path = require('path');
const fs = require('fs');

/**
 * Brand header for every invoice PDF (pdfkit), laid out like Fantom's:
 * logo + name + website on the left, the document title on the right, then
 * a rule. Returns the y position where the rest of the page can start.
 */
const LOGO_PATH = path.join(__dirname, '../assets/invoice-logo.png');
const hasLogo = fs.existsSync(LOGO_PATH);

const BRAND_NAME = 'WALRAS CLOUD';
const BRAND_WEBSITE = 'walras.net';
const BRAND_TEAL = '#037566';

const drawBrandHeader = (doc, { title = 'TAX INVOICE', subtitle = 'Original for recipient', top = 40 } = {}) => {
    const left = doc.page.margins.left;
    const right = doc.page.width - doc.page.margins.right;
    const logoH = 34;
    let textX = left;

    if (hasLogo) {
        doc.image(LOGO_PATH, left, top, { height: logoH });
        textX = left + logoH * 1.5 + 10; // logo is ~1.5:1
    }

    doc.font('Helvetica-Bold').fontSize(15).fillColor('#1d1f20')
        .text(BRAND_NAME, textX, top + 3, { lineBreak: false });
    doc.font('Helvetica').fontSize(9).fillColor(BRAND_TEAL)
        .text(BRAND_WEBSITE, textX, top + 22, { lineBreak: false });

    doc.font('Helvetica-Bold').fontSize(16).fillColor('#1d1f20')
        .text(title, left, top + 2, { width: right - left, align: 'right' });
    if (subtitle) {
        doc.font('Helvetica').fontSize(8).fillColor('#6b6b75')
            .text(subtitle, left, top + 22, { width: right - left, align: 'right' });
    }

    const ruleY = top + logoH + 12;
    doc.moveTo(left, ruleY).lineTo(right, ruleY).lineWidth(0.7).strokeColor('#dcdce5').stroke();

    // Leave the cursor and colours in a neutral state for the caller.
    doc.fillColor('#000000').strokeColor('#000000').font('Helvetica').fontSize(10);
    return ruleY + 14;
};

module.exports = { drawBrandHeader };
