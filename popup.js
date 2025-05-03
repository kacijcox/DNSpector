document.addEventListener('DOMContentLoaded', function() {
    // Tab functionality
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabPanes = document.querySelectorAll('.tab-pane');
    
    tabButtons.forEach(button => {
      button.addEventListener('click', () => {
        // Remove active class from all buttons and panes
        tabButtons.forEach(btn => btn.classList.remove('active'));
        tabPanes.forEach(pane => pane.classList.remove('active'));
        
        // Add active class to clicked button and corresponding pane
        button.classList.add('active');
        const tabId = button.getAttribute('data-tab');
        document.getElementById(tabId).classList.add('active');
      });
    });
  
    // Get current tab URL
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      const currentTab = tabs[0];
      const url = new URL(currentTab.url);
      const domain = url.hostname;
      
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
      
      // Detect cloud provider
      detectCloudProvider(domain);
    });
  
    // Add console logs for debugging
    console.log('DNS & SSL Inspector popup initialized');
  });
  
  // Function to fetch DNS records using Chrome extension messaging
  function loadDnsRecords(domain) {
    console.log('Loading DNS records for:', domain);
    
    const dnsLoader = document.getElementById('dns-loader');
    
    // Define record types to fetch
    const recordTypes = ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'CAA'];
    
    // Fetch each record type
    recordTypes.forEach(type => {
      fetchDnsRecords(domain, type);
    });
    
    // Hide loader after a delay (assuming all APIs respond within 3 seconds)
    setTimeout(() => {
      dnsLoader.classList.add('hidden');
    }, 3000);
  }
  
  function fetchDnsRecords(domain, recordType) {
    console.log(`Fetching ${recordType} records for`, domain);
    
    const recordsContainer = document.getElementById(`${recordType.toLowerCase()}-records`);
    
    // Show loading message
    recordsContainer.textContent = 'Loading...';
    
    // Send message to background script to fetch DNS records
    chrome.runtime.sendMessage(
      {
        action: "getDnsRecords",
        domain: domain,
        recordType: recordType
      }, 
      function(response) {
        console.log(`Received ${recordType} response:`, response);
        
        if (chrome.runtime.lastError) {
          console.error(`Error fetching ${recordType} records:`, chrome.runtime.lastError);
          recordsContainer.textContent = `Error: ${chrome.runtime.lastError.message}`;
          return;
        }
        
        if (!response || !response.success) {
          const errorMsg = response ? response.error || 'Unknown error' : 'No response received';
          console.error(`Error in ${recordType} response:`, errorMsg);
          recordsContainer.textContent = `Error: ${errorMsg}`;
          return;
        }
        
        const data = response.records;
        
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
            default:
              displayText = answer.data;
          }
          
          // Add TTL info
          displayText += ` (TTL: ${answer.TTL}s)`;
          
          recordItem.textContent = displayText;
          recordsContainer.appendChild(recordItem);
        });
      }
    );
  }
  
  // Function to load SSL certificate information
  function loadSslCertificate(url) {
    console.log('Loading SSL certificate for:', url);
    
    const sslLoader = document.getElementById('ssl-loader');
    
    // Send message to background script to get SSL certificate info
    chrome.runtime.sendMessage(
      {
        action: "getSslCertificate",
        url: url
      }, 
      function(response) {
        console.log('Received SSL certificate response:', response);
        
        sslLoader.classList.add('hidden');
        
        if (chrome.runtime.lastError) {
          console.error('Error fetching SSL certificate:', chrome.runtime.lastError);
          document.getElementById('ssl-status-text').textContent = `Error: ${chrome.runtime.lastError.message}`;
          return;
        }
        
        if (!response || !response.success) {
          const errorMsg = response ? response.error || 'Unknown error' : 'No response received';
          console.error('Error in SSL certificate response:', errorMsg);
          document.getElementById('ssl-status-text').textContent = `Error: ${errorMsg}`;
          return;
        }
        
        const certData = response.certificate;
        
        // Update UI with certificate data
        document.getElementById('cert-subject').textContent = url.split('//')[1].split('/')[0]; // Extract domain from URL
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
        
        // Display certificate chain
        const chainContainer = document.getElementById('cert-chain');
        chainContainer.innerHTML = '';
        
        // In a real extension, we would show the actual certificate chain
        // For now, we're showing placeholder data
        ['Root Certificate Authority', 'Intermediate CA', url.split('//')[1].split('/')[0]].forEach((cert, index) => {
          const certItem = document.createElement('div');
          certItem.className = 'cert-chain-item';
          certItem.textContent = cert;
          chainContainer.appendChild(certItem);
          
          // Add arrow except for the last item
          if (index < 2) {
            const arrow = document.createElement('div');
            arrow.textContent = '↓';
            arrow.style.textAlign = 'center';
            arrow.style.margin = '5px 0';
            chainContainer.appendChild(arrow);
          }
        });
      }
    );
  }
  
  // Function to detect cloud provider
  function detectCloudProvider(domain) {
    console.log('Detecting cloud provider for:', domain);
    
    const cloudLoader = document.getElementById('cloud-loader');
    
    // Send message to background script to detect cloud provider
    chrome.runtime.sendMessage(
      {
        action: "getCloudProvider",
        domain: domain
      }, 
      function(response) {
        console.log('Received cloud provider response:', response);
        
        cloudLoader.classList.add('hidden');
        
        if (chrome.runtime.lastError) {
          console.error('Error detecting cloud provider:', chrome.runtime.lastError);
          document.getElementById('cloud-name').textContent = `Error: ${chrome.runtime.lastError.message}`;
          return;
        }
        
        if (!response || !response.success) {
          const errorMsg = response ? response.error || 'Unknown error' : 'No response received';
          console.error('Error in cloud provider response:', errorMsg);
          document.getElementById('cloud-name').textContent = `Error: ${errorMsg}`;
          return;
        }
        
        const cloudProvider = response.provider;
        
        // Map cloud provider to icon
        let icon = '☁️';
        if (cloudProvider.name.includes('AWS') || cloudProvider.name.includes('Amazon')) {
          icon = '☁️ AWS';
        } else if (cloudProvider.name.includes('Azure') || cloudProvider.name.includes('Microsoft')) {
          icon = '☁️ Azure';
        } else if (cloudProvider.name.includes('Google')) {
          icon = '☁️ GCP';
        } else if (cloudProvider.name.includes('Cloudflare')) {
          icon = '☁️ CF';
        }
        
        // Update UI with cloud provider info
        document.getElementById('cloud-icon').textContent = icon;
        document.getElementById('cloud-name').textContent = cloudProvider.name;
        
        // Add additional details if available
        let details = '';
        if (cloudProvider.ip) {
          details += `IP: ${cloudProvider.ip}`;
        }
        if (cloudProvider.confidence) {
          details += ` (${Math.round(cloudProvider.confidence * 100)}% confidence)`;
        }
        
        document.getElementById('cloud-details').textContent = details;
      }
    );
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