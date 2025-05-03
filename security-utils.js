/**
 * Security utilities for DNS & SSL Inspector extension
 */

/**
 * Sanitizes domain input to prevent injection attacks
 * @param {string} domain - Domain to sanitize
 * @returns {string} - Sanitized domain
 */
function sanitizeDomain(domain) {
  if (!domain || typeof domain !== 'string') {
    return '';
  }
  
  // Remove any protocol prefixes
  domain = domain.replace(/^(https?:\/\/)?(www\.)?/i, '');
  
  // Only allow valid domain characters
  domain = domain.replace(/[^a-z0-9.-]/gi, '');
  
  // Validate domain structure
  const domainRegex = /^[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,}$/i;
  if (!domainRegex.test(domain)) {
    console.warn('Invalid domain format:', domain);
    // Return empty string for invalid domains
    return '';
  }
  
  return domain;
}

/**
 * Sanitizes HTML to prevent XSS attacks
 * @param {string} html - HTML string to sanitize
 * @returns {string} - Sanitized HTML
 */
function sanitizeHTML(html) {
  if (!html || typeof html !== 'string') {
    return '';
  }
  
  // Replace HTML special characters with their entities
  return html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Safely adds text content to DOM element to prevent XSS
 * @param {HTMLElement} element - DOM element to update
 * @param {string} text - Text content to add
 */
function setTextContentSafely(element, text) {
  if (!element || !text) {
    return;
  }
  
  // Use textContent instead of innerHTML
  element.textContent = text;
}

/**
 * Validates API response to ensure it contains expected properties
 * @param {Object} response - API response to validate
 * @param {Array} requiredProps - Array of required property names
 * @returns {boolean} - Whether the response is valid
 */
function validateAPIResponse(response, requiredProps) {
  if (!response || typeof response !== 'object') {
    return false;
  }
  
  return requiredProps.every(prop => {
    return Object.prototype.hasOwnProperty.call(response, prop);
  });
}

/**
 * Detects potentially malicious domains based on common patterns
 * @param {string} domain - Domain to check
 * @returns {boolean} - Whether the domain appears suspicious
 */
function isSuspiciousDomain(domain) {
  if (!domain || typeof domain !== 'string') {
    return false;
  }
  
  // Check for common phishing patterns
  const suspiciousPatterns = [
    /paypal.*\.(?!paypal\.com)/i,   // PayPal lookalikes
    /google.*\.(?!google\.com)/i,   // Google lookalikes
    /apple.*\.(?!apple\.com)/i,     // Apple lookalikes
    /microsoft.*\.(?!microsoft\.com)/i, // Microsoft lookalikes
    /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/, // Raw IP addresses
    /.*\.tk$/i,                    // Free TK domains (high abuse rate)
    /.*\.xyz$/i,                   // XYZ domains (high abuse rate)
    /.*-secure-.*\./i,             // "secure" in domain
    /.*-login-.*\./i,              // "login" in domain
    /.*\.temp\./i,                 // Temporary domains
    /.*\.setup\./i                 // Setup domains
  ];
  
  return suspiciousPatterns.some(pattern => pattern.test(domain));
}

// Export the utilities
window.SecurityUtils = {
  sanitizeDomain,
  sanitizeHTML,
  setTextContentSafely,
  validateAPIResponse,
  isSuspiciousDomain
};

// Verify the SecurityUtils object is properly attached to window
console.log('SecurityUtils module loaded and attached to window:', !!window.SecurityUtils);