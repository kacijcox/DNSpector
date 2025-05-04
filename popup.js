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
    
    // Hide DNS loader after 10 seconds to prevent infinite loading
    setTimeout(() => {
      const dnsLoader = document.getElementById('dns-loader');
      if (dnsLoader) {
        dnsLoader.classList.add('hidden');
      }
    }, 10000);
  });
});

// Function to fetch DNS records
function loadDnsRecords(domain) {
  console.log('Loading DNS records for:', domain);
  
  const dnsLoader = document.getElementById('dns-loader');
  
  // Define record types to fetch
  const recordTypes = ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'CAA'];
  
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
  recordTypes.forEach(type => {
    fetchDnsRecords(domain, type);
  });
}

function fetchDnsRecords(domain, recordType) {
  console.log(`Fetching ${recordType} records for:`, domain);
  
  const recordsContainer = document.getElementById(`${recordType.toLowerCase()}-records`);
  if (!recordsContainer) {
    console.error(`Container for ${recordType.toLowerCase()}-records not found!`);
    return;
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
      
      // Hide the loader once any response is received
      const dnsLoader = document.getElementById('dns-loader');
      if (dnsLoader) {
        dnsLoader.classList.add('hidden');
      }
      
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
    }
  );
}