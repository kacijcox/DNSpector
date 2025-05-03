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
        console.log('Using session DNS data for security checks:', cachedDnsData.records);
        Object.assign(dnsData, cachedDnsData.records);
      }
    }
    
    // Get SSL data from session if available
    if (window.SessionData) {
      const cachedSslData = window.SessionData.getSslInfo(domain);
      if (cachedSslData && cachedSslData.certificate) {
        console.log('Using session SSL data for security checks:', cachedSslData.certificate);
        Object.assign(sslData, cachedSslData.certificate);
      }
    }
    
    // If we don't have data in session yet, wait a bit and try to load directly
    if (Object.keys(dnsData).length === 0 || Object.keys(sslData).length === 0) {
      console.log('Missing data for security checks, fetching directly');
      
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
                  console.log(`Received ${type} DNS records for security checks:`, response.records);
                  dnsData[type] = response.records;
                } else {
                  console.log(`Failed to get ${type} DNS records for security checks`);
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
                console.log('Received SSL certificate for security checks:', response.certificate);
                Object.assign(sslData, response.certificate);
              } else {
                console.log('Failed to get SSL certificate for security checks');
              }
              resolve();
            }
          );
        });
      }
    }
    
    console.log('Final data for security checks:', { dnsData, sslData, domain, url });
    
    // Now run the security checks
    if (window.SecurityAlerts) {
      const results = await window.SecurityAlerts.runSecurityChecks(dnsData, sslData, domain, url);
      console.log('Security check results:', results);
      
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