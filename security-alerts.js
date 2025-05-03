/**
 * Security alerts and checks for DNS & SSL Inspector
 */

/**
 * Security issues to check for in DNS records
 */
const dnsSecurityChecks = {
    /**
     * Check for missing SPF records
     * @param {Object} txtRecords - TXT records from DNS
     * @returns {Object} - Security check result
     */
    checkSPF: function(txtRecords) {
      if (!txtRecords || !txtRecords.Answer || txtRecords.Answer.length === 0) {
        return {
          status: 'warning',
          message: 'No TXT records found, cannot verify SPF configuration',
          severity: 'medium'
        };
      }
      
      const hasSPF = txtRecords.Answer.some(record => {
        return record.data && record.data.toLowerCase().includes('v=spf1');
      });
      
      if (!hasSPF) {
        return {
          status: 'warning',
          message: 'No SPF record found. SPF helps prevent email spoofing.',
          severity: 'high',
          recommendation: 'Add an SPF record to define which mail servers are authorized to send email from this domain.'
        };
      }
      
      return {
        status: 'success',
        message: 'SPF record found',
        severity: 'none'
      };
    },
    
    /**
     * Check for missing DMARC records
     * @param {string} domain - Domain to check
     * @returns {Promise<Object>} - Security check result
     */
    checkDMARC: async function(domain) {
      try {
        // Check for DMARC record at _dmarc.domain.com
        const dmarcDomain = `_dmarc.${domain}`;
        const response = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(dmarcDomain)}&type=TXT`);
        const data = await response.json();
        
        if (!data.Answer || data.Answer.length === 0) {
          return {
            status: 'warning',
            message: 'No DMARC record found. DMARC helps prevent email spoofing and improves deliverability.',
            severity: 'high',
            recommendation: 'Add a DMARC record to specify policy for handling emails that fail SPF or DKIM checks.'
          };
        }
        
        const hasDMARC = data.Answer.some(record => {
          return record.data && record.data.toLowerCase().includes('v=dmarc1');
        });
        
        if (!hasDMARC) {
          return {
            status: 'warning',
            message: 'No valid DMARC record found.',
            severity: 'high',
            recommendation: 'Add a DMARC record with a v=DMARC1 tag.'
          };
        }
        
        return {
          status: 'success',
          message: 'DMARC record found',
          severity: 'none'
        };
      } catch (error) {
        console.error('Error checking DMARC record:', error);
        return {
          status: 'error',
          message: 'Error checking DMARC record',
          severity: 'unknown'
        };
      }
    },
    
    /**
     * Check for DNSSEC configuration
     * @param {Object} nsRecords - NS records from DNS
     * @returns {Object} - Security check result
     */
    checkDNSSEC: function(nsRecords) {
      // This is a simplified check - in a real extension
      // we would check for DS records and AD flag
      
      // For now we'll just check if the DO flag was set and an RRSIG was returned
      if (!nsRecords.AD) {
        return {
          status: 'info',
          message: 'DNSSEC validation not detected. DNSSEC adds authentication to DNS lookups.',
          severity: 'medium',
          recommendation: 'Consider implementing DNSSEC for additional DNS security.'
        };
      }
      
      return {
        status: 'success',
        message: 'DNSSEC appears to be enabled',
        severity: 'none'
      };
    },
    
    /**
     * Check for CAA records
     * @param {Object} caaRecords - CAA records from DNS
     * @returns {Object} - Security check result
     */
    checkCAA: function(caaRecords) {
      if (!caaRecords || !caaRecords.Answer || caaRecords.Answer.length === 0) {
        return {
          status: 'info',
          message: 'No CAA records found. CAA records restrict which Certificate Authorities can issue certificates for your domain.',
          severity: 'medium',
          recommendation: 'Consider adding CAA records to prevent unauthorized certificate issuance.'
        };
      }
      
      return {
        status: 'success',
        message: 'CAA records found',
        severity: 'none'
      };
    }
  };
  
  /**
   * Security issues to check for in SSL certificates
   */
  const sslSecurityChecks = {
    /**
     * Check if HTTPS is being used
     * @param {string} url - URL to check
     * @returns {Object} - Security check result
     */
    checkHTTPS: function(url) {
      const isHttps = url.startsWith('https://');
      
      if (!isHttps) {
        return {
          status: 'warning',
          message: 'This site is not using HTTPS. Communications are not encrypted.',
          severity: 'high',
          recommendation: 'Implement HTTPS to secure communications between visitors and your website.'
        };
      }
      
      return {
        status: 'success',
        message: 'Site is using HTTPS',
        severity: 'none'
      };
    },
    
    /**
     * Check certificate expiration
     * @param {Object} certData - Certificate data
     * @returns {Object} - Security check result
     */
    checkCertExpiration: function(certData) {
      if (!certData || !certData.validUntil || certData.validUntil === 'N/A') {
        return {
          status: 'error',
          message: 'Cannot determine certificate expiration date',
          severity: 'unknown'
        };
      }
      
      const expiryDate = new Date(certData.validUntil);
      const now = new Date();
      const daysUntilExpiry = Math.floor((expiryDate - now) / (1000 * 60 * 60 * 24));
      
      if (daysUntilExpiry < 0) {
        return {
          status: 'danger',
          message: 'SSL certificate has expired!',
          severity: 'critical',
          recommendation: 'Renew the SSL certificate immediately.'
        };
      }
      
      if (daysUntilExpiry < 30) {
        return {
          status: 'warning',
          message: `SSL certificate expires in ${daysUntilExpiry} days`,
          severity: 'high',
          recommendation: 'Plan to renew the SSL certificate soon.'
        };
      }
      
      return {
        status: 'success',
        message: `SSL certificate is valid for ${daysUntilExpiry} more days`,
        severity: 'none'
      };
    }
  };
  
  /**
   * Run all security checks and display results
   * @param {Object} dnsData - All DNS records
   * @param {Object} sslData - SSL certificate data
   * @param {string} domain - Domain being checked
   * @param {string} url - Full URL being checked
   */
  async function runSecurityChecks(dnsData, sslData, domain, url) {
    const results = [];
    
    // Run DNS security checks
    if (dnsData && dnsData.TXT) {
      results.push(dnsSecurityChecks.checkSPF(dnsData.TXT));
    }
    
    if (dnsData && dnsData.NS) {
      results.push(dnsSecurityChecks.checkDNSSEC(dnsData.NS));
    }
    
    if (dnsData && dnsData.CAA) {
      results.push(dnsSecurityChecks.checkCAA(dnsData.CAA));
    }
    
    // Check DMARC (async)
    const dmarcResult = await dnsSecurityChecks.checkDMARC(domain);
    results.push(dmarcResult);
    
    // Run SSL security checks
    results.push(sslSecurityChecks.checkHTTPS(url));
    
    if (sslData) {
      results.push(sslSecurityChecks.checkCertExpiration(sslData));
    }
    
    // Check if domain is suspicious
    if (window.SecurityUtils && window.SecurityUtils.isSuspiciousDomain(domain)) {
      results.push({
        status: 'danger',
        message: 'This domain matches patterns commonly used in phishing attacks',
        severity: 'critical',
        recommendation: 'Proceed with extreme caution when visiting this site.'
      });
    }
    
    return results;
  }
  
  /**
   * Display security alerts in the UI
   * @param {Array} securityResults - Results of security checks
   * @param {HTMLElement} containerElement - Element to display results in
   */
  function displaySecurityAlerts(securityResults, containerElement) {
    if (!containerElement || !securityResults || !Array.isArray(securityResults)) {
      return;
    }
    
    // Clear the container
    containerElement.innerHTML = '';
    
    // Create a heading
    const heading = document.createElement('h3');
    heading.textContent = 'Security Check Results';
    containerElement.appendChild(heading);
    
    // Group results by severity
    const criticalIssues = securityResults.filter(r => r.severity === 'critical');
    const highIssues = securityResults.filter(r => r.severity === 'high');
    const mediumIssues = securityResults.filter(r => r.severity === 'medium');
    const infoIssues = securityResults.filter(r => r.severity === 'unknown' || r.severity === 'low');
    const passedChecks = securityResults.filter(r => r.severity === 'none');
    
    // Count issues
    const totalIssues = criticalIssues.length + highIssues.length + mediumIssues.length;
    
    // Add summary
    const summary = document.createElement('div');
    summary.className = 'security-summary';
    
    if (totalIssues === 0) {
      summary.innerHTML = `
        <div class="security-status success">
          <span class="security-icon">✅</span>
          <span>No security issues found</span>
        </div>
      `;
    } else {
      summary.innerHTML = `
        <div class="security-status ${criticalIssues.length > 0 ? 'critical' : highIssues.length > 0 ? 'warning' : 'info'}">
          <span class="security-icon">${criticalIssues.length > 0 ? '⚠️' : highIssues.length > 0 ? '⚠️' : 'ℹ️'}</span>
          <span>${totalIssues} security ${totalIssues === 1 ? 'issue' : 'issues'} found</span>
        </div>
      `;
    }
    
    containerElement.appendChild(summary);
    
    // Add details for each issue category
    const addIssueCategory = (issues, title, className) => {
      if (issues.length === 0) return;
      
      const category = document.createElement('div');
      category.className = `security-category ${className}`;
      
      const categoryTitle = document.createElement('h4');
      categoryTitle.textContent = title;
      category.appendChild(categoryTitle);
      
      const issuesList = document.createElement('ul');
      issues.forEach(issue => {
        const item = document.createElement('li');
        item.textContent = issue.message;
        
        if (issue.recommendation) {
          const recommendation = document.createElement('p');
          recommendation.className = 'recommendation';
          recommendation.textContent = issue.recommendation;
          item.appendChild(recommendation);
        }
        
        issuesList.appendChild(item);
      });
      
      category.appendChild(issuesList);
      containerElement.appendChild(category);
    };
    
    addIssueCategory(criticalIssues, 'Critical Issues', 'critical');
    addIssueCategory(highIssues, 'High Priority Issues', 'high');
    addIssueCategory(mediumIssues, 'Medium Priority Issues', 'medium');
    addIssueCategory(infoIssues, 'Informational', 'info');
    
    // Add passed checks in a collapsible section
    if (passedChecks.length > 0) {
      const passedContainer = document.createElement('details');
      const summary = document.createElement('summary');
      summary.textContent = `${passedChecks.length} Passed Checks`;
      passedContainer.appendChild(summary);
      
      const passedList = document.createElement('ul');
      passedList.className = 'passed-checks';
      
      passedChecks.forEach(check => {
        const item = document.createElement('li');
        item.textContent = check.message;
        passedList.appendChild(item);
      });
      
      passedContainer.appendChild(passedList);
      containerElement.appendChild(passedContainer);
    }
  }
  
  // Export functions
  window.SecurityAlerts = {
    runSecurityChecks,
    displaySecurityAlerts
  };