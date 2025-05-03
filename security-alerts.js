/**
 * Security alerts and checks for DNS & SSL Inspector
 */

/**
 * Security issues to check for in DNS records
 */
const dnsSecurityChecks = {
  /**
   * Check for missing SPF records
   * @param {Object} dnsData - All DNS records
   * @returns {Object} - Security check result
   */
  checkSPF: function(dnsData) {
    if (!dnsData || !dnsData.TXT || !dnsData.TXT.Answer || dnsData.TXT.Answer.length === 0) {
      return {
        status: 'warning',
        message: 'No TXT records found, cannot verify SPF configuration',
        severity: 'medium'
      };
    }
    
    // Directly check the actual TXT records
    const hasSPF = dnsData.TXT.Answer.some(record => {
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
   * @param {Object} dnsData - All DNS records
   * @param {string} domain - Domain being checked
   * @returns {Object} - Security check result
   */
  checkDMARC: function(dnsData, domain) {
    // For real extension, we'd fetch the _dmarc.domain.com TXT record
    // For now, we'll check the existing TXT records for any DMARC entries
    if (!dnsData || !dnsData.TXT || !dnsData.TXT.Answer || dnsData.TXT.Answer.length === 0) {
      return {
        status: 'warning',
        message: 'No TXT records found, cannot verify DMARC configuration',
        severity: 'medium'
      };
    }
    
    const hasDMARC = dnsData.TXT.Answer.some(record => {
      return record.data && record.data.toLowerCase().includes('v=dmarc1');
    });
    
    if (!hasDMARC) {
      return {
        status: 'warning',
        message: 'No DMARC record found. DMARC helps prevent email spoofing and improves deliverability.',
        severity: 'high',
        recommendation: 'Add a DMARC record to specify policy for handling emails that fail SPF or DKIM checks.'
      };
    }
    
    return {
      status: 'success',
      message: 'DMARC record found',
      severity: 'none'
    };
  },
  
  /**
   * Check for DNSSEC configuration
   * @param {Object} dnsData - All DNS records
   * @returns {Object} - Security check result
   */
  checkDNSSEC: function(dnsData) {
    // In real extension, we'd look for DS records and AD flag
    // For now, we'll just look for RRSIG records in the data
    
    let hasDNSSEC = false;
    
    // Look for RRSIG records in any record type
    for (const recordType in dnsData) {
      if (dnsData[recordType] && dnsData[recordType].AD === true) {
        hasDNSSEC = true;
        break;
      }
    }
    
    if (!hasDNSSEC) {
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
   * @param {Object} dnsData - All DNS records
   * @returns {Object} - Security check result
   */
  checkCAA: function(dnsData) {
    if (!dnsData || !dnsData.CAA || !dnsData.CAA.Answer || dnsData.CAA.Answer.length === 0) {
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
  },
  
  /**
   * Check for MX records
   * @param {Object} dnsData - All DNS records
   * @returns {Object} - Security check result
   */
  checkMXRecords: function(dnsData) {
    if (!dnsData || !dnsData.MX || !dnsData.MX.Answer || dnsData.MX.Answer.length === 0) {
      return {
        status: 'info',
        message: 'No MX records found. This domain may not be configured to receive email.',
        severity: 'low'
      };
    }
    
    return {
      status: 'success',
      message: 'MX records found',
      severity: 'none'
    };
  },
  
  /**
   * Check for wildcard DNS records
   * @param {Object} dnsData - All DNS records
   * @returns {Object} - Security check result
   */
  checkWildcardRecords: function(dnsData) {
    // Look for wildcard records in any DNS type
    let hasWildcard = false;
    
    for (const recordType in dnsData) {
      if (dnsData[recordType] && dnsData[recordType].Answer) {
        for (const answer of dnsData[recordType].Answer) {
          if (answer.name && answer.name.includes('*')) {
            hasWildcard = true;
            break;
          }
        }
        if (hasWildcard) break;
      }
    }
    
    if (hasWildcard) {
      return {
        status: 'info',
        message: 'Wildcard DNS records detected. While legitimate, they can sometimes be a security risk.',
        severity: 'low',
        recommendation: 'Review wildcard DNS records to ensure they serve a specific purpose.'
      };
    }
    
    return {
      status: 'success',
      message: 'No wildcard DNS records detected',
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
 * Run all security checks and return results
 * @param {Object} dnsData - All DNS records
 * @param {Object} sslData - SSL certificate data
 * @param {string} domain - Domain being checked
 * @param {string} url - Full URL being checked
 * @returns {Array} - Security check results
 */
function runSecurityChecks(dnsData, sslData, domain, url) {
  console.log('Running security checks with data:', { dnsData, sslData, domain, url });
  
  const results = [];
  
  // Run DNS security checks if we have DNS data
  if (dnsData) {
    // Add debug output to see what's actually in the DNS data
    console.log('DNS data available for security checks:', dnsData);
    
    // Check SPF
    results.push(dnsSecurityChecks.checkSPF(dnsData));
    
    // Check DMARC
    results.push(dnsSecurityChecks.checkDMARC(dnsData, domain));
    
    // Check DNSSEC
    results.push(dnsSecurityChecks.checkDNSSEC(dnsData));
    
    // Check CAA records
    results.push(dnsSecurityChecks.checkCAA(dnsData));
    
    // Check MX records
    results.push(dnsSecurityChecks.checkMXRecords(dnsData));
    
    // Check wildcard records
    results.push(dnsSecurityChecks.checkWildcardRecords(dnsData));
  } else {
    console.log('No DNS data available for security checks');
    results.push({
      status: 'error',
      message: 'No DNS data available for security checks',
      severity: 'unknown'
    });
  }
  
  // Run SSL security checks
  results.push(sslSecurityChecks.checkHTTPS(url));
  
  if (sslData) {
    console.log('SSL data available for security checks:', sslData);
    results.push(sslSecurityChecks.checkCertExpiration(sslData));
  } else {
    console.log('No SSL data available for security checks');
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
  
  console.log('Displaying security alerts:', securityResults);
  
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
      if (window.SecurityUtils) {
        window.SecurityUtils.setTextContentSafely(item, issue.message);
      } else {
        item.textContent = issue.message;
      }
      
      if (issue.recommendation) {
        const recommendation = document.createElement('p');
        recommendation.className = 'recommendation';
        if (window.SecurityUtils) {
          window.SecurityUtils.setTextContentSafely(recommendation, issue.recommendation);
        } else {
          recommendation.textContent = issue.recommendation;
        }
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
      if (window.SecurityUtils) {
        window.SecurityUtils.setTextContentSafely(item, check.message);
      } else {
        item.textContent = check.message;
      }
      passedList.appendChild(item);
    });
    
    passedContainer.appendChild(passedList);
    containerElement.appendChild(passedContainer);
  }
  
  // Add temporary data notice
  const tempDataNotice = document.createElement('div');
  tempDataNotice.className = 'temp-data-info';
  tempDataNotice.innerHTML = `
    <span class="icon">🔒</span>
    <span>All security scan results are stored in memory only and are automatically cleared when you close your browser.</span>
  `;
  containerElement.appendChild(tempDataNotice);
}

// Export functions
window.SecurityAlerts = {
  runSecurityChecks,
  displaySecurityAlerts
};

// Verify module is loaded properly
console.log('SecurityAlerts module loaded and attached to window:', !!window.SecurityAlerts);