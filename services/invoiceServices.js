const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const connection = require('../config/db');
const taxService = require('./taxServices');
const { getPlatform } = require('../utils/platformSettings');

class InvoiceService {
    async generateInvoice(user, month) {
        try {
            // Get billing data for the month
            const billingData = await this.getMonthlyBillingData(user.id, month);
            
            if (billingData.totalAmount === 0) {
                console.log(`No billing data for user ${user.id} in ${month}`);
                return;
            }

            const doc = new PDFDocument({ margin: 50 });
            const invoiceNumber = `INV-${month.replace('-', '')}-${user.id.toString().padStart(6, '0')}`;
            const fileName = `invoice_${invoiceNumber}.pdf`;
            const filePath = path.join(__dirname, '../invoices', fileName);

            // Ensure invoices directory exists
            if (!fs.existsSync(path.dirname(filePath))) {
                fs.mkdirSync(path.dirname(filePath), { recursive: true });
            }

            doc.pipe(fs.createWriteStream(filePath));

            // Company Header with GST Details (admin Settings → Invoice details)
            const { invoice: company } = await getPlatform();
            doc.fontSize(16).font('Helvetica-Bold')
               .text(company.legalName, 50, 50, { width: 330 })
               .fontSize(8).font('Helvetica')
               .text(`Registered Address: ${company.registeredAddress}`, 50, 72, { width: 330 })
               .text(`GST Registered Address: ${company.gstAddress}`, 50, 96, { width: 330 })
               .text(`GSTIN: ${company.gstin}`, 50, 120);

            // Invoice Details
            doc.fontSize(16).font('Helvetica-Bold')
               .text('TAX INVOICE', 400, 50)
               .fontSize(10).font('Helvetica')
               .text(`Invoice Number: ${invoiceNumber}`, 400, 80)
               .text(`Invoice Date: ${new Date().toLocaleDateString()}`, 400, 95)
               .text(`Period: ${this.formatMonth(month)}`, 400, 110)
               .text(`Place of Supply: ${this.getStateFromAddress(user.address)}`, 400, 125);

            // Customer Info Section
            doc.fontSize(12).font('Helvetica-Bold')
               .text('Bill To:', 50, 160)
               .fontSize(10).font('Helvetica')
               .text(user.name, 50, 180);

            if (user.company) {
                doc.text(user.company, 50, 195);
            }

            doc.text(user.email, 50, user.company ? 210 : 195)
               .text(this.formatAddress(user.address), 50, user.company ? 225 : 210, { width: 200 });

            // Add GSTIN for business customers if available
            let customerYPosition = user.company ? 240 : 225;
            if (user.gstin) {
                doc.text(`GSTIN: ${user.gstin}`, 50, customerYPosition);
                customerYPosition += 15;
            }

            // State and HSN/SAC codes
            const customerState = this.getStateFromAddress(user.address);
            doc.text(`State: ${customerState}`, 50, customerYPosition);

            // Billing Table
            let yPosition = 300;
            
            // Table Header
            doc.fillColor('#2c3e50')
               .rect(50, yPosition, 500, 25)
               .fill()
               .fillColor('#ffffff')
               .fontSize(10)
               .text('Description', 60, yPosition + 8)
               .text('HSN/SAC', 250, yPosition + 8)
               .text('Amount (₹)', 450, yPosition + 8);

            yPosition += 30;

            // Table Rows - Using standard HSN 9984 for IT services
            const hsnCode = '9984'; // IT services HSN code
            billingData.items.forEach(item => {
                doc.fillColor('#ffffff')
                   .text(item.description, 60, yPosition, { width: 180 })
                   .text(hsnCode, 250, yPosition)
                   .text(this.formatCurrency(item.amount), 450, yPosition);
                yPosition += 20;
            });

            // Subtotal
            const subtotal = billingData.totalAmount;
            doc.fillColor('#f8f9fa')
               .rect(50, yPosition, 500, 25)
               .fill()
               .fillColor('#000000')
               .font('Helvetica-Bold')
               .text('Subtotal', 350, yPosition + 8)
               .text(this.formatCurrency(subtotal), 450, yPosition + 8);

            yPosition += 30;

            // Calculate taxes
            const taxData = taxService.calculateTax(user, subtotal);
            
            // Tax Breakdown
            if (taxData.taxAmount > 0) {
                taxData.taxBreakdown.forEach(tax => {
                    doc.fillColor('#ffffff')
                       .font('Helvetica')
                       .text(tax.description, 350, yPosition)
                       .text(this.formatCurrency(tax.amount), 450, yPosition);
                    yPosition += 20;
                });
            }

            // Total
            doc.fillColor('#2c3e50')
               .rect(50, yPosition, 500, 30)
               .fill()
               .fillColor('#ffffff')
               .fontSize(12).font('Helvetica-Bold')
               .text('TOTAL', 350, yPosition + 10)
               .text(this.formatCurrency(taxData.totalAmount), 450, yPosition + 10);

            yPosition += 40;

            // Terms and Conditions
            doc.fillColor('#000000')
               .fontSize(8)
               .text('Terms & Conditions:', 50, yPosition)
               .text('• This is a computer-generated invoice and does not require a physical signature.', 50, yPosition + 15)
               .text('• Payment is due within 15 days of invoice date.', 50, yPosition + 30)
               .text('• Interest of 1.5% per month will be charged on overdue amounts.', 50, yPosition + 45)
               .text(`• HSN Code: ${hsnCode} - IT Services`, 50, yPosition + 60);

            // Bank Details, only once they've been filled in under Settings
            if (company.bankName && company.accountNumber) {
                doc.text(`Bank Details: ${company.legalName}`, 300, yPosition, { width: 250 })
                   .text(`Bank: ${company.bankName}`, 300, yPosition + 15)
                   .text(`Account No: ${company.accountNumber}`, 300, yPosition + 30)
                   .text(`IFSC: ${company.ifsc}`, 300, yPosition + 45);
            }

            // For Authorized Signatory
            yPosition += 100;
            doc.text(`For ${company.legalName}`, 300, yPosition, { width: 250, align: 'right' })
               .text('Authorized Signatory', 400, yPosition + 30);

            doc.end();

            // Save invoice record to database
            await this.saveInvoiceRecord(user.id, invoiceNumber, filePath, taxData.totalAmount, month);

            console.log(`✅ GST Invoice generated: ${fileName} for user ${user.id}`);

        } catch (error) {
            console.error('❌ Invoice generation error:', error);
            throw error;
        }
    }

    async getMonthlyBillingData(userId, month) {
        return new Promise((resolve, reject) => {
            connection.query(`
                SELECT description, SUM(amount) as amount
                FROM billing_logs 
                WHERE user_id = ? AND to_char(billing_period, 'YYYY-MM') = ?
                GROUP BY description
            `, [userId, month], (err, results) => {
                if (err) reject(err);
                else {
                    const totalAmount = results.reduce((sum, item) => sum + parseInt(item.amount), 0);
                    resolve({
                        items: results,
                        totalAmount: totalAmount
                    });
                }
            });
        });
    }

    async saveInvoiceRecord(userId, invoiceNumber, filePath, amount, period) {
        return new Promise((resolve, reject) => {
            connection.query(`
                INSERT INTO invoices 
                (user_id, invoice_number, file_path, amount, period, generated_at)
                VALUES (?, ?, ?, ?, ?, NOW())
            `, [userId, invoiceNumber, filePath, amount, period], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    formatMonth(monthString) {
        const [year, month] = monthString.split('-');
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                          'July', 'August', 'September', 'October', 'November', 'December'];
        return `${monthNames[parseInt(month) - 1]} ${year}`;
    }

    formatAddress(address) {
        if (!address) return 'N/A';
        return address.replace(/\\n/g, '\n');
    }

    formatCurrency(amount) {
        // Convert paise to rupees and format with 2 decimal places
        return (amount / 100).toFixed(2);
    }

    getStateFromAddress(address) {
        if (!address) return 'West Bengal';
        
        const addressLower = address.toLowerCase();
        if (addressLower.includes('west bengal') || addressLower.includes('kolkata')) {
            return 'West Bengal';
        } else if (addressLower.includes('delhi')) {
            return 'Delhi';
        } else if (addressLower.includes('maharashtra') || addressLower.includes('mumbai')) {
            return 'Maharashtra';
        } else if (addressLower.includes('karnataka') || addressLower.includes('bangalore')) {
            return 'Karnataka';
        } else if (addressLower.includes('tamil nadu') || addressLower.includes('chennai')) {
            return 'Tamil Nadu';
        }
        
        return 'West Bengal'; // Default
    }
}

module.exports = new InvoiceService();