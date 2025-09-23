// Sri Lanka phone helpers
// Local mobile numbers: 07xxxxxxxx (10 digits). E.164: +947xxxxxxxx

export function normalizeSLPhone(input) {
    if (!input) return '';
    const raw = String(input).trim();
    // Strip spaces, dashes, parentheses
    const cleaned = raw.replace(/[\s\-()]/g, '');
    // Already E.164 +947xxxxxxxx
    if (/^\+947\d{8}$/.test(cleaned)) return cleaned;
    // Local form 07xxxxxxxx
    if (/^07\d{8}$/.test(cleaned)) {
        return '+94' + cleaned.slice(1); // drop leading 0
    }
    // Sometimes users type 7xxxxxxxxx (missing leading 0)
    if (/^7\d{8}$/.test(cleaned)) {
        return '+94' + cleaned; // prefix country code
    }
    // If they typed 00947xxxxxxxx
    if (/^00947\d{8}$/.test(cleaned)) {
        return '+' + cleaned.slice(2);
    }
    return cleaned; // return as-is; let validator decide if acceptable
}

export function isValidSLPhone(input) {
    if (!input) return false;
    const s = normalizeSLPhone(input);
    return /^\+947\d{8}$/.test(s);
}
