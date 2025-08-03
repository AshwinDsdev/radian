/*!
 * @description : Radian Cancel MI Filter Script
 * @portal : Radian Cancel MI Portal
 * @author : Radian Team
 * @group : Radian
 * @owner : Radian
 * @lastModified : 15-May-2023
 * @version : 2.0.0
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

/**
 * Create unallowed element to show when loan is not allowed for offshore users.
 */
function createUnallowedElement() {
  Logger.log("Creating unallowed element");
  const unallowed = document.createElement("span");
  unallowed.appendChild(
    document.createTextNode("Loan is not provisioned to the user")
  );
  unallowed.className = "body";
  unallowed.style.display = "flex";
  unallowed.style.paddingLeft = "250px";
  unallowed.style.alignItems = "center";
  unallowed.style.height = "100px";
  unallowed.style.fontSize = "20px";
  unallowed.style.fontWeight = "bold";
  unallowed.style.color = "black";
  unallowed.style.position = "relative";

  return unallowed;
}

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
 * To create Loader Element.
 */
function createLoaderElement() {
  const loader = document.createElement("div");
  loader.id = "loaderOverlay";
  loader.innerHTML = `<div class="spinner"></div>`;
  return loader;
}

/**
 * Enhanced FormElement class with better dynamic class handling
 */
class FormElement {
  constructor() {
    this.refreshElements();
    this.unallowed = createUnallowedElement();
  }

  /**
   * Refresh elements to handle dynamic class names
   */
  refreshElements() {
    Logger.log("Refreshing form elements");

    // Try multiple possible class names for dynamic content
    const possibleClasses = [
      '.contentmenu',
      '.content-menu',
      '.content',
      '.main-content',
      '.form-content',
      '.page-content',
      '[class*="content"]',
      '[class*="menu"]',
      // Add more specific selectors for the Radian Cancel MI page
      'div[class*="sc-"]',
      'div[class*="styled"]',
      'div[class*="container"]',
      'section',
      'main',
      'article',
      // Fallback to any div that might contain our content
      'div:not([style*="display:none"]):not([style*="display: none"])'
    ];

    let foundElements = null;
    for (const className of possibleClasses) {
      try {
        const elements = document.querySelectorAll(className);
        if (elements && elements.length > 0) {
          Logger.log(`Found elements with selector: ${className}`, elements.length);
          foundElements = elements;
          this.usedSelector = className;
          break;
        }
      } catch (error) {
        Logger.warn(`Invalid selector: ${className}`, error);
      }
    }

    this.element = foundElements || [];

    // Try to find the most appropriate parent element
    if (this.element.length > 0) {
      // First try to find a direct parent
      this.parent = this.element[0] && this.element[0].parentElement;

      // If no direct parent or it's the body, try to find a better container
      if (!this.parent || this.parent === document.body) {
        // Look for common container elements
        const containers = document.querySelectorAll('main, .container, [class*="container"], [class*="content-wrapper"], [class*="main"]');
        if (containers.length > 0) {
          this.parent = containers[0];
        } else {
          // Fallback to body if no better container found
          this.parent = document.body;
        }
      }
    } else {
      // Fallback to body if no elements found
      this.parent = document.body;
    }

    Logger.log(`Form elements refreshed - Found ${this.element.length} elements`);
    Logger.log(`Using parent element:`, this.parent.tagName);
  }

  removeCancelMIElement() {
    Logger.log("Removing Cancel MI elements");
    let removedCount = 0;

    this.element.forEach((section, index) => {
      const innerHTML = section.innerHTML;
      if (
        innerHTML.includes("Cancel MI") ||
        innerHTML.includes("Certificate Number") ||
        innerHTML.includes("Company Name") ||
        innerHTML.includes("Borrower Name") ||
        innerHTML.includes("Policy Status") ||
        innerHTML.includes("Address") ||
        innerHTML.includes("Loan Number") ||
        innerHTML.includes("Cancellation Reason") ||
        innerHTML.includes("Cancellation Date")
      ) {
        section.remove();
        removedCount++;
      }
    });

    Logger.log(`Removed ${removedCount} Cancel MI elements`);
  }

  addCancelMIElement() {
    Logger.log("Adding unallowed element");
    if (this.parent) {
      this.parent.appendChild(this.unallowed);
      Logger.success("Unallowed element added successfully");
    } else {
      Logger.warn("No parent element found to add unallowed element");
    }
  }

  getCancelMITargetElement() {
    return Array.from(this.element).find((section) => {
      return section.innerHTML.includes("Cancel MI");
    });
  }
}

/**
 * Checks if a text contains a potential loan number
 * @param {string} text - The text to check
 * @returns {boolean} True if the text contains a potential loan number
 */
function containsLoanNumber(text) {
  return /\b\d{5,}\b/.test(text) || /\b[A-Z0-9]{5,}\b/.test(text);
}

/**
 * Extracts potential loan numbers from text
 * @param {string} text - The text to extract loan numbers from
 * @returns {string[]} Array of unique potential loan numbers
 */
function extractLoanNumbers(text) {
  const matches = [];
  const digitMatches = text.match(/\b\d{5,}\b/g);
  const alphaNumMatches = text.match(/\b[A-Z0-9]{5,}\b/g);

  if (digitMatches) matches.push(...digitMatches);
  if (alphaNumMatches) matches.push(...alphaNumMatches);

  return [...new Set(matches)];
}

/**
 * Debug function to analyze page state (only when needed)
 */
function debugPageState() {
  Logger.log("=== PAGE STATE ANALYSIS ===");

  // Document state
  Logger.log("Document state:", {
    readyState: document.readyState,
    title: document.title,
    url: window.location.href,
    bodyChildren: document.body.children.length
  });

  // Styled components analysis
  const styledComponents = document.querySelectorAll('div[class*="sc-"]');
  Logger.log(`Styled components found: ${styledComponents.length}`);

  // Paragraph analysis
  const paragraphs = document.querySelectorAll('p');
  Logger.log(`Total paragraphs: ${paragraphs.length}`);

  const paragraphTexts = Array.from(paragraphs).map(p => p.textContent.trim()).filter(t => t.length > 0);
  Logger.log("Paragraph texts (first 10):", paragraphTexts.slice(0, 10));

  Logger.log("=== END PAGE STATE ANALYSIS ===");
}

/**
 * Enhanced loan number extraction optimized for the specific HTML structure
 * @returns {string|null} The loan number if found, null otherwise
 */
function getLoanNumberFromPage() {
  Logger.log("Starting loan number extraction from page");

  // Method 1: Look for the specific pattern matching the provided HTML structure
  // This targets the exact structure: <div class="sc-..."><p>Loan Number</p></div><div class="sc-..."><p>4778748600</p></div>
  Logger.log("Method 1: Searching for specific HTML structure pattern");

  // Look for paragraphs with "Loan Number" text
  const allParagraphs = document.querySelectorAll('p');
  const loanNumberLabels = Array.from(allParagraphs).filter(p =>
    p.textContent.trim() === 'Loan Number'
  );

  Logger.log(`Found ${loanNumberLabels.length} 'Loan Number' labels`);

  for (const label of loanNumberLabels) {
    // Get the parent div of the "Loan Number" label
    const labelParent = label.closest('div');
    if (!labelParent) continue;

    // Look for the next sibling div that contains the actual loan number
    const nextDiv = labelParent.nextElementSibling;
    if (nextDiv && nextDiv.tagName === 'DIV') {
      const loanNumberP = nextDiv.querySelector('p');
      if (loanNumberP) {
        const loanNumberText = loanNumberP.textContent.trim();
        if (containsLoanNumber(loanNumberText)) {
          Logger.success(`Found loan number via Method 1 (specific structure): ${loanNumberText}`);
          return loanNumberText;
        }
      }
    }
  }

  // Method 2: Look for any paragraph containing "Loan Number" and get the next sibling paragraph
  Logger.log("Method 2: Searching for 'Loan Number' in all paragraphs");

  for (let i = 0; i < allParagraphs.length; i++) {
    const currentText = allParagraphs[i].textContent.trim();
    if (currentText === "Loan Number" && i + 1 < allParagraphs.length) {
      const loanNumberText = allParagraphs[i + 1].textContent.trim();
      if (containsLoanNumber(loanNumberText)) {
        Logger.success(`Found loan number via Method 2: ${loanNumberText}`);
        return loanNumberText;
      }
    }
  }

  // Method 3: Look for any text that looks like a loan number in the content
  // This is a fallback method for cases where the structure might be different
  Logger.log("Method 3: Searching for potential loan numbers in all text elements");
  const allTextElements = document.querySelectorAll("p, div, span, td");

  for (const element of allTextElements) {
    const text = element.textContent.trim();
    if (containsLoanNumber(text) && text.length >= 5 && text.length <= 15) {
      // Additional validation: make sure it's not just a label
      if (!text.toLowerCase().includes("loan") &&
        !text.toLowerCase().includes("number") &&
        !text.toLowerCase().includes("certificate") &&
        !text.toLowerCase().includes("company") &&
        !text.toLowerCase().includes("borrower") &&
        !text.toLowerCase().includes("policy") &&
        !text.toLowerCase().includes("address")) {
        Logger.success(`Found potential loan number via Method 3: ${text}`);
        return text;
      }
    }
  }

  // Method 4: Look for the specific structure from the HTML with dynamic class handling
  Logger.log("Method 4: Searching in content menu with dynamic class handling");
  const possibleContentSelectors = [
    '.contentmenu',
    '.content-menu',
    '.content',
    '.main-content',
    '.form-content',
    '.page-content',
    '[class*="content"]'
  ];

  for (const selector of possibleContentSelectors) {
    try {
      const contentMenu = document.querySelector(selector);
      if (contentMenu) {
        const loanNumberElements = contentMenu.querySelectorAll("p");
        for (let i = 0; i < loanNumberElements.length; i++) {
          const currentText = loanNumberElements[i].textContent.trim();
          if (currentText === "Loan Number" && i + 1 < loanNumberElements.length) {
            const loanNumberText = loanNumberElements[i + 1].textContent.trim();
            if (containsLoanNumber(loanNumberText)) {
              Logger.success(`Found loan number via Method 4: ${loanNumberText}`);
              return loanNumberText;
            }
          }
        }
      }
    } catch (error) {
      Logger.warn(`Error with selector ${selector}:`, error);
    }
  }

  // Method 5: Enhanced search for the specific Radian structure with class patterns
  Logger.log("Method 5: Searching for Radian-specific structure with class patterns");
  const radianDivs = document.querySelectorAll('div[class*="sc-"]');

  for (let i = 0; i < radianDivs.length; i++) {
    const currentDiv = radianDivs[i];
    const paragraph = currentDiv.querySelector('p');
    if (paragraph && paragraph.textContent.trim() === 'Loan Number') {
      // Look for the next div with the same class pattern
      if (i + 1 < radianDivs.length) {
        const nextDiv = radianDivs[i + 1];
        const nextParagraph = nextDiv.querySelector('p');
        if (nextParagraph) {
          const loanNumberText = nextParagraph.textContent.trim();
          if (containsLoanNumber(loanNumberText)) {
            Logger.success(`Found loan number via Method 5 (Radian structure): ${loanNumberText}`);
            return loanNumberText;
          }
        }
      }
    }
  }

  // Method 6: Search for any numeric content that could be a loan number
  Logger.log("Method 6: Searching for any numeric content that could be a loan number");
  const allElements = document.querySelectorAll('*');
  for (const element of allElements) {
    if (element.children.length === 0) { // Only leaf nodes
      const text = element.textContent.trim();
      if (text && /^\d{5,}$/.test(text) && text.length <= 15) {
        // Check if this looks like a loan number by examining context
        const parent = element.parentElement;
        if (parent) {
          const parentText = parent.textContent;
          if (parentText.includes('Loan') || parentText.includes('Number')) {
            Logger.success(`Found loan number via Method 6 (context search): ${text}`);
            return text;
          }
        }
      }
    }
  }

  // Method 7: Search for any loan number pattern in styled-components structure
  Logger.log("Method 7: Searching for loan numbers in styled-components structure");
  const styledComponents = document.querySelectorAll('div[class*="sc-"]');

  for (const component of styledComponents) {
    const paragraph = component.querySelector('p');
    if (paragraph) {
      const text = paragraph.textContent.trim();
      // Look for numeric patterns that could be loan numbers (5-15 digits)
      if (/^\d{5,15}$/.test(text)) {
        // Additional validation: make sure it's not just a label or other content
        if (!text.toLowerCase().includes("loan") &&
          !text.toLowerCase().includes("number") &&
          !text.toLowerCase().includes("certificate") &&
          !text.toLowerCase().includes("company") &&
          !text.toLowerCase().includes("borrower") &&
          !text.toLowerCase().includes("policy") &&
          !text.toLowerCase().includes("address")) {
          Logger.success(`Found loan number via Method 7 (styled-components): ${text}`);
          return text;
        }
      }
    }
  }

  // Method 8: Search for any alphanumeric pattern that could be a loan number
  Logger.log("Method 8: Searching for alphanumeric loan number patterns");
  const alphanumericElements = document.querySelectorAll('p, div, span, td');

  for (const element of alphanumericElements) {
    const text = element.textContent.trim();
    // Look for alphanumeric patterns (5-20 characters) that could be loan numbers
    if (/^[A-Z0-9]{5,20}$/i.test(text)) {
      // Additional validation: make sure it's not just a label or other content
      if (!text.toLowerCase().includes("loan") &&
        !text.toLowerCase().includes("number") &&
        !text.toLowerCase().includes("certificate") &&
        !text.toLowerCase().includes("company") &&
        !text.toLowerCase().includes("borrower") &&
        !text.toLowerCase().includes("policy") &&
        !text.toLowerCase().includes("address")) {
        Logger.success(`Found alphanumeric loan number via Method 8: ${text}`);
        return text;
      }
    }
  }

  Logger.warn("No loan number found using any method");
  return null;
}

/**
 * Enhanced form element handler with better error handling and logging
 */
async function handleFormElement() {
  try {
    Logger.log("Starting form element handling");

    // Refresh form elements to handle dynamic changes
    const formElement = new FormElement();

    // Find loan number from the page
    const loanNumber = getLoanNumberFromPage();

    if (!loanNumber) {
      Logger.log("No loan number found yet, will continue monitoring for changes");
      return false; // Return false to indicate we should keep waiting
    }

    Logger.success(`Processing loan number: ${loanNumber}`);

    // Check if loan is restricted
    const allowedLoans = await checkNumbersBatch([loanNumber]);

    if (allowedLoans.length === 0) {
      Logger.log("Loan is restricted, hiding content");
      formElement.removeCancelMIElement();
      formElement.addCancelMIElement();
      Logger.success("Content hidden successfully");
    } else {
      Logger.success("Loan is allowed, showing content");
    }

    return true; // Return true to indicate we're done processing
  } catch (error) {
    Logger.error("Error in handleFormElement:", error);
    return false;
  }
}

/**
 * Enhanced Mutation Observer with debouncing and better change detection
 */
function setupCaseObserver(globalTimeoutRef) {
  Logger.log("Setting up mutation observer");

  let processingTimeout = null;
  let lastProcessedContent = '';
  let processingCount = 0;
  let startTime = Date.now();
  const maxProcessingTime = 45000; // 45 seconds
  let lastProcessedLoanNumber = null;

  const observer = new MutationObserver((mutationList) => {
    // Check if we've exceeded the maximum processing time
    if (Date.now() - startTime > maxProcessingTime) {
      Logger.warn("Mutation observer timeout reached, disconnecting observer");
      observer.disconnect();
      return;
    }

    // Debounce the processing to avoid excessive calls
    if (processingTimeout) {
      clearTimeout(processingTimeout);
    }

    processingTimeout = setTimeout(() => {
      // Always check for changes on significant DOM mutations
      let hasSignificantChanges = false;
      let contentChanged = false;

      // Check for significant DOM changes
      for (const mutation of mutationList) {
        // Check for added nodes (new content)
        if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              // Check if this is a significant element (div, section, etc.)
              if (node.tagName === 'DIV' || node.tagName === 'SECTION' ||
                node.tagName === 'MAIN' || node.tagName === 'ARTICLE') {
                hasSignificantChanges = true;
                break;
              }

              // Check for relevant content
              const content = node.textContent || '';
              if (content.includes('Loan Number') ||
                content.includes('Cancel MI') ||
                /\b\d{5,}\b/.test(content) || // Loan number pattern
                content.includes('Certificate Number') ||
                content.includes('Company Name') ||
                content.includes('Borrower Name')) {
                hasSignificantChanges = true;
                break;
              }
            }
          }
        }

        // Also check for removed nodes (content being replaced)
        if (mutation.type === "childList" && mutation.removedNodes.length > 0) {
          for (const node of mutation.removedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE &&
              (node.tagName === 'DIV' || node.tagName === 'SECTION')) {
              hasSignificantChanges = true;
              break;
            }
          }
        }

        if (hasSignificantChanges) break;
      }

      // Check if overall content has changed significantly
      const currentContent = document.body.textContent;
      if (currentContent !== lastProcessedContent) {
        contentChanged = true;
        lastProcessedContent = currentContent;
      }

      // Process if we have significant changes or content changes
      if (hasSignificantChanges || contentChanged) {
        processingCount++;
        Logger.log(`DOM changes detected (attempt ${processingCount}), checking for loan number...`);

        // Always refresh form elements on significant changes
        const formElement = new FormElement();

        // Check if loan number is now available
        const loanNumber = getLoanNumberFromPage();

        if (loanNumber) {
          // Only process if this is a new loan number or we haven't processed it yet
          if (loanNumber !== lastProcessedLoanNumber) {
            Logger.success(`Loan number found after DOM change: ${loanNumber}`);
            lastProcessedLoanNumber = loanNumber;

            // Process the form with the new loan number
            handleFormElement().then(processed => {
              if (processed) {
                Logger.success("Successfully processed loan after DOM changes");
              } else {
                Logger.warn("Failed to process loan after DOM changes");
              }
            });
          } else {
            Logger.log(`Same loan number detected (${loanNumber}), skipping duplicate processing`);
          }
        } else {
          Logger.log("No loan number found yet, continuing to monitor...");
        }
      }
    }, 250); // Slightly reduced debounce for faster response
  });

  // Observe the entire document body for changes
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true // Also watch attribute changes as they might affect visibility
  });

  Logger.success("Enhanced mutation observer setup complete");
  return observer;
}

// Main entrypoint (this is where everything starts)
(async function () {
  Logger.log("Radian Filter Script starting...");

  // Global timeout mechanism - stop all processing after 45 seconds
  let globalTimeout;

  // create loader style.
  const style = createLoader();

  // Append loader style into header.
  document.head.appendChild(style);

  // Create loader element to load while connecting to extension.
  const loader = createLoaderElement();

  // Append loader element in to body.
  document.body.appendChild(loader);

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

      // Set up global timeout - but only for initial loading
      globalTimeout = setTimeout(() => {
        Logger.warn("Initial loading timeout reached after 45 seconds");
        // Only remove the loader, but keep the observer running
        const loaderElement = document.querySelector('#loaderOverlay');
        if (loaderElement) {
          loaderElement.remove();
        }
      }, 45000);

      // Check Loan extension connection
      await waitForListener();

      // Setup enhanced mutation observer to watch for content changes
      // This observer will continue running throughout the page lifecycle
      const observer = setupCaseObserver(globalTimeout);

      // Store observer reference in window object to prevent garbage collection
      // and ensure it continues running even after initial processing
      window._radianObserver = observer;

      // Initial check for loan number
      let isProcessed = await handleFormElement();

      if (isProcessed) {
        // Loan number was found and processed immediately
        Logger.success("Loan number processed immediately");
        clearTimeout(globalTimeout); // Clear the global timeout
        loader.remove();

        // IMPORTANT: Don't disconnect the observer - keep it running for future DOM changes
        // This is the key fix to ensure the script continues working after initial load
      } else {
        Logger.log("Loan number not found initially, will monitor for changes via mutation observer");
        // Remove loader since we're now monitoring for changes
        loader.remove();

        // Add periodic check as a backup to the mutation observer
        // This ensures we catch changes that might not trigger the mutation observer
        const periodicCheckInterval = setInterval(() => {
          const loanNumber = getLoanNumberFromPage();
          if (loanNumber) {
            Logger.log(`Loan number found during periodic check: ${loanNumber}`);
            handleFormElement().then(processed => {
              if (processed) {
                Logger.success("Successfully processed loan during periodic check");
              }
            });
          }
        }, 5000); // Check every 5 seconds

        // Store interval reference to prevent garbage collection
        window._radianCheckInterval = periodicCheckInterval;

        // Set a long timeout to eventually clear the interval (but keep the observer)
        setTimeout(() => {
          if (window._radianCheckInterval) {
            clearInterval(window._radianCheckInterval);
            Logger.log("Cleared periodic check interval after extended timeout");
          }
        }, 120000); // 2 minutes
      }

    } catch (error) {
      Logger.error("Extension connection failed:", error);
      // Continue without extension functionality
      loader.remove();

      // Still setup mutation observer for future changes
      const observer = setupCaseObserver(globalTimeout);

      // Store observer reference in window object
      window._radianObserver = observer;

      // Initial check for loan number even without extension
      let isProcessed = await handleFormElement();
      if (isProcessed) {
        Logger.success("Loan number processed without extension");
        clearTimeout(globalTimeout);
        // IMPORTANT: Don't disconnect the observer - keep it running
      } else {
        // Add periodic check as a backup
        const periodicCheckInterval = setInterval(() => {
          const loanNumber = getLoanNumberFromPage();
          if (loanNumber) {
            handleFormElement();
          }
        }, 5000);

        // Store interval reference
        window._radianCheckInterval = periodicCheckInterval;

        // Set a long timeout to eventually clear the interval
        setTimeout(() => {
          if (window._radianCheckInterval) {
            clearInterval(window._radianCheckInterval);
          }
        }, 120000); // 2 minutes
      }
    }
  }
})();
