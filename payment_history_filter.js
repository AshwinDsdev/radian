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
    let attempts = 0;
    let delay = initialDelay;
    let timeoutId;

    function sendPing() {
      if (attempts >= maxRetries) {
        console.warn("❌ No listener detected after maximum retries.");
        clearTimeout(timeoutId);
        reject(new Error("Listener not found"));
        return;
      }

      console.log(`🔄 Sending ping attempt ${attempts + 1}/${maxRetries}...`);

      chrome.runtime.sendMessage(
        EXTENSION_ID,
        {
          type: "ping",
        },
        (response) => {
          if (chrome.runtime.lastError) {
            console.warn(
              "❌ Chrome runtime error:",
              chrome.runtime.lastError.message
            );
            timeoutId = setTimeout(() => {
              attempts++;
              delay *= 2; // Exponential backoff (100ms → 200ms → 400ms...)
              sendPing();
            }, delay);
            return;
          }

          if (response?.result === "pong") {
            console.log("✅ Listener detected!");
            clearTimeout(timeoutId);
            resolve(true);
          } else {
            console.warn("❌ No listener detected, retrying...");
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
    if (
      typeof chrome === "undefined" ||
      !chrome.runtime ||
      !chrome.runtime.sendMessage
    ) {
      console.warn("❌ Chrome extension API not available. Running in standalone mode.");
      // Return empty array if Chrome extension API is not available
      resolve([]);
      return;
    }

    chrome.runtime.sendMessage(
      EXTENSION_ID,
      {
        type: "queryLoans",
        loanIds: numbers,
      },
      (response) => {
        if (chrome.runtime.lastError) {
          return reject(chrome.runtime.lastError.message);
        } else if (response.error) {
          return reject(response.error);
        }

        const available = Object.keys(response.result).filter(
          (key) => response.result[key]
        );
        resolve(available);
      }
    );
  });
}

// ########## DO NOT MODIFY THESE LINES - END ##########

/**
 * Check if we're in the target iframe context
 */
function isTargetIframeContext() {
  try {
    const currentUrl = window.location.href;
    const pathname = window.location.pathname;

    // Check if we're in the deepest iframe (payhist_viewAll.html)
    if (currentUrl.includes('payhist_viewAll') || pathname.includes('payhist_viewAll')) {
      console.log("✅ In target payhist_viewAll iframe context");
      return true;
    }

    // Check if document contains payment history specific elements
    const paymentHistoryIndicators = [
      '#_LblLenderNumInfo',
      '#payhist_viewAll_table',
      'table[id*="payhist"]',
      '.payment-history'
    ];

    for (const selector of paymentHistoryIndicators) {
      if (document.querySelector(selector)) {
        console.log(`✅ Found payment history indicator: ${selector}`);
        return true;
      }
    }

    // Check if we can access parent frames that might indicate we're in the right context
    try {
      if (window.frameElement && window.frameElement.src &&
        window.frameElement.src.includes('payhist')) {
        console.log("✅ Frame element indicates payment history context");
        return true;
      }
    } catch (e) {
      // Cross-origin access restriction, but that's ok
    }

    return false;
  } catch (error) {
    console.warn("⚠️ Error checking iframe context:", error);
    return false;
  }
}

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
  const unauthorizedContainer = document.createElement("div");

  // Apply container styles
  applyElementStyles(unauthorizedContainer, {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    height: "200px",
    backgroundColor: "#f8f9fa",
    border: "2px solid #dc3545",
    borderRadius: "8px",
    margin: "20px",
  });

  const messageContainer = document.createElement("div");

  // Apply message container styles
  applyElementStyles(messageContainer, {
    textAlign: "center",
    color: "#dc3545",
    fontSize: "18px",
    fontWeight: "bold",
    padding: "20px",
  });

  // Create icon element
  const iconElement = document.createElement("i");
  iconElement.className = "fas fa-exclamation-triangle";
  applyElementStyles(iconElement, {
    fontSize: "24px",
    marginBottom: "10px",
  });

  // Create text content
  const textElement = document.createElement("div");
  textElement.textContent = "You are not authorized to view restricted loans";
  applyElementStyles(textElement, {
    marginTop: "10px",
  });

  // Assemble the elements
  messageContainer.appendChild(iconElement);
  messageContainer.appendChild(textElement);
  unauthorizedContainer.appendChild(messageContainer);

  return unauthorizedContainer;
}

/**
 * Create loader to show when trying to establish connection with extension
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
      background: rgba(255, 255, 255, 0.95);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      z-index: 99999;
      transition: opacity 0.3s ease;
      font-family: Arial, sans-serif;
    }
    .spinner {
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
    #loaderOverlay.hidden {
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
}

/**
 * Create Loader Element
 */
function createLoaderElement() {
  const loader = document.createElement("div");
  loader.id = "loaderOverlay";

  const spinner = document.createElement("div");
  spinner.className = "spinner";

  const loadingText = document.createElement("div");
  loadingText.className = "loader-text";
  loadingText.textContent = "Verifying loan access permissions...";

  const stepsText = document.createElement("div");
  stepsText.className = "loader-steps";
  stepsText.id = "loaderSteps";
  stepsText.textContent = "Initializing...";

  loader.appendChild(spinner);
  loader.appendChild(loadingText);
  loader.appendChild(stepsText);

  return loader;
}

/**
 * Show loader during extension communication
 */
function showLoader() {
  const style = createLoader();
  const loader = createLoaderElement();

  // Safe DOM manipulation with null checks
  const documentHead = document.head;
  const documentBody = document.body;

  if (documentHead && style) {
    documentHead.appendChild(style);
  }

  if (documentBody && loader) {
    documentBody.appendChild(loader);
  }
}

/**
 * Update loader text during process
 */
function updateLoaderText(stepText) {
  const stepsElement = document.getElementById("loaderSteps");
  if (stepsElement) {
    stepsElement.textContent = stepText;
  }
}

/**
 * Hide loader after extension communication
 */
function hideLoader() {
  const loader = document.getElementById("loaderOverlay");
  if (loader && loader.parentNode) {
    loader.classList.add("hidden");
    setTimeout(() => {
      if (loader.parentNode) {
        loader.parentNode.removeChild(loader);
      }
    }, 300);
  }
}

/**
 * Hide the entire InquiryMIInformation.html iframe when loan is restricted
 */
function hideInquiryMIInformationIframe() {
  try {
    // We're currently in the deepest iframe (payhist_viewAll.html)
    // Need to navigate up to hide the InquiryMIInformation.html iframe

    // Get the parent frame (InquiryMIInformation.html)
    const currentFrame = window.frameElement;
    if (!currentFrame) {
      console.warn("⚠️ Could not access current frame element");
      return;
    }

    // Get the parent document (InquiryMIInformation.html)
    const inquiryDoc = currentFrame.ownerDocument;
    if (!inquiryDoc) {
      console.warn("⚠️ Could not access InquiryMIInformation document");
      return;
    }

    // Get the InquiryMIInformation iframe element (from mionlineNavigation.html)
    const inquiryFrame = inquiryDoc.defaultView.frameElement;
    if (!inquiryFrame) {
      console.warn("⚠️ Could not access InquiryMIInformation iframe element");
      return;
    }

    // Hide the entire InquiryMIInformation.html iframe
    inquiryFrame.style.display = 'none';

    // Get the navigation document to show access denied message
    const navDoc = inquiryFrame.ownerDocument;
    if (navDoc) {
      showAccessDeniedMessageInNavFrame(navDoc);
    }

    console.log("✅ Successfully hid InquiryMIInformation.html iframe");

  } catch (error) {
    console.error("❌ Error hiding InquiryMIInformation.html iframe:", error);
    // Fallback: hide content in current frame
    hideCurrentFrameContent();
  }
}

/**
 * Show access denied message in the navigation frame
 */
function showAccessDeniedMessageInNavFrame(navDoc) {
  try {
    // Remove any existing access denied message
    const existingMsg = navDoc.querySelector('.access-denied-message');
    if (existingMsg) {
      existingMsg.remove();
    }

    // Create and show access denied message
    const accessDeniedDiv = navDoc.createElement('div');
    accessDeniedDiv.className = 'access-denied-message';
    accessDeniedDiv.innerHTML = `
      <div style="
        background-color: #f8f9fa;
        border: 2px solid #dc3545;
        border-radius: 8px;
        padding: 20px;
        margin: 20px;
        text-align: center;
        font-family: Arial, sans-serif;
        position: relative;
        z-index: 9999;
      ">
        <p style="color: #6c757d; margin-bottom: 15px;">
          You do not have permission to view payment history for this loan number.
        </p>
      </div>
    `;

    // Insert the message in the navigation frame
    const container = navDoc.body || navDoc.documentElement;
    if (container) {
      container.appendChild(accessDeniedDiv);
    }

    console.log("✅ Access denied message shown in navigation frame");

  } catch (error) {
    console.error("❌ Error showing access denied message:", error);
  }
}

/**
 * Fallback: Hide content in current frame
 */
function hideCurrentFrameContent() {
  console.log("🔒 Fallback: Hiding content in current frame");

  // Hide all existing content safely
  const allElements = document.querySelectorAll(
    "body > *:not(script):not(style)"
  );
  if (allElements && allElements.length > 0) {
    allElements.forEach((element) => {
      if (element && element.id !== "loaderOverlay") {
        element.style.display = "none";
      }
    });
  }

  // Show unauthorized message in current frame
  const unauthorizedElement = createUnauthorizedElement();
  const documentBody = document.body;
  if (documentBody && unauthorizedElement) {
    documentBody.appendChild(unauthorizedElement);
  }
}

/**
 * Click Payment History tab programmatically in the parent iframe
 */
async function clickPaymentHistoryTab() {
  return new Promise((resolve, reject) => {
    try {
      // We need to access the InquiryMIInformation.html document where the tabs are located
      // Current context: payhist_viewAll.html (deepest iframe)
      // Need to access: InquiryMIInformation.html (parent iframe)

      let inquiryDoc = null;

      // Try to get the InquiryMIInformation document
      try {
        // Get current frame element
        const currentFrame = window.frameElement;
        if (currentFrame) {
          // Get the parent document (InquiryMIInformation.html)
          inquiryDoc = currentFrame.ownerDocument;
          console.log("📋 Accessed InquiryMIInformation document via frameElement");
        }
      } catch (error) {
        console.warn("⚠️ Could not access parent document via frameElement:", error);
      }

      // Fallback: try to access via parent window
      if (!inquiryDoc) {
        try {
          if (window.parent && window.parent.document) {
            inquiryDoc = window.parent.document;
            console.log("📋 Accessed parent document via window.parent");
          }
        } catch (error) {
          console.warn("⚠️ Could not access parent document via window.parent:", error);
        }
      }

      if (!inquiryDoc) {
        console.warn("⚠️ Could not access InquiryMIInformation document");
        reject(new Error("Could not access parent document"));
        return;
      }

      // Specific selectors for Payment History tab based on the actual HTML structure
      const paymentHistorySelectors = [
        '#__tab_containerTab_tabPaymentHistory',  // Exact ID from HTML
        'a[id="__tab_containerTab_tabPaymentHistory"]',
        '#containerTab_tabPaymentHistory_tab a',  // Tab wrapper with link
        'span[id="containerTab_tabPaymentHistory_tab"] a'
      ];

      let paymentHistoryTab = null;

      // Try each specific selector first in the parent document
      for (const selector of paymentHistorySelectors) {
        const element = inquiryDoc.querySelector(selector);
        if (element) {
          paymentHistoryTab = element;
          console.log(`📋 Found Payment History tab using selector: ${selector}`);
          break;
        }
      }

      // Fallback: look for tab with "Payment History" text but only in tab containers
      if (!paymentHistoryTab) {
        const tabSelectors = [
          '.ajax__tab_tab',
          '.ajax__tab_header a',
          '[class*="tab"] a'
        ];

        for (const selector of tabSelectors) {
          const elements = inquiryDoc.querySelectorAll(selector);
          for (const element of elements) {
            if (element.textContent && element.textContent.toLowerCase().includes('payment history')) {
              paymentHistoryTab = element;
              console.log(`📋 Found Payment History tab via text search: ${selector}`);
              break;
            }
          }
          if (paymentHistoryTab) break;
        }
      }

      if (!paymentHistoryTab) {
        console.warn("⚠️ Payment History tab not found in parent document");
        reject(new Error("Payment History tab not found"));
        return;
      }

      console.log("📋 Payment History tab element:", paymentHistoryTab);
      console.log("📋 Tab text content:", paymentHistoryTab.textContent);

      // Click the tab in the parent document
      paymentHistoryTab.click();

      console.log("✅ Payment History tab clicked in parent document");
      resolve(true);

    } catch (error) {
      console.error("❌ Error clicking Payment History tab:", error);
      reject(error);
    }
  });
}

/**
 * Wait for payment history table to become visible
 */
async function waitForPaymentHistoryTable(maxAttempts = 30, interval = 500) {
  return new Promise((resolve, reject) => {
    let attempts = 0;

    function checkForTable() {
      // More specific selectors for payment history table
      const tableSelectors = [
        '#payhist_viewAll_table',  // Most specific
        'table[id*="payhist"]',
        'table[class*="payment"]',
        '.payment-history-table',
        'table'  // Fallback
      ];

      let paymentTable = null;

      for (const selector of tableSelectors) {
        const elements = document.querySelectorAll(selector);
        for (const element of elements) {
          if (element && element.offsetParent !== null) { // Check if visible
            // For generic table selector, check if it contains payment-related content
            if (selector === 'table') {
              const tableText = element.textContent.toLowerCase();
              if (tableText.includes('payment') || tableText.includes('date') ||
                tableText.includes('amount') || tableText.includes('history') ||
                tableText.includes('premium') || tableText.includes('due')) {
                paymentTable = element;
                console.log(`📋 Found payment table via content check: ${selector}`);
                break;
              }
            } else {
              paymentTable = element;
              console.log(`📋 Found payment table using selector: ${selector}`);
              break;
            }
          }
        }
        if (paymentTable) break;
      }

      if (paymentTable) {
        console.log("✅ Payment history table found and visible:", paymentTable);
        resolve(paymentTable);
      } else if (++attempts < maxAttempts) {
        if (attempts === 1) {
          console.log("⏳ Waiting for payment history table to load...");
        }
        setTimeout(checkForTable, interval);
      } else {
        console.warn("⚠️ Payment history table not found after maximum attempts");
        reject(new Error("Payment history table not found"));
      }
    }

    checkForTable();
  });
}

/**
 * Click MI Information tab to return to default view in the parent iframe
 */
async function clickMIInformationTab() {
  return new Promise((resolve, reject) => {
    try {
      // We need to access the InquiryMIInformation.html document where the tabs are located
      let inquiryDoc = null;

      // Try to get the InquiryMIInformation document
      try {
        // Get current frame element
        const currentFrame = window.frameElement;
        if (currentFrame) {
          // Get the parent document (InquiryMIInformation.html)
          inquiryDoc = currentFrame.ownerDocument;
          console.log("📋 Accessed InquiryMIInformation document for MI tab");
        }
      } catch (error) {
        console.warn("⚠️ Could not access parent document via frameElement:", error);
      }

      // Fallback: try to access via parent window
      if (!inquiryDoc) {
        try {
          if (window.parent && window.parent.document) {
            inquiryDoc = window.parent.document;
            console.log("📋 Accessed parent document via window.parent for MI tab");
          }
        } catch (error) {
          console.warn("⚠️ Could not access parent document via window.parent:", error);
        }
      }

      if (!inquiryDoc) {
        console.warn("⚠️ Could not access InquiryMIInformation document for MI tab");
        reject(new Error("Could not access parent document"));
        return;
      }

      // Specific selectors for MI Information tab based on the actual HTML structure
      const miInfoSelectors = [
        '#__tab_containerTab_tabMIApp',  // Exact ID from HTML
        'a[id="__tab_containerTab_tabMIApp"]',
        '#containerTab_tabMIApp_tab a',  // Tab wrapper with link
        'span[id="containerTab_tabMIApp_tab"] a'
      ];

      let miInfoTab = null;

      // Try each specific selector first in the parent document
      for (const selector of miInfoSelectors) {
        const element = inquiryDoc.querySelector(selector);
        if (element) {
          miInfoTab = element;
          console.log(`📋 Found MI Information tab using selector: ${selector}`);
          break;
        }
      }

      // Fallback: look for tab with "MI Information" text but only in tab containers
      if (!miInfoTab) {
        const tabSelectors = [
          '.ajax__tab_tab',
          '.ajax__tab_header a',
          '[class*="tab"] a'
        ];

        for (const selector of tabSelectors) {
          const elements = inquiryDoc.querySelectorAll(selector);
          for (const element of elements) {
            if (element.textContent &&
              (element.textContent.toLowerCase().includes('mi information') ||
                element.textContent.toLowerCase().trim() === 'mi information')) {
              miInfoTab = element;
              console.log(`📋 Found MI Information tab via text search: ${selector}`);
              break;
            }
          }
          if (miInfoTab) break;
        }
      }

      if (!miInfoTab) {
        console.warn("⚠️ MI Information tab not found in parent document");
        reject(new Error("MI Information tab not found"));
        return;
      }

      console.log("📋 MI Information tab element:", miInfoTab);
      console.log("📋 Tab text content:", miInfoTab.textContent);

      // Click the tab in the parent document
      miInfoTab.click();

      console.log("✅ MI Information tab clicked in parent document");
      resolve(true);

    } catch (error) {
      console.error("❌ Error clicking MI Information tab:", error);
      reject(error);
    }
  });
}

/**
 * Main function to check payment history loan number and handle restrictions
 */
async function checkPaymentHistoryLoanAccess() {
  try {
    console.log("🔄 Starting payment history access check process...");

    // Show loader while checking
    showLoader();
    updateLoaderText("Initializing access verification process...");

    // Wait for extension listener to be available
    updateLoaderText("Connecting to extension...");
    console.log("🔗 Waiting for extension listener...");

    try {
      await waitForListener();
      console.log("✅ Extension listener connected successfully");
    } catch (error) {
      console.warn("⚠️ Extension listener not available:", error.message);

      // If extension is not available, proceed normally without restrictions
      try {
        await clickMIInformationTab();
        updateLoaderText("Proceeding without access restrictions");
      } catch (fallbackError) {
        console.warn("⚠️ Could not return to MI Information tab:", fallbackError);
      }

      setTimeout(() => hideLoader(), 1000);
      return;
    }

    // Step 1: Click Payment History tab programmatically
    updateLoaderText("Step 1: Clicking Payment History tab...");
    console.log("📋 Step 1: Clicking Payment History tab...");
    await clickPaymentHistoryTab();

    // Step 2: Wait for payment history table to become visible
    updateLoaderText("Step 2: Waiting for payment history table to load...");
    console.log("⏳ Step 2: Waiting for payment history table to load...");
    await waitForPaymentHistoryTable();

    // Step 3: Find the lender loan number element
    updateLoaderText("Step 3: Extracting loan number information...");
    console.log("🔍 Step 3: Looking for loan number element...");
    const lenderLoanElement = document.querySelector("#_LblLenderNumInfo");

    if (!lenderLoanElement) {
      console.log("No lender loan number element found");
      updateLoaderText("Error: Loan number element not found");
      setTimeout(() => hideLoader(), 2000);
      return;
    }
    console.log("Lender loan number element found:", lenderLoanElement);

    const loanNumber = lenderLoanElement.textContent
      ? lenderLoanElement.textContent.trim()
      : "";

    if (!loanNumber) {
      console.log("No loan number found in element");
      updateLoaderText("Error: Loan number not found");
      setTimeout(() => hideLoader(), 2000);
      return;
    }

    // Step 4: Check if loan is restricted
    updateLoaderText(`Step 4: Verifying access for loan ${loanNumber}...`);
    console.log(`🔍 Step 4: Checking access for loan number: ${loanNumber}`);
    const allowedLoans = await checkNumbersBatch([loanNumber]);

    if (allowedLoans.length === 0) {
      // Loan is restricted - hide entire InquiryMIInformation.html iframe
      updateLoaderText("Access denied - Hiding restricted content...");
      console.log(`🚫 Loan ${loanNumber} is restricted - hiding entire InquiryMIInformation.html iframe`);

      hideInquiryMIInformationIframe();
      // Don't hide loader here - let the restriction message show
    } else {
      // Loan is authorized - switch back to MI Information tab
      updateLoaderText("Access granted - Returning to MI Information tab...");
      console.log(`✅ Loan ${loanNumber} is authorized - switching back to MI Information tab`);

      try {
        await clickMIInformationTab();
        updateLoaderText("Access verification completed successfully");
      } catch (error) {
        updateLoaderText("Warning: Could not return to MI Information tab");
      }

      setTimeout(() => hideLoader(), 1000);
    }

    console.log("✅ Payment history access check process completed");

  } catch (error) {
    console.error("❌ Error in payment history access check process:", error);
    updateLoaderText("Error occurred during access verification");

    try {
      await clickMIInformationTab();
      updateLoaderText("Returned to MI Information tab after error");
    } catch (fallbackError) {
      updateLoaderText("Error: Could not return to MI Information tab");
    }

    setTimeout(() => hideLoader(), 2000);
  }
}

/**
 * Initialize the script when conditions are met
 */
function initializePaymentHistoryFilter() {
  // Check if we're in the right context first
  if (!isTargetIframeContext()) {
    console.log("ℹ️ Not in target iframe context, will retry...");

    // Retry logic for context detection with exponential backoff
    let retryCount = 0;
    const maxRetries = 10;
    const baseDelay = 500;

    function retryInitialization() {
      retryCount++;

      if (retryCount > maxRetries) {
        console.log("⚠️ Maximum retries reached, stopping initialization attempts");
        return;
      }

      if (isTargetIframeContext()) {
        console.log(`✅ Target context found on retry ${retryCount}, starting execution`);
        setTimeout(checkPaymentHistoryLoanAccess, 200);
      } else {
        const delay = baseDelay * Math.pow(1.5, retryCount - 1); // Exponential backoff
        console.log(`🔄 Retry ${retryCount}/${maxRetries} in ${delay}ms...`);
        setTimeout(retryInitialization, delay);
      }
    }

    // Start retry process
    setTimeout(retryInitialization, baseDelay);
    return;
  }

  console.log("✅ In target iframe context, proceeding with execution");

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      setTimeout(checkPaymentHistoryLoanAccess, 300);
    });
  } else {
    setTimeout(checkPaymentHistoryLoanAccess, 300);
  }
}

// Start the script
initializePaymentHistoryFilter();

/**
 * Get the complete script source code as string for injection
 */
function getScriptSourceCode() {
  // Return the complete script as a string for inline injection
  const scriptCode = `
/*!
 * @description : Payment History Loan Filter Script (Injected)
 * @portal : MI Online - Radian Payment History
 */

// ########## INJECTED SCRIPT START ##########
const EXTENSION_ID = "hellpeipojbghaaopdnddjakinlmocjl";

async function waitForListener(maxRetries = 20, initialDelay = 100) {
  return new Promise((resolve, reject) => {
    if (typeof chrome === "undefined" || !chrome.runtime || !chrome.runtime.sendMessage) {
      console.warn("❌ Chrome extension API not available. Running in standalone mode.");
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
        reject(new Error("Listener not found"));
        return;
      }

      try {
        chrome.runtime.sendMessage(
          EXTENSION_ID,
          { type: "ping" },
          (response) => {
            if (chrome.runtime.lastError) {
              console.warn("Chrome extension error:", chrome.runtime.lastError);
              attempts++;
              if (attempts >= maxRetries) {
                reject(new Error("Chrome extension error"));
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
                delay *= 2;
                sendPing();
              }, delay);
            }
          }
        );
      } catch (error) {
        console.error("Error sending message to extension:", error);
        resolve(false);
      }
    }

    sendPing();
  });
}

async function checkNumbersBatch(numbers) {
  return new Promise((resolve, reject) => {
    if (typeof chrome === "undefined" || !chrome.runtime || !chrome.runtime.sendMessage) {
      console.warn("❌ Chrome extension API not available. Running in standalone mode.");
      resolve([]);
      return;
    }

    chrome.runtime.sendMessage(
      EXTENSION_ID,
      {
        type: "queryLoans",
        loanIds: numbers,
      },
      (response) => {
        if (chrome.runtime.lastError) {
          return reject(chrome.runtime.lastError.message);
        } else if (response.error) {
          return reject(response.error);
        }

        const available = Object.keys(response.result).filter(
          (key) => response.result[key]
        );
        resolve(available);
      }
    );
  });
}

function isTargetIframeContext() {
  try {
    const currentUrl = window.location.href;
    const pathname = window.location.pathname;
    
    if (currentUrl.includes('payhist_viewAll') || pathname.includes('payhist_viewAll')) {
      console.log("✅ In target payhist_viewAll iframe context");
      return true;
    }
    
    const paymentHistoryIndicators = [
      '#_LblLenderNumInfo',
      '#payhist_viewAll_table',
      'table[id*="payhist"]',
      '.payment-history'
    ];
    
    for (const selector of paymentHistoryIndicators) {
      if (document.querySelector(selector)) {
        console.log("✅ Found payment history indicator: " + selector);
        return true;
      }
    }
    
    try {
      if (window.frameElement && window.frameElement.src && 
          window.frameElement.src.includes('payhist')) {
        console.log("✅ Frame element indicates payment history context");
        return true;
      }
    } catch (e) {
      // Cross-origin access restriction
    }
    
    return false;
  } catch (error) {
    console.warn("⚠️ Error checking iframe context:", error);
    return false;
  }
}

function applyElementStyles(element, styles) {
  if (!element || !styles) return;
  Object.entries(styles).forEach(([property, value]) => {
    element.style[property] = value;
  });
}

function createUnauthorizedElement() {
  const unauthorizedContainer = document.createElement("div");
  applyElementStyles(unauthorizedContainer, {
    display: "flex", justifyContent: "center", alignItems: "center",
    height: "200px", backgroundColor: "#f8f9fa", border: "2px solid #dc3545",
    borderRadius: "8px", margin: "20px"
  });

  const messageContainer = document.createElement("div");
  applyElementStyles(messageContainer, {
    textAlign: "center", color: "#dc3545", fontSize: "18px",
    fontWeight: "bold", padding: "20px"
  });

  const iconElement = document.createElement("i");
  iconElement.className = "fas fa-exclamation-triangle";
  applyElementStyles(iconElement, { fontSize: "24px", marginBottom: "10px" });

  const textElement = document.createElement("div");
  textElement.textContent = "You are not authorized to view restricted loans";
  applyElementStyles(textElement, { marginTop: "10px" });

  messageContainer.appendChild(iconElement);
  messageContainer.appendChild(textElement);
  unauthorizedContainer.appendChild(messageContainer);
  return unauthorizedContainer;
}

function createLoader() {
  const style = document.createElement("style");
  style.textContent = "#loaderOverlay { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(255, 255, 255, 0.95); display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 99999; transition: opacity 0.3s ease; font-family: Arial, sans-serif; } .spinner { width: 80px; height: 80px; border: 8px solid #e0e0e0; border-top-color: #2b6cb0; border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 20px; } @keyframes spin { to {transform: rotate(360deg);} } #loaderOverlay.hidden { opacity: 0; pointer-events: none; } .loader-text { font-size: 18px; color: #2b6cb0; font-weight: 500; text-align: center; max-width: 400px; line-height: 1.4; } .loader-steps { margin-top: 15px; font-size: 14px; color: #666; text-align: center; }";
  return style;
}

function createLoaderElement() {
  const loader = document.createElement("div");
  loader.id = "loaderOverlay";
  
  const spinner = document.createElement("div");
  spinner.className = "spinner";
  
  const loadingText = document.createElement("div");
  loadingText.className = "loader-text";
  loadingText.textContent = "Verifying loan access permissions...";
  
  const stepsText = document.createElement("div");
  stepsText.className = "loader-steps";
  stepsText.id = "loaderSteps";
  stepsText.textContent = "Initializing...";
  
  loader.appendChild(spinner);
  loader.appendChild(loadingText);
  loader.appendChild(stepsText);
  return loader;
}

function showLoader() {
  const style = createLoader();
  const loader = createLoaderElement();
  if (document.head && style) document.head.appendChild(style);
  if (document.body && loader) document.body.appendChild(loader);
}

function updateLoaderText(stepText) {
  const stepsElement = document.getElementById("loaderSteps");
  if (stepsElement) stepsElement.textContent = stepText;
}

function hideLoader() {
  const loader = document.getElementById("loaderOverlay");
  if (loader && loader.parentNode) {
    loader.classList.add("hidden");
    setTimeout(() => {
      if (loader.parentNode) loader.parentNode.removeChild(loader);
    }, 300);
  }
}

function hideInquiryMIInformationIframe() {
  try {
    const currentFrame = window.frameElement;
    if (!currentFrame) {
      console.warn("⚠️ Could not access current frame element");
      return;
    }
    
    const inquiryDoc = currentFrame.ownerDocument;
    if (!inquiryDoc) {
      console.warn("⚠️ Could not access InquiryMIInformation document");
      return;
    }
    
    const inquiryFrame = inquiryDoc.defaultView.frameElement;
    if (!inquiryFrame) {
      console.warn("⚠️ Could not access InquiryMIInformation iframe element");
      return;
    }
    
    inquiryFrame.style.display = 'none';
    
    const navDoc = inquiryFrame.ownerDocument;
    if (navDoc) showAccessDeniedMessageInNavFrame(navDoc);
    
    console.log("✅ Successfully hid InquiryMIInformation.html iframe");
  } catch (error) {
    console.error("❌ Error hiding InquiryMIInformation.html iframe:", error);
    hideCurrentFrameContent();
  }
}

function showAccessDeniedMessageInNavFrame(navDoc) {
  try {
    const existingMsg = navDoc.querySelector('.access-denied-message');
    if (existingMsg) existingMsg.remove();
    
    const accessDeniedDiv = navDoc.createElement('div');
    accessDeniedDiv.className = 'access-denied-message';
    accessDeniedDiv.innerHTML = "<div style=\\"background-color: #f8f9fa; border: 2px solid #dc3545; border-radius: 8px; padding: 20px; margin: 20px; text-align: center; font-family: Arial, sans-serif; position: relative; z-index: 9999;\\"><p style=\\"color: #6c757d; margin-bottom: 15px;\\">You do not have permission to view payment history for this loan number.</p></div>";
    
    const container = navDoc.body || navDoc.documentElement;
    if (container) container.appendChild(accessDeniedDiv);
    
    console.log("✅ Access denied message shown in navigation frame");
  } catch (error) {
    console.error("❌ Error showing access denied message:", error);
  }
}

function hideCurrentFrameContent() {
  console.log("🔒 Fallback: Hiding content in current frame");
  
  const allElements = document.querySelectorAll("body > *:not(script):not(style)");
  if (allElements && allElements.length > 0) {
    allElements.forEach((element) => {
      if (element && element.id !== "loaderOverlay") {
        element.style.display = "none";
      }
    });
  }
  
  const unauthorizedElement = createUnauthorizedElement();
  const documentBody = document.body;
  if (documentBody && unauthorizedElement) {
    documentBody.appendChild(unauthorizedElement);
  }
}

async function clickPaymentHistoryTab() {
  return new Promise((resolve, reject) => {
    try {
      let inquiryDoc = null;
      
      try {
        const currentFrame = window.frameElement;
        if (currentFrame) {
          inquiryDoc = currentFrame.ownerDocument;
          console.log("📋 Accessed InquiryMIInformation document via frameElement");
        }
      } catch (error) {
        console.warn("⚠️ Could not access parent document via frameElement:", error);
      }
      
      if (!inquiryDoc) {
        try {
          if (window.parent && window.parent.document) {
            inquiryDoc = window.parent.document;
            console.log("📋 Accessed parent document via window.parent");
          }
        } catch (error) {
          console.warn("⚠️ Could not access parent document via window.parent:", error);
        }
      }
      
      if (!inquiryDoc) {
        reject(new Error("Could not access parent document"));
        return;
      }

      const paymentHistorySelectors = [
        '#__tab_containerTab_tabPaymentHistory',
        'a[id="__tab_containerTab_tabPaymentHistory"]',
        '#containerTab_tabPaymentHistory_tab a',
        'span[id="containerTab_tabPaymentHistory_tab"] a'
      ];

      let paymentHistoryTab = null;
      
      for (const selector of paymentHistorySelectors) {
        const element = inquiryDoc.querySelector(selector);
        if (element) {
          paymentHistoryTab = element;
          console.log("📋 Found Payment History tab using selector: " + selector);
          break;
        }
      }

      if (!paymentHistoryTab) {
        const tabSelectors = ['.ajax__tab_tab', '.ajax__tab_header a', '[class*="tab"] a'];
        for (const selector of tabSelectors) {
          const elements = inquiryDoc.querySelectorAll(selector);
          for (const element of elements) {
            if (element.textContent && element.textContent.toLowerCase().includes('payment history')) {
              paymentHistoryTab = element;
              console.log("📋 Found Payment History tab via text search: " + selector);
              break;
            }
          }
          if (paymentHistoryTab) break;
        }
      }

      if (!paymentHistoryTab) {
        reject(new Error("Payment History tab not found"));
        return;
      }

      paymentHistoryTab.click();
      console.log("✅ Payment History tab clicked in parent document");
      resolve(true);
      
    } catch (error) {
      console.error("❌ Error clicking Payment History tab:", error);
      reject(error);
    }
  });
}

async function waitForPaymentHistoryTable(maxAttempts = 30, interval = 500) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    
    function checkForTable() {
      const tableSelectors = [
        '#payhist_viewAll_table',
        'table[id*="payhist"]',
        'table[class*="payment"]',
        '.payment-history-table',
        'table'
      ];

      let paymentTable = null;
      
      for (const selector of tableSelectors) {
        const elements = document.querySelectorAll(selector);
        for (const element of elements) {
          if (element && element.offsetParent !== null) {
            if (selector === 'table') {
              const tableText = element.textContent.toLowerCase();
              if (tableText.includes('payment') || tableText.includes('date') || 
                  tableText.includes('amount') || tableText.includes('history') ||
                  tableText.includes('premium') || tableText.includes('due')) {
                paymentTable = element;
                console.log("📋 Found payment table via content check: " + selector);
                break;
              }
            } else {
              paymentTable = element;
              console.log("📋 Found payment table using selector: " + selector);
              break;
            }
          }
        }
        if (paymentTable) break;
      }

      if (paymentTable) {
        resolve(paymentTable);
      } else if (++attempts < maxAttempts) {
        if (attempts === 1) console.log("⏳ Waiting for payment history table to load...");
        setTimeout(checkForTable, interval);
      } else {
        reject(new Error("Payment history table not found"));
      }
    }
    
    checkForTable();
  });
}

async function clickMIInformationTab() {
  return new Promise((resolve, reject) => {
    try {
      let inquiryDoc = null;
      
      try {
        const currentFrame = window.frameElement;
        if (currentFrame) {
          inquiryDoc = currentFrame.ownerDocument;
        }
      } catch (error) {
        console.warn("⚠️ Could not access parent document via frameElement:", error);
      }
      
      if (!inquiryDoc) {
        try {
          if (window.parent && window.parent.document) {
            inquiryDoc = window.parent.document;
          }
        } catch (error) {
          console.warn("⚠️ Could not access parent document via window.parent:", error);
        }
      }
      
      if (!inquiryDoc) {
        reject(new Error("Could not access parent document"));
        return;
      }

      const miInfoSelectors = [
        '#__tab_containerTab_tabMIApp',
        'a[id="__tab_containerTab_tabMIApp"]',
        '#containerTab_tabMIApp_tab a',
        'span[id="containerTab_tabMIApp_tab"] a'
      ];

      let miInfoTab = null;
      
      for (const selector of miInfoSelectors) {
        const element = inquiryDoc.querySelector(selector);
        if (element) {
          miInfoTab = element;
          break;
        }
      }

      if (!miInfoTab) {
        const tabSelectors = ['.ajax__tab_tab', '.ajax__tab_header a', '[class*="tab"] a'];
        for (const selector of tabSelectors) {
          const elements = inquiryDoc.querySelectorAll(selector);
          for (const element of elements) {
            if (element.textContent && 
                (element.textContent.toLowerCase().includes('mi information') || 
                 element.textContent.toLowerCase().trim() === 'mi information')) {
              miInfoTab = element;
              break;
            }
          }
          if (miInfoTab) break;
        }
      }

      if (!miInfoTab) {
        reject(new Error("MI Information tab not found"));
        return;
      }

      miInfoTab.click();
      console.log("✅ MI Information tab clicked in parent document");
      resolve(true);
      
    } catch (error) {
      console.error("❌ Error clicking MI Information tab:", error);
      reject(error);
    }
  });
}

async function checkPaymentHistoryLoanAccess() {
  try {
    console.log("🔄 Starting payment history access check process...");
    showLoader();
    updateLoaderText("Initializing access verification process...");

    updateLoaderText("Connecting to extension...");
    console.log("🔗 Waiting for extension listener...");
    
    try {
      await waitForListener();
      console.log("✅ Extension listener connected successfully");
    } catch (error) {
      console.warn("⚠️ Extension listener not available:", error.message);
      
      try {
        await clickMIInformationTab();
        updateLoaderText("Proceeding without access restrictions");
      } catch (fallbackError) {
        console.warn("⚠️ Could not return to MI Information tab:", fallbackError);
      }
      
      setTimeout(() => hideLoader(), 1000);
      return;
    }

    updateLoaderText("Step 1: Clicking Payment History tab...");
    await clickPaymentHistoryTab();
    
    updateLoaderText("Step 2: Waiting for payment history table to load...");
    await waitForPaymentHistoryTable();
    
    updateLoaderText("Step 3: Extracting loan number information...");
    const lenderLoanElement = document.querySelector("#_LblLenderNumInfo");

    if (!lenderLoanElement) {
      updateLoaderText("Error: Loan number element not found");
      setTimeout(() => hideLoader(), 2000);
      return;
    }

    const loanNumber = lenderLoanElement.textContent ? lenderLoanElement.textContent.trim() : "";

    if (!loanNumber) {
      updateLoaderText("Error: Loan number not found");
      setTimeout(() => hideLoader(), 2000);
      return;
    }

    updateLoaderText("Step 4: Verifying access for loan " + loanNumber + "...");
    const allowedLoans = await checkNumbersBatch([loanNumber]);

    if (allowedLoans.length === 0) {
      updateLoaderText("Access denied - Hiding restricted content...");
      console.log("🚫 Loan " + loanNumber + " is restricted");
      hideInquiryMIInformationIframe();
    } else {
      updateLoaderText("Access granted - Returning to MI Information tab...");
      console.log("✅ Loan " + loanNumber + " is authorized");
      
      try {
        await clickMIInformationTab();
        updateLoaderText("Access verification completed successfully");
      } catch (error) {
        updateLoaderText("Warning: Could not return to MI Information tab");
      }
      
      setTimeout(() => hideLoader(), 1000);
    }

    console.log("✅ Payment history access check process completed");
    
  } catch (error) {
    console.error("❌ Error in payment history access check process:", error);
    updateLoaderText("Error occurred during access verification");
    
    try {
      await clickMIInformationTab();
      updateLoaderText("Returned to MI Information tab after error");
    } catch (fallbackError) {
      updateLoaderText("Error: Could not return to MI Information tab");
    }
    
    setTimeout(() => hideLoader(), 2000);
  }
}

function initializePaymentHistoryFilter() {
  if (!isTargetIframeContext()) {
    console.log("ℹ️ Not in target iframe context, will retry...");
    
    let retryCount = 0;
    const maxRetries = 10;
    const baseDelay = 500;
    
    function retryInitialization() {
      retryCount++;
      
      if (retryCount > maxRetries) {
        console.log("⚠️ Maximum retries reached, stopping initialization attempts");
        return;
      }
      
      if (isTargetIframeContext()) {
        console.log("✅ Target context found on retry " + retryCount + ", starting execution");
        setTimeout(checkPaymentHistoryLoanAccess, 200);
      } else {
        const delay = baseDelay * Math.pow(1.5, retryCount - 1);
        console.log("🔄 Retry " + retryCount + "/" + maxRetries + " in " + delay + "ms...");
        setTimeout(retryInitialization, delay);
      }
    }
    
    setTimeout(retryInitialization, baseDelay);
    return;
  }
  
  console.log("✅ In target iframe context, proceeding with execution");
  
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      setTimeout(checkPaymentHistoryLoanAccess, 300);
    });
  } else {
    setTimeout(checkPaymentHistoryLoanAccess, 300);
  }
}

// Start the injected script
initializePaymentHistoryFilter();

// ########## INJECTED SCRIPT END ##########
`;

  return scriptCode;
}

/**
 * Inject script into iframe using inline code instead of file path
 */
function injectInlineScript(doc) {
  if (!doc) {
    console.warn('[payment_history_filter] [DEBUG] No document provided for injection');
    return;
  }

  // Check if script is already injected
  if (doc.querySelector('script[data-payment-history-filter="true"]')) {
    console.log('[payment_history_filter] [DEBUG] Script already injected in document');
    return;
  }

  const script = doc.createElement('script');
  script.type = 'text/javascript';
  script.setAttribute('data-payment-history-filter', 'true');
  script.textContent = getScriptSourceCode();

  const head = doc.head || doc.getElementsByTagName('head')[0] || doc.documentElement;
  if (head) {
    head.appendChild(script);
    console.log('[payment_history_filter] [DEBUG] Inline script injected successfully');
  } else {
    console.warn('[payment_history_filter] [DEBUG] Could not find head element for script injection');
  }
}

/**
 * Inject this script into the innermost payhist_viewAll.html iframe (4-level deep)
 */
function injectIntoFourLevelDeepIframe() {
  // Poll for the first iframe (contentBlock-iframe)
  function pollForFirstIframe(maxAttempts = 30, interval = 300) {
    return new Promise((resolve, reject) => {
      let attempts = 0;
      function check() {
        const contentBlockIframe = document.getElementById('contentBlock-iframe');

        if (contentBlockIframe && contentBlockIframe.contentWindow && contentBlockIframe.contentDocument) {
          console.log('[payment_history_filter] [DEBUG] Found contentBlock-iframe on attempt', attempts + 1);
          resolve(contentBlockIframe);
        } else if (++attempts < maxAttempts) {
          if (attempts === 1) console.log('[payment_history_filter] [DEBUG] Waiting for contentBlock-iframe...');
          setTimeout(check, interval);
        } else {
          console.warn('[payment_history_filter] [DEBUG] contentBlock-iframe not found after', maxAttempts, 'attempts.');
          reject(new Error('contentBlock-iframe not found'));
        }
      }
      check();
    });
  }

  // Poll for iframe inside a given document by src pattern
  function pollForIframeBySrc(doc, srcPattern, maxAttempts = 30, interval = 300) {
    return new Promise((resolve, reject) => {
      let attempts = 0;
      function check() {
        if (attempts === 0) {
          const allIframes = Array.from(doc.getElementsByTagName('iframe'));
          console.log(`[payment_history_filter] [DEBUG] Found iframes in doc:`,
            allIframes.map(f => ({ id: f.id, src: f.src }))
          );
        }

        const iframes = Array.from(doc.getElementsByTagName('iframe'));
        const iframe = iframes.find(f => f.src && f.src.includes(srcPattern));

        if (iframe && iframe.contentWindow && iframe.contentDocument) {
          console.log(`[payment_history_filter] [DEBUG] Found iframe with src pattern "${srcPattern}" on attempt ${attempts + 1}`);
          resolve(iframe);
        } else if (++attempts < maxAttempts) {
          if (attempts === 1) console.log(`[payment_history_filter] [DEBUG] Waiting for iframe with src pattern "${srcPattern}"...`);
          setTimeout(check, interval);
        } else {
          console.warn(`[payment_history_filter] [DEBUG] Iframe with src pattern "${srcPattern}" not found after ${maxAttempts} attempts.`);
          reject(new Error(`Iframe with src pattern "${srcPattern}" not found`));
        }
      }
      check();
    });
  }

  // Main logic for 4-level injection
  (async function () {
    try {
      console.log('[payment_history_filter] [DEBUG] Starting 4-level deep iframe injection...');

      // Level 1: Wait for contentBlock-iframe (mionlineNavigation.html)
      const level1Iframe = await pollForFirstIframe();
      const level1Doc = level1Iframe.contentDocument;

      // Level 2: Wait for iframe in mionlineNavigation.html (InquiryMIInformation.html)
      const level2Iframe = await pollForIframeBySrc(level1Doc, 'InquiryMIInformation');
      const level2Doc = level2Iframe.contentDocument;

      // Level 3: Wait for iframe in InquiryMIInformation.html (payhist_viewAll.html)
      const level3Iframe = await pollForIframeBySrc(level2Doc, 'payhist_viewAll');
      const level3Doc = level3Iframe.contentDocument;

      // Level 4: Wait for document to be ready and inject script
      if (level3Doc.readyState === 'loading') {
        console.log('[payment_history_filter] [DEBUG] Waiting for level 3 iframe DOMContentLoaded...');
        await new Promise((res) => level3Doc.addEventListener('DOMContentLoaded', res, { once: true }));
      }

      // Inject inline script into the deepest level (payhist_viewAll.html)
      injectInlineScript(level3Doc);
      console.log('[payment_history_filter] [DEBUG] 4-level deep iframe injection complete.');

    } catch (e) {
      console.warn('[payment_history_filter] [DEBUG] 4-level deep iframe injection failed:', e);
    }
  })();
}

// Start injection process
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', injectIntoFourLevelDeepIframe);
} else {
  injectIntoFourLevelDeepIframe();
} 