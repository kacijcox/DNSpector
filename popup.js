document.addEventListener('DOMContentLoaded', function() {
  // Get current tab URL
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    const currentTab = tabs[0];
    const url = new URL(currentTab.url);
    
    // Extract base domain instead of using hostname directly
    const hostname = url.hostname;
    const domain = extractBaseDomain(hostname);
    
    console.log("Current hostname:", hostname);
    console.log("Base domain for DNS lookup:", domain);
    
    // Display current URL
    document.getElementById('current-url').textContent = hostname;
    
    // Add favicon
    const faviconContainer = document.getElementById('favicon-container');
    const faviconImg = document.createElement('img');
    faviconImg.src = `https://www.google.com/s2/favicons?domain=${hostname}`;
    faviconContainer.appendChild(faviconImg);
    
    // Load DNS information for the base domain to get correct records
    loadDnsRecords(domain);
  });
});

// Function to extract base domain from hostname
function extractBaseDomain(hostname) {
  // If it starts with www., strip it off
  let domain = hostname;
  if (domain.startsWith('www.')) {
    domain = domain.substring(4);
  }
  
  // For subdomains, we might want to query the base domain for NS records
  // Only keep the last two parts for common TLDs, or last three for country-specific TLDs
  const parts = domain.split('.');
  if (parts.length > 2) {
    // Handle special cases like .co.uk, .com.au, etc.
    const lastPart = parts[parts.length - 1];
    const secondLastPart = parts[parts.length - 2];
    
    if ((lastPart.length === 2 && secondLastPart.length <= 3) || 
        ['com', 'org', 'net', 'edu', 'gov', 'mil'].includes(secondLastPart)) {
      // Country code TLD with special second level
      if (parts.length > 3) {
        domain = parts.slice(-3).join('.');
      }
    } else {
      // Normal TLD
      domain = parts.slice(-2).join('.');
    }
  }
  
  console.log(`Extracted base domain: ${domain}`);
  return domain;
}

// Function to fetch DNS records
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

  // Define DNS providers - ONLY use Google DNS initially since it's working
  const dnsProviders = [
    { 
      name: 'Google DNS', 
      fetchFunction: fetchFromGoogleDNS 
    }
    // Temporarily removing other providers until we fix the CSP issues
  ];
  
  // Use Promise.all for better parallel fetching
  const fetchPromises = [];
  
  // Create an object to store all records from all providers
  const allRecords = {};
  recordTypes.forEach(type => {
    allRecords[type] = [];
  });
  
  // Create all fetch promises
  dnsProviders.forEach(provider => {
    recordTypes.forEach(type => {
      // Add debugging code to verify if fetch requests are actually being made
      console.log(`Creating fetch request for ${type} records from ${provider.name}`);
      
      const promise = provider.fetchFunction(domain, type)
        .then(records => {
          // Store records from this provider
          if (records && records.length > 0) {
            console.log(`Got ${records.length} ${type} records from ${provider.name}:`, records);
            const recordsWithProvider = records.map(record => ({
              ...record,
              provider: provider.name
            }));
            // Add to our collection
            allRecords[type] = [...allRecords[type], ...recordsWithProvider];
          } else {
            console.log(`No ${type} records from ${provider.name}`);
          }
        })
        .catch(error => {
          console.error(`Error fetching ${type} records from ${provider.name}:`, error);
        });
      
      fetchPromises.push(promise);
    });
  });
  
  // Wait for all fetches to complete
  Promise.allSettled(fetchPromises)
    .then(results => {
      console.log('All DNS queries completed');
      console.log('Aggregated records:', allRecords);
      
      // Check if we got NS records
      const nsRecords = allRecords.NS;
      if (nsRecords && nsRecords.length > 0) {
        console.log(`Found ${nsRecords.length} NS records`);
      } else {
        console.warn('No NS records found. This might indicate a problem with DNS resolution.');
      }
      
      // Display the aggregated results and force display of all record sections
      displayAggregatedRecords(domain, allRecords);
      
      // Hide the loader
      if (dnsLoader) {
        dnsLoader.classList.add('hidden');
      }
    });

  // Fallback to hide loader after 10 seconds
  setTimeout(() => {
    if (dnsLoader) {
      dnsLoader.classList.add('hidden');
    }
  }, 10000);
}

// Function to fetch DNS records from Google DNS
function fetchFromGoogleDNS(domain, recordType) {
  return new Promise((resolve, reject) => {
    const url = `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=${recordType}`;

    console.log(`Fetching ${recordType} from Google DNS: ${url}`);
    
    fetch(url)
      .then(response => {
        if (!response.ok) {
          throw new Error(`DNS query failed: ${response.status} ${response.statusText}`);
        }
        return response.json();
      })
      .then(data => {
        console.log(`Received ${recordType} records from Google DNS:`, data);

        if (!data.Answer || data.Answer.length === 0) {
          resolve([]);
          return;
        }

        // Parse the records
        const records = data.Answer.map(answer => ({
          name: answer.name,
          type: recordType,
          data: answer.data,
          ttl: answer.TTL
        }));

        resolve(records);
      })
      .catch(error => {
        console.error(`Error fetching ${recordType} records from Google DNS:`, error);
        resolve([]); // Resolve with empty array instead of rejecting
      });
  });
}

// Function to display aggregated records from multiple providers
function displayAggregatedRecords(domain, allRecords) {
  // Go through each record type
  Object.keys(allRecords).forEach(recordType => {
    const recordsContainer = document.getElementById(`${recordType.toLowerCase()}-records`);
    if (!recordsContainer) return;

    const records = allRecords[recordType];

    if (records.length === 0) {
      // CHANGE: Display a simplified message when no records are found
      recordsContainer.innerHTML = `
        <div class="record-item">
          <span>No ${recordType} records found for ${domain}</span>
        </div>
      `;
      return;
    }

    // Clear existing content
    recordsContainer.innerHTML = '';

    // Better deduplication based on the combination of record type and data
    const uniqueRecords = new Map();

    // First pass: collect all records and count occurrences
    records.forEach(record => {
      // Create a key specifically for the record type - for NS records, just use the data
      let key;
      
      // Strip trailing dots for consistency
      const cleanData = record.data.endsWith('.') ? record.data.slice(0, -1) : record.data;
      
      // Create a unique key based on the type of record
      if (recordType === 'NS' || recordType === 'SOA' || recordType === 'TXT') {
        key = cleanData;
      } else if (recordType === 'MX') {
        // For MX records, include the priority in the key
        key = cleanData;
      } else if (recordType === 'A' || recordType === 'AAAA') {
        // For IP addresses, just use the IP itself
        key = cleanData;
      } else if (recordType === 'CNAME') {
        // For CNAME records, use the canonical name
        key = cleanData;
      } else {
        // Default key format
        key = `${cleanData}`;
      }
      
      if (uniqueRecords.has(key)) {
        const existing = uniqueRecords.get(key);
        // Only add the provider if it's not already in the sources array
        if (!existing.sources.includes(record.provider)) {
          existing.sources.push(record.provider);
        }
      } else {
        uniqueRecords.set(key, {
          ...record,
          data: cleanData, // Use the version without trailing dot
          sources: [record.provider]
        });
      }
    });

    // Display the unique records
    uniqueRecords.forEach(record => {
      const recordItem = document.createElement('div');
      recordItem.className = 'record-item';

      // Format record data based on record type
      let displayText = '';

      switch(recordType) {
        case 'NS':
          // Just display the nameserver
          displayText = record.data;
          break;
          
        case 'MX':
          // MX records have priority and target
          let [priority, host] = ['', ''];
          if (record.data.includes(' ')) {
            [priority, host] = record.data.split(' ');
            displayText = `Priority: ${priority}, Host: ${host}`;
          } else {
            displayText = record.data;
          }
          break;
          
        case 'TXT':
          // Remove quotes from TXT records if present
          let txtValue = record.data;
          if (txtValue.startsWith('"') && txtValue.endsWith('"')) {
            txtValue = txtValue.slice(1, -1);
          }
          displayText = txtValue;
          break;
          
        case 'CNAME':
          // Clearly format CNAME records
          displayText = `Points to: ${record.data}`;
          break;
          
        case 'SOA':
          // SOA records have multiple fields
          const soaParts = record.data.split(' ');
          if (soaParts.length >= 7) {
            displayText = `Primary NS: ${soaParts[0]}, Admin: ${soaParts[1]}, ` +
                         `Serial: ${soaParts[2]}, Refresh: ${soaParts[3]}s, ` +
                         `Retry: ${soaParts[4]}s, Expire: ${soaParts[5]}s, ` +
                         `Minimum: ${soaParts[6]}s`;
          } else {
            displayText = record.data;
          }
          break;
          
        case 'PTR':
          displayText = `Hostname: ${record.data}`;
          break;
          
        case 'A':
        case 'AAAA':
          // Just display the IP address
          displayText = record.data;
          break;
          
        default:
          displayText = record.data;
      }

      // Set the record text
      recordItem.textContent = displayText;

      // Add TTL info
      recordItem.textContent += ` (TTL: ${record.ttl}s)`;

      // Add sources info
      const sourcesText = document.createElement('span');
      sourcesText.className = 'record-sources';
      sourcesText.textContent = ` [Sources: ${record.sources.join(', ')}]`;
      recordItem.appendChild(sourcesText);

      // If it's a nameserver, fetch its IP addresses
      if (recordType === 'NS') {
        fetchNameserverIP(record.data, recordItem);
      }

      recordsContainer.appendChild(recordItem);
    });
  });
}

// Function to fetch IP address for a nameserver
function fetchNameserverIP(nameserver, recordItem) {
  // Clean the nameserver name if it has a trailing dot
  const cleanNameserver = nameserver.endsWith('.') ? nameserver.slice(0, -1) : nameserver;

  // Fetch A record for the nameserver from Google DNS (only provider working currently)
  fetchARecordFromGoogle(cleanNameserver)
    .then(ips => {
      if (ips && ips.length > 0) {
        // Add IPs to the record item
        const ipSpan = document.createElement('span');
        ipSpan.className = 'ns-ip';
        ipSpan.textContent = ` (IP: ${ips.join(', ')})`;
        recordItem.appendChild(ipSpan);
      }
    })
    .catch(error => {
      console.error(`Error fetching IP for nameserver ${nameserver}:`, error);
    });
}

// Function to fetch A record from Google DNS
function fetchARecordFromGoogle(domain) {
  return new Promise((resolve, reject) => {
    const url = `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=A`;

    fetch(url)
      .then(response => response.json())
      .then(data => {
        if (data.Answer && data.Answer.length > 0) {
          const ips = data.Answer.map(answer => answer.data);
          resolve(ips);
        } else {
          resolve([]);
        }
      })
      .catch(error => {
        console.error(`Error fetching IP from Google DNS:`, error);
        resolve([]); // Resolve with empty array to continue the chain
      });
  });
}