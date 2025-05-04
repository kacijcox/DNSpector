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

      // Always hide loaders
      document.querySelectorAll('.loader').forEach(loader => {
        loader.classList.add('hidden');
      });
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
    
    // For now, just set placeholder text in all record containers
    const recordContainers = [
      'a-records', 'aaaa-records', 'cname-records',
      'mx-records', 'txt-records', 'caa-records'
    ];
    
    recordContainers.forEach(containerId => {
      const container = document.getElementById(containerId);
      if (container) {
        container.textContent = 'No records found';
      }
    });
    
    // Hide all loaders after a short delay to prevent infinite loading
    setTimeout(() => {
      document.querySelectorAll('.loader').forEach(loader => {
        loader.classList.add('hidden');
      });
    }, 1000);
  });
});