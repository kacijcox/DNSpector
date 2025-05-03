// Background script for DNS & SSL Inspector with session-only data

// In-memory session cache for temporary storage
const sessionCache = new Map();

// Listen for installation
chrome.runtime.onInstalled.addListener(function() {
  console.log('DNS & SSL Inspector extension installed');
  // Initialize session data
  resetSessionData();
});

// Reset all session data - called on installation and can be triggered manually
function resetSessionData() {
  sessionCache.clear();
  console.log('Session data reset');
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  // Handle DNS record requests
  if (request.action === "getDnsRecords") {
    // Check if we have cached results that are still fresh (less than 2 minutes old)
    const cacheKey = `dns_${request.domain}_${request.recordType}`;
    const cachedData = sessionCache.get(cacheKey);
    
    if (cachedData && (Date.now() - cachedData.timestamp < 2 * 60 * 1000)) {
      console.log(`Using cached DNS data for ${request.domain} (${request.recordType})`);
      sendResponse({ success: true, records: cachedData.data });
      return true;
    }
    
    // No fresh cache, fetch from API
    fetchDnsRecords(request.domain, request.recordType)
      .then(data => {
        // Store in session cache
        sessionCache.set(cacheKey, {
          data: data,
          timestamp: Date.now()
        });
        
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
    // Check if we have cached results
    const cacheKey = `ssl_${new URL(request.url).hostname}`;
    const cachedData = sessionCache.get(cacheKey);
    
    if (cachedData && (Date.now() - cachedData.timestamp < 5 * 60 * 1000)) {
      console.log(`Using cached SSL data for ${request.url}`);
      sendResponse({ success: true, certificate: cachedData.data });
      return true;
    }
    
    // No cache, generate new data
    const url = request.url;
    const isSecure = url.startsWith('https://');
    
    // Create a certificate object with basic info
    const certData = {
      secure: isSecure,
      protocol: isSecure ? "TLS" : "None",
      issuer: isSecure ? "Certificate Authority" : "None",
      validFrom: isSecure ? new Date().toISOString() : "N/A",
      validUntil: isSecure ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() : "N/A"
    };
    
    // Store in session cache
    sessionCache.set(cacheKey, {
      data: certData,
      timestamp: Date.now()
    });
    
    sendResponse({ success: true, certificate: certData });
    return true;
  }
  
  // Handle cloud provider detection
  if (request.action === "getCloudProvider") {
    // Check if we have cached results
    const cacheKey = `cloud_${request.domain}`;
    const cachedData = sessionCache.get(cacheKey);
    
    if (cachedData && (Date.now() - cachedData.timestamp < 10 * 60 * 1000)) {
      console.log(`Using cached cloud provider data for ${request.domain}`);
      sendResponse({ success: true, provider: cachedData.data });
      return true;
    }
    
    // No cache, detect provider
    detectCloudProvider(request.domain)
      .then(data => {
        // Store in session cache
        sessionCache.set(cacheKey, {
          data: data,
          timestamp: Date.now()
        });
        
        sendResponse({ success: true, provider: data });
      })
      .catch(error => {
        console.error(error);
        sendResponse({ success: false, error: error.message });
      });
    
    return true;
  }
  
  // Handle session data management
  if (request.action === "clearSessionData") {
    resetSessionData();
    sendResponse({ success: true, message: "Session data cleared" });
    return true;
  }
  
  // Handle session status request
  if (request.action === "getSessionStatus") {
    const sessionInfo = {
      cacheSize: sessionCache.size,
      cacheKeys: Array.from(sessionCache.keys()),
      sessionStart: sessionCache.get('session_start') || Date.now()
    };
    sendResponse({ success: true, sessionInfo: sessionInfo });
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

// Function to detect cloud provider
async function detectCloudProvider(domain) {
  try {
    // First, get IP address from DNS A record
    const dnsResult = await fetchDnsRecords(domain, "A");
    
    if (!dnsResult.Answer || dnsResult.Answer.length === 0) {
      return { name: "Unknown", confidence: 0 };
    }
    
    const ip = dnsResult.Answer[0].data;
    
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
    
    // Basic IP range checking
    // This is a simplified version; a real extension would use IP range databases
    if (ip.startsWith('13.') || ip.startsWith('54.')) {
      return { name: "Amazon AWS", confidence: 0.7, ip: ip };
    } else if (ip.startsWith('35.') || ip.startsWith('34.')) {
      return { name: "Google Cloud", confidence: 0.7, ip: ip };
    } else if (ip.startsWith('40.') || ip.startsWith('20.')) {
      return { name: "Microsoft Azure", confidence: 0.7, ip: ip };
    } else if (ip.startsWith('104.') && !isNaN(parseInt(ip.split('.')[1]))) {
      return { name: "Cloudflare", confidence: 0.7, ip: ip };
    }
    
    // Return a generic result with the IP
    return { name: "Unknown", confidence: 0.1, ip: ip };
  } catch (error) {
    console.error(`Error detecting cloud provider for ${domain}:`, error);
    return { name: "Error", confidence: 0, error: error.message };
  }
}

// Add a "session_start" entry to mark when the session began
sessionCache.set('session_start', Date.now());