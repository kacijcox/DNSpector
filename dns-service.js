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
        let url;
        const headers = new Headers();
        
        if (provider === 'google') {
          url = `${this.googleDnsApi}?name=${encodeURIComponent(domain)}&type=${recordType}`;
        } else if (provider === 'cloudflare') {
          url = `${this.cloudflareDnsApi}?name=${encodeURIComponent(domain)}&type=${recordType}`;
          headers.append('accept', 'application/dns-json');
        } else {
          throw new Error('Invalid DNS provider specified');
        }
        
        const response = await fetch(url, { headers });
        
        if (!response.ok) {
          throw new Error(`DNS query failed: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        return this.parseResponse(data, recordType);
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
      );
      
      await Promise.all(promises);
      
      return {
        domain,
        records: results
      };
    }
    
    /**
     * Format DNS records for display
     * @param {Object} recordsData - The parsed DNS records
     * @returns {Object} - Formatted records for UI display
     */
    formatRecordsForDisplay(recordsData) {
      const formatted = {};
      
      for (const [type, data] of Object.entries(recordsData.records)) {
        if (!data.success || data.records.length === 0) {
          formatted[type] = [{displayText: 'No records found'}];
          continue;
        }
        
        formatted[type] = data.records.map(record => {
          let displayText = '';
          
          switch (type) {
            case 'A':
            case 'AAAA':
              displayText = `${record.ip} (TTL: ${record.ttl})`;
              break;
              
            case 'MX':
              displayText = `Priority: ${record.priority}, Host: ${record.host} (TTL: ${record.ttl})`;
              break;
              
            case 'TXT':
              displayText = `${record.text} (TTL: ${record.ttl})`;
              break;
              
            case 'CNAME':
              displayText = `${record.target} (TTL: ${record.ttl})`;
              break;
              
            case 'NS':
              displayText = `${record.nameserver} (TTL: ${record.ttl})`;
              break;
              
            case 'SOA':
              displayText = `Primary NS: ${record.mname}, Admin: ${record.rname}, Serial: ${record.serial} (TTL: ${record.ttl})`;
              break;
              
            case 'CAA':
              displayText = `Flags: ${record.flags}, Tag: ${record.tag}, Value: ${record.value} (TTL: ${record.ttl})`;
              break;
              
            default:
              displayText = `${record.data} (TTL: ${record.ttl})`;
          }
          
          return {
            displayText,
            raw: record
          };
        });
      }
      
      return formatted;
    }
    
    /**
     * Detect if a domain has DNSSEC enabled
     * @param {string} domain - The domain to check
     * @returns {Promise<boolean>} - Whether DNSSEC is enabled
     */
    async checkDnssec(domain) {
      try {
        // Use Google's DNS API which returns DNSSEC information
        const url = `${this.googleDnsApi}?name=${encodeURIComponent(domain)}&type=NS&do=1`;
        const response = await fetch(url);
        const data = await response.json();
        
        // Check if the AD (Authenticated Data) flag is set, indicating DNSSEC validation
        return data.AD === true;
      } catch (error) {
        console.error(`Error checking DNSSEC for ${domain}:`, error);
        return false;
      }
    }
    
    /**
     * Detect if a domain uses any special DNS features
     * @param {string} domain - The domain to check
     * @returns {Promise<Object>} - DNS features detected
     */
    async detectDnsFeatures(domain) {
      const features = {
        dnssec: false,
        hasWildcardRecords: false,
        usesCDN: false,
        hasEmailRecords: false,
        hasSPFRecord: false,
        hasDMARCRecord: false,
        hasDKIMRecord: false
      };
      
      try {
        // Check DNSSEC
        features.dnssec = await this.checkDnssec(domain);
        
        // Fetch MX records to check for email configuration
        const mxResult = await this.fetchRecords(domain, 'MX');
        features.hasEmailRecords = mxResult.success && mxResult.records.length > 0;
        
        // Check for SPF record
        const txtResult = await this.fetchRecords(domain, 'TXT');
        if (txtResult.success) {
          features.hasSPFRecord = txtResult.records.some(record => 
            (record.text && record.text.startsWith('v=spf1'))
          );
          
          // Check for wildcard records
          features.hasWildcardRecords = txtResult.records.some(record =>
            (record.text && record.text.includes('*'))
          );
        }
        
        // Check for DMARC record
        const dmarcResult = await this.fetchRecords(`_dmarc.${domain}`, 'TXT');
        features.hasDMARCRecord = dmarcResult.success && dmarcResult.records.some(record =>
          (record.text && record.text.startsWith('v=DMARC1'))
        );
        
        // Check for common CDN CNAMEs
        const cnameResult = await this.fetchRecords(domain, 'CNAME');
        if (cnameResult.success) {
          const cdnPatterns = [
            'cloudfront.net',
            'akamai',
            'cloudflare',
            'fastly',
            'edgekey.net',
            'akadns.net',
            'cdn'
          ];
          
          features.usesCDN = cnameResult.records.some(record =>
            cdnPatterns.some(pattern => record.target && record.target.includes(pattern))
          );
        }
        
        return features;
      } catch (error) {
        console.error(`Error detecting DNS features for ${domain}:`, error);
        return features;
      }
    }
    
    /**
     * Find the authoritative name servers for a domain
     * @param {string} domain - The domain to check
     * @returns {Promise<Array>} - List of authoritative name servers
     */
    async findAuthoritativeNameServers(domain) {
      try {
        const result = await this.fetchRecords(domain, 'NS');
        if (result.success) {
          return result.records.map(record => record.nameserver);
        }
        return [];
      } catch (error) {
        console.error(`Error finding authoritative name servers for ${domain}:`, error);
        return [];
      }
    }
    
    /**
     * Detect the domain's DNS provider based on name servers
     * @param {string} domain - The domain to check
     * @returns {Promise<Object>} - Information about the DNS provider
     */
    async detectDnsProvider(domain) {
      try {
        const nameServers = await this.findAuthoritativeNameServers(domain);
        if (nameServers.length === 0) {
          return {
            provider: 'Unknown',
            confidence: 0
          };
        }
        
        // Convert nameservers to lowercase for easier matching
        const nsLower = nameServers.map(ns => ns.toLowerCase());
        
        // Check for common DNS providers
        const providerPatterns = [
          { pattern: 'cloudflare', name: 'Cloudflare' },
          { pattern: 'aws', name: 'Amazon Route 53' },
          { pattern: 'awsdns', name: 'Amazon Route 53' },
          { pattern: 'azure-dns', name: 'Azure DNS' },
          { pattern: 'googledomains', name: 'Google Domains' },
          { pattern: 'nsdns.net', name: 'GoDaddy' },
          { pattern: 'domaincontrol.com', name: 'GoDaddy' },
          { pattern: 'cloudns', name: 'ClouDNS' },
          { pattern: 'dnsimple', name: 'DNSimple' },
          { pattern: 'dnsmadeeasy', name: 'DNS Made Easy' },
          { pattern: 'worldnic.com', name: 'Network Solutions' },
          { pattern: 'registrar-servers.com', name: 'Namecheap' },
          { pattern: 'name-services.com', name: 'Namecheap' },
          { pattern: 'nsone.net', name: 'NS1' },
          { pattern: 'dynect', name: 'Dyn' },
          { pattern: 'ultradns', name: 'UltraDNS' },
          { pattern: 'linode', name: 'Linode' },
          { pattern: 'digitalocean', name: 'DigitalOcean' },
          { pattern: 'hostgator', name: 'HostGator' },
          { pattern: 'bluehost', name: 'Bluehost' },
          { pattern: 'dreamhost', name: 'DreamHost' },
          { pattern: 'ovh', name: 'OVH' }
        ];
        
        for (const provider of providerPatterns) {
          if (nsLower.some(ns => ns.includes(provider.pattern))) {
            return {
              provider: provider.name,
              confidence: 0.9,
              nameServers: nameServers
            };
          }
        }
        
        // If no known provider is detected, return the NS records
        return {
          provider: 'Custom/Unknown',
          confidence: 0.5,
          nameServers: nameServers
        };
        
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