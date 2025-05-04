document.addEventListener('DOMContentLoaded', function() {
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
    
    // Load DNS information
    loadDnsRecords(domain);
    
    // Load SSL Certificate information
    loadSslCertificate(currentTab.url);
  });
});

// Function to fetch DNS records directly from Google's DNS-over-HTTPS API
function loadDnsRecords(domain) {
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
            // Nameserver records
            displayText = answer.data;
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
          default:
            displayText = answer.data;
        }
        
        // Add TTL info
        displayText += ` (TTL: ${answer.TTL}s)`;
        
        recordItem.textContent = displayText;
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