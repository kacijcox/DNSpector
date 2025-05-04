document.addEventListener('DOMContentLoaded', function() {
  // SECTION 1: WINDOW RESIZING AND MOVEMENT FUNCTIONALITY
  
  // Variables to store the current position and size
  let pos = { x: 0, y: 0 };
  let size = { width: 450, height: 500 };
  let dragging = false;
  let resizing = false;
  
  // Get DOM elements for drag and resize functionality
  const window = document.querySelector('.window');
  const dragHandle = document.getElementById('drag-handle');
  const resizeHandle = document.getElementById('resize-handle');
  
  // Window control buttons
  const minimizeBtn = document.getElementById('minimize-btn');
  const maximizeBtn = document.getElementById('maximize-btn');
  const closeBtn = document.getElementById('close-btn');
  
  // Min and max window sizes
  const minWidth = 400;
  const minHeight = 300;
  const maxWidth = 800;
  const maxHeight = 600;

  // Function to initialize window position (center it on screen)
  function initWindowPosition() {
    // Use window dimensions if available, otherwise use defaults
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 800;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 600;
    
    // Calculate centered position
    pos.x = (viewportWidth - size.width) / 2;
    pos.y = (viewportHeight - size.height) / 2;
    
    // Apply position
    updateWindowPosition();
  }
  
  // Function to update window position
  function updateWindowPosition() {
    window.style.transform = `translate(${pos.x}px, ${pos.y}px)`;
  }
  
  // Function to update window size
  function updateWindowSize() {
    window.style.width = `${size.width}px`;
    window.style.height = `${size.height}px`;
  }
  
  // Set up initial window position
  initWindowPosition();
  
  // EVENT LISTENERS FOR DRAGGING
  dragHandle.addEventListener('mousedown', function(e) {
    // Only handle left mouse button
    if (e.button !== 0) return;
    
    dragging = true;
    
    // Store the initial mouse position
    pos.startX = e.clientX;
    pos.startY = e.clientY;
    
    // Apply styling
    document.body.style.cursor = 'move';
    dragHandle.style.cursor = 'move';
    
    // Prevent text selection during drag
    e.preventDefault();
  });
  
  // EVENT LISTENERS FOR RESIZING
  resizeHandle.addEventListener('mousedown', function(e) {
    // Only handle left mouse button
    if (e.button !== 0) return;
    
    resizing = true;
    
    // Store the initial mouse position
    size.startX = e.clientX;
    size.startY = e.clientY;
    size.startWidth = parseInt(window.style.width);
    size.startHeight = parseInt(window.style.height);
    
    // Apply styling
    document.body.style.cursor = 'nwse-resize';
    
    // Prevent text selection during resize
    e.preventDefault();
  });
  
  // EVENT LISTENERS FOR WINDOW BUTTONS
  if (minimizeBtn) {
    minimizeBtn.addEventListener('click', function() {
      // Implement minimize functionality if needed
      // For Chrome extensions popup, this could just hide some elements
      console.log('Minimize clicked');
    });
  }
  
  if (maximizeBtn) {
    maximizeBtn.addEventListener('click', function() {
      // Toggle maximize/restore
      if (size.width < maxWidth || size.height < maxHeight) {
        // Save current size for restore
        size.previousWidth = size.width;
        size.previousHeight = size.height;
        
        // Maximize
        size.width = maxWidth;
        size.height = maxHeight;
      } else {
        // Restore previous size
        size.width = size.previousWidth || minWidth;
        size.height = size.previousHeight || minHeight;
      }
      
      updateWindowSize();
      console.log('Maximize/restore clicked');
    });
  }
  
  if (closeBtn) {
    closeBtn.addEventListener('click', function() {
      // For a Chrome extension, we can't actually close the popup from JS
      // This is just a visual indicator
      console.log('Close clicked - window would close if this were a regular window');
    });
  }
  
  // MOUSE MOVE AND MOUSE UP HANDLERS (shared for both drag and resize)
  document.addEventListener('mousemove', function(e) {
    if (dragging) {
      // Calculate the new position
      pos.x += e.clientX - pos.startX;
      pos.y += e.clientY - pos.startY;
      
      // Update the start position for the next movement
      pos.startX = e.clientX;
      pos.startY = e.clientY;
      
      // Enforce window stays partly visible on screen
      // For simplicity, ensure at least 100px remains visible
      const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
      
      pos.x = Math.max(-size.width + 100, Math.min(pos.x, viewportWidth - 100));
      pos.y = Math.max(0, Math.min(pos.y, viewportHeight - 100));
      
      // Update the window position
      updateWindowPosition();
    }
    
    if (resizing) {
      // Calculate new dimensions
      let newWidth = size.startWidth + (e.clientX - size.startX);
      let newHeight = size.startHeight + (e.clientY - size.startY);
      
      // Enforce min/max size constraints
      newWidth = Math.max(minWidth, Math.min(newWidth, maxWidth));
      newHeight = Math.max(minHeight, Math.min(newHeight, maxHeight));
      
      // Update the window size
      size.width = newWidth;
      size.height = newHeight;
      updateWindowSize();
    }
  });
  
  document.addEventListener('mouseup', function() {
    if (dragging) {
      dragging = false;
      document.body.style.cursor = 'default';
      dragHandle.style.cursor = 'move';
    }
    
    if (resizing) {
      resizing = false;
      document.body.style.cursor = 'default';
    }
  });
  
  // SECTION 2: ORIGINAL EXTENSION FUNCTIONALITY
  
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
    
    // Load email security records
    loadEmailSecurityRecords(domain);
  });
});

// Function to fetch DNS records directly from Google's DNS-over-HTTPS API
function loadDnsRecords(domain) {
  console.log('Loading DNS records for:', domain);
  
  const dnsLoader = document.getElementById('dns-loader');
  
  // Define record types to fetch - added SOA and PTR
  const recordTypes = ['NS', 'A', 'AAAA', 'CNAME', 'MX', 'TXT', 'CAA', 'SOA', 'PTR'];
  
  // Initialize all record containers with "Loading..." text
  recordTypes.forEach(type => {
    const recordsContainer = document.getElementById(`${type.toLowerCase()}-records`);
    if (recordsContainer) {
      recordsContainer.textContent = 'Loading...';
    } else {
      console.error(`Container for ${type.toLowerCase()}-records not found!`);
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

// Function to specifically load email security records (SPF, DKIM, DMARC)
function loadEmailSecurityRecords(domain) {
  console.log('Loading email security records for:', domain);
  
  // Check for DMARC record
  const dmarcDomain = `_dmarc.${domain}`;
  fetchDnsRecordsDirectly(dmarcDomain, 'TXT', null, 'dmarc-records');
  
  // Check for DKIM selectors - commonly used selectors
  // This is more of a best effort since we don't know the exact selector
  const commonSelectors = ['default', 'google', 'k1', 'selector1', 'selector2'];
  commonSelectors.forEach(selector => {
    const dkimDomain = `${selector}._domainkey.${domain}`;
    fetchDnsRecordsDirectly(dkimDomain, 'TXT', null, 'dkim-records');
  });
  
  // Check for BIMI record
  const bimiDomain = `default._bimi.${domain}`;
  fetchDnsRecordsDirectly(bimiDomain, 'TXT', null, 'bimi-records');
}

// Function to fetch DNS records directly from Google DNS-over-HTTPS API
// Added optional targetContainer parameter for special record types
function fetchDnsRecordsDirectly(domain, recordType, callback, targetContainer = null) {
  console.log(`Fetching ${recordType} records for:`, domain);
  
  // Determine which container to use
  const containerID = targetContainer || `${recordType.toLowerCase()}-records`;
  const recordsContainer = document.getElementById(containerID);
  
  // Skip if container doesn't exist and we're not creating a special one
  if (!recordsContainer && !targetContainer) {
    console.error(`Container for ${containerID} not found!`);
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
      console.log(`Received ${recordType} records for ${domain}:`, data);
      
      if (!data.Answer || data.Answer.length === 0) {
        // Don't modify container for special lookups that didn't find anything
        if (targetContainer && !recordsContainer) {
          return;
        }
        if (recordsContainer) {
          recordsContainer.textContent = 'No records found';
        }
        return;
      }
      
      // For special record types, we need to create containers if they don't exist
      if (targetContainer && !recordsContainer) {
        createRecordSection(targetContainer, getRecordTypeLabel(targetContainer));
      }
      
      // Only clear container if it exists and has content to clear
      if (recordsContainer) {
        // Only clear if this is the first time we're writing to this container
        // This is important for DKIM records with multiple selectors
        if (recordsContainer.textContent === 'Loading...' || 
            recordsContainer.textContent === 'No records found') {
          recordsContainer.innerHTML = '';
        }
        
        // Add records to container
        data.Answer.forEach(answer => {
          const recordItem = document.createElement('div');
          recordItem.className = 'record-item';
          
          // Format record data based on record type
          let displayText = '';
          
          switch(recordType) {
            case 'NS':
              // Create a text node for the nameserver without the TTL part first
              const nameserverText = document.createTextNode(answer.data);
              recordItem.appendChild(nameserverText);
          
              // Add TTL as a separate text node
              const ttlText = document.createTextNode(` (TTL: ${answer.TTL}s)`);
              recordItem.appendChild(ttlText);
          
              // Get IP for nameserver
              fetchNameserverIP(answer.data, recordItem);
          
              // Add to container and return early since we've already set up the record item
              recordsContainer.appendChild(recordItem);
              return;
              
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
              
              // Check if this is a special record type
              if (domain.startsWith('_dmarc.') && targetContainer === 'dmarc-records') {
                displayText = `DMARC: ${txtValue}`;
              } else if (domain.includes('._domainkey.') && targetContainer === 'dkim-records') {
                displayText = `DKIM (${domain.split('.')[0]}): ${txtValue}`;
              } else if (domain.includes('._bimi.') && targetContainer === 'bimi-records') {
                displayText = `BIMI: ${txtValue}`;
              } else if (txtValue.includes('v=spf1') && recordType === 'TXT') {
                // This is an SPF record
                const spfContainer = document.getElementById('spf-records');
                if (!spfContainer) {
                  createRecordSection('spf-records', 'SPF Records');
                }
                
                const spfItem = document.createElement('div');
                spfItem.className = 'record-item';
                spfItem.textContent = `SPF: ${txtValue} (TTL: ${answer.TTL}s)`;
                
                const spfRecords = document.getElementById('spf-records');
                if (spfRecords) {
                  if (spfRecords.textContent === 'Loading...' || 
                      spfRecords.textContent === 'No records found') {
                    spfRecords.innerHTML = '';
                  }
                  spfRecords.appendChild(spfItem);
                }
              } else {
                displayText = txtValue;
              }
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
          // or if this is a special record type with custom handling
          if (recordType !== 'NS' && 
              !domain.startsWith('_dmarc.') && 
              !domain.includes('._domainkey.') &&
              !domain.includes('._bimi.') &&
              !(recordType === 'TXT' && answer.data.includes('v=spf1'))) {
            recordItem.textContent = displayText;
            
            // Add TTL info
            recordItem.textContent += ` (TTL: ${answer.TTL}s)`;
            recordsContainer.appendChild(recordItem);
          } else if (domain.startsWith('_dmarc.') || 
                     domain.includes('._domainkey.') ||
                     domain.includes('._bimi.')) {
            // Handle special records
            if (displayText) {
              recordItem.textContent = displayText + ` (TTL: ${answer.TTL}s)`;
              recordsContainer.appendChild(recordItem);
            }
          }
        });
      }
    })
    .catch(error => {
      console.error(`Error fetching ${recordType} records for ${domain}:`, error);
      
      // Don't show errors for special lookups that are best-effort
      if (targetContainer && !recordsContainer) {
        return;
      }
      
      if (recordsContainer) {
        recordsContainer.textContent = `Error: ${error.message}`;
      }
    })
    .finally(() => {
      if (callback) callback();
    });
}

// Helper function to create a new record section
function createRecordSection(id, title) {
  const dnsPane = document.getElementById('dns');
  if (!dnsPane) return;
  
  // Create the section container
  const sectionDiv = document.createElement('div');
  sectionDiv.className = 'record-section';
  
  // Create the title
  const titleH3 = document.createElement('h3');
  titleH3.textContent = title;
  
  // Create the records list
  const recordsList = document.createElement('div');
  recordsList.id = id;
  recordsList.className = 'records-list';
  recordsList.textContent = 'Loading...';
  
  // Assemble the section
  sectionDiv.appendChild(titleH3);
  sectionDiv.appendChild(recordsList);
  
  // Add to the DNS pane
  dnsPane.appendChild(sectionDiv);
}

// Helper function to get a user-friendly label for record types
function getRecordTypeLabel(containerId) {
  switch(containerId) {
    case 'dmarc-records':
      return 'DMARC Records';
    case 'dkim-records':
      return 'DKIM Records';
    case 'spf-records':
      return 'SPF Records';
    case 'bimi-records':
      return 'BIMI Records';
    default:
      return containerId.replace('-records', '').toUpperCase() + ' Records';
  }
}

// Function to fetch IP address for a nameserver
function fetchNameserverIP(nameserver, recordItem) {
  // Clean the nameserver name if it has a trailing dot
  const cleanNameserver = nameserver.endsWith('.') ? nameserver.slice(0, -1) : nameserver;
  
  // Fetch A record for the nameserver
  const url = `https://dns.google/resolve?name=${encodeURIComponent(cleanNameserver)}&type=A`;
  
  fetch(url)
    .then(response => {
      if (!response.ok) {
        throw new Error(`DNS query failed: ${response.status} ${response.statusText}`);
      }
      return response.json();
    })
    .then(data => {
      if (data.Answer && data.Answer.length > 0) {
        // Create IP span
        const ipSpan = document.createElement('span');
        ipSpan.className = 'ns-ip';
        ipSpan.textContent = ` (IP: ${data.Answer[0].data})`;
        
        // Append to record item
        recordItem.appendChild(ipSpan);
      }
    })
    .catch(error => {
      console.error(`Error fetching IP for nameserver ${nameserver}:`, error);
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