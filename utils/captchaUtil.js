const axios = require('axios');
const qs = require('querystring');

const verifyRecaptcha = async (token) => {
  try {
    const secret = process.env.RECAPTCHA_SECRET;
    if (!secret) throw new Error("RECAPTCHA_SECRET not set");

    const response = await axios.post(
      'https://www.google.com/recaptcha/api/siteverify',
      qs.stringify({ secret, response: token }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    console.log("Recaptcha response:", response.data);

    return response.data.success;
  } catch (err) {
    console.error("Recaptcha verification error:", err.response?.data || err.message);
    return false;
  }
};

module.exports = { verifyRecaptcha };
