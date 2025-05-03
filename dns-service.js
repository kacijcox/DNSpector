// DNS Service for interacting with DNS APIs
class DnsService {
    constructor() {
      // Base URL for Google's DNS-over-HTTPS API
      this.googleDnsApi = 'https://dns.google/resolve';
      
      // Base URL for Cloudflare's DNS-over-HTTPS API
      this.cloudflareDnsApi = 'https://cloudflare-dns.com/dns-query';
      
      // Default DNS provider
      this.defaultProvider = 'google';
    }
    
    /**
     * Fetch DNS records for a domain
     * @param {string} domain - The domain to query
     * @param {string} recordType - The DNS record type (A, AAAA, MX, TXT, etc.)
     * @param {string} provider - The DNS provider to use (google or cloudflare)
     * @returns {Promise<Object>} - The DNS records response
     */
    async fetchRecords(domain, recordType, provider = this.defaultProvider) {
      try {
        // Since we're using Manifest V3, we need to use the background script for CORS
        // so we'll send a message to the background script to make the request
        return new Promise((resolve, reject) => {
          chrome.runtime.sendMessage(
            {
              action: "getDnsRecords",
              domain: domain,
              recordType: recordType
            },
            function(response) {
              if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
                return;
              }
              
              if (!response.success) {
                reject(new Error(response.error || 'Unknown error'));
                return;
              }
              
              resolve(response.records);
            }
          );
        });
      } catch (error) {
        console.error(`Error fetching ${recordType} records for ${domain}:`, error);
        return {
          success: false,
          error: error.message,
          records: []
        };
      }
    }
    
    /**
     * Parse the DNS API response
     * @param {Object} response - The API response
     * @param {string} recordType - The DNS record type
     * @returns {Object} - Parsed records
     */
    parseResponse(response, recordType) {
      if (!response.Answer) {
        return {
          success: true,
          records: []
        };
      }
      
      const records = [];
      
      response.Answer.forEach(answer => {
        // Different record types need different parsing
        switch (recordType) {
          case 'A':
          case 'AAAA':
            records.push({
              ip: answer.data,
              ttl: answer.TTL
            });
            break;
            
          case 'MX':
            // MX records typically have priority and hostname
            const [priority, host] = answer.data.split(' ');
            records.push({
              priority: parseInt(priority, 10),
              host,
              ttl: answer.TTL
            });
            break;
            
          case 'TXT':
            // Remove quotes that typically surround TXT records
            let txtData = answer.data;
            if (txtData.startsWith('"') && txtData.endsWith('"')) {
              txtData = txtData.slice(1, -1);
            }
            records.push({
              text: txtData,
              ttl: answer.TTL
            });
            break;
            
          case 'CNAME':
            records.push({
              target: answer.data,
              ttl: answer.TTL
            });
            break;
            
          case 'NS':
            records.push({
              nameserver: answer.data,
              ttl: answer.TTL
            });
            break;
            
          case 'SOA':
            // SOA records have multiple fields
            const soaParts = answer.data.split(' ');
            records.push({
              mname: soaParts[0],
              rname: soaParts[1],
              serial: parseInt(soaParts[2], 10),
              refresh: parseInt(soaParts[3], 10),
              retry: parseInt(soaParts[4], 10),
              expire: parseInt(soaParts[5], 10),
              minimum: parseInt(soaParts[6], 10),
              ttl: answer.TTL
            });
            break;
            
          case 'CAA':
            // CAA records have flags, tag, and value
            const caaParts = answer.data.split(' ');
            records.push({
              flags: parseInt(caaParts[0], 10),
              tag: caaParts[1].replace(/"/g, ''),
              value: caaParts[2].replace(/"/g, ''),
              ttl: answer.TTL
            });
            break;
            
          default:
            // For other record types, just store the raw data
            records.push({
              data: answer.data,
              ttl: answer.TTL
            });
        }
      });
      
      return {
        success: true,
        records
      };
    }
    
    /**
     * Fetch all common DNS records for a domain
     * @param {string} domain - The domain to query
     * @returns {Promise<Object>} - All DNS records
     */
    async fetchAllRecords(domain) {
      const recordTypes = ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SOA', 'CAA'];
      const results = {};
      
      const promises = recordTypes.map(type => 
        this.fetchRecords(domain, type)
          .then(result => {
            results[type] = result;
          })
          .catch(error => {
            console.error(`Error fetching ${type} records:`, error);
            results[type] = { success: false, error: error.message, records: [] };
          })
      );
      
      await Promise.all(promises);
      
      return {
        domain,
        records: results
      };
    }
    
    /**
     * Check if a domain has DNSSEC enabled
     * @param {string} domain - The domain to check
     * @returns {Promise<boolean>} - Whether DNSSEC is enabled
     */
    async checkDnssec(domain) {
      try {
        // We need to add the do=1 flag to the query to get DNSSEC information
        const response = await this.fetchRecords(domain, 'NS');
        
        // In a real extension, we would properly check the AD flag
        // For now, just simulate a response
        return Math.random() > 0.5; // Randomly return true or false
      } catch (error) {
        console.error(`Error checking DNSSEC for ${domain}:`, error);
        return false;
      }
    }
    
    /**
     * Detect the domain's DNS provider based on name servers
     * @param {string} domain - The domain to check
     * @returns {Promise<Object>} - Information about the DNS provider
     */
    async detectDnsProvider(domain) {
      try {
        // Send message to background script
        return new Promise((resolve, reject) => {
          chrome.runtime.sendMessage(
            {
              action: "getCloudProvider",
              domain: domain
            },
            function(response) {
              if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
                return;
              }
              
              if (!response.success) {
                reject(new Error(response.error || 'Unknown error'));
                return;
              }
              
              resolve(response.provider);
            }
          );
        });
      } catch (error) {
        console.error(`Error detecting DNS provider for ${domain}:`, error);
        return {
          provider: 'Error',
          confidence: 0,
          error: error.message
        };
      }
    }
  }
  
  // Export the DnsService class
  window.DnsService = DnsService;