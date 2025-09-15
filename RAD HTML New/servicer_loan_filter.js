/*!
 * @description : Servicer Loan Filter Script - Simplified for Direct Injection
 * @portal : MI Online - Radian
 * @author :  Accelirate Team
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
// ########## DO NOT MODIFY THESE LINES - END ##########

// ########## LOAN NUMBER CHECKING LOGIC ##########
async function checkNumbersBatch(numbers) {
  return new Promise((resolve, reject) => {
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

// ########## NAVIGATION CONTROL (adapted minimal) ##########
const HIDDEN_ACTION_ELEMENTS = [
  'Document Center',
  'Send Decision Doc',
  'Quick Actions',
  'Rate Finder',
  'New Application',
  'Activate Deferred',
  'Transfer Servicing'
];

const PRESERVED_ACTION_ELEMENTS = [
  'Notes',
  'Print'
];

function hideNavigationLinks() {
  try {
    const allElements = document.querySelectorAll('a, button, .menu-item, [role="menuitem"], [role="button"], .nav-link, .navigation-item');
    allElements.forEach((element) => {
      const text = element.textContent?.replace(/\s+/g, ' ').trim() || '';
      if (!text) return;

      const shouldHide = HIDDEN_ACTION_ELEMENTS.some(hiddenText =>
        text.toLowerCase().includes(hiddenText.toLowerCase())
      );

      const shouldPreserve = PRESERVED_ACTION_ELEMENTS.some(preservedText =>
        text.toLowerCase().includes(preservedText.toLowerCase())
      );

      if (shouldHide && !shouldPreserve) {
        element.style.display = 'none';
        element.setAttribute('data-hidden-by-filter', 'true');
      } else if (shouldPreserve) {
        element.setAttribute('data-preserved-by-filter', 'true');
      }
    });

    // Same-origin iframes
    const iframes = document.querySelectorAll('iframe');
    iframes.forEach(iframe => {
      try {
        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
        if (!iframeDoc) return;
        const iframeElements = iframeDoc.querySelectorAll('a, button, .menu-item, [role="menuitem"], [role="button"], .nav-link, .navigation-item');
        iframeElements.forEach((element) => {
          const text = element.textContent?.replace(/\s+/g, ' ').trim() || '';
          if (!text) return;
          const shouldHide = HIDDEN_ACTION_ELEMENTS.some(hiddenText =>
            text.toLowerCase().includes(hiddenText.toLowerCase())
          );
          if (shouldHide) {
            element.style.display = 'none';
            element.setAttribute('data-hidden-by-filter', 'true');
          }
        });
      } catch (_) { /* cross-origin ignored */ }
    });
  } catch (_) {
    // no-op
  }
}

// ########## CORE FUNCTIONALITY ##########

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
 * Create loader to show when checking loan access
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
 * Create Loader Element
 */
function createLoaderElement() {
  const loader = document.createElement("div");
  loader.id = "loaderOverlay";

  const spinner = document.createElement("div");
  spinner.className = "spinner";

  const loadingText = document.createElement("div");
  loadingText.textContent = "Verifying loan access permissions...";
  applyElementStyles(loadingText, {
    marginLeft: "20px",
    fontSize: "16px",
    color: "#2b6cb0",
  });

  loader.appendChild(spinner);
  loader.appendChild(loadingText);

  return loader;
}

/**
 * Show loader during loan access check
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
 * Hide loader after loan access check
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
 * Main function to check servicer loan number and handle restrictions
 */
async function checkServicerLoanAccess() {
  try {
    console.log("[servicer_loan_filter] 🔍 Checking servicer loan access...");

    // Show loader while checking
    showLoader();

    // Wait for extension listener
    await waitForListener();

    // Find the servicer loan number element
    const servicerLoanElement = document.querySelector(
      "#lblServicerLoanNumVal"
    );

    if (!servicerLoanElement) {
      console.log("No servicer loan number element found");
      hideLoader();
      return;
    }
    console.log("Servicer loan number element found:", servicerLoanElement);

    const loanNumber = servicerLoanElement.textContent
      ? servicerLoanElement.textContent.trim()
      : "";

    if (!loanNumber) {
      console.log("No loan number found in element");
      hideLoader();
      return;
    }

    console.log(`Checking access for loan number: ${loanNumber}`);

    // Check if loan is restricted
    const allowedLoans = await checkNumbersBatch([loanNumber]);

    if (allowedLoans.length === 0) {
      // Loan is restricted - hide content and show unauthorized message
      console.log(`Loan ${loanNumber} is restricted - hiding content`);

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

      // Show unauthorized message
      const unauthorizedElement = createUnauthorizedElement();
      const documentBody = document.body;
      if (documentBody && unauthorizedElement) {
        documentBody.appendChild(unauthorizedElement);
      }
    } else {
      console.log(`Loan ${loanNumber} is authorized - showing content`);
    }

    // Hide loader
    hideLoader();
  } catch (error) {
    console.error("Error checking loan access:", error);
    hideLoader();
  }
}

/**
 * Check if current page contains the servicer loan element
 */
function hasServicerLoanElement() {
  return !!document.querySelector("#lblServicerLoanNumVal");
}

/**
 * Get current loan number from the page
 */
function getCurrentLoanNumber() {
  const element = document.querySelector("#lblServicerLoanNumVal");
  return element ? element.textContent.trim() : "";
}

/**
 * Global monitoring state
 */
let lastLoanNumber = "";
let currentURL = window.location.href;
let elementObserver = null;
let loanElementObserver = null;

/**
 * Simple URL change detection
 */
function monitorURLChanges() {
  // Override pushState and replaceState to detect programmatic navigation
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  history.pushState = function (...args) {
    originalPushState.apply(history, args);
    handleURLChange();
  };

  history.replaceState = function (...args) {
    originalReplaceState.apply(history, args);
    handleURLChange();
  };

  // Listen for popstate events
  window.addEventListener("popstate", handleURLChange);

  function handleURLChange() {
    const newURL = window.location.href;
    if (newURL !== currentURL) {
      console.log(
        "[servicer_loan_filter] URL changed, re-checking loan access..."
      );
      currentURL = newURL;
      lastLoanNumber = ""; // Reset to force re-check
      startElementMonitoring(); // Restart monitoring for new page
    }
  }
}

function startElementMonitoring() {
  // Disconnect existing observer if any
  if (elementObserver) {
    elementObserver.disconnect();
  }

  // Check if element already exists
  if (hasServicerLoanElement()) {
    console.log(
      "[servicer_loan_filter] ✅ Loan element already found, checking access..."
    );
    lastLoanNumber = getCurrentLoanNumber();
    checkServicerLoanAccess();
    startLoanElementMonitoring();
    return;
  }

  console.log(
    "[servicer_loan_filter] 🔍 Monitoring for loan element to appear..."
  );

  // Monitor entire document for the loan element to appear
  elementObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === "childList") {
        mutation.addedNodes.forEach((node) => {
          // Check if the added node is the loan element
          if (node.nodeType === 1 && node.id === "lblServicerLoanNumVal") {
            console.log(
              "[servicer_loan_filter] ✅ Loan element appeared, checking access..."
            );
            elementObserver.disconnect();
            lastLoanNumber = getCurrentLoanNumber();
            checkServicerLoanAccess();
            startLoanElementMonitoring();
            return;
          }

          // Check if the added node contains the loan element
          if (node.nodeType === 1 && node.querySelector) {
            const loanElement = node.querySelector("#lblServicerLoanNumVal");
            if (loanElement) {
              console.log(
                "[servicer_loan_filter] ✅ Loan element found in added content, checking access..."
              );
              elementObserver.disconnect();
              lastLoanNumber = getCurrentLoanNumber();
              checkServicerLoanAccess();
              startLoanElementMonitoring();
              return;
            }
          }
        });
      }
    });
  });

  // Monitor the entire document body
  elementObserver.observe(document.body || document.documentElement, {
    childList: true,
    subtree: true,
  });

  // Fallback timeout
  setTimeout(() => {
    if (hasServicerLoanElement()) {
      console.log(
        "[servicer_loan_filter] ✅ Loan element found in fallback check..."
      );
      if (elementObserver) {
        elementObserver.disconnect();
      }
      lastLoanNumber = getCurrentLoanNumber();
      checkServicerLoanAccess();
      startLoanElementMonitoring();
    }
  }, 10000); // 10 second fallback
}

/**
 * Monitor loan element content changes (after it appears)
 */
function startLoanElementMonitoring() {
  // Disconnect existing observer if any
  if (loanElementObserver) {
    loanElementObserver.disconnect();
  }

  const loanElement = document.querySelector("#lblServicerLoanNumVal");
  if (!loanElement) {
    console.log(
      "[servicer_loan_filter] ⚠️ Loan element not found for content monitoring"
    );
    return;
  }

  console.log(
    "[servicer_loan_filter] 🔍 Monitoring loan element content changes..."
  );

  loanElementObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      // Only check if the servicer loan element content changed
      if (
        mutation.type === "childList" ||
        (mutation.type === "characterData" &&
          mutation.target.parentElement?.id === "lblServicerLoanNumVal")
      ) {
        const newLoanNumber = getCurrentLoanNumber();
        if (newLoanNumber && newLoanNumber !== lastLoanNumber) {
          console.log(
            `[servicer_loan_filter] Loan number changed from "${lastLoanNumber}" to "${newLoanNumber}", re-checking access...`
          );
          lastLoanNumber = newLoanNumber;
          checkServicerLoanAccess();
        }
      }
    });
  });

  loanElementObserver.observe(loanElement, {
    childList: true,
    characterData: true,
    subtree: true,
  });
}

/**
 * Initialize the script and check loan access
 */
function initializeServicerLoanFilter() {
  console.log("[servicer_loan_filter] 🚀 Initializing servicer loan filter...");

  // Start monitoring for loan element to appear
  startElementMonitoring();

  // Start URL change monitoring
  monitorURLChanges();

  // Apply navigation link hiding and keep it resilient to dynamic changes
  hideNavigationLinks();
  window.addEventListener('DOMContentLoaded', hideNavigationLinks);
  window.addEventListener('load', hideNavigationLinks);
  try {
    const iframes = document.querySelectorAll('iframe');
    iframes.forEach(iframe => {
      try { iframe.addEventListener('load', hideNavigationLinks); } catch (_) {}
    });
  } catch (_) {}
  // Lightweight periodic re-apply as fallback
  if (!window.__servicerNavHideInterval) {
    window.__servicerNavHideInterval = setInterval(hideNavigationLinks, 3000);
  }
}

// Start the script when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeServicerLoanFilter);
} else {
  // DOM is already ready
  initializeServicerLoanFilter();
}
