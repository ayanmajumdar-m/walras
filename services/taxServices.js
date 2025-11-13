class TaxService {
    /**
     * Calculate taxes based on user's country and state
     * @param {Object} user - User object with address field
     * @param {number} baseAmount - Base amount in paise
     * @returns {Object} Tax breakdown
     */
    calculateTax(user, baseAmount) {
        const { country, state } = this.extractLocationFromAddress(user.address);
        
        // Only apply taxes if country is India
        if (country && country.toLowerCase().includes('india')) {
            return this.calculateIndiaGST(baseAmount, state);
        }
        
        // No taxes for non-India countries
        return {
            baseAmount: baseAmount,
            taxAmount: 0,
            totalAmount: baseAmount,
            taxBreakdown: [],
            country: country || 'Unknown',
            state: state || 'Unknown'
        };
    }

    /**
     * Extract country and state from address string
     * @param {string} address - Combined address string
     * @returns {Object} {country, state}
     */
    extractLocationFromAddress(address) {
        if (!address) return { country: null, state: null };
        
        const addressLines = address.split('\n').map(line => line.trim());
        let country = null;
        let state = null;
        
        // Look for country (usually the last line or contains common country names)
        const countryKeywords = ['india', 'united states', 'usa', 'canada', 'australia', 'uk', 'united kingdom'];
        for (const line of addressLines) {
            const lowerLine = line.toLowerCase();
            for (const keyword of countryKeywords) {
                if (lowerLine.includes(keyword)) {
                    country = line;
                    break;
                }
            }
            if (country) break;
        }
        
        // Look for state (usually second to last line or contains state names)
        // Check for Indian states
        const indianStates = [
            'andhra pradesh', 'arunachal pradesh', 'assam', 'bihar', 'chhattisgarh',
            'goa', 'gujarat', 'haryana', 'himachal pradesh', 'jharkhand', 'karnataka',
            'kerala', 'madhya pradesh', 'maharashtra', 'manipur', 'meghalaya', 'mizoram',
            'nagaland', 'odisha', 'punjab', 'rajasthan', 'sikkim', 'tamil nadu',
            'telangana', 'tripura', 'uttar pradesh', 'uttarakhand', 'west bengal',
            'andaman and nicobar islands', 'chandigarh', 'dadra and nagar haveli',
            'daman and diu', 'delhi', 'jammu and kashmir', 'ladakh', 'lakshadweep',
            'puducherry'
        ];
        
        for (const line of addressLines) {
            const lowerLine = line.toLowerCase();
            for (const stateName of indianStates) {
                if (lowerLine.includes(stateName)) {
                    state = line;
                    break;
                }
            }
            if (state) break;
        }
        
        return { country, state };
    }

    /**
     * Calculate India GST based on state
     * @param {number} baseAmount - Base amount in paise
     * @param {string} state - State name
     * @returns {Object} Tax breakdown
     */
    calculateIndiaGST(baseAmount, state) {
        const baseAmountInRupees = baseAmount / 100;
        let taxBreakdown = [];
        let totalTaxAmount = 0;
        
        if (state && state.toLowerCase().includes('west bengal')) {
            // West Bengal: 18% GST
            const gstAmount = Math.round(baseAmountInRupees * 0.18 * 100); // Convert back to paise
            taxBreakdown.push({
                type: 'GST',
                rate: 18,
                amount: gstAmount,
                description: 'GST (18%)'
            });
            totalTaxAmount = gstAmount;
        } else {
            // Other states: 9% IGST + 9% SGST
            const igstAmount = Math.round(baseAmountInRupees * 0.09 * 100); // Convert back to paise
            const sgstAmount = Math.round(baseAmountInRupees * 0.09 * 100); // Convert back to paise
            
            taxBreakdown.push({
                type: 'IGST',
                rate: 9,
                amount: igstAmount,
                description: 'IGST (9%)'
            });
            
            taxBreakdown.push({
                type: 'SGST',
                rate: 9,
                amount: sgstAmount,
                description: 'SGST (9%)'
            });
            
            totalTaxAmount = igstAmount + sgstAmount;
        }
        
        return {
            baseAmount: baseAmount,
            taxAmount: totalTaxAmount,
            totalAmount: baseAmount + totalTaxAmount,
            taxBreakdown: taxBreakdown,
            country: 'India',
            state: state || 'Unknown'
        };
    }

    /**
     * Format tax breakdown for display
     * @param {Object} taxData - Tax calculation result
     * @returns {string} Formatted tax breakdown
     */
    formatTaxBreakdown(taxData) {
        if (taxData.taxAmount === 0) {
            return 'No taxes applicable';
        }
        
        let breakdown = `Taxes (${taxData.country}${taxData.state ? `, ${taxData.state}` : ''}):\n`;
        taxData.taxBreakdown.forEach(tax => {
            breakdown += `- ${tax.description}: ₹${(tax.amount / 100).toFixed(2)}\n`;
        });
        
        return breakdown;
    }
}

module.exports = new TaxService();
