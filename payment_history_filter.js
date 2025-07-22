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
 * Check if Chrome extension API is available
 */
function isExtensionAvailable() {
  return typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage;
}

/**
 * Establish Communication with Loan Checker Extension
 */
async function waitForListener(maxRetries = 20, initialDelay = 100) {
  return new Promise((resolve, reject) => {
    if (!isExtensionAvailable()) {
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

      console.log(`🔄 Sending ping attempt ${attempts + 1}/${maxRetries}...`);

      try {
        chrome.runtime.sendMessage(
          EXTENSION_ID,
          { type: "ping" },
          (response) => {
            if (chrome.runtime.lastError) {
              console.warn("❌ Chrome runtime error:", chrome.runtime.lastError.message);
              timeoutId = setTimeout(() => {
                attempts++;
                delay *= 2;
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

/**
 * Request a batch of numbers from the storage script
 */
async function checkNumbersBatch(numbers) {
  return new Promise((resolve, reject) => {
    if (!isExtensionAvailable()) {
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

// ########## DO NOT MODIFY THESE LINES - END ##########

/**
 * Check if we're in the target iframe context
 */
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
        console.log(`✅ Found payment history indicator: ${selector}`);
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
      // Cross-origin access restriction, but that's ok
    }

    return false;
  } catch (error) {
    console.warn("⚠️ Error checking iframe context:", error);
    return false;
  }
}

/**
 * Get parent document (InquiryMIInformation.html) safely
 */
function getParentDocument() {
  let inquiryDoc = null;

  // Try frameElement first
  try {
    const currentFrame = window.frameElement;
    if (currentFrame) {
      inquiryDoc = currentFrame.ownerDocument;
      console.log("📋 Accessed InquiryMIInformation document via frameElement");
    }
  } catch (error) {
    console.warn("⚠️ Could not access parent document via frameElement:", error);
  }

  // Fallback to parent window
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

  return inquiryDoc;
}

/**
 * Find tab element by name and selectors
 */
function findTabElement(doc, tabName, specificSelectors) {
  if (!doc) return null;

  let tabElement = null;

  // Try specific selectors first
  for (const selector of specificSelectors) {
    const element = doc.querySelector(selector);
    if (element) {
      tabElement = element;
      console.log(`📋 Found ${tabName} tab using selector: ${selector}`);
      break;
    }
  }

  // Fallback: look for tab with text content
  if (!tabElement) {
    const tabSelectors = ['.ajax__tab_tab', '.ajax__tab_header a', '[class*="tab"] a'];
    for (const selector of tabSelectors) {
      const elements = doc.querySelectorAll(selector);
      for (const element of elements) {
        if (element.textContent && element.textContent.toLowerCase().includes(tabName.toLowerCase())) {
          tabElement = element;
          console.log(`📋 Found ${tabName} tab via text search: ${selector}`);
          break;
        }
      }
      if (tabElement) break;
    }
  }

  return tabElement;
}

/**
 * Click Payment History tab programmatically
 */
async function clickPaymentHistoryTab() {
  return new Promise((resolve, reject) => {
    try {
      const inquiryDoc = getParentDocument();
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

      const paymentHistoryTab = findTabElement(inquiryDoc, 'Payment History', paymentHistorySelectors);
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

/**
 * Click MI Information tab programmatically
 */
async function clickMIInformationTab() {
  return new Promise((resolve, reject) => {
    try {
      const inquiryDoc = getParentDocument();
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

      const miInfoTab = findTabElement(inquiryDoc, 'MI Information', miInfoSelectors);
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

/**
 * Wait for payment history table to become visible
 */
async function waitForPaymentHistoryTable(maxAttempts = 120, interval = 500) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    let currentInterval = interval;
    const maxInterval = 2000; // Cap at 2 seconds

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

        // Show progress for long waits
        if (attempts % 20 === 0) {
          const elapsed = Math.round((attempts * currentInterval) / 1000);
          console.log(`⏳ Still waiting for payment table... (${elapsed}s elapsed, attempt ${attempts}/${maxAttempts})`);
        }

        // Use exponential backoff for efficiency
        if (attempts > 30) {
          currentInterval = Math.min(currentInterval * 1.2, maxInterval);
        }

        setTimeout(checkForTable, currentInterval);
      } else {
        const totalTime = Math.round((attempts * interval) / 1000);
        console.warn(`⚠️ Payment history table not found after maximum attempts (${totalTime}s total)`);
        reject(new Error(`Payment history table not found after ${totalTime}s`));
      }
    }

    checkForTable();
  });
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
  textElement.textContent = "You are not authorized to view restricted loans";
  applyElementStyles(textElement, {
    marginTop: "10px",
  });

  messageContainer.appendChild(iconElement);
  messageContainer.appendChild(textElement);
  unauthorizedContainer.appendChild(messageContainer);

  return unauthorizedContainer;
}

/**
 * Create and manage loader overlay
 */
const LoaderManager = {
  createStyles() {
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
  },

  createElement() {
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
  },

  show() {
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
    const stepsElement = document.getElementById("loaderSteps");
    if (stepsElement) {
      stepsElement.textContent = stepText;
    }
  },

  hide() {
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
};

/**
 * Hide the entire InquiryMIInformation.html iframe when loan is restricted
 */
function hideInquiryMIInformationIframe() {
  // Double-check that extension is available before applying restrictions
  if (!isExtensionAvailable()) {
    console.error("🚨 CRITICAL ERROR: hideInquiryMIInformationIframe called without extension availability!");
    console.error("🚨 This should NEVER happen. Extension must be connected before applying restrictions.");
    return;
  }

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
    if (navDoc) {
      showAccessDeniedMessageInNavFrame(navDoc);
    }

    console.log("✅ Successfully hid InquiryMIInformation.html iframe");

  } catch (error) {
    console.error("❌ Error hiding InquiryMIInformation.html iframe:", error);
    hideCurrentFrameContent();
  }
}

/**
 * Show access denied message in the navigation frame
 */
function showAccessDeniedMessageInNavFrame(navDoc) {
  try {
    const existingMsg = navDoc.querySelector('.access-denied-message');
    if (existingMsg) {
      existingMsg.remove();
    }

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

  const unauthorizedElement = createUnauthorizedElement();
  const documentBody = document.body;
  if (documentBody && unauthorizedElement) {
    documentBody.appendChild(unauthorizedElement);
  }
}

/**
 * Global flag to prevent multiple script executions
 */
window.paymentHistoryFilterRunning = window.paymentHistoryFilterRunning || false;

/**
 * Main function to check payment history loan number and handle restrictions
 */
async function checkPaymentHistoryLoanAccess() {
  // Prevent multiple executions
  if (window.paymentHistoryFilterRunning) {
    console.log("⚠️ Payment history filter already running, skipping execution");
    return;
  }

  window.paymentHistoryFilterRunning = true;

  try {
    console.log("🔄 Starting payment history access check process...");

    LoaderManager.show();
    LoaderManager.updateText("Initializing access verification process...");

    LoaderManager.updateText("Connecting to extension...");
    console.log("🔗 Waiting for extension listener...");

    let extensionConnected = false;
    try {
      extensionConnected = await waitForListener();
      console.log("✅ Extension listener connected successfully");
    } catch (error) {
      console.warn("⚠️ Extension listener not available:", error.message);
      console.log("🔓 No extension available - allowing unrestricted access to payment history");

      try {
        await clickMIInformationTab();
        LoaderManager.updateText("Extension not available - proceeding without restrictions");
        console.log("✅ Returned to MI Information tab - no restrictions applied");
      } catch (fallbackError) {
        console.warn("⚠️ Could not return to MI Information tab:", fallbackError);
        LoaderManager.updateText("Extension not available - no restrictions applied");
      }

      console.log("[DEBUG] Hiding loader due to extension connection failure (catch block)");
      LoaderManager.hide();
      console.log("[DEBUG] Loader should now be hidden (catch block)");
      return; // EXIT COMPLETELY - do not proceed with loan checking
    }

    if (!extensionConnected) {
      console.warn("⚠️ Extension connection was not successful (resolved false)");
      LoaderManager.updateText("Extension not available - proceeding without restrictions");
      console.log("[DEBUG] Hiding loader due to extension connection failure (resolved false)");
      LoaderManager.hide();
      console.log("[DEBUG] Loader should now be hidden (resolved false)");
      return;
    }

    // Only proceed with loan checking if extension is available
    LoaderManager.updateText("Step 1: Clicking Payment History tab...");
    console.log("📋 Step 1: Clicking Payment History tab...");
    await clickPaymentHistoryTab();

    LoaderManager.updateText("Step 2: Waiting for payment history table to load...");
    console.log("⏳ Step 2: Waiting for payment history table to load...");
    await waitForPaymentHistoryTable();

    LoaderManager.updateText("Step 3: Extracting loan number information...");
    console.log("🔍 Step 3: Looking for loan number element...");
    const lenderLoanElement = document.querySelector("#_LblLenderNumInfo");

    if (!lenderLoanElement) {
      console.log("No lender loan number element found");
      LoaderManager.updateText("Error: Loan number element not found");
      LoaderManager.hide();
      return;
    }
    console.log("Lender loan number element found:", lenderLoanElement);

    const loanNumber = lenderLoanElement.textContent
      ? lenderLoanElement.textContent.trim()
      : "";

    if (!loanNumber) {
      console.log("No loan number found in element");
      LoaderManager.updateText("Error: Loan number not found");
      LoaderManager.hide();
      return;
    }

    LoaderManager.updateText(`Step 4: Verifying access for loan ${loanNumber}...`);
    console.log(`🔍 Step 4: Checking access for loan number: ${loanNumber}`);
    const allowedLoans = await checkNumbersBatch([loanNumber]);
    console.log("Result of checkNumbersBatch:", allowedLoans);

    if (!allowedLoans || allowedLoans.length === 0) {
      LoaderManager.updateText("Access denied - Hiding restricted content...");
      console.log(`🚫 Loan ${loanNumber} is restricted - hiding entire InquiryMIInformation.html iframe`);

      hideInquiryMIInformationIframe();
    } else {
      LoaderManager.updateText("Access granted - Returning to MI Information tab...");
      console.log(`✅ Loan ${loanNumber} is authorized - switching back to MI Information tab`);

      try {
        await clickMIInformationTab();
        LoaderManager.updateText("Access verification completed successfully");
      } catch (error) {
        LoaderManager.updateText("Warning: Could not return to MI Information tab");
      }

      LoaderManager.hide();
    }

    console.log("✅ Payment history access check process completed");

  } catch (error) {
    console.error("❌ Error in payment history access check process:", error);
    LoaderManager.updateText("Error occurred during access verification");

    try {
      await clickMIInformationTab();
      LoaderManager.updateText("Returned to MI Information tab after error");
    } catch (fallbackError) {
      LoaderManager.updateText("Error: Could not return to MI Information tab");
    }

    LoaderManager.hide();
  } finally {
    // Reset the flag when execution completes
    window.paymentHistoryFilterRunning = false;
  }
}

/**
 * Initialize the script when conditions are met
 */
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
        console.log(`✅ Target context found on retry ${retryCount}, starting execution`);
        setTimeout(checkPaymentHistoryLoanAccess, 200);
      } else {
        const delay = baseDelay * Math.pow(1.5, retryCount - 1);
        console.log(`🔄 Retry ${retryCount}/${maxRetries} in ${delay}ms...`);
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
    if (!isExtensionAvailable()) {
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
              console.warn("❌ Chrome runtime error:", chrome.runtime.lastError.message);
              timeoutId = setTimeout(() => {
                attempts++;
                delay *= 2;
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

// Define loan numbers directly in the injected script for standalone mode
async function checkNumbersBatch(numbers) {
  return new Promise((resolve, reject) => {
    if (!isExtensionAvailable()) {
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
    console.log("[INJECTED] Checking loan number:", loanNumber);
    const allowedLoans = await checkNumbersBatch([loanNumber]);
    console.log("[INJECTED] Result of check:", allowedLoans);

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
 * Inject script into iframe using inline code with enhanced error handling
 */
function injectInlineScript(doc) {
  if (!doc) {
    console.warn('[payment_history_filter] [DEBUG] No document provided for injection');
    return;
  }

  if (doc.querySelector('script[data-payment-history-filter="true"]')) {
    console.log('[payment_history_filter] [DEBUG] Script already injected in document');
    return;
  }

  // Wait for document to be ready if it's still loading
  if (doc.readyState === 'loading') {
    console.log('[payment_history_filter] [DEBUG] Document still loading, waiting...');
    return new Promise((resolve) => {
      doc.addEventListener('DOMContentLoaded', () => {
        console.log('[payment_history_filter] [DEBUG] Document loaded, proceeding with injection');
        resolve(injectInlineScript(doc));
      }, { once: true });
    });
  }

  const script = doc.createElement('script');
  script.type = 'text/javascript';
  script.setAttribute('data-payment-history-filter', 'true');
  script.textContent = getScriptSourceCode();

  // Try multiple injection targets with fallbacks
  let injectionTarget = null;
  const targets = [
    doc.head,
    doc.getElementsByTagName('head')[0],
    doc.body,
    doc.getElementsByTagName('body')[0],
    doc.documentElement
  ];

  for (const target of targets) {
    if (target) {
      injectionTarget = target;
      break;
    }
  }

  if (injectionTarget) {
    injectionTarget.appendChild(script);
    console.log(`[payment_history_filter] [DEBUG] Inline script injected successfully into ${injectionTarget.tagName}`);
  } else {
    console.warn('[payment_history_filter] [DEBUG] Could not find any suitable injection target');

    // Last resort: wait for DOM elements to be available
    setTimeout(() => {
      console.log('[payment_history_filter] [DEBUG] Retrying injection after delay...');
      injectInlineScript(doc);
    }, 1000);
  }
}

/**
 * Poll for iframe by src pattern with enhanced timeout and server-aware polling
 */
function pollForIframeBySrc(doc, srcPattern, maxAttempts = 120, interval = 500) {

  console.log(`[payment_history_filter] [DEBUG] Polling for iframe in Document:`, doc);
  return new Promise((resolve, reject) => {
    let attempts = 0;
    let currentInterval = interval;
    const maxInterval = 2000; // Cap at 2 seconds

    function check() {
      if (attempts === 0) {
        const allIframes = Array.from(doc.getElementsByTagName('iframe'));
        console.log("[DEBUG] Polling for iframe with src pattern: " + srcPattern + ". Found iframes:",
          allIframes.map(f => ({ id: f.id, src: f.src }))
        );
      }

      const iframes = Array.from(doc.getElementsByTagName('iframe'));
      let iframe = null;

      // Try to find iframe by src pattern first
      iframe = iframes.find(f => f.src && f.src.includes(srcPattern));
      
      // If not found by src, try to find by specific ID patterns for live site
      if (!iframe) {
        if (srcPattern.includes('InquiryMIInformation')) {
          // Look for live site iframe ID: frmMIOnlineContent
          iframe = iframes.find(f => f.id === 'frmMIOnlineContent');
          if (iframe) {
            console.log("[DEBUG] Found InquiryMIInformation iframe by ID: frmMIOnlineContent");
          }
        } else if (srcPattern.includes('payhist')) {
          // Look for live site iframe ID: containerTab_tabPaymentHistory_frmPaymentHistory
          iframe = iframes.find(f => f.id === 'containerTab_tabPaymentHistory_frmPaymentHistory');
          if (iframe) {
            console.log("[DEBUG] Found payhist iframe by ID: containerTab_tabPaymentHistory_frmPaymentHistory");
          }
        }
      }

      if (iframe) {
        if (iframe.contentWindow && iframe.contentDocument) {
          console.log("[DEBUG] Found and accessed iframe with pattern: " + srcPattern + " on attempt " + (attempts + 1));
          resolve(iframe);
          return;
        } else {
          console.warn("[DEBUG] Found iframe but NOT ACCESSIBLE. Src: " + iframe.src + ", ID: " + iframe.id);
          reject(new Error("Iframe not accessible (cross-origin): " + srcPattern));
          return;
        }
      }

      if (++attempts < maxAttempts) {
        if (attempts === 1) {
          console.log("[DEBUG] Waiting for iframe with pattern: " + srcPattern);
        }

        if (attempts % 10 === 0) {
          const elapsed = Math.round((attempts * currentInterval) / 1000);
          console.log("[DEBUG] Still waiting for " + srcPattern + " iframe... (" + elapsed + "s elapsed, attempt " + attempts + "/" + maxAttempts + ")");
        }

        if (attempts > 20) {
          currentInterval = Math.min(currentInterval * 1.2, maxInterval);
        }

        setTimeout(check, currentInterval);
      } else {
        const totalTime = Math.round((attempts * interval) / 1000);
        console.warn("[DEBUG] Iframe not found after " + maxAttempts + " attempts (" + totalTime + "s total): " + srcPattern);
        reject(new Error("Iframe not found after " + totalTime + "s: " + srcPattern));
      }
    }
    check();
  });
}

/**
 * Inject this script into the innermost payhist_viewAll.html iframe (4-level deep)
 */
function injectIntoFourLevelDeepIframe() {
  // Poll for the first iframe (contentBlock-iframe)
  function pollForFirstIframe(maxAttempts = 120, interval = 500) {
    return new Promise((resolve, reject) => {
      let attempts = 0;
      let currentInterval = interval;
      const maxInterval = 2000; // Cap at 2 seconds

      function check() {
        // First try the standard ID
        let contentBlockIframe = document.getElementById('contentBlock-iframe');

        // If not found, try alternative selectors for live site
        if (!contentBlockIframe) {
          const allIframes = document.querySelectorAll('iframe');
          console.log('[payment_history_filter] [DEBUG] contentBlock-iframe not found by ID, trying alternatives. Found iframes:',
            Array.from(allIframes).map(f => ({ id: f.id, src: f.src })));

          // Look for iframe that might contain mionlineNavigation
          contentBlockIframe = Array.from(allIframes).find(f =>
            f.src && (f.src.includes('mionlineNavigation') || f.src.includes('Navigation'))
          );
        }

        if (contentBlockIframe && contentBlockIframe.contentWindow && contentBlockIframe.contentDocument) {
          console.log('[payment_history_filter] [DEBUG] Found contentBlock-iframe on attempt', attempts + 1);
          resolve(contentBlockIframe);
        } else if (++attempts < maxAttempts) {
          if (attempts === 1) {
            console.log('[payment_history_filter] [DEBUG] Waiting for contentBlock-iframe...');
          }

          // Show progress for long waits
          if (attempts % 10 === 0) {
            const elapsed = Math.round((attempts * currentInterval) / 1000);
            console.log(`[payment_history_filter] [DEBUG] Still waiting for contentBlock-iframe... (${elapsed}s elapsed, attempt ${attempts}/${maxAttempts})`);
          }

          // Use exponential backoff for efficiency, but cap the interval
          if (attempts > 20) {
            currentInterval = Math.min(currentInterval * 1.2, maxInterval);
          }

          setTimeout(check, currentInterval);
        } else {
          const totalTime = Math.round((attempts * interval) / 1000);
          console.warn('[payment_history_filter] [DEBUG] contentBlock-iframe not found after', maxAttempts, `attempts (${totalTime}s total).`);
          reject(new Error(`contentBlock-iframe not found after ${totalTime}s`));
        }
      }
      check();
    });
  }

  // Main logic for 4-level injection
  (async function () {
    try {
      console.log('[payment_history_filter] [DEBUG] Starting 4-level deep iframe injection...');

      // Debug: Show all iframes at the start
      const topLevelIframes = document.querySelectorAll('iframe');
      console.log('[payment_history_filter] [DEBUG] Top-level iframes found:',
        Array.from(topLevelIframes).map(f => ({ id: f.id, src: f.src })));

      // Level 1: Wait for contentBlock-iframe (mionlineNavigation.html)
      console.log('[payment_history_filter] [DEBUG] Level 1: Waiting for contentBlock-iframe...');
      const level1Iframe = await pollForFirstIframe();
      console.log('[payment_history_filter] [DEBUG] Level 1: Found iframe with src:', level1Iframe.src);

      // Level 1.5: Wait for iframe content to load
      console.log('[payment_history_filter] [DEBUG] Level 1.5: Waiting for iframe content to load...');
      const level1Doc = await waitForIframeContentLoaded(level1Iframe);
      console.log('[payment_history_filter] [DEBUG] Level 1.5: Iframe content loaded, proceeding...');

      // Level 2: Wait for iframe in mionlineNavigation.html (InquiryMIInformation.html)
      console.log('[payment_history_filter] [DEBUG] Level 2: Waiting for InquiryMIInformation iframe...');
      const level2Iframe = await pollForIframeBySrc(level1Doc, 'InquiryMIInformation');
      console.log('[payment_history_filter] [DEBUG] Level 2: Found iframe with src:', level2Iframe.src, 'ID:', level2Iframe.id);

      // Level 2.5: Wait for level 2 iframe content to load
      console.log('[payment_history_filter] [DEBUG] Level 2.5: Waiting for level 2 iframe content to load...');
      const level2Doc = await waitForIframeContentLoaded(level2Iframe);
      console.log('[payment_history_filter] [DEBUG] Level 2.5: Level 2 iframe content loaded, proceeding...');

      // Level 3: Wait for iframe in InquiryMIInformation.html (payhist_viewAll.html)
      console.log('[payment_history_filter] [DEBUG] Level 3: Waiting for payhist_viewAll iframe...');
      const level3Iframe = await pollForIframeBySrc(level2Doc, 'payhist_viewAll');
      console.log('[payment_history_filter] [DEBUG] Level 3: Found iframe with src:', level3Iframe.src, 'ID:', level3Iframe.id);

      // Level 3.5: Wait for level 3 iframe content to load
      console.log('[payment_history_filter] [DEBUG] Level 3.5: Waiting for level 3 iframe content to load...');
      const level3Doc = await waitForIframeContentLoaded(level3Iframe);

      // Level 4: Inject script into final iframe
      console.log('[payment_history_filter] [DEBUG] Level 4: Preparing payhist_viewAll document...');
      console.log('[payment_history_filter] [DEBUG] Level 4: Final document ready state:', level3Doc.readyState);

      // Inject inline script into the deepest level (payhist_viewAll.html)
      console.log('[payment_history_filter] [DEBUG] Level 4: Injecting script into payhist_viewAll...');
      const injectionResult = injectInlineScript(level3Doc);

      // Handle async injection if document was still loading
      if (injectionResult instanceof Promise) {
        await injectionResult;
      }

      console.log('[payment_history_filter] [DEBUG] 4-level deep iframe injection complete.');

    } catch (e) {
      console.warn('[payment_history_filter] [DEBUG] 4-level deep iframe injection failed:', e);

      // Log detailed error information
      console.log('[payment_history_filter] [DEBUG] Error details - Message:', e.message, 'Stack:', e.stack);

      // Enhanced error recovery: retry after delay for server-related issues
      if (e.message.includes('not found after') && e.message.includes('s')) {
        console.log('[payment_history_filter] [DEBUG] Server appears slow, implementing recovery strategy...');

        // Wait a bit longer and try a simplified approach
        setTimeout(() => {
          console.log('[payment_history_filter] [DEBUG] Attempting recovery injection...');

          // Try to find any payhist iframe that might have loaded by now
          function recursiveIframeSearch(doc, depth = 0) {
            if (depth > 5) return; // Prevent infinite recursion

            const iframes = doc.querySelectorAll('iframe');
            console.log('[payment_history_filter] [DEBUG] Depth', depth, '- Found iframes:',
              Array.from(iframes).map(f => ({ id: f.id, src: f.src })));

            for (const iframe of iframes) {
              try {
                if (iframe.src && iframe.src.includes('payhist') &&
                  iframe.contentDocument && iframe.contentWindow) {
                  console.log('[payment_history_filter] [DEBUG] Found payhist iframe during recovery at depth', depth, '- injecting...');
                  injectInlineScript(iframe.contentDocument);
                  return;
                }

                // Recursively search in accessible iframes
                if (iframe.contentDocument) {
                  recursiveIframeSearch(iframe.contentDocument, depth + 1);
                }
              } catch (recoveryError) {
                console.log('[payment_history_filter] [DEBUG] Recovery search error at depth', depth, ':', recoveryError.message);
              }
            }
          }

          recursiveIframeSearch(document);
        }, 5000); // Wait 5 seconds before recovery attempt
      }
    }
  })();
}

// ########## URL CHANGE MONITORING ##########

/**
 * Track current URL to detect changes
 */
let currentUrl = window.location.href;
let isProcessing = false;
let urlChangeTimeout = null;

/**
 * Handle URL change and retrigger script
 */
function handleUrlChange() {
  const newUrl = window.location.href;

  if (newUrl !== currentUrl && !isProcessing) {
    console.log(`[payment_history_filter] 🔄 URL changed from ${currentUrl} to ${newUrl}`);
    currentUrl = newUrl;

    // Clear any existing timeout to avoid multiple rapid triggers
    if (urlChangeTimeout) {
      clearTimeout(urlChangeTimeout);
    }

    // Debounce URL changes to avoid rapid-fire triggers
    urlChangeTimeout = setTimeout(() => {
      console.log('[payment_history_filter] 🚀 Retriggering script due to URL change...');

      // Reset processing flag and restart injection
      isProcessing = false;

      // Clear any existing injected scripts to avoid duplicates
      const existingScripts = document.querySelectorAll('script[data-payment-history-filter="true"]');
      existingScripts.forEach(script => script.remove());

      // Also clear any injected scripts in iframes
      clearExistingIframeScripts();

      // Restart the injection process
      restartInjectionProcess();

    }, 1000); // Wait 1 second after URL change to ensure page is stable
  }
}

/**
 * Clear existing injected scripts from all accessible iframes
 */
function clearExistingIframeScripts() {
  try {
    const allIframes = document.querySelectorAll('iframe');

    allIframes.forEach(iframe => {
      try {
        if (iframe.contentDocument) {
          const existingScripts = iframe.contentDocument.querySelectorAll('script[data-payment-history-filter="true"]');
          existingScripts.forEach(script => {
            console.log('[payment_history_filter] 🧹 Clearing existing script from iframe');
            script.remove();
          });
        }
      } catch (e) {
        // Ignore cross-origin access errors
      }
    });
  } catch (e) {
    console.warn('[payment_history_filter] Could not clear iframe scripts:', e);
  }
}

/**
 * Restart the entire injection process from the beginning
 */
function restartInjectionProcess() {
  console.log('[payment_history_filter] 🔄 Restarting injection process...');

  // Reset state
  isProcessing = true;

  // Wait a bit for page to stabilize after URL change
  setTimeout(() => {
    console.log('[payment_history_filter] 📍 Starting fresh injection after URL change');

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        setTimeout(injectIntoFourLevelDeepIframe, 500);
      }, { once: true });
    } else {
      setTimeout(injectIntoFourLevelDeepIframe, 500);
    }

    isProcessing = false;
  }, 1500);
}

/**
 * Set up URL change monitoring
 */
function setupUrlChangeMonitoring() {
  console.log('[payment_history_filter] 🔍 Setting up URL change monitoring...');

  // Monitor pushState and replaceState (for SPA navigation)
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  history.pushState = function () {
    originalPushState.apply(history, arguments);
    handleUrlChange();
  };

  history.replaceState = function () {
    originalReplaceState.apply(history, arguments);
    handleUrlChange();
  };

  // Monitor popstate events (back/forward button)
  window.addEventListener('popstate', handleUrlChange);

  // Monitor hash changes
  window.addEventListener('hashchange', handleUrlChange);

  // Monitor for new iframe creation and iframe src changes
  setupIframeMonitoring();

  // Periodic URL check as fallback (for edge cases)
  setInterval(() => {
    if (window.location.href !== currentUrl) {
      handleUrlChange();
    }
  }, 2000);

  console.log('[payment_history_filter] ✅ URL change monitoring setup complete');
}

/**
 * Set up iframe monitoring for src changes and new iframe creation
 */
function setupIframeMonitoring() {
  // Track existing iframe src values
  const iframeSrcMap = new Map();

  function trackIframeSources() {
    const iframes = document.querySelectorAll('iframe');
    iframes.forEach((iframe, index) => {
      const currentSrc = iframe.src || '';
      const iframeId = iframe.id || `iframe-${index}`;

      if (iframeSrcMap.get(iframeId) !== currentSrc) {
        if (iframeSrcMap.has(iframeId)) {
          console.log(`[payment_history_filter] 🔄 Iframe ${iframeId} src changed to: ${currentSrc}`);
          // Trigger script restart if iframe src contains payment history indicators
          if (currentSrc.includes('payhist') || currentSrc.includes('InquiryMIInformation')) {
            handleUrlChange();
          }
        }
        iframeSrcMap.set(iframeId, currentSrc);
      }
    });
  }

  // Initial tracking
  trackIframeSources();

  // Monitor for new iframes and iframe changes using MutationObserver
  const iframeObserver = new MutationObserver((mutations) => {
    let iframeChanges = false;

    mutations.forEach((mutation) => {
      // Check for new iframes
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            if (node.tagName === 'IFRAME' || node.querySelector('iframe')) {
              iframeChanges = true;
            }
          }
        });
      }

      // Check for iframe attribute changes (src, etc.)
      if (mutation.type === 'attributes' &&
        mutation.target.tagName === 'IFRAME' &&
        (mutation.attributeName === 'src' || mutation.attributeName === 'data-src')) {
        iframeChanges = true;
      }
    });

    if (iframeChanges) {
      console.log('[payment_history_filter] 🔄 Iframe changes detected');
      trackIframeSources();
    }
  });

  iframeObserver.observe(document.body || document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['src', 'data-src']
  });

  // Periodic iframe monitoring as fallback
  setInterval(trackIframeSources, 3000);

  console.log('[payment_history_filter] 🔍 Iframe monitoring setup complete');
}

// ########## END URL CHANGE MONITORING ##########

// Start injection process with URL monitoring
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    isProcessing = true;
    setupUrlChangeMonitoring();
    setTimeout(() => {
      injectIntoFourLevelDeepIframe();
      isProcessing = false;
    }, 1000);
  });
} else {
  isProcessing = true;
  setupUrlChangeMonitoring();
  setTimeout(() => {
    injectIntoFourLevelDeepIframe();
    isProcessing = false;
  }, 1000);
}

/**
 * Wait for iframe document to be fully loaded and populated
 * Enhanced with cross-origin handling and fallback strategies
 */
async function waitForIframeContentLoaded(iframe, maxAttempts = 60, interval = 1000) {
  return new Promise((resolve, reject) => {
    let attempts = 0;

    function checkContent() {
      try {
        // First check if we can access the iframe directly
        let doc = null;
        let isCrossOrigin = false;

        try {
          doc = iframe.contentDocument;
          // If we get here without error, we can access the document
        } catch (accessError) {
          console.log(`[payment_history_filter] [DEBUG] Cross-origin restriction detected: ${accessError.message}`);
          isCrossOrigin = true;
        }

        // If cross-origin or doc is null, we need to use alternative strategies
        if (isCrossOrigin || !doc) {
          console.log(`[payment_history_filter] [DEBUG] Using alternative strategy for cross-origin iframe`);

          // Check if iframe has loaded based on other indicators
          const hasLoaded = iframe.complete === true ||
            iframe.readyState === 'complete' ||
            iframe.dataset.loaded === 'true';

          // If iframe appears loaded or we've waited long enough, proceed anyway
          if (hasLoaded || attempts >= Math.min(20, maxAttempts / 2)) {
            console.log(`[payment_history_filter] [DEBUG] Cross-origin iframe appears loaded (attempt ${attempts + 1})`);

            // Create a placeholder document object that mimics enough functionality
            const placeholderDoc = {
              body: { innerHTML: "[Cross-origin content]" },
              querySelectorAll: () => [],
              querySelector: () => null,
              getElementsByTagName: () => [],
              readyState: "complete",
              location: { href: iframe.src },
              _isCrossOrigin: true  // Flag to identify this is a placeholder
            };

            resolve(placeholderDoc);
            return;
          }
        } else if (doc) {
          // We can access the document - check if it has meaningful content
          const hasBody = doc.body && doc.body.children.length > 0;
          const hasHead = doc.head && doc.head.children.length > 0;
          const hasIframes = doc.querySelectorAll('iframe').length > 0;
          const hasContent = doc.documentElement && doc.documentElement.textContent &&
            doc.documentElement.textContent.trim().length > 50;
          const isComplete = doc.readyState === 'complete';
          const isInteractive = doc.readyState === 'interactive';

          if (attempts % 10 === 0 || attempts === 0) {
            console.log(`[payment_history_filter] [DEBUG] Iframe content check (attempt ${attempts + 1}):`, {
              hasBody,
              hasHead,
              hasIframes,
              hasContent,
              bodyChildren: doc.body ? doc.body.children.length : 0,
              totalText: doc.documentElement ? doc.documentElement.textContent.trim().length : 0,
              readyState: doc.readyState
            });
          }

          // Consider loaded if it has body content OR nested iframes OR substantial text OR readyState complete
          if (hasBody || hasIframes || hasContent || isComplete || (isInteractive && hasContent)) {
            console.log(`[payment_history_filter] [DEBUG] Iframe content loaded successfully after ${attempts + 1} attempts`);
            resolve(doc);
            return;
          }
        }

        if (++attempts < maxAttempts) {
          // Continue polling at increasing intervals
          const dynamicInterval = Math.min(interval * Math.pow(1.1, Math.floor(attempts / 10)), 3000);

          if (attempts % 10 === 0) {
            console.log(`[payment_history_filter] [DEBUG] Iframe content not ready, waiting... (attempt ${attempts}/${maxAttempts}, interval: ${dynamicInterval}ms)`);
          }

          setTimeout(checkContent, dynamicInterval);
        } else {
          console.warn(`[payment_history_filter] [DEBUG] Iframe content failed to load after ${maxAttempts} attempts`);

          // Even after max attempts, try to return whatever document we have
          if (doc) {
            console.log(`[payment_history_filter] [DEBUG] Returning incomplete document after max attempts`);
            resolve(doc);
          } else {
            reject(new Error(`Iframe content not loaded after ${maxAttempts * interval / 1000}s`));
          }
        }
      } catch (error) {
        console.error(`[payment_history_filter] [DEBUG] Error checking iframe content:`, error);
        if (++attempts < maxAttempts) {
          setTimeout(checkContent, interval);
        } else {
          reject(error);
        }
      }
    }

    // Start checking immediately
    checkContent();
  });
}

/**
 * Poll for iframe by src pattern with enhanced cross-origin handling
 */
function pollForIframeBySrc(doc, srcPattern, maxAttempts = 120, interval = 500) {
  console.log(`[payment_history_filter] [DEBUG] Polling for iframe in Document:`, doc);
  return new Promise((resolve, reject) => {
    let attempts = 0;
    let currentInterval = interval;
    const maxInterval = 2000; // Cap at 2 seconds

    // Keep track of iframes we've seen to detect changes
    const seenIframes = new Map();

    // Function to log iframe details safely
    function logIframeDetails(iframe, index) {
      try {
        const details = {
          index,
          id: iframe.id || "[no id]",
          src: iframe.src || "[no src]",
          name: iframe.name || "[no name]",
          width: iframe.width,
          height: iframe.height,
          visible: iframe.style.display !== 'none' && iframe.style.visibility !== 'hidden',
          accessibleContent: false
        };

        try {
          // Try to access contentDocument (will fail for cross-origin)
          if (iframe.contentDocument) {
            details.accessibleContent = true;
            details.readyState = iframe.contentDocument.readyState;
            details.bodySize = iframe.contentDocument.body ?
              iframe.contentDocument.body.children.length : 'no body';
          }
        } catch (e) {
          details.accessibleContent = false;
          details.crossOrigin = true;
        }

        return details;
      } catch (e) {
        return { index, error: e.message };
      }
    }

    function check() {
      if (attempts === 0 || attempts % 10 === 0) {
        const allIframes = Array.from(doc.getElementsByTagName('iframe'));
        console.log(`[payment_history_filter] [DEBUG] Polling for iframe with src pattern "${srcPattern}". Found ${allIframes.length} iframes in doc:`,
          allIframes.map((f, i) => logIframeDetails(f, i))
        );
      }

      const iframes = Array.from(doc.getElementsByTagName('iframe'));
      let iframe = null;
      let matchFound = false;
      let crossOriginMatch = null;

      // First pass: Try to find iframe by src pattern
      for (let i = 0; i < iframes.length; i++) {
        const frame = iframes[i];

        // Check if this iframe matches our pattern
        if (frame.src && frame.src.includes(srcPattern)) {
          matchFound = true;

          // Try to access contentDocument to check if it's cross-origin
          try {
            if (frame.contentDocument) {
              iframe = frame;
              console.log(`[payment_history_filter] [DEBUG] Found accessible iframe with src pattern "${srcPattern}" on attempt ${attempts + 1}`);
              break;
            } else {
              crossOriginMatch = frame;
              console.log(`[payment_history_filter] [DEBUG] Found iframe with matching src but null contentDocument`);
            }
          } catch (e) {
            // This is a cross-origin iframe
            crossOriginMatch = frame;
            console.log(`[payment_history_filter] [DEBUG] Found cross-origin iframe with matching src pattern "${srcPattern}"`);
          }
        }
      }

      // Second pass: If no direct src match, try ID patterns
      if (!iframe && !crossOriginMatch) {
        if (srcPattern.includes('InquiryMIInformation')) {
          // Look for live site iframe ID: frmMIOnlineContent
          iframe = iframes.find(f => f.id === 'frmMIOnlineContent' ||
            f.id.includes('MIOnline') ||
            f.id.includes('Inquiry'));
          if (iframe) {
            console.log(`[payment_history_filter] [DEBUG] Found InquiryMIInformation iframe by ID: ${iframe.id}`);
          }
        } else if (srcPattern.includes('payhist')) {
          // Look for live site iframe ID: containerTab_tabPaymentHistory_frmPaymentHistory
          iframe = iframes.find(f => f.id === 'containerTab_tabPaymentHistory_frmPaymentHistory' ||
            f.id.includes('Payment') ||
            f.id.includes('payhist'));
          if (iframe) {
            console.log(`[payment_history_filter] [DEBUG] Found payhist iframe by ID: ${iframe.id}`);
          }
        }

        // If we found by ID, check if it's cross-origin
        if (iframe) {
          try {
            if (!iframe.contentDocument) {
              crossOriginMatch = iframe;
              iframe = null;
              console.log(`[payment_history_filter] [DEBUG] Found iframe by ID but it's cross-origin`);
            }
          } catch (e) {
            crossOriginMatch = iframe;
            iframe = null;
            console.log(`[payment_history_filter] [DEBUG] Found iframe by ID but it's cross-origin (exception)`);
          }
        }
      }

      // Third pass: Check for iframes with specific attributes or content that might match
      if (!iframe && !crossOriginMatch) {
        for (const frame of iframes) {
          // Check for any attributes that might indicate this is our target
          const nameMatch = frame.name && (
            frame.name.includes('payment') ||
            frame.name.includes('history') ||
            frame.name.includes('inquiry')
          );

          const idMatch = frame.id && (
            frame.id.includes('payment') ||
            frame.id.includes('history') ||
            frame.id.includes('inquiry') ||
            frame.id.includes('content')
          );

          // If we have a potential match, check if it's accessible
          if (nameMatch || idMatch) {
            try {
              if (frame.contentDocument) {
                iframe = frame;
                console.log(`[payment_history_filter] [DEBUG] Found potential iframe match by name/id attributes: ${frame.id || frame.name}`);
                break;
              } else {
                if (!crossOriginMatch) crossOriginMatch = frame;
              }
            } catch (e) {
              if (!crossOriginMatch) crossOriginMatch = frame;
            }
          }
        }
      }

      // If we found an accessible iframe, resolve with it
      if (iframe) {
        // Check if iframe has changed since last time
        const iframeKey = iframe.id || iframe.name || iframe.src;
        const previousState = seenIframes.get(iframeKey);

        if (previousState) {
          // If we've seen this iframe before, check if it's changed
          const currentSrc = iframe.src || '';
          const previousSrc = previousState.src || '';

          if (currentSrc !== previousSrc) {
            console.log(`[payment_history_filter] [DEBUG] Iframe src changed from "${previousSrc}" to "${currentSrc}"`);
          }
        }

        // Update seen iframes map
        seenIframes.set(iframeKey, {
          src: iframe.src,
          time: Date.now(),
          attempt: attempts
        });

        // Iframe with matching pattern found and accessible
        console.log(`[payment_history_filter] [DEBUG] Found and accessed iframe with src pattern "${srcPattern}" on attempt ${attempts + 1}`);
        resolve(iframe);
        return;
      }
      // If we found a cross-origin match but can't access it
      else if (crossOriginMatch && attempts >= Math.min(30, maxAttempts / 2)) {
        console.log(`[payment_history_filter] [DEBUG] Using cross-origin iframe match after ${attempts} attempts`);

        // Create a special flag on the iframe to indicate it's cross-origin
        crossOriginMatch._isCrossOrigin = true;

        resolve(crossOriginMatch);
        return;
      }
      // If we found a match by src pattern but can't access it yet (might be loading)
      else if (matchFound && !iframe) {
        console.log(`[payment_history_filter] [DEBUG] Found matching iframe but can't access content yet (attempt ${attempts + 1})`);
      }

      if (++attempts < maxAttempts) {
        if (attempts === 1) {
          console.log(`[payment_history_filter] [DEBUG] Waiting for iframe with src pattern "${srcPattern}"...`);
        }

        // Show progress for long waits
        if (attempts % 10 === 0) {
          const elapsed = Math.round((attempts * currentInterval) / 1000);
          console.log(`[payment_history_filter] [DEBUG] Still waiting for "${srcPattern}" iframe... (${elapsed}s elapsed, attempt ${attempts}/${maxAttempts})`);
        }

        // Use exponential backoff for efficiency, but cap the interval
        if (attempts > 20) {
          currentInterval = Math.min(currentInterval * 1.2, maxInterval);
        }

        setTimeout(check, currentInterval);
      } else {
        const totalTime = Math.round((attempts * interval) / 1000);
        console.warn(`[payment_history_filter] [DEBUG] Iframe with src pattern "${srcPattern}" not found after ${maxAttempts} attempts (${totalTime}s total).`);

        // Last resort: If we have a cross-origin match, use it even though we can't access it
        if (crossOriginMatch) {
          console.log(`[payment_history_filter] [DEBUG] Using cross-origin iframe as last resort`);
          crossOriginMatch._isCrossOrigin = true;
          resolve(crossOriginMatch);
        } else {
          reject(new Error(`Iframe with src pattern "${srcPattern}" not found after ${totalTime}s`));
        }
      }
    }
    check();
  });
}

/**
 * Inject this script into the innermost payhist_viewAll.html iframe (4-level deep)
 * Enhanced with cross-origin handling and direct injection strategies
 */
function injectIntoFourLevelDeepIframe() {
  // Poll for the first iframe (contentBlock-iframe)
  function pollForFirstIframe(maxAttempts = 120, interval = 500) {
    return new Promise((resolve, reject) => {
      let attempts = 0;
      let currentInterval = interval;
      const maxInterval = 2000; // Cap at 2 seconds

      function check() {
        // First try the standard ID
        let contentBlockIframe = document.getElementById('contentBlock-iframe');

        // If not found, try alternative selectors for live site
        if (!contentBlockIframe) {
          const allIframes = document.querySelectorAll('iframe');

          if (attempts === 0 || attempts % 10 === 0) {
            console.log('[payment_history_filter] [DEBUG] contentBlock-iframe not found by ID, trying alternatives. Found iframes:',
              Array.from(allIframes).map((f, i) => ({
                index: i,
                id: f.id || "[no id]",
                src: f.src || "[no src]",
                name: f.name || "[no name]"
              })));
          }

          // Look for iframe that might contain mionlineNavigation
          contentBlockIframe = Array.from(allIframes).find(f =>
            (f.src && (f.src.includes('mionlineNavigation') || f.src.includes('Navigation'))) ||
            (f.id && (f.id.includes('content') || f.id.includes('main') || f.id.includes('navigation'))) ||
            (f.name && (f.name.includes('content') || f.name.includes('main') || f.name.includes('navigation')))
          );

          // If still not found, take the first iframe with substantial size
          if (!contentBlockIframe) {
            contentBlockIframe = Array.from(allIframes).find(f =>
              (parseInt(f.width) > 500 || parseInt(f.style.width) > 500) &&
              (parseInt(f.height) > 300 || parseInt(f.style.height) > 300)
            );
          }

          // Last resort: just take the first iframe
          if (!contentBlockIframe && allIframes.length > 0) {
            if (attempts >= maxAttempts / 2) {
              console.log('[payment_history_filter] [DEBUG] Using first iframe as last resort');
              contentBlockIframe = allIframes[0];
            }
          }
        }

        // Check if we can access the iframe
        let isAccessible = false;
        if (contentBlockIframe) {
          try {
            isAccessible = !!contentBlockIframe.contentWindow && !!contentBlockIframe.contentDocument;
          } catch (e) {
            console.log('[payment_history_filter] [DEBUG] Found iframe but it\'s cross-origin:', e.message);
          }
        }

        if (contentBlockIframe && isAccessible) {
          console.log('[payment_history_filter] [DEBUG] Found contentBlock-iframe on attempt', attempts + 1);
          resolve(contentBlockIframe);
        } else if (contentBlockIframe && !isAccessible && attempts >= maxAttempts / 2) {
          // If we found an iframe but can't access it, and we've waited long enough
          console.log('[payment_history_filter] [DEBUG] Using cross-origin iframe after', attempts, 'attempts');
          contentBlockIframe._isCrossOrigin = true;
          resolve(contentBlockIframe);
        } else if (++attempts < maxAttempts) {
          if (attempts === 1) {
            console.log('[payment_history_filter] [DEBUG] Waiting for contentBlock-iframe...');
          }

          // Show progress for long waits
          if (attempts % 10 === 0) {
            const elapsed = Math.round((attempts * currentInterval) / 1000);
            console.log(`[payment_history_filter] [DEBUG] Still waiting for contentBlock-iframe... (${elapsed}s elapsed, attempt ${attempts}/${maxAttempts})`);
          }

          // Use exponential backoff for efficiency, but cap the interval
          if (attempts > 20) {
            currentInterval = Math.min(currentInterval * 1.2, maxInterval);
          }

          setTimeout(check, currentInterval);
        } else {
          const totalTime = Math.round((attempts * interval) / 1000);
          console.warn('[payment_history_filter] [DEBUG] contentBlock-iframe not found after', maxAttempts, `attempts (${totalTime}s total).`);

          // Try direct injection as fallback
          console.log('[payment_history_filter] [DEBUG] Attempting direct injection as fallback');
          tryDirectInjection();

          reject(new Error(`contentBlock-iframe not found after ${totalTime}s`));
        }
      }
      check();
    });
  }

  // Try direct injection into any payment-related iframe we can find
  function tryDirectInjection() {
    console.log('[payment_history_filter] [DEBUG] Trying direct injection into any accessible iframe');

    // Look for any iframe that might be related to payments
    const allIframes = document.querySelectorAll('iframe');
    let injected = false;

    for (const iframe of allIframes) {
      try {
        // Check if this iframe is accessible and might be payment-related
        if (iframe.contentDocument && iframe.contentWindow) {
          const src = iframe.src || '';
          const id = iframe.id || '';
          const name = iframe.name || '';

          if (src.includes('payment') || src.includes('payhist') ||
            id.includes('payment') || id.includes('history') ||
            name.includes('payment') || name.includes('history')) {

            console.log('[payment_history_filter] [DEBUG] Found potentially relevant iframe for direct injection:',
              { src, id, name });

            // Try to inject our script
            injectInlineScript(iframe.contentDocument);
            injected = true;
          }
        }
      } catch (e) {
        // Cross-origin iframe, can't access
      }
    }

    if (!injected) {
      console.log('[payment_history_filter] [DEBUG] Could not find any accessible iframe for direct injection');

      // Last resort: Try to detect if we're already in the payment history context
      if (isTargetIframeContext()) {
        console.log('[payment_history_filter] [DEBUG] We are already in payment history context, running filter directly');
        checkPaymentHistoryLoanAccess();
      }
    }
  }

  // Main logic for 4-level injection with enhanced cross-origin handling
  (async function () {
    try {
      console.log('[payment_history_filter] [DEBUG] Starting 4-level deep iframe injection with enhanced cross-origin handling...');

      // Debug: Show all iframes at the start
      const topLevelIframes = document.querySelectorAll('iframe');
      console.log('[payment_history_filter] [DEBUG] Top-level iframes found:',
        Array.from(topLevelIframes).map((f, i) => ({
          index: i,
          id: f.id || "[no id]",
          src: f.src || "[no src]",
          name: f.name || "[no name]"
        })));

      // Check if we're already in the payment history context
      if (isTargetIframeContext()) {
        console.log('[payment_history_filter] [DEBUG] Already in payment history context, running filter directly');
        checkPaymentHistoryLoanAccess();
        return;
      }

      // Level 1: Wait for contentBlock-iframe (mionlineNavigation.html)
      console.log('[payment_history_filter] [DEBUG] Level 1: Waiting for contentBlock-iframe...');
      const level1Iframe = await pollForFirstIframe();
      console.log('[payment_history_filter] [DEBUG] Level 1: Found iframe with src:', level1Iframe.src);

      // Handle cross-origin iframe
      if (level1Iframe._isCrossOrigin) {
        console.log('[payment_history_filter] [DEBUG] Level 1 iframe is cross-origin, trying alternative approach');
        tryDirectInjection();
        return;
      }

      // Level 1.5: Wait for iframe content to load
      console.log('[payment_history_filter] [DEBUG] Level 1.5: Waiting for iframe content to load...');
      const level1Doc = await waitForIframeContentLoaded(level1Iframe);

      // Check if we got a cross-origin placeholder
      if (level1Doc._isCrossOrigin) {
        console.log('[payment_history_filter] [DEBUG] Level 1 document is cross-origin, trying alternative approach');
        tryDirectInjection();
        return;
      }

      console.log('[payment_history_filter] [DEBUG] Level 1.5: Iframe content loaded, proceeding...');

      // Level 2: Wait for iframe in mionlineNavigation.html (InquiryMIInformation.html)
      console.log('[payment_history_filter] [DEBUG] Level 2: Waiting for InquiryMIInformation iframe...');
      const level2Iframe = await pollForIframeBySrc(level1Doc, 'InquiryMIInformation');
      console.log('[payment_history_filter] [DEBUG] Level 2: Found iframe with src:', level2Iframe.src, 'ID:', level2Iframe.id);

      // Handle cross-origin iframe
      if (level2Iframe._isCrossOrigin) {
        console.log('[payment_history_filter] [DEBUG] Level 2 iframe is cross-origin, trying alternative approach');

        // Try to find payment history tab in level1Doc
        const paymentHistoryTab = findTabElement(level1Doc, 'Payment History', [
          '#__tab_containerTab_tabPaymentHistory',
          'a[id="__tab_containerTab_tabPaymentHistory"]',
          '#containerTab_tabPaymentHistory_tab a',
          'span[id="containerTab_tabPaymentHistory_tab"] a'
        ]);

        if (paymentHistoryTab) {
          console.log('[payment_history_filter] [DEBUG] Found Payment History tab in level1Doc, clicking it');
          paymentHistoryTab.click();

          // Wait a bit and check if we're now in the payment history context
          setTimeout(() => {
            if (isTargetIframeContext()) {
              console.log('[payment_history_filter] [DEBUG] Now in payment history context after clicking tab');
              checkPaymentHistoryLoanAccess();
            } else {
              console.log('[payment_history_filter] [DEBUG] Still not in payment history context after clicking tab');
              tryDirectInjection();
            }
          }, 2000);
        } else {
          tryDirectInjection();
        }

        return;
      }

      // Level 2.5: Wait for level 2 iframe content to load
      console.log('[payment_history_filter] [DEBUG] Level 2.5: Waiting for level 2 iframe content to load...');
      const level2Doc = await waitForIframeContentLoaded(level2Iframe);

      // Check if we got a cross-origin placeholder
      if (level2Doc._isCrossOrigin) {
        console.log('[payment_history_filter] [DEBUG] Level 2 document is cross-origin, trying alternative approach');
        tryDirectInjection();
        return;
      }

      console.log('[payment_history_filter] [DEBUG] Level 2.5: Level 2 iframe content loaded, proceeding...');

      // Level 3: Wait for iframe in InquiryMIInformation.html (payhist_viewAll.html)
      console.log('[payment_history_filter] [DEBUG] Level 3: Waiting for payhist_viewAll iframe...');
      const level3Iframe = await pollForIframeBySrc(level2Doc, 'payhist_viewAll');
      console.log('[payment_history_filter] [DEBUG] Level 3: Found iframe with src:', level3Iframe.src, 'ID:', level3Iframe.id);

      // Handle cross-origin iframe
      if (level3Iframe._isCrossOrigin) {
        console.log('[payment_history_filter] [DEBUG] Level 3 iframe is cross-origin, trying alternative approach');

        // Try to find payment history tab in level2Doc
        const paymentHistoryTab = findTabElement(level2Doc, 'Payment History', [
          '#__tab_containerTab_tabPaymentHistory',
          'a[id="__tab_containerTab_tabPaymentHistory"]',
          '#containerTab_tabPaymentHistory_tab a',
          'span[id="containerTab_tabPaymentHistory_tab"] a'
        ]);

        if (paymentHistoryTab) {
          console.log('[payment_history_filter] [DEBUG] Found Payment History tab in level2Doc, clicking it');
          paymentHistoryTab.click();

          // Wait a bit and check if we're now in the payment history context
          setTimeout(() => {
            if (isTargetIframeContext()) {
              console.log('[payment_history_filter] [DEBUG] Now in payment history context after clicking tab');
              checkPaymentHistoryLoanAccess();
            } else {
              console.log('[payment_history_filter] [DEBUG] Still not in payment history context after clicking tab');
              tryDirectInjection();
            }
          }, 2000);
        } else {
          tryDirectInjection();
        }

        return;
      }

      // Level 3.5: Wait for level 3 iframe content to load
      console.log('[payment_history_filter] [DEBUG] Level 3.5: Waiting for level 3 iframe content to load...');
      const level3Doc = await waitForIframeContentLoaded(level3Iframe);

      // Check if we got a cross-origin placeholder
      if (level3Doc._isCrossOrigin) {
        console.log('[payment_history_filter] [DEBUG] Level 3 document is cross-origin, trying alternative approach');
        tryDirectInjection();
        return;
      }

      // Level 4: Inject script into final iframe
      console.log('[payment_history_filter] [DEBUG] Level 4: Preparing payhist_viewAll document...');
      console.log('[payment_history_filter] [DEBUG] Level 4: Final document ready state:', level3Doc.readyState);

      // Inject inline script into the deepest level (payhist_viewAll.html)
      console.log('[payment_history_filter] [DEBUG] Level 4: Injecting script into payhist_viewAll...');
      const injectionResult = injectInlineScript(level3Doc);

      // Handle async injection if document was still loading
      if (injectionResult instanceof Promise) {
        await injectionResult;
      }

      console.log('[payment_history_filter] [DEBUG] 4-level deep iframe injection complete.');

    } catch (e) {
      console.warn('[payment_history_filter] [DEBUG] 4-level deep iframe injection failed:', e);

      // Log detailed error information
      console.log('[payment_history_filter] [DEBUG] Error details - Message:', e.message, 'Stack:', e.stack);

      // Enhanced error recovery: try direct injection
      console.log('[payment_history_filter] [DEBUG] Attempting recovery via direct injection...');
      tryDirectInjection();
    }
  })();
}

// ... existing code ...