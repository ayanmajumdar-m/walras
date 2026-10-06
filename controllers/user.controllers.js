const User = require('../model/User.model');
const dotenv = require('dotenv');
const axios = require('axios');
const { sendDomainPurchaseEmail } = require('../utils/sendEmail');
dotenv.config();
const { validatePhone } = require('../utils/validation');

// Passwords and email verification codes live in controllers/auth.controllers.js.

// Helper function to handle wallet payment for domain purchase
async function handleWalletPayment(userId, amountPaise, domainTransactionId, domainName,
    registrationPeriod, contactInfo, res, connection) {
    try {
        // Check wallet balance
        connection.query("SELECT * FROM wallets WHERE user_id = ?", [userId], (err, walletRows) => {
            if (err) {
                return connection.rollback(() => {
                    res.status(500).json({ error: 'Database error' });
                });
            }

            if (walletRows.length === 0 || walletRows[0].balance < amountPaise) {
                return connection.rollback(() => {
                    res.status(400).json({
                        error: 'Insufficient wallet balance',
                        required: (amountPaise / 100).toFixed(2),
                        available: walletRows.length > 0 ? (walletRows[0].balance / 100).toFixed(2) : '0.00'
                    });
                });
            }

            // Deduct from wallet
            connection.query(
                "UPDATE wallets SET balance = balance - ? WHERE user_id = ?",
                [amountPaise, userId],
                (updateErr) => {
                    if (updateErr) {
                        return connection.rollback(() => {
                            res.status(500).json({ error: 'Failed to deduct from account balance' });
                        });
                    }

                    // Record wallet transaction
                    connection.query(
                        `INSERT INTO wallet_transactions 
                         (wallet_id, type, amount, description, reference_id, status)
                         VALUES ((SELECT id FROM wallets WHERE user_id=?), 'debit', ?, ?, ?, 'completed')`,
                        [userId, amountPaise, `Domain purchase - ${domainName}`, `domain_${domainTransactionId}`],
                        (txErr) => {
                            if (txErr) {
                                return connection.rollback(() => {
                                    res.status(500).json({ error: 'Failed to record wallet transaction' });
                                });
                            }

                            // Proceed with domain registration
                            proceedWithDomainRegistration(domainTransactionId, domainName,
                                registrationPeriod, contactInfo, res, connection);
                        }
                    );
                }
            );
        });
    } catch (error) {
        connection.rollback(() => {
            res.status(500).json({ error: 'Account balance payment failed' });
        });
    }
}

// Helper function to handle Razorpay payment for domain purchase
async function handleRazorpayPayment(userId, amountPaise, domainTransactionId, domainName,
    registrationPeriod, contactInfo, res, connection) {
    try {
        const { createOrder } = require('../services/razorpayServices');
        const receipt = `domain_${domainTransactionId}_${Date.now()}`;

        // Store contact information first for Razorpay payments
        const contactQuery = `
            INSERT INTO domain_contacts 
            (user_id, contact_type, first_name, last_name, company, email, phone, 
             address_line1, address_line2, city, state, country, postal_code, gender)
            VALUES (?, 'owner', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        connection.query(contactQuery, [
            contactInfo.userId,
            contactInfo.firstName,
            contactInfo.lastName,
            contactInfo.company || '',
            contactInfo.email,
            contactInfo.phone,
            contactInfo.address1,
            contactInfo.address2 || '',
            contactInfo.city,
            contactInfo.state,
            contactInfo.country,
            contactInfo.postalCode,
            contactInfo.gender || 'm'
        ], (contactErr) => {
            if (contactErr) {
                console.error('Error storing contact info for Razorpay payment:', contactErr);
                return connection.rollback(() => {
                    res.status(500).json({ error: 'Failed to store contact information' });
                });
            }

            // Create Razorpay order
            createOrder({
                amount: amountPaise,
                currency: "INR",
                receipt
            }).then(order => {
                // Update domain transaction with Razorpay order ID
                connection.query(
                    "UPDATE domain_transactions SET payment_reference = ? WHERE id = ?",
                    [order.id, domainTransactionId],
                    (err) => {
                        if (err) {
                            return connection.rollback(() => {
                                res.status(500).json({ error: 'Failed to update domain transaction' });
                            });
                        }

                        res.json({
                            success: true,
                            message: 'Razorpay order created. Complete payment to proceed with domain registration.',
                            orderId: order.id,
                            amount: order.amount,
                            currency: order.currency,
                            key: process.env.RAZORPAY_KEY_ID,
                            domainTransactionId
                        });
                    }
                );
            }).catch(error => {
                connection.rollback(() => {
                    res.status(500).json({ error: 'Razorpay order creation failed' });
                });
            });
        });
    } catch (error) {
        connection.rollback(() => {
            res.status(500).json({ error: 'Razorpay order creation failed' });
        });
    }
}

// Helper function to proceed with domain registration after payment
// Helper function to proceed with domain registration after payment
async function proceedWithDomainRegistration(domainTransactionId, domainName,
    registrationPeriod, contactInfo, res, connection) {
    try {
        const { registerDomain, createContact } = require('../services/openProviderServices');

        console.log('Creating customer/contact in OpenProvider...');

        // Extract domain extension for .in domain handling
        const domainParts = domainName.split('.');
        const domainExtension = domainParts.slice(1).join('.');
        contactInfo.domainExtension = domainExtension;

        // Create contact in OpenProvider first
        const contactResult = await createContact(contactInfo);
        console.log('Customer created successfully:', contactResult);

        // Add a small delay to ensure contact propagation
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Store contact information in database for future reference
        const contactQuery = `
            INSERT INTO domain_contacts 
            (user_id, contact_type, first_name, last_name, company, email, phone, 
             address_line1, address_line2, city, state, country, postal_code, gender, openprovider_handle)
            VALUES (?, 'owner', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        connection.query(contactQuery, [
            contactInfo.userId || null,
            contactInfo.firstName,
            contactInfo.lastName,
            contactInfo.company || '',
            contactInfo.email,
            contactInfo.phone,
            contactInfo.address1,
            contactInfo.address2 || '',
            contactInfo.city,
            contactInfo.state,
            contactInfo.country,
            contactInfo.postalCode,
            contactInfo.gender || 'm',
            contactResult.handle
        ], (contactErr) => {
            if (contactErr) {
                console.error('Error storing contact info:', contactErr);
            }
        });

        console.log('Registering domain with OpenProvider...');

        // Register domain using the created contact handle
        const registrationResult = await registerDomain({
            domainName,
            period: registrationPeriod,
            contacts: {
                owner: contactResult.handle,
                admin: contactResult.handle,
                tech: contactResult.handle,
                billing: contactResult.handle
            }
        });

        console.log('Domain registration result:', registrationResult);

        // FIX: Use registrationResult directly (not registrationResult.domain.id)
        const domainId = registrationResult.id;
        const domainStatus = registrationResult.status;
        const expirationDate = registrationResult.expirationDate;

        console.log('Extracted domain details:', { domainId, domainStatus, expirationDate });

        if (!registrationResult.success || !domainId) {
            throw new Error('Invalid registration result received');
        }

        // Update domain transaction with success
        connection.query(
            `UPDATE domain_transactions 
             SET status = 'completed', 
                 openprovider_domain_id = ?, 
                 payment_reference = ?,
                 registration_date = NOW(),
                 expiration_date = ?
             WHERE id = ?`,
            [
                domainId,
                `openprovider_${domainId}`,
                expirationDate,
                domainTransactionId
            ],
            (err) => {
                if (err) {
                    console.error('Error updating domain transaction:', err);
                    return connection.rollback(() => {
                        res.status(500).json({ error: 'Failed to update domain transaction' });
                    });
                }

                // ✅ COMMIT THE TRANSACTION FIRST
                connection.commit(async (commitErr) => {
                    if (commitErr) {
                        console.error('Commit error:', commitErr);
                        return connection.rollback(() => {
                            res.status(500).json({ error: 'Failed to commit transaction' });
                        });
                    }

                    console.log('Transaction committed successfully - Domain registration COMPLETE');

                    // ✅ NOW SEND THE EMAIL AFTER SUCCESSFUL REGISTRATION
                    try {
                        // Get user details for email
                        User.viewData(contactInfo.userId, async (userErr, userResults) => {
                            if (userErr || !userResults || userResults.length === 0) {
                                console.error('Error fetching user details for email:', userErr);
                            } else {
                                const user = userResults[0];
                                console.log('Sending domain purchase email to:', user.email);
                                
                                await sendDomainPurchaseEmail(
                                    user.email,
                                    user.name,
                                    domainName,
                                    new Date().toLocaleDateString(),
                                    expirationDate
                                );
                                console.log('Domain purchase email sent successfully');
                            }
                        });
                    } catch (emailError) {
                        console.error('Failed to send domain purchase email:', emailError.message);
                        // Don't fail the request if email fails
                    }

                    // Send success response to client
                    res.json({
                        success: true,
                        message: 'Domain registered successfully!',
                        domain: {
                            name: domainName,
                            id: domainId,
                            status: domainStatus,
                            activationDate: registrationResult.activationDate,
                            expirationDate: expirationDate,
                            renewalDate: registrationResult.renewalDate,
                            authCode: registrationResult.authCode
                        },
                        customer: {
                            handle: contactResult.handle
                        }
                    });
                });
            }
        );

    } catch (error) {
        console.error('Domain registration error:', error);

        // Update domain transaction with error
        connection.query(
            `UPDATE domain_transactions 
             SET status = 'failed', error_message = ?
             WHERE id = ?`,
            [error.message.substring(0, 255), domainTransactionId],
            (err) => {
                if (err) {
                    console.error('Error updating failed transaction:', err);
                }

                connection.rollback(() => {
                    res.status(500).json({
                        error: 'Domain registration failed',
                        details: error.message
                    });
                });
            }
        );
    }
}

const UserController = {
    // Sign-up, sign-in, verification and password reset live in
    // controllers/auth.controllers.js.
    viewProfile: async (req, res) => {
        try {
            const userId = req.params.id;

            // Verify that the user is viewing their own profile
            if (userId != req.user.userId) {
                return res.status(403).json({ error: 'Unauthorized access' });
            }

            User.viewData(userId, (err, results) => {
                if (err) {
                    return res.status(500).json({ error: 'Database error' });
                }
                if (results.length === 0) {
                    return res.status(404).json({ error: 'User not found' });
                }

                res.status(200).json(results[0]);
            });
        } catch (error) {
            console.error('View profile error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    updateProfile: async (req, res) => {
        try {
            const userId = req.params.id;
            const { phone, company, role, address } = req.body;
            const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
            const gstin = typeof req.body.gstin === 'string' ? req.body.gstin.trim().toUpperCase() : '';

            if (userId != req.user.userId) {
                return res.status(403).json({ error: 'Unauthorized access' });
            }

            // Email is not accepted here: changing it would need the new
            // address verified first.
            if (name.length < 2 || name.length > 100) {
                return res.status(400).json({ error: 'Enter your full name' });
            }
            if (gstin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstin)) {
                return res.status(400).json({ error: 'Enter a valid 15-character GSTIN, or leave it blank' });
            }
            if (phone && !validatePhone(phone)) {
                return res.status(400).json({ error: 'Invalid phone number' });
            }

            User.viewData(userId, (err, results) => {
                if (err) return res.status(500).json({ error: 'Database error' });
                if (!results || results.length === 0) return res.status(404).json({ error: 'User not found' });

                User.updateData(userId, { name, phone, company, gstin: gstin || null, role, address }, (updateErr) => {
                    if (updateErr && updateErr.code === 'ER_DUP_ENTRY') {
                        return res.status(409).json({ error: 'This phone number is already linked to another account' });
                    }
                    if (updateErr) return res.status(500).json({ error: 'Database error' });

                    res.status(200).json({ message: 'Profile updated successfully' });
                });
            });
        } catch (error) {
            console.error('Update profile error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    getOpenProviderAuthToken: async (req, res) => {
        try {
            const { getAuthToken } = require('../services/openProviderServices');
            const authToken = await getAuthToken();
            res.status(200).json({ authToken });
        } catch (error) {
            console.error('Error fetching OpenProvider auth token:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },
    getOpenProviderDomains: async (req, res) => {
        try {
            const { getDomains } = require('../services/openProviderServices');
            const domains = await getDomains();
            res.status(200).json({ domains });
        } catch (error) {
            console.error('Error fetching OpenProvider domains:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },
    searchDomain: async (req, res) => {
        try {
            const { domainName } = req.body;

            if (!domainName) {
                return res.status(400).json({ error: 'Domain name is required' });
            }

            const { searchDomain } = require('../services/openProviderServices');
            const searchResults = await searchDomain(domainName);

            // Format the response to match frontend expectations
            const formattedResults = searchResults.results ? searchResults.results.map(result => ({
                domain: result.domain,
                available: result.available, // Use the availability from the service
                price: result.price,
                currency: 'INR',
                period: 'year',
                status: result.status,
                reason: result.reason || null
            })) : [];

            console.log('Formatted results:', formattedResults);

            res.status(200).json({
                searchResults: formattedResults,
                originalResponse: searchResults
            });
        } catch (error) {
            console.error('Error searching domain:', error);

            // Check if it's a configuration error
            if (error.message.includes('credentials not configured')) {
                return res.status(503).json({
                    error: 'Domain search service is temporarily unavailable. Please contact support.',
                    details: 'Service configuration issue'
                });
            }

            // Check if it's an authentication error
            if (error.message.includes('authenticate with OpenProvider')) {
                return res.status(503).json({
                    error: 'Domain search service is temporarily unavailable. Please try again later.',
                    details: 'External service authentication failed'
                });
            }

            res.status(500).json({
                error: 'Internal server error',
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    },

    purchaseDomain: async (req, res) => {
    try {
        const userId = req.user.userId;
        const { domainName, registrationPeriod = 1, paymentMethod, contactInfo } = req.body;

        if (!domainName || !paymentMethod || !contactInfo) {
            return res.status(400).json({
                error: 'Domain name, payment method, and contact information are required'
            });
        }

        if (!['wallet', 'razorpay'].includes(paymentMethod)) {
            return res.status(400).json({
                error: 'Invalid payment method. Must be "wallet" or "razorpay"'
            });
        }

        const { searchDomain } = require('../services/openProviderServices');
        const connection = require('../config/db');

        // Check domain availability
        const searchResults = await searchDomain(domainName);
        const availableDomain = searchResults.results?.find(r => r.available);

        if (!availableDomain) {
            return res.status(400).json({ error: 'Domain is no longer available for purchase' });
        }

        const totalAmount = availableDomain.price * registrationPeriod;
        const amountPaise = Math.round(totalAmount * 100);

        // Start DB transaction
        connection.beginTransaction(async (txErr) => {
            if (txErr) {
                console.error('Transaction error:', txErr);
                return res.status(500).json({ error: 'Database transaction error' });
            }

            try {
                const domainTransactionQuery = `
                INSERT INTO domain_transactions 
                (user_id, domain_name, domain_extension, full_domain, amount, currency, 
                 registration_period, payment_method, status)
                VALUES (?, ?, ?, ?, ?, 'INR', ?, ?, 'pending')
            `;

                const domainParts = domainName.split('.');
                const name = domainParts[0];
                const extension = domainParts.slice(1).join('.');

                connection.query(domainTransactionQuery, [
                    userId, name, extension, domainName, amountPaise,
                    registrationPeriod, paymentMethod
                ], async (err, result) => {
                    if (err) {
                        return connection.rollback(() => {
                            console.error('Domain transaction insert error:', err);
                            return res.status(500).json({ error: 'Failed to create domain transaction' });
                        });
                    }

                    const domainTransactionId = result.insertId;
                    contactInfo.userId = userId;

                    // ✅ REMOVED EMAIL SENDING FROM HERE - Will be sent after successful registration

                    // Proceed with payment method handling
                    if (paymentMethod === 'wallet') {
                        return handleWalletPayment(
                            userId, amountPaise, domainTransactionId, domainName,
                            registrationPeriod, contactInfo, res, connection,
                        );
                    } else {
                        return handleRazorpayPayment(
                            userId, amountPaise, domainTransactionId, domainName,
                            registrationPeriod, contactInfo, res, connection
                        );
                    }
                });

            } catch (error) {
                connection.rollback(() => {
                    console.error('Domain purchase error:', error);
                    return res.status(500).json({ error: 'Domain purchase failed' });
                });
            }
        });

    } catch (error) {
        console.error('Error purchasing domain:', error);
        return res.status(500).json({
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
},


    getDomainTransactions: async (req, res) => {
        try {
            const userId = req.user.userId;
            const connection = require('../config/db');

            const query = `
                SELECT id, domain_name, domain_extension, full_domain, amount, currency,
                       registration_period, payment_method, status, error_message,
                       created_at, updated_at
                FROM domain_transactions 
                WHERE user_id = ? 
                ORDER BY created_at DESC
            `;

            connection.query(query, [userId], (err, results) => {
                if (err) {
                    console.error('Error fetching domain transactions:', err);
                    return res.status(500).json({ error: 'Database error' });
                }

                const formattedResults = results.map(transaction => ({
                    ...transaction,
                    amount: (transaction.amount / 100).toFixed(2)
                }));

                res.status(200).json({ transactions: formattedResults });
            });

        } catch (error) {
            console.error('Error fetching domain transactions:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    verifyDomainPayment: async (req, res) => {
        try {
            const userId = req.user.userId;
            const { razorpay_order_id, razorpay_payment_id, razorpay_signature, domainTransactionId } = req.body;

            if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !domainTransactionId) {
                return res.status(400).json({ error: 'Missing payment verification details' });
            }

            const { verifyPaymentSignature } = require('../services/razorpayServices');
            const connection = require('../config/db');

            // Verify payment signature
            const isValid = verifyPaymentSignature({
                order_id: razorpay_order_id,
                payment_id: razorpay_payment_id,
                signature: razorpay_signature
            });

            if (!isValid) {
                return res.status(400).json({ error: 'Invalid payment signature' });
            }

            // Get domain transaction details
            connection.query(
                "SELECT * FROM domain_transactions WHERE id = ? AND user_id = ? AND status = 'pending'",
                [domainTransactionId, userId],
                (err, results) => {
                    if (err) {
                        console.error('Error fetching domain transaction:', err);
                        return res.status(500).json({ error: 'Database error' });
                    }

                    if (results.length === 0) {
                        return res.status(404).json({ error: 'Domain transaction not found or already processed' });
                    }

                    const domainTransaction = results[0];

                    // Update domain transaction with payment details
                    connection.query(
                        `UPDATE domain_transactions 
                         SET status = 'processing', payment_reference = ?
                         WHERE id = ?`,
                        [razorpay_payment_id, domainTransactionId],
                        (updateErr) => {
                            if (updateErr) {
                                console.error('Error updating domain transaction:', updateErr);
                                return res.status(500).json({ error: 'Failed to update domain transaction' });
                            }

                            // Get contact information from domain_contacts table
                            connection.query(
                                "SELECT * FROM domain_contacts WHERE user_id = ? ORDER BY created_at DESC LIMIT 1",
                                [userId],
                                (contactErr, contactRows) => {
                                    if (contactErr) {
                                        console.error('Error fetching contact info:', contactErr);
                                        return connection.rollback(() => {
                                            res.status(500).json({ error: 'Failed to fetch contact information' });
                                        });
                                    }

                                    if (contactRows.length === 0) {
                                        return connection.rollback(() => {
                                            res.status(400).json({ error: 'Contact information not found' });
                                        });
                                    }

                                    const contactInfo = {
                                        userId: userId,
                                        firstName: contactRows[0].first_name,
                                        lastName: contactRows[0].last_name,
                                        company: contactRows[0].company,
                                        email: contactRows[0].email,
                                        phone: contactRows[0].phone,
                                        address1: contactRows[0].address_line1,
                                        address2: contactRows[0].address_line2,
                                        city: contactRows[0].city,
                                        state: contactRows[0].state,
                                        country: contactRows[0].country,
                                        postalCode: contactRows[0].postal_code
                                    };

                                    // Proceed with domain registration
                                    proceedWithDomainRegistration(
                                        domainTransactionId,
                                        domainTransaction.full_domain,
                                        domainTransaction.registration_period,
                                        contactInfo,
                                        res,
                                        connection
                                    );
                                }
                            );
                        }
                    );
                }
            );

        } catch (error) {
            console.error('Error verifying domain payment:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },
    getPurchasedDomains: async (req, res) => {
        try {
            const userId = req.user.userId;
            const connection = require('../config/db');

            const query = `
                SELECT domain_name, domain_extension, full_domain, registration_period, 
                       payment_method, status, created_at, updated_at,
                       openprovider_domain_id, registration_date, expiration_date, auth_code
                FROM domain_transactions 
                WHERE user_id = ? AND status = 'completed'
                ORDER BY created_at DESC
            `;

            connection.query(query, [userId], (err, results) => {
                if (err) {
                    console.error('Error fetching purchased domains:', err);
                    return res.status(500).json({ error: 'Database error' });
                }

                res.status(200).json({ domains: results });
            });

        } catch (error) {
            console.error('Error fetching purchased domains:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
    ,
    // Update nameservers for a purchased domain (must be owner)
    updateNameservers: async (req, res) => {
        try {
            const userId = req.user.userId;
            const { openprovider_domain_id, full_domain, nameservers } = req.body;

            if (!openprovider_domain_id && !full_domain) {
                return res.status(400).json({ error: 'Provide openprovider_domain_id or full_domain' });
            }

            if (!nameservers || !Array.isArray(nameservers) || nameservers.length === 0) {
                return res.status(400).json({ error: 'Provide nameservers array' });
            }

            // Basic validation for nameserver strings
            const nsValid = nameservers.every(ns => typeof ns === 'string' && ns.trim().length > 3 && ns.includes('.'));
            if (!nsValid) return res.status(400).json({ error: 'Invalid nameserver values' });

            const connection = require('../config/db');

            const selectorValue = openprovider_domain_id || full_domain;
            const selectorField = openprovider_domain_id ? 'openprovider_domain_id' : 'full_domain';

            const query = `SELECT id FROM domain_transactions WHERE user_id = ? AND ${selectorField} = ? AND status = 'completed' LIMIT 1`;

            connection.query(query, [userId, selectorValue], async (err, results) => {
                if (err) {
                    console.error('DB error checking domain ownership:', err);
                    return res.status(500).json({ error: 'Database error' });
                }

                if (!results || results.length === 0) {
                    return res.status(403).json({ error: 'Domain not found or you do not own this domain' });
                }

                // Call service to update nameservers
                try {
                    const { updateDomainNameservers } = require('../services/openProviderServices');
                    const domainIdentifier = openprovider_domain_id || selectorValue;
                    const svcResult = await updateDomainNameservers(domainIdentifier, nameservers);

                    // Optionally update local DB record (touch updated_at)
                    const updQuery = `UPDATE domain_transactions SET updated_at = NOW() WHERE id = ?`;
                    connection.query(updQuery, [results[0].id], (uErr) => {
                        if (uErr) console.error('Failed to update domain transaction updated_at:', uErr);
                    });

                    return res.json({ success: true, message: 'Nameservers updated', provider: svcResult.data || null });
                } catch (svcErr) {
                    console.error('OpenProvider update error:', svcErr.message || svcErr);
                    return res.status(500).json({ error: svcErr.message || 'Failed to update nameservers' });
                }
            });

        } catch (error) {
            console.error('updateNameservers error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
    ,
    // Transfer domain using OpenProvider (requires auth code)
    transferDomain: async (req, res) => {
        try {
            const userId = req.user.userId;
            const { full_domain, domainName, auth_code, nameservers, handles } = req.body;

            const domainIdentifier = full_domain || domainName;
            if (!domainIdentifier) return res.status(400).json({ error: 'Provide full_domain or domainName' });
            if (!auth_code) return res.status(400).json({ error: 'auth_code is required for transfer' });

            const connection = require('../config/db');
            // Verify ownership
            const query = `SELECT id FROM domain_transactions WHERE user_id = ? AND (full_domain = ? OR domain_name = ?) AND status = 'completed' LIMIT 1`;

            connection.query(query, [userId, domainIdentifier, domainIdentifier.split('.')[0]], async (err, results) => {
                if (err) {
                    console.error('DB error checking domain ownership for transfer:', err);
                    return res.status(500).json({ error: 'Database error' });
                }

                if (!results || results.length === 0) {
                    return res.status(403).json({ error: 'Domain not found or you do not own this domain' });
                }

                try {
                    const { transferDomain } = require('../services/openProviderServices');
                    const domainNameToUse = domainName || full_domain || null;
                    const svcResult = await transferDomain({
                        domainName: domainNameToUse,
                        authCode: auth_code,
                        nameservers: nameservers || [],
                        handles: handles || {}
                    });

                    // Optionally update transaction status
                    const updQuery = `UPDATE domain_transactions SET status = 'transfer_initiated', updated_at = NOW() WHERE id = ?`;
                    connection.query(updQuery, [results[0].id], (uErr) => {
                        if (uErr) console.error('Failed to update transaction status for transfer:', uErr);
                    });

                    return res.json({ success: true, message: 'Transfer initiated', provider: svcResult.data || null });
                } catch (svcErr) {
                    console.error('Transfer service error:', svcErr);
                    return res.status(500).json({ error: svcErr.message || 'Transfer failed' });
                }
            });

        } catch (error) {
            console.error('transferDomain controller error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
};

module.exports = UserController;

