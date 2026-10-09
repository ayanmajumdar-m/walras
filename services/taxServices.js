/**
 * GST on Walras Cloud charges (18%).
 *
 * Walras Cloud is registered in the state its GSTIN says (Admin → Settings →
 * Invoice details; 19 = West Bengal). The place of supply (IGST Act s.12(2)):
 *   - a customer with a GSTIN: the state of that GSTIN;
 *   - otherwise the state in their profile address;
 *   - no state on record: Walras Cloud's own state.
 * Place of supply in Walras Cloud's state → CGST 9% + SGST 9%; another state
 * → IGST 18%. A customer whose address is in another country pays no GST.
 *
 * The country is India unless the address names another country: a blank
 * or unrecognised country counts as India, so a customer who hasn't filled
 * in an address isn't left untaxed.
 *
 * Amounts in paise.
 */

// GST state codes (the first two digits of a GSTIN).
const STATE_CODES = {
    '01': 'Jammu and Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab', '04': 'Chandigarh', '05': 'Uttarakhand',
    '06': 'Haryana', '07': 'Delhi', '08': 'Rajasthan', '09': 'Uttar Pradesh', '10': 'Bihar', '11': 'Sikkim',
    '12': 'Arunachal Pradesh', '13': 'Nagaland', '14': 'Manipur', '15': 'Mizoram', '16': 'Tripura', '17': 'Meghalaya',
    '18': 'Assam', '19': 'West Bengal', '20': 'Jharkhand', '21': 'Odisha', '22': 'Chhattisgarh', '23': 'Madhya Pradesh',
    '24': 'Gujarat', '25': 'Dadra and Nagar Haveli and Daman and Diu', '26': 'Dadra and Nagar Haveli and Daman and Diu',
    '27': 'Maharashtra', '28': 'Andhra Pradesh', '29': 'Karnataka', '30': 'Goa', '31': 'Lakshadweep', '32': 'Kerala',
    '33': 'Tamil Nadu', '34': 'Puducherry', '35': 'Andaman and Nicobar Islands', '36': 'Telangana', '37': 'Andhra Pradesh',
    '38': 'Ladakh',
};
// Other ways people write a state.
const STATE_ALIASES = {
    'orissa': 'Odisha', 'pondicherry': 'Puducherry', 'new delhi': 'Delhi', 'nct of delhi': 'Delhi',
    'j and k': 'Jammu and Kashmir', 'daman and diu': 'Dadra and Nagar Haveli and Daman and Diu',
    'dadra and nagar haveli': 'Dadra and Nagar Haveli and Daman and Diu', 'andaman and nicobar': 'Andaman and Nicobar Islands',
    'uttaranchal': 'Uttarakhand', 'tamilnadu': 'Tamil Nadu', 'westbengal': 'West Bengal', 'w.b.': 'West Bengal',
    'wb': 'West Bengal', 'up': 'Uttar Pradesh', 'mp': 'Madhya Pradesh', 'tn': 'Tamil Nadu', 'ap': 'Andhra Pradesh',
};
const GST_RATE = 0.18;

const norm = (s) => String(s || '').toLowerCase().replace(/&/g, ' and ').replace(/\s+/g, ' ').trim();
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const wordRe = (phrase) => new RegExp(`(^|[^a-z])${escapeRe(phrase).replace(/ /g, '\\s+')}($|[^a-z])`);

// Longest first, so "Dadra and Nagar Haveli and Daman and Diu" wins over "Daman and Diu".
const STATE_PATTERNS = [...new Set(Object.values(STATE_CODES))].map((name) => [norm(name), name])
    .concat(Object.entries(STATE_ALIASES).filter(([alias]) => alias.length > 3))
    .sort((a, b) => b[0].length - a[0].length)
    .map(([phrase, name]) => [wordRe(phrase), name]);

/** The Indian state `text` names, or null. */
const findState = (text) => {
    const t = norm(text);
    if (!t) return null;
    if (STATE_ALIASES[t]) return STATE_ALIASES[t];
    const hit = STATE_PATTERNS.find(([re]) => re.test(t));
    return hit ? hit[1] : null;
};

/** The state a GSTIN is registered in, or null. */
const stateFromGstin = (gstin) => STATE_CODES[String(gstin || '').trim().slice(0, 2)] || null;

// State name → its current GST code (later codes replace retired ones: 26 over 25, 37 over 28).
const CODE_OF = Object.fromEntries(Object.entries(STATE_CODES).map(([code, name]) => [name, code]));
/** "West Bengal (19)" for a state; anything else as it is. */
const withStateCode = (place) => (CODE_OF[place] ? `${place} (${CODE_OF[place]})` : place);

// Country names (English, from the runtime's ICU data) and common short forms → ISO code.
const COUNTRIES = (() => {
    const map = new Map();
    try {
        const names = new Intl.DisplayNames(['en'], { type: 'region', fallback: 'none' });
        for (let a = 65; a <= 90; a += 1) {
            for (let b = 65; b <= 90; b += 1) {
                const code = String.fromCharCode(a, b);
                const name = code === 'ZZ' ? null : names.of(code);
                if (name && name !== code) {
                    map.set(norm(name), code);
                    map.set(code.toLowerCase(), code);
                }
            }
        }
    } catch { /* no ICU region names: the short forms below still work */ }
    Object.entries({
        india: 'IN', in: 'IN', ind: 'IN', bharat: 'IN', 'republic of india': 'IN', hindustan: 'IN',
        usa: 'US', 'u.s.a.': 'US', 'u.s.a': 'US', 'u.s.': 'US', 'united states of america': 'US', america: 'US',
        uk: 'GB', 'u.k.': 'GB', 'great britain': 'GB', britain: 'GB', england: 'GB', scotland: 'GB', wales: 'GB',
        uae: 'AE', 'u.a.e.': 'AE', 'u.a.e': 'AE',
    }).forEach(([k, v]) => map.set(k, v));
    return map;
})();
// For a country named inside a longer line ("Dubai, UAE"): names of 3+ letters, longest first.
const COUNTRY_PATTERNS = [...COUNTRIES.entries()].filter(([k]) => k.length > 2)
    .sort((a, b) => b[0].length - a[0].length)
    .map(([k, code]) => [wordRe(k), code]);

/** ISO code of the country `text` names, or null if it doesn't name one. */
const countryCode = (text) => {
    const t = norm(text).replace(/[.,;]+$/, '');
    if (!t) return null;
    if (COUNTRIES.has(t)) return COUNTRIES.get(t);
    if (wordRe('india').test(t) || wordRe('bharat').test(t)) return 'IN';
    const hit = COUNTRY_PATTERNS.find(([re]) => re.test(t));
    return hit ? hit[1] : null;
};

/**
 * The profile address as fields. Profiles save six lines (line 1, line 2,
 * city, state, country, PIN), blank ones included. Addresses saved before
 * that dropped blank lines, so those are read from the end: PIN (if it looks
 * like one), country, state.
 */
const parseAddress = (address) => {
    const lines = String(address || '').split('\n').map((l) => l.trim());
    if (lines.length === 6) return { state: lines[3], country: lines[4], zip: lines[5], lines };
    const rest = lines.filter(Boolean);
    const out = { lines, state: '', country: '', zip: '' };
    if (rest.length > 1 && /\d/.test(rest[rest.length - 1]) && /^[a-z0-9 -]{3,10}$/i.test(rest[rest.length - 1])) out.zip = rest.pop();
    if (rest.length > 1) out.country = rest.pop();
    if (rest.length > 1) out.state = rest.pop();
    return out;
};

let sellerState = 'West Bengal'; // from the default GSTIN (19…); utils/platformSettings keeps it in step with Settings

class TaxService {
    /** The GSTIN from Admin → Settings → Invoice details. */
    setSellerGstin(gstin) {
        sellerState = stateFromGstin(gstin) || sellerState;
    }

    get sellerState() {
        return sellerState;
    }

    /** Where `user` ({ address, gstin }) is: { inIndia, state, country }. */
    locate(user = {}) {
        const gstState = stateFromGstin(user.gstin);
        if (gstState) return { inIndia: true, state: gstState, country: 'India' };
        const a = parseAddress(user.address);
        const code = countryCode(a.country);
        if (code && code !== 'IN') return { inIndia: false, state: null, country: a.country };
        const state = findState(a.state) || findState(a.country) || a.lines.map(findState).find(Boolean) || null;
        return { inIndia: true, state, country: 'India' };
    }

    /**
     * GST on `baseAmount` (paise) for `user` ({ address, gstin }). Returns
     * { baseAmount, taxAmount, totalAmount, taxBreakdown: [{ type, rate,
     * amount, description }], placeOfSupply, customerGstin, country, state }.
     */
    calculateTax(user, baseAmount) {
        const u = user || {};
        const { inIndia, state, country } = this.locate(u);
        const customerGstin = u.gstin ? String(u.gstin).trim().toUpperCase() : null;
        if (!inIndia) {
            return {
                baseAmount, taxAmount: 0, totalAmount: baseAmount, taxBreakdown: [],
                placeOfSupply: `Outside India (${country})`, customerGstin, country, state: null,
            };
        }
        const placeOfSupply = state || sellerState;
        let taxBreakdown;
        if (placeOfSupply === sellerState) {
            const half = Math.round(baseAmount * (GST_RATE / 2));
            taxBreakdown = [
                { type: 'CGST', rate: 9, amount: half, description: 'CGST (9%)' },
                { type: 'SGST', rate: 9, amount: half, description: 'SGST (9%)' },
            ];
        } else {
            taxBreakdown = [{ type: 'IGST', rate: 18, amount: Math.round(baseAmount * GST_RATE), description: 'IGST (18%)' }];
        }
        const taxAmount = taxBreakdown.reduce((n, t) => n + t.amount, 0);
        return {
            baseAmount, taxAmount, totalAmount: baseAmount + taxAmount, taxBreakdown,
            placeOfSupply, customerGstin, country: 'India', state: placeOfSupply,
        };
    }

    // Older callers.
    extractLocationFromAddress(address) {
        const { state, country } = this.locate({ address });
        return { country, state };
    }

    formatTaxBreakdown(taxData) {
        if (taxData.taxAmount === 0) return 'No taxes applicable';
        let breakdown = `Taxes (${taxData.country}${taxData.state ? `, ${taxData.state}` : ''}):\n`;
        taxData.taxBreakdown.forEach((tax) => { breakdown += `- ${tax.description}: ₹${(tax.amount / 100).toFixed(2)}\n`; });
        return breakdown;
    }
}

const taxService = new TaxService();
taxService.parseAddress = parseAddress;
taxService.stateFromGstin = stateFromGstin;
taxService.countryCode = countryCode;
taxService.withStateCode = withStateCode;
module.exports = taxService;
