/*!
 * @description : Efficient Loan Number Finder Script
 * @portal : Radian Cancel MI Portal
 * @author : Radian Team
 * @group : Radian
 * @owner : Radian
 * @lastModified : Current Date
 * @version : 1.0.0
 */

// ########## DO NOT MODIFY THESE LINES ##########
const EXTENSION_ID = "afkpnpkodeiolpnfnbdokgkclljpgmcm";

/**
 * Minimal logging utility for essential debugging only
 */
const Logger = {
  prefix: '[Radian Filter]',
  log: (message, data = null) => {
    const timestamp = new Date().toISOString();
    console.log(`${Logger.prefix} [${timestamp}] ${message}`, data || '');
  },
  warn: (message, data = null) => {
    const timestamp = new Date().toISOString();
    console.warn(`${Logger.prefix} [${timestamp}] ⚠️ ${message}`, data || '');
  },
  error: (message, data = null) => {
    const timestamp = new Date().toISOString();
    console.error(`${Logger.prefix} [${timestamp}] ❌ ${message}`, data || '');
  },
  success: (message, data = null) => {
    const timestamp = new Date().toISOString();
    console.log(`${Logger.prefix} [${timestamp}] ✅ ${message}`, data || '');
  }
};

/**
 * Establish Communication with Loan Checker Extension
 */
async function waitForListener(maxRetries = 20, initialDelay = 100) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    let delay = initialDelay;
    let timeoutId;

    function sendPing() {
      if (attempts >= maxRetries) {
        Logger.warn("No listener detected after maximum retries.");
        clearTimeout(timeoutId);
        reject(new Error("Listener not found"));
        return;
      }

      Logger.log(`Sending ping attempt ${attempts + 1}/${maxRetries}...`);
      if (!chrome.runtime?.sendMessage) {
        reject(new Error("Chrome runtime not available"));
        return;
      }

      chrome.runtime?.sendMessage(
        EXTENSION_ID,
        {
          type: "ping",
        },
        (response) => {
          if (chrome.runtime.lastError) {
            Logger.warn("Chrome runtime error:", chrome.runtime.lastError.message);
            timeoutId = setTimeout(() => {
              attempts++;
              delay *= 2; // Exponential backoff (100ms → 200ms → 400ms...)
              sendPing();
            }, delay);
            return;
          }

          if (response?.result === "pong") {
            Logger.success("Listener detected!");
            clearTimeout(timeoutId);
            resolve(true);
          } else {
            Logger.warn("No listener detected, retrying...");
            timeoutId = setTimeout(() => {
              attempts++;
              delay *= 2; // Exponential backoff (100ms → 200ms → 400ms...)
              sendPing();
            }, delay);
          }
        }
      );
    }

    sendPing(); // Start the first attempt
  });
}

/**
 * Request a batch of numbers from the storage script
 */
async function checkNumbersBatch(numbers) {
  return new Promise((resolve, reject) => {
    Logger.log(`Checking loan numbers batch:`, numbers);

    chrome.runtime.sendMessage(
      EXTENSION_ID,
      {
        type: "queryLoans",
        loanIds: numbers,
      },
      (response) => {
        if (chrome.runtime.lastError) {
          Logger.error("Extension communication error:", chrome.runtime.lastError.message);
          return reject(chrome.runtime.lastError.message);
        } else if (!response || response.error) {
          Logger.error("Invalid response from extension:", response?.error || "Invalid response received");
          return reject(response?.error || "Invalid response received");
        }

        if (!response.result || typeof response.result !== "object") {
          Logger.error("Invalid result format from extension");
          return reject("Invalid result format received");
        }

        const available = Object.keys(response.result).filter(
          (key) => response.result[key]
        );
        Logger.log(`Extension response - Available loans:`, available);
        resolve(available);
      }
    );
  });
}
// ########## DO NOT MODIFY THESE LINES - END ##########

// ########## NAVIGATION CONTROL ##########

/**
 * Define the links that should be hidden
 */
const HIDDEN_ACTION_ELEMENTS = [
  'Document Center',
  'Send Decision Doc',
  'Quick Actions',
  'Rate Finder',
  'New Application',
  'Activate Deferred',
  'Transfer Servicing'
];

/**
 * Define the links that should always be preserved
 */
const PRESERVED_ACTION_ELEMENTS = [
  'Notes',
  'Print'
];

/**
 * Hide specific action elements except Notes and Print
 * This function is designed to be called repeatedly to handle dynamic content
 */
function hideNavigationLinks() {
  Logger.log("🔒 Hiding specific action elements except Notes and Print");

  try {
    // Find all links and buttons
    const allElements = document.querySelectorAll('a, button, .menu-item, [role="menuitem"], [role="button"], .nav-link, .navigation-item');
    let hiddenCount = 0;
    let preservedCount = 0;

    Logger.log(`🔍 Checking ${allElements.length} potential navigation elements...`);

    allElements.forEach((element, index) => {
      const text = element.textContent?.replace(/\s+/g, ' ').trim() || '';

      // Skip empty elements
      if (!text) return;

      // Check if this element should be hidden
      const shouldHide = HIDDEN_ACTION_ELEMENTS.some(hiddenText =>
        text.toLowerCase().includes(hiddenText.toLowerCase())
      );

      // Check if this element should be preserved
      const shouldPreserve = PRESERVED_ACTION_ELEMENTS.some(preservedText =>
        text.toLowerCase().includes(preservedText.toLowerCase())
      );

      if (shouldHide && !shouldPreserve) {
        // Hide the element
        element.style.display = 'none';
        // Also add a data attribute to mark it as hidden by our script
        element.setAttribute('data-hidden-by-filter', 'true');
        hiddenCount++;
        Logger.log(`    🚫 Hidden: "${text}"`);
      } else if (shouldPreserve) {
        // Mark as preserved
        element.setAttribute('data-preserved-by-filter', 'true');
        preservedCount++;
        Logger.log(`    ✅ Preserving: "${text}"`);
      }
    });

    // Also specifically target all iframe documents that might contain navigation elements
    try {
      const iframes = document.querySelectorAll('iframe');
      iframes.forEach(iframe => {
        try {
          // Only access same-origin iframes
          const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
          if (iframeDoc) {
            const iframeElements = iframeDoc.querySelectorAll('a, button, .menu-item, [role="menuitem"], [role="button"], .nav-link, .navigation-item');
            iframeElements.forEach(element => {
              const text = element.textContent?.replace(/\s+/g, ' ').trim() || '';
              if (!text) return;

              const shouldHide = HIDDEN_ACTION_ELEMENTS.some(hiddenText =>
                text.toLowerCase().includes(hiddenText.toLowerCase())
              );

              if (shouldHide) {
                element.style.display = 'none';
                element.setAttribute('data-hidden-by-filter', 'true');
                hiddenCount++;
                Logger.log(`    🚫 Hidden in iframe: "${text}"`);
              }
            });
          }
        } catch (e) {
          // Silently ignore cross-origin iframe errors
        }
      });
    } catch (iframeError) {
      Logger.log("⚠️ Error accessing iframes:", iframeError);
    }

    Logger.success(`✅ Action elements control applied - ${hiddenCount} elements hidden, ${preservedCount} elements preserved`);

  } catch (error) {
    Logger.error("❌ Error hiding action elements:", error);
  }
}

// ########## END NAVIGATION CONTROL ##########

/**
 * Create unallowed element to show when loan is not allowed for offshore users.
 * This creates the element only once and returns it.
 */
function createUnallowedElement() {
  Logger.log("Creating unallowed element");
  const unallowed = document.createElement("div");
  unallowed.appendChild(
    document.createTextNode("Loan is not provisioned to the user")
  );
  unallowed.className = "body";
  unallowed.style.display = "flex";
  unallowed.style.justifyContent = "center"; // Center horizontally
  unallowed.style.alignItems = "center";
  unallowed.style.width = "100%"; // Take full width
  unallowed.style.height = "200px"; // Taller for better visibility
  unallowed.style.fontSize = "22px";
  unallowed.style.fontWeight = "bold";
  unallowed.style.color = "#d32f2f"; // Red color for emphasis
  unallowed.style.backgroundColor = "#f5f5f5"; // Light background
  unallowed.style.borderRadius = "4px";
  unallowed.style.padding = "20px";
  unallowed.style.margin = "20px 0";
  unallowed.style.boxShadow = "0 2px 4px rgba(0,0,0,0.1)";
  unallowed.id = "loan-not-provisioned-message"; // Add an ID to easily find and remove it later

  return unallowed;
}

/**
 * Create loader style
 */
function createLoader() {
  const style = document.createElement("style");
  style.textContent = `
    #loaderOverlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(255, 255, 255, 0.9);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      transition: opacity 0.3s ease;
    }
    .spinner {
      width: 60px;
      height: 60px;
      border: 6px solid #ccc;
      border-top-color: #2b6cb0;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
    @keyframes spin {
      to {transform: rotate(360deg);}
    }
    #loaderOverlay.hidden {
      opacity: 0;
      pointer-events: none;
    }
  `;
  return style;
}

/**
 * Create loader element
 */
function createLoaderElement() {
  const loader = document.createElement("div");
  loader.id = "loaderOverlay";
  loader.innerHTML = `<div class="spinner"></div>`;
  return loader;
}

/**
 * Efficient loan number finder - uses a direct approach to find the loan number
 * by looking for the paragraph with "Loan Number" text and specific class names
 */
function findLoanNumber() {
  Logger.log("Starting efficient loan number search");

  // Method 1: Direct approach using the static class names
  const typographyParagraphs = document.querySelectorAll('p.MuiTypography-root.MuiTypography-body2');

  if (typographyParagraphs && typographyParagraphs.length > 0) {
    Logger.log(`Found ${typographyParagraphs.length} paragraphs with MuiTypography classes`);

    // Find the paragraph that contains "Loan Number" text
    let loanNumberLabel = null;
    for (const paragraph of typographyParagraphs) {
      if (paragraph.textContent.trim() === "Loan Number") {
        loanNumberLabel = paragraph;
        Logger.log("Found 'Loan Number' label paragraph", paragraph);
        break;
      }
    }

    if (loanNumberLabel) {
      // Get the parent div of the "Loan Number" label
      const labelParentDiv = loanNumberLabel.closest('div');
      if (labelParentDiv) {
        // Find the next sibling div that should contain the loan number
        const nextDiv = labelParentDiv.nextElementSibling;
        if (nextDiv && nextDiv.tagName === 'DIV') {
          // Find the paragraph in the next div that contains the loan number
          const loanNumberParagraph = nextDiv.querySelector('p.MuiTypography-root.MuiTypography-body2');
          if (loanNumberParagraph) {
            const loanNumber = loanNumberParagraph.textContent.trim();
            if (loanNumber) {
              Logger.success(`Method 1: Found loan number using static classes: ${loanNumber}`);
              return loanNumber;
            }
          }
        }
      }
    }
  }

  // Method 2: Fallback - Look for any paragraph with "Loan Number" text
  Logger.log("Method 1 failed, trying fallback method");
  const allParagraphs = document.querySelectorAll('p');

  for (let i = 0; i < allParagraphs.length; i++) {
    if (allParagraphs[i].textContent.trim() === "Loan Number" && i + 1 < allParagraphs.length) {
      // Check if the next paragraph might contain the loan number
      const nextParagraph = allParagraphs[i + 1];
      const loanNumber = nextParagraph.textContent.trim();

      // Simple validation: loan numbers are typically 5+ digits
      if (/^\d{5,}$/.test(loanNumber)) {
        Logger.success(`Method 2: Found loan number using fallback method: ${loanNumber}`);
        return loanNumber;
      }
    }
  }

  // Method 3: Last resort - Look for any div that comes after "Loan Number" text
  Logger.log("Method 2 failed, trying last resort method");
  const textNodes = [];
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    null,
    false
  );

  let node;
  while (node = walker.nextNode()) {
    if (node.nodeValue.trim() === "Loan Number") {
      // Found the "Loan Number" text node, now look for nearby number
      let current = node.parentNode;
      let found = false;

      // Look at siblings and their children
      for (let i = 0; i < 5 && !found && current; i++) {
        current = current.nextElementSibling;
        if (current) {
          const text = current.textContent.trim();
          if (/^\d{5,}$/.test(text)) {
            Logger.success(`Method 3: Found loan number using text node search: ${text}`);
            return text;
          }
        }
      }
    }
  }

  Logger.warn("No loan number found using any method");
  return null;
}

/**
 * Function to handle the loan number check and UI updates
 */
async function handleLoanCheck() {
  try {
    Logger.log("Starting loan check");

    // Find the loan number using our efficient method
    const loanNumber = findLoanNumber();

    if (!loanNumber) {
      Logger.warn("No loan number found");
      return false;
    }

    Logger.success(`Processing loan number: ${loanNumber}`);

    // Check if loan is restricted - CRITICAL STEP
    try {
      const allowedLoans = await checkNumbersBatch([loanNumber]);
      Logger.log(`Loan check result: ${JSON.stringify(allowedLoans)}`);

      // Remove any existing "not provisioned" messages to prevent duplicates
      const existingMessages = document.querySelectorAll('#loan-not-provisioned-message');
      existingMessages.forEach(msg => msg.remove());

      if (!allowedLoans || allowedLoans.length === 0) {
        Logger.log("Loan is restricted, hiding content");

        // Find the contentmenu div - this is the specific element we need to hide
        const contentMenu = document.querySelector('div.contentmenu');
        
        if (contentMenu) {
          // Store original content for debugging
          const originalContentHTML = contentMenu.innerHTML;
          Logger.log(`Original content found, length: ${originalContentHTML.length}`);

          // Clear the content
          contentMenu.innerHTML = '';

          // Add the unallowed message
          const unallowedElement = createUnallowedElement();
          contentMenu.appendChild(unallowedElement);
          Logger.success("Content hidden and message displayed");
          
          // Verify message was added
          setTimeout(() => {
            const messageElement = document.getElementById('loan-not-provisioned-message');
            if (messageElement) {
              Logger.success("Verified message element is in DOM");
            } else {
              Logger.error("Message element not found in DOM after adding");
              // Try again with contentMenu as parent
              contentMenu.appendChild(createUnallowedElement());
            }
          }, 100);
        } else {
          // Fallback to previous approach if contentmenu is not found
          const mainContent = document.querySelector('div[class*="sc-"][class*="MuiPaper-root"]') ||
            document.querySelector('div.sc-bMwpA') ||
            document.querySelector('main') ||
            document.querySelector('div[class*="container"]') ||
            document.querySelector('div[class*="sc-"]');

          if (mainContent) {
            // Clear the content
            mainContent.innerHTML = '';

            // Add the unallowed message
            const unallowedElement = createUnallowedElement();
            mainContent.appendChild(unallowedElement);
            Logger.success("Content hidden and message displayed using fallback selector");

            // Verify message was added
            setTimeout(() => {
              const messageElement = document.getElementById('loan-not-provisioned-message');
              if (messageElement) {
                Logger.success("Verified message element is in DOM");
              } else {
                Logger.error("Message element not found in DOM after adding");
                // Try again with body as parent
                document.body.appendChild(createUnallowedElement());
              }
            }, 100);
          } else {
            // Fallback if we can't find the main content container
            document.body.appendChild(createUnallowedElement());
            Logger.warn("Could not find main content container, added message to body");
          }
        }
      } else {
        Logger.success("Loan is allowed, showing content");
      }

      return true;
    } catch (checkError) {
      Logger.error("Error checking loan restriction:", checkError);
      // Even if check fails, try to show the message as a fallback
      document.body.appendChild(createUnallowedElement());
      return false;
    }
  } catch (error) {
    Logger.error("Error in handleLoanCheck:", error);
    // Try to show error message even if we have an exception
    try {
      document.body.appendChild(createUnallowedElement());
    } catch (e) {
      // Last resort error handling
      Logger.error("Failed to add error message to body:", e);
    }
    return false;
  }
}

/**
 * Setup mutation observer to detect DOM changes
 */
function setupObserver() {
  Logger.log("Setting up mutation observer");

  let lastProcessedLoanNumber = null;
  let debounceTimer = null;
  let navLinksDebounceTimer = null;

  // Create a debounced version of hideNavigationLinks to avoid excessive calls
  const debouncedHideNavigationLinks = () => {
    clearTimeout(navLinksDebounceTimer);
    navLinksDebounceTimer = setTimeout(() => {
      hideNavigationLinks();
    }, 300);
  };

  const observer = new MutationObserver((mutations) => {
    // Debounce to prevent multiple rapid executions
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    debounceTimer = setTimeout(() => {
      // Check if loan number is available
      const loanNumber = findLoanNumber();

      if (loanNumber && loanNumber !== lastProcessedLoanNumber) {
        Logger.log(`New loan number detected: ${loanNumber}`);
        lastProcessedLoanNumber = loanNumber;

        // Process the loan number and ensure it completes
        handleLoanCheck().then(result => {
          if (result) {
            Logger.success(`Successfully processed loan check for ${loanNumber}`);
          } else {
            Logger.error(`Failed to process loan check for ${loanNumber}`);
          }
        }).catch(err => {
          Logger.error(`Error during loan check: ${err.message}`);
        });
      }
    }, 300);

    // Check for navigation-related changes
    let shouldCheckLinks = false;
    mutations.forEach((mutation) => {
      // For attribute changes, check if they're on navigation elements
      if (mutation.type === 'attributes') {
        const target = mutation.target;
        if (target.tagName === 'A' || target.tagName === 'BUTTON' ||
          target.getAttribute('role') === 'menuitem' ||
          target.getAttribute('role') === 'button' ||
          target.classList.contains('menu-item') ||
          target.classList.contains('nav-link')) {
          shouldCheckLinks = true;
        }
      }

      // For added nodes, check for navigation elements
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node;
            if (element.querySelector &&
              (element.querySelector('a') ||
                element.querySelector('button') ||
                element.querySelector('[role="menuitem"]') ||
                element.querySelector('.menu-item'))) {
              shouldCheckLinks = true;
            }
          }
        }
      }
    });

    // Handle navigation links if needed
    if (shouldCheckLinks) {
      Logger.log("🔄 Navigation-related changes detected - re-applying link controls");
      debouncedHideNavigationLinks();
    }
  });

  // Observe the entire document for changes
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['style', 'class', 'display', 'visibility']
  });

  // Initial call to hide navigation links
  hideNavigationLinks();

  // Set up periodic check for navigation links as a fallback
  const periodicCheckInterval = setInterval(() => {
    hideNavigationLinks();
  }, 3000);

  // Add event listeners for page load events to catch all possible DOM changes
  window.addEventListener('DOMContentLoaded', hideNavigationLinks);
  window.addEventListener('load', hideNavigationLinks);

  // Store references to clean up if needed
  window._radianNavInterval = periodicCheckInterval;

  Logger.success("Mutation observer setup complete with navigation control");
  return observer;
}

// Main entry point
(async function () {
  Logger.log("Radian Efficient Loan Finder starting...");

  // Create and append loader style
  const style = createLoader();
  document.head.appendChild(style);

  // Create and append loader element
  const loader = createLoaderElement();
  document.body.appendChild(loader);

  // Wait for document to be ready
  if (document.readyState === "loading") {
    Logger.log("Document still loading, waiting for DOMContentLoaded");
    document.addEventListener("DOMContentLoaded", onReady);
  } else {
    Logger.log("Document already loaded, proceeding immediately");
    onReady();
  }

  async function onReady() {
    try {
      Logger.log("Document ready, starting initialization");

      // Set global timeout for initial loading
      const globalTimeout = setTimeout(() => {
        Logger.warn("Initial loading timeout reached after 30 seconds");
        const loaderElement = document.querySelector('#loaderOverlay');
        if (loaderElement) {
          loaderElement.remove();
        }
      }, 30000);

      // Check extension connection
      await waitForListener();

      // Hide navigation links after successful connection
      hideNavigationLinks();

      // Setup mutation observer
      const observer = setupObserver();
      window._radianObserver = observer;

      // Initial check for loan number - force execution and handle errors
      try {
        const isProcessed = await handleLoanCheck();

        if (isProcessed) {
          Logger.success("Loan number processed successfully");
          clearTimeout(globalTimeout);
          loader.remove();
        } else {
          Logger.log("Loan number not found initially, will monitor for changes");
          loader.remove();

          // Add a single periodic check as a backup with forced execution
          const checkInterval = setInterval(() => {
            const loanNumber = findLoanNumber();
            if (loanNumber) {
              handleLoanCheck().then(result => {
                if (result) {
                  Logger.success(`Successfully processed loan check for ${loanNumber} in interval`);
                } else {
                  Logger.error(`Failed to process loan check for ${loanNumber} in interval`);
                }
              }).catch(err => {
                Logger.error(`Error during loan check in interval: ${err.message}`);
              });
              clearInterval(checkInterval);
              Logger.log("Cleared periodic check interval after finding loan number");
            }
          }, 3000);

          // Clear interval after 1 minute if no loan number found
          setTimeout(() => {
            clearInterval(checkInterval);
            Logger.log("Cleared periodic check interval after timeout");
          }, 60000);
        }

      } catch (error) {
        Logger.error("Error during initialization:", error);
        loader.remove();

        // Still setup observer for future changes
        const observer = setupObserver();
        window._radianObserver = observer;

        // Try initial check even without extension
        handleLoanCheck().then(result => {
          if (result) {
            Logger.success("Loan number processed successfully even without extension");
          } else {
            Logger.warn("Could not process loan check without extension");
          }
        }).catch(err => {
          Logger.error(`Error during loan check without extension: ${err.message}`);
        });
      }
    } catch (outerError) {
      // Handle any unexpected errors in the outer try block
      Logger.error("Critical error in onReady function:", outerError);

      // Make sure loader is removed in case of errors
      if (loader && document.body.contains(loader)) {
        loader.remove();
      }

      // Try to set up a basic observer as a last resort
      try {
        const observer = setupObserver();
        window._radianObserver = observer;
      } catch (e) {
        Logger.error("Failed to set up observer after critical error:", e);
      }
    }
  }
})();