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
      
      // Sanitize domain for security
      const sanitizedDomain = window.SecurityUtils ? 
        window.SecurityUtils.sanitizeDomain(domain) : domain;
      
      // Display current URL
      document.getElementById('current-url').textContent = sanitizedDomain;
      
      // Add favicon
      const faviconContainer = document.getElementById('favicon-container');
      const faviconImg = document.createElement('img');
      faviconImg.src = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(sanitizedDomain)}`;
      faviconContainer.appendChild(faviconImg);
      
      // Load DNS information
      loadDnsRecords(sanitizedDomain);
      
      // Load SSL Certificate information
      loadSslCertificate(currentTab.url);
      
      // Detect cloud provider
      detectCloudProvider(sanitizedDomain);
      
      // Run initial security check
      runSecurityCheck(sanitizedDomain, currentTab.url);
      
      // Initialize settings
      initializeSettings();
    });
  
    // Set up button listeners
    document.getElementById('btn-run-security-check')?.addEventListener('click', () => {
      // Get current tab URL again
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        const currentTab = tabs[0];
        const url = new URL(currentTab.url);
        const domain = url.hostname;
        
        // Sanitize domain for security
        const sanitizedDomain = window.SecurityUtils ? 
          window.SecurityUtils.sanitizeDomain(domain) : domain;
        
        // Run security check
        runSecurityCheck(sanitizedDomain, currentTab.url);
      });
    });
    
    document.getElementById('btn-clear-session')?.addEventListener('click', () => {
      // Send message to clear session data
      chrome.runtime.sendMessage(
        { action: "clearSessionData" },
        function(response) {
          if (response && response.success) {
            alert('Session data cleared successfully');
            
            // Refresh the current tab
            window.close();
          } else {
            alert('Failed to clear session data');
          }
        }
      );
    });
  });
  
  // Function to fetch DNS records using Chrome extension messaging
  function loadDnsRecords(domain) {
    console.log('Loading DNS records for:', domain);
    
    const dnsLoader = document.getElementById('dns-loader');
    
    // Define record types to fetch
    const recordTypes = ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'CAA'];
    
    // Create a container to store all the DNS results
    const allDnsRecords = {};
    
    // Fetch each record type
    recordTypes.forEach(type => {
      fetchDnsRecords(domain, type, allDnsRecords);
    });
    
    // Hide loader after a delay (assuming all APIs respond within 3 seconds)
    setTimeout(() => {
      dnsLoader.classList.add('hidden');
    }, 3000);
  }
  
  function fetchDnsRecords(domain, recordType, allRecordsContainer) {
    console.log(`Fetching ${recordType} records for`, domain);
    
    const recordsContainer = document.getElementById(`${recordType.toLowerCase()}-records`);
    
    // Show loading message
    recordsContainer.textContent = 'Loading...';
    
    // Check if we have cached results in session
    if (window.SessionData) {
      const cachedData = window.SessionData.getDnsRecords(domain);
      if (cachedData && cachedData.records && cachedData.records[recordType]) {
        console.log(`Using cached ${recordType} records for ${domain}`);
        
        // Update the allRecordsContainer
        if (allRecordsContainer) {
          allRecordsContainer[recordType] = cachedData.records[recordType];
        }
        
        updateDnsRecordDisplay(recordType, cachedData.records[recordType], recordsContainer);
        return;
      }
    }
    
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
        
        // Store in session data if available
        if (window.SessionData) {
          const currentRecords = window.SessionData.getDnsRecords(domain) || { records: {} };
          currentRecords.records[recordType] = data;
          window.SessionData.storeDnsRecords(domain, currentRecords.records);
        }
        
        // Update the allRecordsContainer
        if (allRecordsContainer) {
          allRecordsContainer[recordType] = data;
        }
        
        updateDnsRecordDisplay(recordType, data, recordsContainer);
      }
    );
  }
  
  function updateDnsRecordDisplay(recordType, data, recordsContainer) {
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
      
      // Use security utilities to safely set text content
      if (window.SecurityUtils) {
        window.SecurityUtils.setTextContentSafely(recordItem, displayText);
      } else {
        recordItem.textContent = displayText;
      }
      
      recordsContainer.appendChild(recordItem);
    });
  }
  
  // Function to load SSL certificate information
  function loadSslCertificate(url) {
    console.log('Loading SSL certificate for:', url);
    
    const sslLoader = document.getElementById('ssl-loader');
    
    // Check if we have cached results in session
    if (window.SessionData) {
      const domain = new URL(url).hostname;
      const cachedData = window.SessionData.getSslInfo(domain);
      if (cachedData && cachedData.certificate) {
        console.log(`Using cached SSL data for ${domain}`);
        updateSslDisplay(cachedData.certificate, url);
        sslLoader.classList.add('hidden');
        return;
      }
    }
    
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
        
        // Store in session data if available
        if (window.SessionData) {
          const domain = new URL(url).hostname;
          window.SessionData.storeSslInfo(domain, certData);
        }
        
        updateSslDisplay(certData, url);
      }
    );
  }
  
  function updateSslDisplay(certData, url) {
    // Update UI with certificate data
    const domain = url.split('//')[1].split('/')[0]; // Extract domain from URL
    
    // Use security utilities to safely set text content
    if (window.SecurityUtils) {
      window.SecurityUtils.setTextContentSafely(document.getElementById('cert-subject'), domain);
      window.SecurityUtils.setTextContentSafely(document.getElementById('cert-issuer'), certData.issuer);
      window.SecurityUtils.setTextContentSafely(document.getElementById('cert-valid-from'), formatDate(certData.validFrom));
      window.SecurityUtils.setTextContentSafely(document.getElementById('cert-valid-until'), formatDate(certData.validUntil));
      window.SecurityUtils.setTextContentSafely(document.getElementById('tls-version'), certData.protocol);
    } else {
      document.getElementById('cert-subject').textContent = domain;
      document.getElementById('cert-issuer').textContent = certData.issuer;
      document.getElementById('cert-valid-from').textContent = formatDate(certData.validFrom);
      document.getElementById('cert-valid-until').textContent = formatDate(certData.validUntil);
      document.getElementById('tls-version').textContent = certData.protocol;
    }
    
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
    ['Root Certificate Authority', 'Intermediate CA', domain].forEach((cert, index) => {
      const certItem = document.createElement('div');
      certItem.className = 'cert-chain-item';
      
      // Use security utilities to safely set text content
      if (window.SecurityUtils) {
        window.SecurityUtils.setTextContentSafely(certItem, cert);
      } else {
        certItem.textContent = cert;
      }
      
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
  
  // Function to detect cloud provider
  function detectCloudProvider(domain) {
    console.log('Detecting cloud provider for:', domain);
    
    const cloudLoader = document.getElementById('cloud-loader');
    
    // Check if we have cached results in session
    if (window.SessionData) {
      const cachedData = window.SessionData.get(`cloud_${domain}`);
      if (cachedData) {
        console.log(`Using cached cloud provider data for ${domain}`);
        updateCloudProviderDisplay(cachedData);
        cloudLoader.classList.add('hidden');
        return;
      }
    }
    
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
        
        // Store in session data if available
        if (window.SessionData) {
          window.SessionData.set(`cloud_${domain}`, cloudProvider, 10 * 60 * 1000);
        }
        
        updateCloudProviderDisplay(cloudProvider);
      }
    );
  }
  
  function updateCloudProviderDisplay(cloudProvider) {
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
    
    // Use security utilities to safely set text content
    if (window.SecurityUtils) {
      window.SecurityUtils.setTextContentSafely(document.getElementById('cloud-name'), cloudProvider.name);
    } else {
      document.getElementById('cloud-name').textContent = cloudProvider.name;
    }
    
    // Add additional details if available
    let details = '';
    if (cloudProvider.ip) {
      details += `IP: ${cloudProvider.ip}`;
    }
    if (cloudProvider.confidence) {
      details += ` (${Math.round(cloudProvider.confidence * 100)}% confidence)`;
    }
    
    // Use security utilities to safely set text content
    if (window.SecurityUtils) {
      window.SecurityUtils.setTextContentSafely(document.getElementById('cloud-details'), details);
    } else {
      document.getElementById('cloud-details').textContent = details;
    }
  }
  
  // Function to run security check
  async function runSecurityCheck(domain, url) {
    console.log('Running security check for:', domain);
    
    const securityLoader = document.getElementById('security-loader');
    if (securityLoader) {
      securityLoader.classList.remove('hidden');
    }
    
    // Check if we have cached results in session
    if (window.SecurityUtils && window.SecurityAlerts && window.SessionData) {
      const cachedData = window.SessionData.getSecurityResults(domain);
      if (cachedData && cachedData.results) {
        console.log(`Using cached security results for ${domain}`);
        window.SecurityAlerts.displaySecurityAlerts(
          cachedData.results, 
          document.getElementById('security-alerts')
        );
        
        if (securityLoader) {
          securityLoader.classList.add('hidden');
        }
        return;
      }
    }
    
    // Collect all the data we need for the security check
    const dnsData = {};
    const sslData = {};
    
    // Wait for DNS records to load
    const recordTypes = ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'CAA'];
    
    // Get DNS records from session data if available
    if (window.SessionData) {
      const cachedDnsData = window.SessionData.getDnsRecords(domain);
      if (cachedDnsData && cachedDnsData.records) {
        Object.assign(dnsData, cachedDnsData.records);
      }
    }
    
    // Get SSL data from session if available
    if (window.SessionData) {
      const cachedSslData = window.SessionData.getSslInfo(domain);
      if (cachedSslData && cachedSslData.certificate) {
        Object.assign(sslData, cachedSslData.certificate);
      }
    }
    
    // If we don't have data in session yet, wait a bit and try to load directly
    if (Object.keys(dnsData).length === 0 || Object.keys(sslData).length === 0) {
      // Wait for 2 seconds to allow other data to load
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Load DNS records directly if needed
      if (Object.keys(dnsData).length === 0) {
        for (const type of recordTypes) {
          await new Promise(resolve => {
            chrome.runtime.sendMessage(
              {
                action: "getDnsRecords",
                domain: domain,
                recordType: type
              }, 
              function(response) {
                if (response && response.success) {
                  dnsData[type] = response.records;
                }
                resolve();
              }
            );
          });
        }
      }
      
      // Load SSL data directly if needed
      if (Object.keys(sslData).length === 0) {
        await new Promise(resolve => {
          chrome.runtime.sendMessage(
            {
              action: "getSslCertificate",
              url: url
            }, 
            function(response) {
              if (response && response.success) {
                Object.assign(sslData, response.certificate);
              }
              resolve();
            }
          );
        });
      }
    }
    
    // Now run the security checks
    if (window.SecurityAlerts) {
      const results = await window.SecurityAlerts.runSecurityChecks(dnsData, sslData, domain, url);
      
      // Store results in session
      if (window.SessionData) {
        window.SessionData.storeSecurityResults(domain, results);
      }
      
      // Display results
      window.SecurityAlerts.displaySecurityAlerts(
        results, 
        document.getElementById('security-alerts')
      );
    } else {
      // If SecurityAlerts is not available, show basic information
      const securityAlertsElement = document.getElementById('security-alerts');
      if (securityAlertsElement) {
        securityAlertsElement.innerHTML = '<div class="security-status info"><span>Security module not loaded. Basic inspection only.</span></div>';
      }
    }
    
    if (securityLoader) {
      securityLoader.classList.add('hidden');
    }
  }
  
  // Function to initialize settings tab
  function initializeSettings() {
    // Get session start time
    chrome.runtime.sendMessage(
      { action: "getSessionStatus" },
      function(response) {
        if (response && response.success) {
          const sessionInfo = response.sessionInfo;
          const sessionStartElement = document.getElementById('session-start-time');
          
          if (sessionStartElement && sessionInfo.sessionStart) {
            const startTime = new Date(sessionInfo.sessionStart);
            sessionStartElement.textContent = startTime.toLocaleTimeString();
          }
        }
      }
    );
    
    // Add temporary data notification
    const settingsGroup = document.querySelector('.settings-group');
    if (settingsGroup) {
      const tempDataInfo = document.createElement('div');
      tempDataInfo.className = 'temp-data-info';
      tempDataInfo.innerHTML = `
        <span class="icon">ℹ️</span>
        <span>For enhanced security, all data is stored in memory only and is automatically cleared when you close your browser.</span>
      `;
      settingsGroup.appendChild(tempDataInfo);
    }
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