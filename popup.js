document.addEventListener('DOMContentLoaded', function() {
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
  });
});

// Function to fetch DNS records directly from Google's DNS-over-HTTPS API
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

  // Define DNS providers
  const dnsProviders = [
    { name: 'Google', url: 'https://dns.google/resolve?name=' },
    { name: 'Cloudflare', url: 'https://cloudflare-dns.com/dns-query?name=' },
    { name: 'Quad9', url: 'https://dns.quad9.net/dns-query?name=' }
  ];

  
  
  // Fetch each record type
  let completedRequests = 0;
  const totalRequests = recordTypes.length * dnsProviders.length;

  // Create an object to store all records from all providers
  const allRecords = {};
  recordTypes.forEach(type => {
    allRecords[type] = [];
  });

  // Fetch records from each provider
  dnsProviders.forEach(type => {
    recordTypes.forEach(provider => {
      provider.fetchFunction(domain, type)
      .then(records => {
        // Store records from this provider
        if (records && records.length > 0) {
          const recordsWithProvider = records.map(record => ({
            ...record,
            provider: provider.name
          }));
  
   // Add to our collection
   allRecords[type] = [...allRecords[type], ...recordsWithProvider];
  }
})
.catch(error => {
  console.error(`Error fetching ${type} records from ${provider.name}:`, error);
})
.finally(() => {
  completedRequests++;
  
  // Check if all requests are complete
  if (completedRequests === totalRequests) {
    // Display the aggregated results
    displayAggregatedRecords(domain, allRecords);
    
    // Hide the loader
    if (dnsLoader) {
      dnsLoader.classList.add('hidden');
    }
  }
});
});
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
reject(error);
});
});
}

// Function to fetch DNS records from Cloudflare
function fetchFromCloudflare(domain, recordType) {
return new Promise((resolve, reject) => {
// Cloudflare DNS-over-HTTPS API uses a different format
const url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=${recordType}`;

fetch(url, {
headers: {
'Accept': 'application/dns-json'
}
})
.then(response => {
if (!response.ok) {
  throw new Error(`DNS query failed: ${response.status} ${response.statusText}`);
}
return response.json();
})
.then(data => {
console.log(`Received ${recordType} records from Cloudflare:`, data);

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
console.error(`Error fetching ${recordType} records from Cloudflare:`, error);
reject(error);
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
recordsContainer.textContent = 'No records found';
return;
}

// Clear existing content
recordsContainer.innerHTML = '';

// Use a Map to deduplicate records by their data
const uniqueRecords = new Map();

// First pass: collect all records and count occurrences
records.forEach(record => {
const key = record.data;
if (uniqueRecords.has(key)) {
const existing = uniqueRecords.get(key);
existing.sources.push(record.provider);
} else {
uniqueRecords.set(key, {
  ...record,
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
  // Just display the nameserver record with TTL
  recordItem.textContent = record.data + ` (TTL: ${record.ttl}s)`;
  
  // Add sources info
  const sourcesText = document.createElement('span');
  sourcesText.className = 'record-sources';
  sourcesText.textContent = ` [Sources: ${record.sources.join(', ')}]`;
  recordItem.appendChild(sourcesText);
  
  // If the user wants IP addresses, we fetch and add them
  fetchNameserverIP(record.data, recordItem);
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
  
default:
  displayText = record.data;
}

// Only set textContent if it hasn't been set already (NS case)
if (recordType !== 'NS') {
recordItem.textContent = displayText;

// Add TTL info
recordItem.textContent += ` (TTL: ${record.ttl}s)`;

// Add sources info
const sourcesText = document.createElement('span');
sourcesText.className = 'record-sources';
sourcesText.textContent = ` [Sources: ${record.sources.join(', ')}]`;
recordItem.appendChild(sourcesText);
}

recordsContainer.appendChild(recordItem);
});
});
}

// Function to fetch IP address for a nameserver
function fetchNameserverIP(nameserver, recordItem) {
// Clean the nameserver name if it has a trailing dot
const cleanNameserver = nameserver.endsWith('.') ? nameserver.slice(0, -1) : nameserver;

// Fetch A record for the nameserver from multiple providers for better reliability
Promise.all([
fetchARecordFromGoogle(cleanNameserver),
fetchARecordFromCloudflare(cleanNameserver)
])
.then(results => {
// Combine results from both providers
const allIPs = results
.filter(result => result) // Remove any null results
.flat() // Flatten the array
.filter((ip, index, self) => self.indexOf(ip) === index); // Deduplicate

if (allIPs.length > 0) {
// Add IPs to the record item
const ipSpan = document.createElement('span');
ipSpan.className = 'ns-ip';
ipSpan.textContent = ` (IP: ${allIPs.join(', ')})`;
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

// Function to fetch A record from Cloudflare
function fetchARecordFromCloudflare(domain) {
return new Promise((resolve, reject) => {
const url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=A`;

fetch(url, {
headers: {
'Accept': 'application/dns-json'
}
})
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
console.error(`Error fetching IP from Cloudflare:`, error);
resolve([]); // Resolve with empty array to continue the chain
});
});
}