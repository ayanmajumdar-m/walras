const { ApiClient, TransactionalEmailsApi, SendSmtpEmail } = require('@getbrevo/brevo');
const dotenv = require('dotenv');

// Ensure environment variables are loaded
dotenv.config();

if (!process.env.EMAIL_API_KEY) {
    console.error('EMAIL_API_KEY is not set in environment variables');
    process.exit(1);
}

if (!process.env.SMTPLogin) {
    console.error('SMTPLogin is not set in environment variables');
    process.exit(1);
}

const apiInstance = new TransactionalEmailsApi();

// Configure API key
const apiKey = apiInstance.authentications['apiKey'];
apiKey.apiKey = process.env.EMAIL_API_KEY;

const createPasswordResetTemplate = (name, resetLink) => {
    return `
        <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background-color: #4CAF50; color: white; padding: 20px; text-align: center; }
                    .content { padding: 20px; background-color: #f9f9f9; }
                    .button {
                        display: inline-block;
                        padding: 12px 24px;
                        background-color: #4CAF50;
                        color: white;
                        text-decoration: none;
                        border-radius: 4px;
                        margin: 20px 0;
                    }
                    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>Password Reset Request</h1>
                    </div>
                    <div class="content">
                        <h2>Hello ${name},</h2>
                        <p>We received a request to reset your password. If you didn't make this request, you can safely ignore this email.</p>
                        <p>To reset your password, click the button below. This link will expire in 1 hour.</p>
                        <p style="text-align: center;">
                            <a href="${resetLink}" class="button">Reset Password</a>
                        </p>
                        <p>If the button doesn't work, you can also copy and paste this link into your browser:</p>
                        <p>${resetLink}</p>
                        <p>For security reasons, this link will expire in 1 hour.</p>
                    </div>
                    <div class="footer">
                        <p>This is an automated message, please do not reply to this email.</p>
                    </div>
                </div>
            </body>
        </html>
    `;
};

const createWelcomeEmailTemplate = (name, emailOtp) => {
    return `
        <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background-color: #4CAF50; color: white; padding: 20px; text-align: center; }
                    .content { padding: 20px; background-color: #f9f9f9; }
                    .button {
                        display: inline-block;
                        padding: 12px 24px;
                        background-color: #4CAF50;
                        color: white;
                        text-decoration: none;
                        border-radius: 4px;
                        margin: 20px 0;
                    }
                    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>Welcome to Superflare!</h1>
                    </div>
                    <div class="content">
                        <h2>Hello ${name} </h2>
                        <p>Thank you for registering with Superflare. We're excited to have you on board!</p>
                        <p>Please verify your email address by clicking the button below:</p>
                        <p style="text-align: center;">
                        ${emailOtp}
                        </p>
                        <p>This verification link will expire in 24 hours.</p>
                        <p>If you have any questions or need assistance, please don't hesitate to contact our support team.</p>
                    </div>
                    <div class="footer">
                        <p>This is an automated message, please do not reply to this email.</p>
                        <p>&copy; ${new Date().getFullYear()} Superflare. All rights reserved.</p>
                    </div>
                </div>
            </body>
        </html>
    `;
};

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
                        <p>Thank you for purchasing a domain with Superflare!</p>
                        <p>Here are the details of your purchase:</p>
                        <ul>
                            <li><strong>Domain Name:</strong> ${domainName}</li>
                            <li><strong>Purchase Date:</strong> ${purchaseDate}</li>
                        </ul>
                        <p>If you have any questions or need further assistance, please feel free to reach out to our support team.</p>
                    </div>
                    <div class="footer">
                        <p>This is an automated message, please do not reply to this email.</p>
                        <p>&copy; ${new Date().getFullYear()} Superflare. All rights reserved.</p>
                    </div>
                </div>
            </body>
        </html>
    `;
};


const sendWelcomeEmail = async (to, name, emailOtp) => {
    const sendSmtpEmail = new SendSmtpEmail();
    sendSmtpEmail.subject = 'Welcome to Superflare - Please Verify Your Email via OTP';
    sendSmtpEmail.htmlContent = createWelcomeEmailTemplate(name, emailOtp);
    sendSmtpEmail.sender = { name: "Superflare", email: 'no-reply@superflare.io' };
    sendSmtpEmail.to = [{ email: to }];

    try {
        const response = await apiInstance.sendTransacEmail(sendSmtpEmail);
        console.log("Email sent successfully:", response);
    } catch (error) {
        // ✅ Make error logging bulletproof
        if (error.response && error.response.body) {
            console.error("API Error details:", error.response.body);
        } else if (error.message) {
            console.error("Error sending email:", error.message);
        } else {
            console.error("Error sending email:", error);
        }
        throw error; // rethrow so caller can handle it
    }
};

const sendForgotPasswordEmail = async (to, name, resetLink) => {
    const sendSmtpEmail = new SendSmtpEmail();
    sendSmtpEmail.subject = "Password Reset Request";
    sendSmtpEmail.htmlContent = createPasswordResetTemplate(name, resetLink);
    sendSmtpEmail.sender = { name: "Superflare", email: 'no-reply@superflare.io' };
    sendSmtpEmail.to = [{ email: to }];

    try {
        const response = await apiInstance.sendTransacEmail(sendSmtpEmail);
        console.log("Password reset email sent successfully:", response);
    } catch (error) {
        if (error.response && error.response.body) {
            console.error("API Error details:", error.response.body);
        } else if (error.message) {
            console.error("Error sending reset email:", error.message);
        } else {
            console.error("Error sending reset email:", error);
        }
        throw error;
    }
};

const sendDomainPurchaseEmail = async (to, name, domainName, purchaseDate) => {
    const sendSmtpEmail = new SendSmtpEmail();
    sendSmtpEmail.subject = "Domain Purchase Confirmation";
    sendSmtpEmail.htmlContent = createDomainPurchaseTemplate(name, domainName, purchaseDate);
    sendSmtpEmail.sender = { name: "Superflare", email: 'no-reply@superflare.io' };
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
    sendWelcomeEmail,
    sendForgotPasswordEmail,
    sendDomainPurchaseEmail
};
