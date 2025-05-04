// Background script for DNS & SSL Inspector

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
  console.log("Background received message:", request.action, request);
  
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
    console.log(`Fetching DNS records for ${request.domain} (${request.recordType}) from API`);
    fetchDnsRecords(request.domain, request.recordType)
      .then(data => {
        console.log(`Received DNS data for ${request.domain} (${request.recordType}):`, data);
        
        // Store in session cache
        sessionCache.set(cacheKey, {
          data: data,
          timestamp: Date.now()
        });
        
        sendResponse({ success: true, records: data });
      })
      .catch(error => {
        console.error(`Error fetching DNS for ${request.domain} (${request.recordType}):`, error);
        sendResponse({ success: false, error: error.message });
      });
    
    // Return true to indicate we'll respond asynchronously
    return true;
  }
  
  // Handle session data management
  if (request.action === "clearSessionData") {
    resetSessionData();
    sendResponse({ success: true, message: "Session data cleared" });
    return true;
  }
});

// Function to fetch DNS records
async function fetchDnsRecords(domain, recordType) {
  try {
    console.log(`Background: Fetching ${recordType} records for ${domain}`);
    
    // Using Google's DNS-over-HTTPS API
    const url = `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=${recordType}`;
    
    console.log("Fetching from URL:", url);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`DNS query failed: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Add extra logging for CNAME records
    if (recordType === 'CNAME') {
      console.log('CNAME record response:', data);
    }
    
    return data;
  } catch (error) {
    console.error(`Error fetching ${recordType} records for ${domain}:`, error);
    throw error;
  }
}

// Add a "session_start" entry to mark when the session began
sessionCache.set('session_start', Date.now());