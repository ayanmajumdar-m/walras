const { ApiClient, TransactionalEmailsApi, SendSmtpEmail } = require('@getbrevo/brevo');
const dotenv = require('dotenv');

// Ensure environment variables are loaded
dotenv.config();

// Missing mail credentials used to call process.exit(1) here, at import time,
// which killed the whole server before Express ever bound a port — a deploy
// with no Brevo account looked like a crash-loop with no explanation.
//
// Now it degrades: the site boots, everything else works, and only the mail
// calls no-op with a warning.
const emailConfigured = Boolean(process.env.EMAIL_API_KEY && process.env.SMTPLogin);

if (!emailConfigured) {
    console.warn('⚠️  EMAIL_API_KEY / SMTPLogin not set — transactional email is disabled.');
}

const apiInstance = new TransactionalEmailsApi();

if (emailConfigured) {
    const apiKey = apiInstance.authentications['apiKey'];
    apiKey.apiKey = process.env.EMAIL_API_KEY;
}


const createDomainPurchaseTemplate = (name, domainName, purchaseDate) => {
    return `
        <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background-color: #4CAF50; color: white; padding: 20px; text-align: center; }
                    .content { padding: 20px; background-color: #f9f9f9; }
                    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>Domain Purchase Confirmation</h1>
                    </div>
                    <div class="content">
                        <h2>Hello ${name},</h2>
                        <p>Thank you for purchasing a domain with Buttr Cloud!</p>
                        <p>Here are the details of your purchase:</p>
                        <ul>
                            <li><strong>Domain Name:</strong> ${domainName}</li>
                            <li><strong>Purchase Date:</strong> ${purchaseDate}</li>
                        </ul>
                        <p>If you have any questions or need further assistance, please feel free to reach out to our support team.</p>
                    </div>
                    <div class="footer">
                        <p>This is an automated message, please do not reply to this email.</p>
                        <p>&copy; ${new Date().getFullYear()} Buttr Cloud. All rights reserved.</p>
                    </div>
                </div>
            </body>
        </html>
    `;
};


// The welcome-with-OTP and password-reset emails left with the local auth
// system. BUTTR ID sends its own verification and recovery mail.

const sendDomainPurchaseEmail = async (to, name, domainName, purchaseDate) => {
    if (!emailConfigured) {
        console.warn(`Email disabled — not sending domain purchase confirmation to ${to}`);
        return;
    }

    const sendSmtpEmail = new SendSmtpEmail();
    sendSmtpEmail.subject = "Domain Purchase Confirmation";
    sendSmtpEmail.htmlContent = createDomainPurchaseTemplate(name, domainName, purchaseDate);
    sendSmtpEmail.sender = { name: "Buttr Cloud", email: 'no-reply@buttr.cloud' };
    sendSmtpEmail.to = [{ email: to }];

    try {
        const response = await apiInstance.sendTransacEmail(sendSmtpEmail);
        console.log("Domain purchase email sent successfully:", response);
    } catch (error) {
        if (error.response && error.response.body) {
            console.error("API Error details:", error.response.body);
        } else if (error.message) {
            console.error("Error sending domain purchase email:", error.message);
        }
        else {
            console.error("Error sending domain purchase email:", error);
        }
        throw error;
    }
};

module.exports = {
    sendDomainPurchaseEmail
};
