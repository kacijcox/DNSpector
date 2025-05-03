/**
 * Session-only data storage for DNS & SSL Inspector
 * 
 * This module provides temporary in-memory storage that is never persisted
 * to disk and only lasts for the current browser session.
 * Data is automatically cleared when the browser is closed or the extension is reloaded.
 */

const SessionData = (function() {
    // In-memory storage that is never persisted
    const memoryStore = new Map();
    
    // Session start timestamp
    const sessionStartTime = Date.now();
    
    // Default expiry time (30 minutes)
    const DEFAULT_EXPIRY = 30 * 60 * 1000;
    
    /**
     * Store data in the session
     * @param {string} key - Storage key
     * @param {any} value - Data to store
     * @param {number} expiryMs - Milliseconds until data expires (default: 30 minutes)
     */
    function set(key, value, expiryMs = DEFAULT_EXPIRY) {
      if (!key) {
        throw new Error('Storage key is required');
      }
      
      const expiryTime = Date.now() + expiryMs;
      
      memoryStore.set(key, {
        value: JSON.parse(JSON.stringify(value)), // Deep clone to prevent reference issues
        expiryTime
      });
      
      // Set a timer to automatically remove the data when it expires
      setTimeout(() => {
        if (memoryStore.has(key)) {
          memoryStore.delete(key);
          console.log(`Session data for key "${key}" automatically expired`);
        }
      }, expiryMs);
      
      return true;
    }
    
    /**
     * Retrieve data from the session
     * @param {string} key - Storage key
     * @returns {any} - Retrieved data or null if not found/expired
     */
    function get(key) {
      if (!key) {
        throw new Error('Storage key is required');
      }
      
      const item = memoryStore.get(key);
      
      if (!item) {
        return null;
      }
      
      // Check if the data has expired
      if (Date.now() > item.expiryTime) {
        memoryStore.delete(key);
        return null;
      }
      
      // Return a deep clone to prevent reference issues
      return JSON.parse(JSON.stringify(item.value));
    }
    
    /**
     * Remove data from the session
     * @param {string} key - Storage key to remove
     */
    function remove(key) {
      if (!key) {
        throw new Error('Storage key is required');
      }
      
      return memoryStore.delete(key);
    }
    
    /**
     * Clear all session data
     */
    function clear() {
      memoryStore.clear();
      return true;
    }
    
    /**
     * Get all keys in the session store
     * @returns {Array} - Array of keys
     */
    function getKeys() {
      return Array.from(memoryStore.keys());
    }
    
    /**
     * Get session metadata
     * @returns {Object} - Session information
     */
    function getSessionInfo() {
      return {
        startTime: sessionStartTime,
        duration: Date.now() - sessionStartTime,
        itemCount: memoryStore.size,
        keys: Array.from(memoryStore.keys())
      };
    }
    
    /**
     * Store security scan results for the current domain
     * @param {string} domain - Domain that was scanned
     * @param {Array} securityResults - Security check results
     * @param {number} expiryMs - Milliseconds until data expires (default: 5 minutes)
     */
    function storeSecurityResults(domain, securityResults, expiryMs = 5 * 60 * 1000) {
      if (!domain || !securityResults) {
        return false;
      }
      
      // Store with shorter expiry since security status can change
      return set(`security_${domain}`, {
        results: securityResults,
        timestamp: Date.now()
      }, expiryMs);
    }
    
    /**
     * Get security scan results for a domain
     * @param {string} domain - Domain to get results for
     * @returns {Object|null} - Security results or null if not found/expired
     */
    function getSecurityResults(domain) {
      if (!domain) {
        return null;
      }
      
      return get(`security_${domain}`);
    }
    
    /**
     * Store DNS record results temporarily
     * @param {string} domain - Domain that was queried
     * @param {Object} dnsRecords - DNS records by type
     * @param {number} expiryMs - Milliseconds until data expires (default: 5 minutes)
     */
    function storeDnsRecords(domain, dnsRecords, expiryMs = 5 * 60 * 1000) {
      if (!domain || !dnsRecords) {
        return false;
      }
      
      return set(`dns_${domain}`, {
        records: dnsRecords,
        timestamp: Date.now()
      }, expiryMs);
    }
    
    /**
     * Get DNS record results for a domain
     * @param {string} domain - Domain to get records for
     * @returns {Object|null} - DNS records or null if not found/expired
     */
    function getDnsRecords(domain) {
      if (!domain) {
        return null;
      }
      
      return get(`dns_${domain}`);
    }
    
    /**
     * Store SSL certificate information temporarily
     * @param {string} domain - Domain that certificate is for
     * @param {Object} sslInfo - SSL certificate information
     * @param {number} expiryMs - Milliseconds until data expires (default: 5 minutes)
     */
    function storeSslInfo(domain, sslInfo, expiryMs = 5 * 60 * 1000) {
      if (!domain || !sslInfo) {
        return false;
      }
      
      return set(`ssl_${domain}`, {
        certificate: sslInfo,
        timestamp: Date.now()
      }, expiryMs);
    }
    
    /**
     * Get SSL certificate information for a domain
     * @param {string} domain - Domain to get certificate for
     * @returns {Object|null} - SSL info or null if not found/expired
     */
    function getSslInfo(domain) {
      if (!domain) {
        return null;
      }
      
      return get(`ssl_${domain}`);
    }
    
    // Initialize the session when the extension is loaded
    function init() {
      // Clear session when extension unloads
      window.addEventListener('unload', () => {
        clear();
      });
      
      console.log('Session data storage initialized');
    }
    
    // Initialize when this script loads
    init();
    
    // Public API
    return {
      set,
      get,
      remove,
      clear,
      getKeys,
      getSessionInfo,
      storeSecurityResults,
      getSecurityResults,
      storeDnsRecords,
      getDnsRecords,
      storeSslInfo,
      getSslInfo
    };
  })();
  
  // Make the API available globally
  window.SessionData = SessionData;