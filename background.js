// Background script for DNS & SSL Inspector

// Listen for installation
chrome.runtime.onInstalled.addListener(function() {
    console.log('DNS & SSL Inspector extension installed');
  });
  
  // Set up CORS headers for DNS-over-HTTPS requests
  chrome.webRequest.onHeadersReceived.addListener(
    function(details) {
      return {
        responseHeaders: [
          ...details.responseHeaders,
          { name: 'Access-Control-Allow-Origin', value: '*' },
          { name: 'Access-Control-Allow-Methods', value: 'GET, POST, OPTIONS' },
          { name: 'Access-Control-Allow-Headers', value: 'Content-Type' }
        ]
      };
    },
    { urls: ["https://dns.google/*", "https://cloudflare-dns.com/*"] },
    ["blocking", "responseHeaders"]
  );
  
  // Listen for messages from popup
  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    // Handle DNS record requests
    if (request.action === "getDnsRecords") {
      fetchDnsRecords(request.domain, request.recordType)
        .then(data => {
          sendResponse({ success: true, records: data });
        })
        .catch(error => {
          console.error(error);
          sendResponse({ success: false, error: error.message });
        });
      
      // Return true to indicate we'll respond asynchronously
      return true;
    }
    
    // Handle SSL certificate information requests
    if (request.action === "getSslCertificate") {
      fetchSslCertificate(request.url)
        .then(data => {
          sendResponse({ success: true, certificate: data });
        })
        .catch(error => {
          console.error(error);
          sendResponse({ success: false, error: error.message });
        });
      
      return true;
    }
    
    // Handle cloud provider detection
    if (request.action === "getCloudProvider") {
      detectCloudProvider(request.domain)
        .then(data => {
          sendResponse({ success: true, provider: data });
        })
        .catch(error => {
          console.error(error);
          sendResponse({ success: false, error: error.message });
        });
      
      return true;
    }
  });
  
  // Function to fetch DNS records
  async function fetchDnsRecords(domain, recordType) {
    try {
      // Using Google's DNS-over-HTTPS API
      const url = `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=${recordType}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`DNS query failed: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error(`Error fetching ${recordType} records for ${domain}:`, error);
      throw error;
    }
  }
  
  // Function to fetch SSL certificate information
  async function fetchSslCertificate(url) {
    // We'll need to use a proxy service or a content script injection 
    // to get SSL certificate details - this is a simplified version
    return new Promise((resolve, reject) => {
      try {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
          const activeTab = tabs[0];
          
          // Execute a content script to get certificate information
          chrome.tabs.executeScript(
            activeTab.id,
            { code: 'window.location.protocol === "https:" ? "Secure" : "Insecure"' },
            function(results) {
              if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
                return;
              }
              
              const isSecure = results[0] === "Secure";
              
              // In a real extension, we would get more detailed certificate info
              // using chrome.webRequest API or a proxy service
              resolve({
                secure: isSecure,
                protocol: isSecure ? "TLS" : "None",
                issuer: isSecure ? "Certificate Authority" : "None",
                validFrom: isSecure ? new Date().toISOString() : "N/A",
                validUntil: isSecure ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() : "N/A"
              });
            }
          );
        });
      } catch (error) {
        reject(error);
      }
    });
  }
  
  // Function to detect cloud provider
  async function detectCloudProvider(domain) {
    try {
      // First, get IP address from DNS A record
      const dnsResult = await fetchDnsRecords(domain, "A");
      
      if (!dnsResult.Answer || dnsResult.Answer.length === 0) {
        return { name: "Unknown", confidence: 0 };
      }
      
      const ip = dnsResult.Answer[0].data;
      
      // In a real extension, we would check IP ranges against known cloud providers
      // This would require a database of IP ranges or an API service
      
      // For demo purposes, we'll do a very basic check
      // A more complete solution would use a cloud provider IP database
      
      // Check CNAME records for clues
      const cnameResult = await fetchDnsRecords(domain, "CNAME");
      if (cnameResult.Answer) {
        const cname = cnameResult.Answer[0]?.data || "";
        
        if (cname.includes("cloudfront.net")) {
          return { name: "Amazon AWS CloudFront", confidence: 0.9 };
        } else if (cname.includes("cloudflare")) {
          return { name: "Cloudflare", confidence: 0.9 };
        } else if (cname.includes("azure")) {
          return { name: "Microsoft Azure", confidence: 0.9 };
        } else if (cname.includes("googleusercontent")) {
          return { name: "Google Cloud", confidence: 0.9 };
        }
      }
      
      // Return a generic result - in a real extension we would do more checks
      return { name: "Unknown", confidence: 0.1, ip: ip };
    } catch (error) {
      console.error(`Error detecting cloud provider for ${domain}:`, error);
      return { name: "Error", confidence: 0, error: error.message };
    }
  }