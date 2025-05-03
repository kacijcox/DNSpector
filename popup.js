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
  });
  
  // Function to fetch DNS records using public DNS API
  function loadDnsRecords(domain) {
    const dnsLoader = document.getElementById('dns-loader');
    
    // Define record types to fetch
    const recordTypes = ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'CAA'];
    
    // Fetch each record type
    recordTypes.forEach(type => {
      fetchDnsRecords(domain, type);
    });
    
    // Hide loader after a delay (assuming all APIs respond within 2 seconds)
    setTimeout(() => {
      dnsLoader.classList.add('hidden');
    }, 2000);
  }
  
  function fetchDnsRecords(domain, recordType) {
    // We'll use Google's Public DNS API through an HTTPS endpoint
    // Note: In a real extension, you would need a server proxy or use a different approach due to CORS
    // For demo purposes, we'll simulate the responses
    
    const recordsContainer = document.getElementById(`${recordType.toLowerCase()}-records`);
    
    // Simulate API call delay
    setTimeout(() => {
      // Simulate different records based on record type
      let records = [];
      
      switch(recordType) {
        case 'A':
          records = ['93.184.216.34', '93.184.216.35'];
          break;
        case 'AAAA':
          records = ['2606:2800:220:1:248:1893:25c8:1946'];
          break;
        case 'CNAME':
          records = ['example.com'];
          break;
        case 'MX':
          records = ['10 mail.example.com', '20 backup-mail.example.com'];
          break;
        case 'TXT':
          records = [
            'v=spf1 include:_spf.example.com -all',
            'google-site-verification=abcdefghijklmnopqrstuvwxyz'
          ];
          break;
        case 'CAA':
          records = ['0 issue "letsencrypt.org"', '0 issuewild "comodo.com"'];
          break;
        default:
          records = ['No records found'];
      }
      
      if (records.length === 0) {
        recordsContainer.textContent = 'No records found';
        return;
      }
      
      // Clear existing content
      recordsContainer.innerHTML = '';
      
      // Add records to container
      records.forEach(record => {
        const recordItem = document.createElement('div');
        recordItem.className = 'record-item';
        recordItem.textContent = record;
        recordsContainer.appendChild(recordItem);
      });
    }, 500);
  }
  
  // Function to load SSL certificate information
  function loadSslCertificate(url) {
    const sslLoader = document.getElementById('ssl-loader');
    
    // In a real extension, you would need to execute a content script or use native messaging
    // For demo purposes, we'll simulate the response
    
    setTimeout(() => {
      sslLoader.classList.add('hidden');
      
      // Simulate certificate data
      const certData = {
        subject: 'example.com',
        issuer: 'DigiCert Inc',
        validFrom: new Date(2023, 0, 1).toLocaleDateString(),
        validUntil: new Date(2024, 0, 1).toLocaleDateString(),
        tlsVersion: 'TLS 1.3',
        isValid: true,
        chain: [
          'CN=example.com, O=Example Inc, L=Mountain View, S=California, C=US',
          'CN=DigiCert TLS RSA SHA256 2020 CA1, O=DigiCert Inc, C=US',
          'CN=DigiCert Global Root CA, OU=www.digicert.com, O=DigiCert Inc, C=US'
        ]
      };
      
      // Update UI with certificate data
      document.getElementById('cert-subject').textContent = certData.subject;
      document.getElementById('cert-issuer').textContent = certData.issuer;
      document.getElementById('cert-valid-from').textContent = certData.validFrom;
      document.getElementById('cert-valid-until').textContent = certData.validUntil;
      document.getElementById('tls-version').textContent = certData.tlsVersion;
      
      // Set SSL status
      const sslIcon = document.getElementById('ssl-icon');
      const sslStatusText = document.getElementById('ssl-status-text');
      
      if (certData.isValid) {
        sslIcon.textContent = '🔒';
        sslIcon.className = 'status-secure';
        sslStatusText.textContent = 'Connection is secure';
        sslStatusText.className = 'status-secure';
      } else {
        sslIcon.textContent = '⚠️';
        sslIcon.className = 'status-warning';
        sslStatusText.textContent = 'Certificate has issues';
        sslStatusText.className = 'status-warning';
      }
      
      // Display certificate chain
      const chainContainer = document.getElementById('cert-chain');
      chainContainer.innerHTML = '';
      
      certData.chain.forEach((cert, index) => {
        const certItem = document.createElement('div');
        certItem.className = 'cert-chain-item';
        certItem.textContent = cert;
        chainContainer.appendChild(certItem);
        
        // Add arrow except for the last item
        if (index < certData.chain.length - 1) {
          const arrow = document.createElement('div');
          arrow.textContent = '↓';
          arrow.style.textAlign = 'center';
          arrow.style.margin = '5px 0';
          chainContainer.appendChild(arrow);
        }
      });
    }, 800);
  }
  
  // Function to detect cloud provider
  function detectCloudProvider(domain) {
    const cloudLoader = document.getElementById('cloud-loader');
    
    // In a real extension, you would analyze IP ranges, CNAME patterns, or HTTP headers
    // For demo purposes, we'll simulate the detection
    
    setTimeout(() => {
      cloudLoader.classList.add('hidden');
      
      // Simulate cloud detection
      let cloudProvider = {
        name: 'Amazon Web Services',
        icon: '☁️',
        details: 'Hosted in us-east-1 region'
      };
      
      // Update UI with cloud provider info
      document.getElementById('cloud-icon').textContent = cloudProvider.icon;
      document.getElementById('cloud-name').textContent = cloudProvider.name;
      document.getElementById('cloud-details').textContent = cloudProvider.details;
    }, 1000);
  }