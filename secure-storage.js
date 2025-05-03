/**
 * Secure storage utilities for DNS & SSL Inspector
 * Uses Chrome's storage.sync API with encryption for sensitive data
 */

const SecureStorage = (function() {
    // Simple encryption key derived from extension ID
    // In a production extension, consider a more secure approach
    let encryptionKey = '';
    
    /**
     * Initialize the secure storage
     * @returns {Promise<void>}
     */
    async function init() {
      // Get the extension ID to use for encryption
      const extensionInfo = chrome.runtime.getManifest();
      const extensionId = chrome.runtime.id;
      encryptionKey = extensionId + extensionInfo.version;
      
      console.log('Secure storage initialized');
    }
    
    /**
     * Simple XOR encryption/decryption
     * Note: This is not cryptographically secure, just basic obfuscation
     * For a production extension, use the SubtleCrypto API
     * 
     * @param {string} text - Text to encrypt/decrypt
     * @returns {string} - Encrypted/decrypted text
     */
    function xorEncrypt(text) {
      if (!text) return '';
      
      let result = '';
      for (let i = 0; i < text.length; i++) {
        const charCode = text.charCodeAt(i) ^ encryptionKey.charCodeAt(i % encryptionKey.length);
        result += String.fromCharCode(charCode);
      }
      return btoa(result); // Base64 encode for storage
    }
    
    /**
     * Decrypt XOR encrypted text
     * @param {string} encryptedText - Text to decrypt
     * @returns {string} - Decrypted text
     */
    function xorDecrypt(encryptedText) {
      if (!encryptedText) return '';
      
      try {
        const text = atob(encryptedText); // Base64 decode
        let result = '';
        for (let i = 0; i < text.length; i++) {
          const charCode = text.charCodeAt(i) ^ encryptionKey.charCodeAt(i % encryptionKey.length);
          result += String.fromCharCode(charCode);
        }
        return result;
      } catch (e) {
        console.error('Decryption error:', e);
        return '';
      }
    }
    
    /**
     * Store data securely
     * @param {string} key - Storage key
     * @param {any} data - Data to store
     * @param {boolean} encrypt - Whether to encrypt the data
     * @returns {Promise<void>}
     */
    async function storeData(key, data, encrypt = false) {
      if (!key) {
        throw new Error('Storage key is required');
      }
      
      // Convert data to string
      const dataString = JSON.stringify(data);
      
      // Encrypt if requested
      const valueToStore = encrypt ? xorEncrypt(dataString) : dataString;
      
      // Store with metadata
      const storageObj = {
        data: valueToStore,
        encrypted: encrypt,
        timestamp: Date.now()
      };
      
      return new Promise((resolve, reject) => {
        chrome.storage.sync.set({ [key]: storageObj }, () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve();
          }
        });
      });
    }
    
    /**
     * Retrieve data from secure storage
     * @param {string} key - Storage key
     * @returns {Promise<any>} - Retrieved data
     */
    async function retrieveData(key) {
      if (!key) {
        throw new Error('Storage key is required');
      }
      
      return new Promise((resolve, reject) => {
        chrome.storage.sync.get(key, (result) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
            return;
          }
          
          const storageObj = result[key];
          
          if (!storageObj) {
            resolve(null);
            return;
          }
          
          try {
            // Decrypt if needed
            const dataString = storageObj.encrypted 
              ? xorDecrypt(storageObj.data) 
              : storageObj.data;
            
            // Parse the data
            const data = JSON.parse(dataString);
            
            resolve({
              data,
              timestamp: storageObj.timestamp
            });
          } catch (e) {
            console.error('Error retrieving data:', e);
            reject(e);
          }
        });
      });
    }
    
    /**
     * Remove data from storage
     * @param {string} key - Storage key to remove
     * @returns {Promise<void>}
     */
    async function removeData(key) {
      if (!key) {
        throw new Error('Storage key is required');
      }
      
      return new Promise((resolve, reject) => {
        chrome.storage.sync.remove(key, () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve();
          }
        });
      });
    }
    
    /**
     * Clear all stored data
     * @returns {Promise<void>}
     */
    async function clearAllData() {
      return new Promise((resolve, reject) => {
        chrome.storage.sync.clear(() => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve();
          }
        });
      });
    }
    
    /**
     * Store visited site information securely
     * @param {string} domain - Domain that was visited
     * @param {Object} sslInfo - SSL certificate information
     * @param {Object} dnsInfo - DNS records
     * @returns {Promise<void>}
     */
    async function storeVisitedSite(domain, sslInfo, dnsInfo) {
      try {
        // Get existing visited sites
        const visitedData = await retrieveData('visited_sites') || { data: [] };
        const visitedSites = visitedData.data;
        
        // Check if this site already exists
        const existingIndex = visitedSites.findIndex(site => site.domain === domain);
        
        // Create site data object
        const siteData = {
          domain,
          lastVisited: Date.now(),
          sslInfo: {
            secure: sslInfo?.secure || false,
            validUntil: sslInfo?.validUntil || null
          },
          hasSPF: dnsInfo?.TXT?.Answer?.some(r => r.data?.includes('v=spf1')) || false,
          hasDMARC: dnsInfo?.TXT?.Answer?.some(r => r.data?.includes('v=dmarc1')) || false,
          hasCAA: (dnsInfo?.CAA?.Answer?.length > 0) || false
        };
        
        // Update or add site
        if (existingIndex >= 0) {
          visitedSites[existingIndex] = siteData;
        } else {
          visitedSites.push(siteData);
        }
        
        // Keep only the last 100 sites
        if (visitedSites.length > 100) {
          visitedSites.sort((a, b) => b.lastVisited - a.lastVisited);
          visitedSites.length = 100;
        }
        
        // Store the updated list
        await storeData('visited_sites', visitedSites, true);
        
      } catch (error) {
        console.error('Error storing visited site:', error);
      }
    }
    
    /**
     * Get list of visited sites
     * @returns {Promise<Array>} - List of visited sites
     */
    async function getVisitedSites() {
      try {
        const visitedData = await retrieveData('visited_sites');
        if (!visitedData || !visitedData.data) {
          return [];
        }
        
        return visitedData.data;
      } catch (error) {
        console.error('Error retrieving visited sites:', error);
        return [];
      }
    }
    
    // Initialize when this script loads
    init();
    
    // Public API
    return {
      storeData,
      retrieveData,
      removeData,
      clearAllData,
      storeVisitedSite,
      getVisitedSites
    };
  })();
  
  // Make the API available globally
  window.SecureStorage = SecureStorage;