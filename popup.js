document.addEventListener('DOMContentLoaded', function() {
  // Get current tab URL
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    const currentTab = tabs[0];
    const url = new URL(currentTab.url);
    const domain = url.hostname;
    
    console.log("Current domain:", domain);
    
    // Display current URL
    document.getElementById('current-url').textContent = domain;
    
    // Add favicon
    const faviconContainer = document.getElementById('favicon-container');
    const faviconImg = document.createElement('img');
    faviconImg.src = `https://www.google.com/s2/favicons?domain=${domain}`;
    faviconContainer.appendChild(faviconImg);
    
    // Load DNS information
    loadDnsRecords(domain);
  });
});

// Function to fetch DNS records directly from Google's DNS-over-HTTPS API
function loadDnsRecords(domain) {
  console.log('Loading DNS records for:', domain);
  
  const dnsLoader = document.getElementById('dns-loader');
  
  // Define record types to fetch
  const recordTypes = ['NS', 'A', 'AAAA', 'CNAME', 'MX', 'TXT', 'CAA', 'SOA', 'PTR'];
  
  // Initialize all record containers with "Loading..." text
  recordTypes.forEach(type => {
    const recordsContainer = document.getElementById(`${type.toLowerCase()}-records`);
    if (recordsContainer) {
      recordsContainer.textContent = 'Loading...';
    } else {
      console.error(`Container for ${type} records not found!`);
    }
  });
  
  // Fetch each record type
  let completedRequests = 0;
  recordTypes.forEach(type => {
    fetchDnsRecordsDirectly(domain, type, () => {
      completedRequests++;
      // Hide loader once all requests are complete
      if (completedRequests === recordTypes.length) {
        if (dnsLoader) {
          dnsLoader.classList.add('hidden');
        }
      }
    });
  });
  
  // Fallback to hide loader after 10 seconds
  setTimeout(() => {
    if (dnsLoader) {
      dnsLoader.classList.add('hidden');
    }
  }, 10000);
}

// Function to fetch DNS records directly from Google DNS-over-HTTPS API
function fetchDnsRecordsDirectly(domain, recordType, callback) {
  console.log(`Fetching ${recordType} records for:`, domain);
  
  const recordsContainer = document.getElementById(`${recordType.toLowerCase()}-records`);
  if (!recordsContainer) {
    console.error(`Container for ${recordType.toLowerCase()}-records not found!`);
    if (callback) callback();
    return;
  }
  
  // Using Google's DNS-over-HTTPS API directly - CORS enabled
  const url = `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=${recordType}`;
  
  fetch(url)
    .then(response => {
      if (!response.ok) {
        throw new Error(`DNS query failed: ${response.status} ${response.statusText}`);
      }
      return response.json();
    })
    .then(data => {
      console.log(`Received ${recordType} records:`, data);
      
      if (!data.Answer || data.Answer.length === 0) {
        recordsContainer.textContent = 'No records found';
        return;
      }
      
      // Clear existing content
      recordsContainer.innerHTML = '';
      
      // Add records to container
      data.Answer.forEach(answer => {
        const recordItem = document.createElement('div');
        recordItem.className = 'record-item';
        
        // Format record data based on record type
        let displayText = '';
        
        switch(recordType) {
          case 'NS':
            // Just display the nameserver record with TTL
            recordItem.textContent = answer.data + ` (TTL: ${answer.TTL}s)`;
            
            // If the user wants IP addresses, we fetch and add them
            fetchNameserverIP(answer.data, recordItem);
            break;
            
          case 'MX':
            // MX records have priority and target
            const [priority, host] = answer.data.split(' ');
            displayText = `Priority: ${priority}, Host: ${host}`;
            break;
            
          case 'TXT':
            // Remove quotes from TXT records if present
            let txtValue = answer.data;
            if (txtValue.startsWith('"') && txtValue.endsWith('"')) {
              txtValue = txtValue.slice(1, -1);
            }
            displayText = txtValue;
            break;
            
          case 'CNAME':
            // Clearly format CNAME records
            displayText = `Points to: ${answer.data}`;
            break;
            
          case 'SOA':
            // SOA records have multiple fields
            const soaParts = answer.data.split(' ');
            if (soaParts.length >= 7) {
              displayText = `Primary NS: ${soaParts[0]}, Admin: ${soaParts[1]}, ` +
                           `Serial: ${soaParts[2]}, Refresh: ${soaParts[3]}s, ` +
                           `Retry: ${soaParts[4]}s, Expire: ${soaParts[5]}s, ` +
                           `Minimum: ${soaParts[6]}s`;
            } else {
              displayText = answer.data;
            }
            break;
            
          case 'PTR':
            displayText = `Hostname: ${answer.data}`;
            break;
            
          default:
            displayText = answer.data;
        }
        
        // Only set textContent if it hasn't been set already (NS case)
        if (recordType !== 'NS') {
          recordItem.textContent = displayText;
          
          // Add TTL info
          recordItem.textContent += ` (TTL: ${answer.TTL}s)`;
        }
        
        recordsContainer.appendChild(recordItem);
      });
    })
    .catch(error => {
      console.error(`Error fetching ${recordType} records:`, error);
      recordsContainer.textContent = `Error: ${error.message}`;
    })
    .finally(() => {
      if (callback) callback();
    });
}

// Function to fetch IP address for a nameserver
function fetchNameserverIP(nameserver, recordItem) {
  // Clean the nameserver name if it has a trailing dot
  const cleanNameserver = nameserver.endsWith('.') ? nameserver.slice(0, -1) : nameserver;
  
  // Fetch A record for the nameserver
  const url = `https://dns.google/resolve?name=${encodeURIComponent(cleanNameserver)}&type=A`;
  
  fetch(url)
    .then(response => response.json())
    .then(data => {
      if (data.Answer && data.Answer.length > 0) {
        // Just add the IP to the existing text
        recordItem.textContent += ` (IP: ${data.Answer[0].data})`;
      }
    })
    .catch(error => {
      console.error(`Error fetching IP for nameserver ${nameserver}:`, error);
    });
}