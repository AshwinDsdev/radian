/*!
 * @description : Payment History Loan Filter Script
 * @portal : MI Online - Radian Payment History
 * @author : Accelirate Team
 * @group : Accelirate Team
 * @owner : Cenlar
 * @lastModified : 14-May-2025
 */

// ########## DO NOT MODIFY THESE LINES ##########
const EXTENSION_ID = "hellpeipojbghaaopdnddjakinlmocjl";

/**
 * Establish Communication with Loan Checker Extension
 */
async function waitForListener(maxRetries = 20, initialDelay = 100) {
  return new Promise((resolve, reject) => {
    if (
      typeof chrome === "undefined" ||
      !chrome.runtime ||
      !chrome.runtime.sendMessage
    ) {
      console.warn(
        "❌ Chrome extension API not available. Running in standalone mode."
      );
      showPage(true);
      resolve(false);
      return;
    }

    let attempts = 0;
    let delay = initialDelay;
    let timeoutId;

    function sendPing() {
      if (attempts >= maxRetries) {
        console.warn("❌ No listener detected after maximum retries.");
        clearTimeout(timeoutId);
        showPage(true);
        resolve(false);
        return;
      }

      chrome.runtime.sendMessage(
        EXTENSION_ID,
        {
          type: "ping",
        },
        (response) => {
          if (chrome.runtime.lastError) {
            console.warn("Chrome extension error:", chrome.runtime.lastError);
            attempts++;
            if (attempts >= maxRetries) {
              showPage(true);
              resolve(false);
              return;
            }
            timeoutId = setTimeout(sendPing, delay);
            return;
          }

          if (response?.result === "pong") {
            clearTimeout(timeoutId);
            resolve(true);
          } else {
            timeoutId = setTimeout(() => {
              attempts++;
              delay *= 2; // Exponential backoff
              sendPing();
            }, delay);
          }
        }
      );
    }

    sendPing();
  });
}

/**
 * Request a batch of numbers from the storage script
 */
async function checkNumbersBatch(numbers) {
  console.log("[radian_filter] checkNumbersBatch: Checking numbers", numbers);
  return new Promise((resolve, reject) => {
    chrome.runtime?.sendMessage(
      EXTENSION_ID,
      {
        type: "queryLoans",
        loanIds: numbers,
      },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error(
            "[radian_filter] checkNumbersBatch: chrome.runtime.lastError",
            chrome.runtime.lastError
          );
          return reject(chrome.runtime.lastError.message);
        } else if (response.error) {
          console.error(
            "[radian_filter] checkNumbersBatch: response.error",
            response.error
          );
          return reject(response.error);
        }

        const available = Object.keys(response.result).filter(
          (key) => response.result[key]
        );
        console.log("[radian_filter] checkNumbersBatch: available", available);
        resolve(available);
      }
    );
  });
}
// ########## DO NOT MODIFY THESE LINES - END ##########


/**
 * Logger utility for consistent debug output
 */
const logger = {
  debug: (...args) => console.debug('[PaymentHistoryFilter]', ...args),
  info: (...args) => console.info('[PaymentHistoryFilter]', ...args),
  warn: (...args) => console.warn('[PaymentHistoryFilter]', ...args),
  error: (...args) => console.error('[PaymentHistoryFilter]', ...args),
};

// ########## LOADER MANAGEMENT ##########

const LoaderManager = {
  createStyles() {
    const style = document.createElement("style");
    style.textContent = `
      #paymentHistoryLoader {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(255, 255, 255, 0.95);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        z-index: 99999;
        transition: opacity 0.3s ease;
        font-family: Arial, sans-serif;
      }
      .payment-spinner {
        width: 80px;
        height: 80px;
        border: 8px solid #e0e0e0;
        border-top-color: #2b6cb0;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin-bottom: 20px;
      }
      @keyframes spin {
        to {transform: rotate(360deg);}
      }
      #paymentHistoryLoader.hidden {
        opacity: 0;
        pointer-events: none;
      }
      .loader-text {
        font-size: 18px;
        color: #2b6cb0;
        font-weight: 500;
        text-align: center;
        max-width: 400px;
        line-height: 1.4;
      }
      .loader-steps {
        margin-top: 15px;
        font-size: 14px;
        color: #666;
        text-align: center;
      }
    `;
    return style;
  },

  createElement() {
    const loader = document.createElement("div");
    loader.id = "paymentHistoryLoader";

    const spinner = document.createElement("div");
    spinner.className = "payment-spinner";

    const loadingText = document.createElement("div");
    loadingText.className = "loader-text";
    loadingText.textContent = "Verifying loan access permissions...";

    const stepsText = document.createElement("div");
    stepsText.className = "loader-steps";
    stepsText.id = "paymentLoaderSteps";
    stepsText.textContent = "Initializing...";

    loader.appendChild(spinner);
    loader.appendChild(loadingText);
    loader.appendChild(stepsText);

    return loader;
  },

  show() {
    const existingLoader = document.getElementById("paymentHistoryLoader");
    if (existingLoader) {
      existingLoader.remove();
    }

    const style = this.createStyles();
    const loader = this.createElement();

    if (document.head && style) {
      document.head.appendChild(style);
    }
    if (document.body && loader) {
      document.body.appendChild(loader);
    }
  },

  updateText(stepText) {
    const stepsElement = document.getElementById("paymentLoaderSteps");
    if (stepsElement) {
      stepsElement.textContent = stepText;
    }
  },

  hide() {
    const loader = document.getElementById("paymentHistoryLoader");
    if (loader && loader.parentNode) {
      loader.classList.add("hidden");
      setTimeout(() => {
        if (loader.parentNode) {
          loader.parentNode.removeChild(loader);
        }

        // Remove the temporary style that hides content
        const tempStyle = document.getElementById("temporary-content-hide");
        if (tempStyle && tempStyle.parentNode) {
          tempStyle.parentNode.removeChild(tempStyle);
        }

        // Make content visible again
        document.documentElement.style.visibility = "";
      }, 300);
    }
  }
};

// ########## CONTEXT DETECTION ##########

/**
 * Detect if we're in InquiryMIInformation.aspx context (frmMIOnlineContent iframe)
 */
function isInquiryMIInformationContext() {
  try {
    // Only check for content indicators, no URL checks
    if (document.body && document.body.textContent &&
      document.body.textContent.includes('Lender/Servicer Loan Number')) {
      logger.info("✅ In InquiryMIInformation context (content detected)");
      return true;
    }

    return false;
  } catch (error) {
    logger.warn("⚠️ Error detecting InquiryMIInformation context:", error);
    return false;
  }
}

// ########## MUTATION OBSERVER ##########

/**
 * Set up mutation observer to handle dynamic content loading
 */
function setupMutationObserver() {
  if (window.paymentHistoryMutationObserver) {
    return; // Already set up
  }

  // Create a debounced version of hideNavigationLinks to avoid excessive calls
  let navLinksDebounceTimer = null;
  const debouncedHideNavigationLinks = () => {
    clearTimeout(navLinksDebounceTimer);
    navLinksDebounceTimer = setTimeout(() => {
      hideNavigationLinks();
    }, 300);
  };

  // Track URL changes to detect navigation
  let lastUrl = window.location.href;

  const observer = new MutationObserver((mutations) => {
    let shouldCheckLinks = false;
    let shouldCheckLoanInfo = false;

    // Check if URL changed (navigation happened)
    if (lastUrl !== window.location.href) {
      lastUrl = window.location.href;
      logger.info("🔄 URL changed - will re-apply navigation controls");
      shouldCheckLinks = true;
      shouldCheckLoanInfo = true;
    }

    // Check mutations for relevant changes
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

      // For added nodes, check for both navigation and loan info
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node;

            // Check for navigation elements
            if (element.querySelector &&
              (element.querySelector('a') ||
                element.querySelector('button') ||
                element.querySelector('[role="menuitem"]') ||
                element.querySelector('.menu-item'))) {
              shouldCheckLinks = true;
            }

            // Check for loan information
            if (element.textContent && element.textContent.includes('Lender/Servicer Loan Number')) {
              logger.info("🔄 Dynamic content detected with loan information");
              shouldCheckLoanInfo = true;
            }
          }
        }
      }
    });

    // Handle navigation links if needed
    if (shouldCheckLinks) {
      logger.debug("🔄 Navigation-related changes detected - re-applying link controls");
      debouncedHideNavigationLinks();
    }

    // Handle loan information if needed
    if (shouldCheckLoanInfo) {
      setTimeout(() => {
        if (isInquiryMIInformationContext() && !window.paymentHistoryLoanChecked) {
          logger.info("🔄 Re-initializing due to dynamic content with loan information");
          window.paymentHistoryLoanChecked = true;
          handleInquiryMIInformationContext();
        }
      }, 500);
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['style', 'class', 'display', 'visibility']
  });

  // Also set up a periodic check for navigation links as a fallback
  const periodicCheckInterval = setInterval(() => {
    hideNavigationLinks();
  }, 3000);
  
  // Add event listeners for page load events to catch all possible DOM changes
  window.addEventListener('DOMContentLoaded', hideNavigationLinks);
  window.addEventListener('load', hideNavigationLinks);
  
  // Listen for iframe load events
  function setupIframeListeners() {
    const iframes = document.querySelectorAll('iframe');
    iframes.forEach(iframe => {
      try {
        iframe.addEventListener('load', hideNavigationLinks);
      } catch (e) {
        // Ignore cross-origin errors
      }
    });
  }
  
  // Initial iframe setup and periodic check for new iframes
  setupIframeListeners();
  setInterval(setupIframeListeners, 5000);
  
  // Store references to clean up if needed
  window.paymentHistoryMutationObserver = observer;
  window.paymentHistoryPeriodicCheck = periodicCheckInterval;

  logger.info("✅ Enhanced mutation observer set up for dynamic content and navigation");
}

// ########## UTILITY FUNCTIONS ##########

/**
 * Apply styles to an element safely
 */
function applyElementStyles(element, styles) {
  if (!element || !styles) return;
  Object.entries(styles).forEach(([property, value]) => {
    element.style[property] = value;
  });
}

/**
 * Create unauthorized access message element
 */
function createUnauthorizedElement() {
  // Create a centered card that fits within the parent container (e.g., contentmenu)
  const unauthorizedContainer = document.createElement("div");
  applyElementStyles(unauthorizedContainer, {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
    minHeight: "200px",
    backgroundColor: "#f8f9fa",
    border: "2px solid #dc3545",
    borderRadius: "8px",
    boxShadow: "0 4px 8px rgba(0, 0, 0, 0.1)",
    margin: "20px 0",
    zIndex: "1000"
  });

  const messageContainer = document.createElement("div");
  applyElementStyles(messageContainer, {
    textAlign: "center",
    color: "#dc3545",
    fontSize: "18px",
    fontWeight: "bold",
    padding: "20px",
  });

  const iconElement = document.createElement("i");
  iconElement.className = "fas fa-exclamation-triangle";
  applyElementStyles(iconElement, {
    fontSize: "24px",
    marginBottom: "10px",
  });

  const textElement = document.createElement("div");
  textElement.textContent = "You are not authorized to view this loan information";
  applyElementStyles(textElement, {
    marginTop: "10px",
  });

  messageContainer.appendChild(iconElement);
  messageContainer.appendChild(textElement);
  unauthorizedContainer.appendChild(messageContainer);

  return unauthorizedContainer;
}

// ########## IFRAME MONITORING ##########

/**
 * Wait for payment history iframe to load after tab click
 */
async function waitForPaymentHistoryIframe(maxAttempts = 30, interval = 1000) {
  return new Promise((resolve, reject) => {
    let attempts = 0;

    function checkForIframe() {
      // Look for the payment history iframe
      const paymentIframe = document.querySelector('#containerTab_tabPaymentHistory_frmPaymentHistory');

      if (paymentIframe) {
        try {
          // Check if iframe is accessible and has loaded content
          if (paymentIframe.contentDocument && paymentIframe.contentWindow) {
            const iframeDoc = paymentIframe.contentDocument;

            // Check if iframe has substantial content (not just loading)
            const hasContent = iframeDoc.body &&
              (iframeDoc.body.children.length > 0 ||
                iframeDoc.querySelector('#_LblLenderNumInfo') ||
                iframeDoc.querySelector('table'));

            if (hasContent && iframeDoc.readyState === 'complete') {
              logger.info("✅ Payment history iframe loaded with content");
              resolve(paymentIframe);
              return;
            } else if (hasContent) {
              logger.debug("📋 Payment history iframe has content but still loading...");
            }
          }
        } catch (e) {
          logger.warn("⚠️ Payment iframe found but not accessible:", e.message);
        }
      }

      if (++attempts < maxAttempts) {
        if (attempts === 1) {
          logger.info("⏳ Waiting for payment history iframe to load...");
        }
        if (attempts % 5 === 0) {
          logger.debug(`⏳ Still waiting for payment iframe... (attempt ${attempts}/${maxAttempts})`);
        }
        setTimeout(checkForIframe, interval);
      } else {
        reject(new Error("Payment history iframe not found or not accessible"));
      }
    }

    checkForIframe();
  });
}

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
  logger.info("🔒 Hiding specific action elements except Notes and Print");

  try {
    // Find all links and buttons
    const allElements = document.querySelectorAll('a, button, .menu-item, [role="menuitem"], [role="button"], .nav-link, .navigation-item');
    let hiddenCount = 0;
    let preservedCount = 0;

    logger.debug(`🔍 Checking ${allElements.length} potential navigation elements...`);

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
        logger.debug(`    🚫 Hidden: "${text}"`);
      } else if (shouldPreserve) {
        // Mark as preserved
        element.setAttribute('data-preserved-by-filter', 'true');
        preservedCount++;
        logger.debug(`    ✅ Preserving: "${text}"`);
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
                logger.debug(`    🚫 Hidden in iframe: "${text}"`);
              }
            });
          }
        } catch (e) {
          // Silently ignore cross-origin iframe errors
        }
      });
    } catch (iframeError) {
      logger.debug("⚠️ Error accessing iframes:", iframeError);
    }

    logger.info(`✅ Action elements control applied - ${hiddenCount} elements hidden, ${preservedCount} elements preserved`);

  } catch (error) {
    logger.error("❌ Error hiding action elements:", error);
  }
}

// ########## ACCESS CONTROL ##########

/**
 * Hide contentmenu div and show unauthorized message
 */
function hideInquiryMIInformationFrame() {
  logger.info("🔒 Hiding contentmenu div - unauthorized access");

  // Find the contentmenu div
  const contentMenuDiv = document.querySelector('.contentmenu');
  if (contentMenuDiv) {
    // Create unauthorized message
    const unauthorizedElement = createUnauthorizedElement();

    // Insert the unauthorized message in place of the contentmenu div
    if (contentMenuDiv.parentNode && unauthorizedElement) {
      contentMenuDiv.parentNode.insertBefore(unauthorizedElement, contentMenuDiv);
      contentMenuDiv.style.display = "none";
      logger.info("✅ contentmenu div hidden and unauthorized message placed in its position");
    } else {
      // Fallback: just hide the contentmenu div
      contentMenuDiv.style.display = "none";
      logger.info("✅ contentmenu div hidden successfully");
    }
  } else {
    logger.warn("⚠️ contentmenu div not found, falling back to full content hiding");
    // Fallback: Hide all content if contentmenu div is not found
    const allElements = document.querySelectorAll("body > *:not(script):not(style)");
    if (allElements && allElements.length > 0) {
      allElements.forEach((element) => {
        if (element && element.id !== "paymentHistoryLoader") {
          element.style.display = "none";
        }
      });
    }

    // Show unauthorized message at body level as fallback
    const unauthorizedElement = createUnauthorizedElement();
    const documentBody = document.body;
    if (documentBody && unauthorizedElement) {
      documentBody.appendChild(unauthorizedElement);
    }
  }

  logger.info("✅ Unauthorized message displayed");
}

// ########## MAIN LOGIC ##########

/**
 * Handle Payment History context - check loan access from within payhist_viewAll.html
 */
async function handlePaymentHistoryContext() {
  try {
    logger.info("🔄 Handling Payment History context");
    LoaderManager.show();
    LoaderManager.updateText("Checking loan access permissions...");

    // Wait a bit for the page to stabilize
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Extract loan number using the new structure
    LoaderManager.updateText("Extracting loan number...");
    const loanNumber = extractLoanNumberDirectly();

    if (!loanNumber) {
      LoaderManager.updateText("Error: Loan number not found");
      setTimeout(() => LoaderManager.hide(), 2000);
      return;
    }

    // Check loan access
    LoaderManager.updateText(`Verifying access for loan ${loanNumber}...`);
    const allowedLoans = await checkNumbersBatch([loanNumber]);

    if (!allowedLoans || allowedLoans.length === 0) {
      LoaderManager.updateText("Access denied - Hiding restricted content...");
      logger.debug(`🚫 Loan ${loanNumber} is restricted`);

      // Hide content and show unauthorized message  
      setTimeout(() => {
        LoaderManager.hide();

        // Hide only the contentmenu div which contains the loan information
        const contentMenuDiv = document.querySelector('.contentmenu');
        if (contentMenuDiv) {
          // Create unauthorized message
          const unauthorizedElement = createUnauthorizedElement();

          // Insert the unauthorized message in place of the contentmenu div
          if (contentMenuDiv.parentNode && unauthorizedElement) {
            contentMenuDiv.parentNode.insertBefore(unauthorizedElement, contentMenuDiv);
            contentMenuDiv.style.display = "none";
            logger.info("✅ contentmenu div hidden and unauthorized message placed in its position in payment history context");
          } else {
            // Fallback: just hide the contentmenu div
            contentMenuDiv.style.display = "none";
            logger.info("✅ contentmenu div hidden successfully in payment history context");
          }
        } else {
          logger.warn("⚠️ contentmenu div not found, falling back to full content hiding");
          // Fallback: Hide all content if contentmenu div is not found
          const allElements = document.querySelectorAll("body > *:not(script):not(style)");
          allElements.forEach((element) => {
            if (element && element.id !== "paymentHistoryLoader") {
              element.style.display = "none";
            }
          });

          // Show unauthorized message at body level as fallback
          const unauthorizedElement = createUnauthorizedElement();
          if (document.body) {
            document.body.appendChild(unauthorizedElement);
          }
        }
      }, 1000);
    } else {
      LoaderManager.updateText("Access granted");
      logger.debug(`✅ Loan ${loanNumber} is authorized`);
      setTimeout(() => LoaderManager.hide(), 1000);
    }

  } catch (error) {
    logger.error("❌ Error in Payment History context handling:", error);
    LoaderManager.updateText("Error occurred during access verification");
    setTimeout(() => LoaderManager.hide(), 2000);
  }
}

/**
 * Extract loan number directly from InquiryMIInformation page - simplified for new structure
 */
function extractLoanNumberDirectly() {
  try {
    logger.info("🔍 Starting loan number extraction...");

    // Method 1: Find elements containing "Lender/Servicer Loan Number"
    const allElements = document.querySelectorAll('*');
    logger.debug(`Found ${allElements.length} elements to search`);

    for (const element of allElements) {
      if (element.textContent && element.textContent.trim() === 'Lender/Servicer Loan Number') {
        logger.info("📍 Found 'Lender/Servicer Loan Number' label");

        // Found the label, look for the next sibling div that contains the loan number
        const parentDiv = element.closest('div');
        if (parentDiv && parentDiv.nextElementSibling) {
          const nextDiv = parentDiv.nextElementSibling;
          const pElement = nextDiv.querySelector('p');
          if (pElement && pElement.textContent) {
            const loanNumber = pElement.textContent.trim();
            logger.debug(`Found potential loan number: '${loanNumber}'`);
            if (loanNumber && /^\d+$/.test(loanNumber)) {
              logger.info(`✅ Extracted loan number: ${loanNumber}`);
              return loanNumber;
            }
          }
        }
      }
    }

    // Method 2: Broader search for numeric patterns near loan-related text
    logger.debug("🔍 Trying broader extraction method...");
    const textContent = document.body.textContent || "";
    if (textContent.includes('Lender/Servicer Loan Number')) {
      // Look for numeric patterns after the label
      const patterns = textContent.match(/Lender\/Servicer Loan Number[\s\S]{0,200}?\b(\d{6,})\b/);
      if (patterns && patterns[1]) {
        const loanNumber = patterns[1];
        logger.info(`✅ Extracted loan number via pattern: ${loanNumber}`);
        return loanNumber;
      }
    }

    logger.warn("⚠️ No loan number found with any method");
    return null;
  } catch (error) {
    logger.error("❌ Error extracting loan number:", error);
    return null;
  }
}

/**
 * Handle InquiryMIInformation context - extract loan number directly and check access
 */
async function handleInquiryMIInformationContext() {
  try {
    logger.info("🔄 Starting loan access verification");
    LoaderManager.show();
    LoaderManager.updateText("Extracting loan number directly...");

    // Small delay to ensure page is ready
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Extract loan number directly from the page
    LoaderManager.updateText("Extracting loan number from page...");
    const loanNumber = extractLoanNumberDirectly();

    if (!loanNumber) {
      logger.warn("❌ No loan found - stopping verification");
      LoaderManager.updateText("Error: Loan number not found");
      setTimeout(() => {
        LoaderManager.hide();
      }, 2000);
      return;
    }

    // Check loan access
    logger.info(`🔍 Checking loan access for: ${loanNumber}`);
    LoaderManager.updateText(`Verifying access for loan ${loanNumber}...`);
    const allowedLoans = await checkNumbersBatch([loanNumber]);

    if (!allowedLoans || allowedLoans.length === 0) {
      LoaderManager.updateText("Access denied - Hiding restricted content...");
      logger.info(`🚫 Loan ${loanNumber} is RESTRICTED - hiding content`);

      // Hide the entire InquiryMIInformation frame
      setTimeout(() => {
        LoaderManager.hide();
        hideInquiryMIInformationFrame();
      }, 1000);
    } else {
      LoaderManager.updateText("Access granted");
      logger.info(`✅ Loan ${loanNumber} is AUTHORIZED - showing content`);
      setTimeout(() => LoaderManager.hide(), 1000);
    }

  } catch (error) {
    logger.error("❌ Error in InquiryMIInformation context handling:", error);
    LoaderManager.updateText("Error occurred during access verification");
    setTimeout(() => LoaderManager.hide(), 2000);
  }
}

// ########## INITIALIZATION ##########

/**
 * Global execution flags to prevent multiple runs
 */
window.paymentHistoryFilterExecuted = window.paymentHistoryFilterExecuted || false;
window.paymentHistoryLoanChecked = window.paymentHistoryLoanChecked || false;

/**
 * Main initialization function
 */
async function initializePaymentHistoryFilter() {
  // Prevent multiple executions
  if (window.paymentHistoryFilterExecuted) {
    logger.warn("⚠️ Payment history filter already executed, skipping");
    return;
  }

  window.paymentHistoryFilterExecuted = true;
  logger.info("🚀 Initializing Payment History Filter");

  // Check if loader is already shown (from immediate execution)
  const loaderAlreadyShown = document.getElementById("paymentHistoryLoader");

  // Show loader if not already shown and in relevant context
  if (!loaderAlreadyShown && (isInquiryMIInformationContext())) {
    logger.info("🔒 Showing loader to prevent content exposure");
    LoaderManager.show();
    LoaderManager.updateText("Initializing access verification...");
  }

  try {
    // Set up mutation observer for dynamic content
    setupMutationObserver();

    // First, establish connection with the extension
    logger.info("🔗 Establishing connection with extension...");
    await waitForListener();
    logger.info("✅ Extension connection established successfully");

    // Hide navigation links after successful connection
    hideNavigationLinks();

    // Now determine context and handle accordingly
    if (isInquiryMIInformationContext()) {
      logger.info("📍 Detected InquiryMIInformation context - will start automated loan check");
      // Start automated process after DOM is ready
      setTimeout(() => handleInquiryMIInformationContext(), 1000);
    }
    else {
      logger.info("📍 Not in recognized context - script will remain dormant");
      // Hide loader if not in recognized context
      LoaderManager.hide();
    }

  } catch (error) {
    logger.error("❌ Failed to establish extension connection:", error);
    logger.warn("⚠️ Script will not function without extension connection");
    // Hide loader on error
    LoaderManager.hide();
  }
}

// ########## AUTO-START ##########

// Show loader immediately to prevent content flash
// This must happen before any other processing and before DOM is fully loaded
(function showLoaderImmediately() {
  try {
    // Show loader immediately regardless of context to prevent any content flash
    // We'll hide it later if we're not in the right context
    logger.info("🔒 Showing loader immediately to prevent content exposure");
    LoaderManager.show();
    LoaderManager.updateText("Initializing access verification...");

    // Hide all content temporarily until we can verify access
    document.documentElement.style.visibility = "hidden";

    // Create and insert a style element to hide content immediately
    const style = document.createElement("style");
    style.id = "temporary-content-hide";
    style.textContent = `
      body > *:not(#paymentHistoryLoader) {
        visibility: hidden !important;
      }
      #paymentHistoryLoader {
        visibility: visible !important;
      }
    `;
    document.head.appendChild(style);
  } catch (error) {
    logger.warn("⚠️ Could not show loader immediately:", error);
  }
})();

// Start initialization when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(initializePaymentHistoryFilter, 100);
  });
} else {
  setTimeout(initializePaymentHistoryFilter, 100);
}

logger.info("📜 Payment History Filter script loaded");