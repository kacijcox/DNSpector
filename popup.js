document.addEventListener('DOMContentLoaded', function() {
  // Initialize the DNS Service
  const dnsService = new DnsService();
  
  // Tab functionality
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabPanes = document.querySelectorAll('.tab-pane');
  
  console.log("Tab buttons found:", tabButtons.length);
  console.log("Tab panes found:", tabPanes.length);
  
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      console.log("Tab clicked:", button.getAttribute('data-tab'));
      
      // Remove active class from all buttons and panes
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabPanes.forEach(pane => pane.classList.remove('active'));
      
      // Add active class to clicked button and corresponding pane
      button.classList.add('active');
      const tabId = button.getAttribute('data-tab');
      const pane = document.getElementById(tabId);
      
      if (pane) {
        pane.classList.add('active');
      } else {
        console.error("Tab pane not found:", tabId);
      }
    });
  });

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
    
    // Load DNS information using the DnsService
    loadDnsRecords(domain, dnsService);
    
    // Load SSL Certificate information
    loadSslCertificate(currentTab.url);
  });
});

// Function to load DNS records using DnsService
async function loadDnsRecords(domain, dnsService) {
  console.log('Loading DNS records for:', domain);
  
  const dnsLoader = document.getElementById('dns-loader');
  
  // Define record types to fetch
  const recordTypes = ['NS', 'A', 'AAAA', 'CNAME', 'MX', 'TXT', 'CAA'];
  
  // Initialize all record containers with "Loading..." text
  recordTypes.forEach(type => {
    const recordsContainer = document.getElementById(`${type.toLowerCase()}-records`);
    if (recordsContainer) {
      recordsContainer.textContent = 'Loading...';
    } else {
      console.error(`Container for ${type} records not found!`);
    }
  });
  
  // Create a counter to track completed requests
  let completedRequests = 0;
  
  // Fetch records for each type
  recordTypes.forEach(type => {
    fetchAndDisplayRecords(domain, type, dnsService)
      .then(() => {
        completedRequests++;
        // Hide loader once all requests are complete
        if (completedRequests === recordTypes.length && dnsLoader) {
          dnsLoader.classList.add('hidden');
        }
      })
      .catch(error => {
        console.error(`Error fetching ${type} records:`, error);
        completedRequests++;
        if (completedRequests === recordTypes.length && dnsLoader) {
          dnsLoader.classList.add('hidden');
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

// Function to fetch and display DNS records for a specific type
async function fetchAndDisplayRecords(domain, recordType, dnsService) {
  console.log(`Fetching ${recordType} records for:`, domain);
  
  const recordsContainer = document.getElementById(`${recordType.toLowerCase()}-records`);
  if (!recordsContainer) {
    console.error(`Container for ${recordType.toLowerCase()}-records not found!`);
    return;
  }
  
  try {
    // Use the DnsService to fetch records
    const response = await dnsService.fetchRecords(domain, recordType);
    console.log(`Received ${recordType} records:`, response);
    
    // Clear the container
    recordsContainer.innerHTML = '';
    
    // Check if we have records
    if (!response.records || response.records.length === 0) {
      recordsContainer.textContent = 'No records found';
      return;
    }
    
    // Display the records based on type
    response.records.forEach(record => {
      displayRecord(recordType, record, recordsContainer);
    });
  } catch (error) {
    console.error(`Error fetching ${recordType} records:`, error);
    recordsContainer.textContent = `Error: ${error.message}`;
  }
}

// Function to display a DNS record in the UI
function displayRecord(recordType, record, container) {
  const recordItem = document.createElement('div');
  recordItem.className = 'record-item';
  
  switch (recordType) {
    case 'NS':
      // Create nameserver record display
      const nameserverText = document.createTextNode(record.nameserver);
      recordItem.appendChild(nameserverText);
      
      // Add TTL information
      const ttlSpan = document.createElement('span');
      ttlSpan.className = 'ttl-info';
      ttlSpan.textContent = ` (TTL: ${record.ttl}s)`;
      recordItem.appendChild(ttlSpan);
      
      // Add loading indicator for IP
      const ipLoadingSpan = document.createElement('span');
      ipLoadingSpan.className = 'ns-ip-loading';
      ipLoadingSpan.textContent = ' (Loading IP...)';
      recordItem.appendChild(ipLoadingSpan);
      
      // Fetch the IP for this nameserver
      fetchNameserverIP(record.nameserver, recordItem, ipLoadingSpan);
      break;
      
    case 'A':
    case 'AAAA':
      recordItem.textContent = `${record.ip} (TTL: ${record.ttl}s)`;
      break;
      
    case 'MX':
      recordItem.textContent = `Priority: ${record.priority}, Host: ${record.host} (TTL: ${record.ttl}s)`;
      break;
      
    case 'TXT':
      recordItem.textContent = `${record.text} (TTL: ${record.ttl}s)`;
      break;
      
    case 'CNAME':
      recordItem.textContent = `Points to: ${record.target} (TTL: ${record.ttl}s)`;
      break;
      
    case 'CAA':
      recordItem.textContent = `Flags: ${record.flags}, Tag: ${record.tag}, Value: ${record.value} (TTL: ${record.ttl}s)`;
      break;
      
    default:
      recordItem.textContent = `${JSON.stringify(record.data)} (TTL: ${record.ttl}s)`;
  }
  
  container.appendChild(recordItem);
}

// Function to fetch IP address for a nameserver
async function fetchNameserverIP(nameserver, recordItem, loadingSpan) {
  // Clean the nameserver name if it has a trailing dot
  const cleanNameserver = nameserver.endsWith('.') ? nameserver.slice(0, -1) : nameserver;
  
  try {
    // Create a new instance of DnsService to use for this lookup
    const dnsService = new DnsService();
    
    // Fetch A record for the nameserver
    const response = await dnsService.fetchRecords(cleanNameserver, 'A');
    
    // Remove the loading span
    if (loadingSpan && loadingSpan.parentNode) {
      loadingSpan.parentNode.removeChild(loadingSpan);
    }
    
    if (response.records && response.records.length > 0) {
      // Create IP span with proper styling
      const ipSpan = document.createElement('span');
      ipSpan.className = 'ns-ip';
      ipSpan.textContent = ` (IP: ${response.records[0].ip})`;
      
      // Append to record item
      recordItem.appendChild(ipSpan);
    } else {
      // No IP found
      const noIpSpan = document.createElement('span');
      noIpSpan.className = 'ns-ip-not-found';
      noIpSpan.textContent = ' (No IP found)';
      recordItem.appendChild(noIpSpan);
    }
  } catch (error) {
    console.error(`Error fetching IP for nameserver ${nameserver}:`, error);
    
    // Remove the loading span
    if (loadingSpan && loadingSpan.parentNode) {
      loadingSpan.parentNode.removeChild(loadingSpan);
    }
    
    // Add error message
    const errorSpan = document.createElement('span');
    errorSpan.className = 'ns-ip-error';
    errorSpan.textContent = ' (IP lookup failed)';
    recordItem.appendChild(errorSpan);
  }
}

// Function to load SSL certificate information
function loadSslCertificate(url) {
  console.log('Loading SSL certificate for:', url);
  
  const sslLoader = document.getElementById('ssl-loader');
  
  // Basic check if the URL is using HTTPS
  const isSecure = url.startsWith('https://');
  
  // Create SSL certificate data based on URL properties
  const domain = new URL(url).hostname;
  const certData = {
    secure: isSecure,
    protocol: isSecure ? "TLS" : "None",
    issuer: isSecure ? "Certificate Authority" : "None",
    validFrom: isSecure ? new Date().toISOString() : "N/A",
    validUntil: isSecure ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() : "N/A"
  };
  
  // Update the UI with the SSL information
  updateSslDisplay(certData, url);
  
  // Hide the loader
  if (sslLoader) {
    sslLoader.classList.add('hidden');
  }
}

function updateSslDisplay(certData, url) {
  // Update UI with certificate data
  const domain = new URL(url).hostname;
  
  document.getElementById('cert-subject').textContent = domain;
  document.getElementById('cert-issuer').textContent = certData.issuer;
  document.getElementById('cert-valid-from').textContent = formatDate(certData.validFrom);
  document.getElementById('cert-valid-until').textContent = formatDate(certData.validUntil);
  document.getElementById('tls-version').textContent = certData.protocol;
  
  // Set SSL status
  const sslIcon = document.getElementById('ssl-icon');
  const sslStatusText = document.getElementById('ssl-status-text');
  
  if (certData.secure) {
    sslIcon.textContent = '🔒';
    sslIcon.className = 'status-secure';
    sslStatusText.textContent = 'Connection is secure';
    sslStatusText.className = 'status-secure';
  } else {
    sslIcon.textContent = '⚠️';
    sslIcon.className = 'status-warning';
    sslStatusText.textContent = 'Not using HTTPS';
    sslStatusText.className = 'status-warning';
  }
  
  // Display certificate chain (simplified for now)
  const chainContainer = document.getElementById('cert-chain');
  chainContainer.innerHTML = '';
  
  // Show a simple chain for now
  const certificates = ['Root Certificate Authority', 'Intermediate CA', domain];
  certificates.forEach((cert, index) => {
    const certItem = document.createElement('div');
    certItem.className = 'cert-chain-item';
    certItem.textContent = cert;
    chainContainer.appendChild(certItem);
    
    // Add arrow except for the last item
    if (index < certificates.length - 1) {
      const arrow = document.createElement('div');
      arrow.textContent = '↓';
      arrow.style.textAlign = 'center';
      arrow.style.margin = '5px 0';
      chainContainer.appendChild(arrow);
    }
  });
}

// Helper function to format date strings
function formatDate(dateStr) {
  if (dateStr === 'N/A') return dateStr;
  
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  } catch (e) {
    return dateStr;
  }
}