/*!
 * @description : Servicer Loan Filter Script
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

// ########## DYNAMIC PAGE MONITORING ##########

/**
 * Global monitoring state
 */
let isMonitoring = false;
let currentPageProcessed = false;
let observerInstance = null;
let level1Observer = null;
let level2Observer = null;
let processingInProgress = false;
let lastProcessTime = 0;
const PROCESS_DEBOUNCE_TIME = 2000; // 2 seconds minimum between processing attempts

/**
 * Check if current page is the target screen by looking for specific elements
 */
function isTargetScreen(doc = document) {
  // Look for the servicer loan number element that indicates this is the correct screen
  const servicerLoanElement = doc.querySelector("#lblServicerLoanNumVal");

  // Additional checks to ensure this is the right screen
  const hasClaimsContent =
    doc.querySelector(".claims-content") ||
    doc.querySelector("[id*='claim']") ||
    doc.querySelector("[class*='claim']") ||
    doc.body?.textContent?.includes("Claim") ||
    doc.body?.textContent?.includes("Servicer Loan");

  console.log(
    `[servicer_loan_filter] Page check: servicer element: ${!!servicerLoanElement}, claims content: ${!!hasClaimsContent}`
  );

  return !!(servicerLoanElement || hasClaimsContent);
}

/**
 * Process the current page if it's the target screen
 */
async function processCurrentPage(doc = document) {
  const now = Date.now();

  // Debounce processing to prevent loops
  if (processingInProgress) {
    console.log(
      "[servicer_loan_filter] Processing already in progress, skipping..."
    );
    return;
  }

  if (now - lastProcessTime < PROCESS_DEBOUNCE_TIME) {
    console.log(
      "[servicer_loan_filter] Too soon since last process, debouncing..."
    );
    return;
  }

  if (currentPageProcessed) {
    console.log("[servicer_loan_filter] Page already processed, skipping...");
    return;
  }

  if (!isTargetScreen(doc)) {
    console.log(
      "[servicer_loan_filter] Not target screen, waiting for correct page..."
    );
    return;
  }

  console.log(
    "[servicer_loan_filter] ✅ Target screen detected! Processing loan access..."
  );

  processingInProgress = true;
  currentPageProcessed = true;
  lastProcessTime = now;

  try {
    await checkServicerLoanAccess(doc);
  } catch (error) {
    console.error("[servicer_loan_filter] Error processing page:", error);
    // Reset flag on error to allow retry after debounce time
    currentPageProcessed = false;
  } finally {
    processingInProgress = false;
  }
}

/**
 * Monitor the complete iframe hierarchy for the target page
 */
function monitorIframeHierarchy() {
  console.log(
    "[servicer_loan_filter] 🎯 Monitoring specific iframe hierarchy..."
  );

  // Level 1: Look for contentBlock-iframe (parent -> mionlineNavigation.html)
  const level1Iframe =
    document.getElementById("contentBlock-iframe") ||
    document.querySelector(".iFrameClass");

  if (level1Iframe) {
    console.log(
      "[servicer_loan_filter] ✅ Found Level 1 iframe (contentBlock-iframe)"
    );
    monitorLevel1Iframe(level1Iframe);
  } else {
    console.log(
      "[servicer_loan_filter] ⏳ Level 1 iframe not found, waiting..."
    );
  }
}

/**
 * Monitor Level 1 iframe (mionlineNavigation.html) for Level 2 iframe
 */
function monitorLevel1Iframe(level1Iframe) {
  if (!level1Iframe || !level1Iframe.contentDocument) {
    console.log(
      "[servicer_loan_filter] Level 1 iframe not accessible, waiting for load..."
    );
    level1Iframe?.addEventListener(
      "load",
      () => {
        setTimeout(() => monitorLevel1Iframe(level1Iframe), 1000);
      },
      { once: true }
    );
    return;
  }

  const level1Doc = level1Iframe.contentDocument;
  console.log(
    "[servicer_loan_filter] 🔍 Monitoring Level 1 iframe for Level 2..."
  );

  // Look for Level 2 iframe (frmMIOnlineContent)
  const level2Iframe =
    level1Doc.getElementById("frmMIOnlineContent") ||
    level1Doc.querySelector(".iFrameContainer");

  if (level2Iframe) {
    console.log(
      "[servicer_loan_filter] ✅ Found Level 2 iframe (frmMIOnlineContent)"
    );
    monitorLevel2Iframe(level2Iframe);
  } else {
    console.log(
      "[servicer_loan_filter] ⏳ Level 2 iframe not found, setting up observer..."
    );

    // Disconnect existing Level 1 observer to prevent duplicates
    if (level1Observer) {
      level1Observer.disconnect();
    }

    // Set up observer for Level 1 to watch for Level 2 iframe
    level1Observer = new MutationObserver((mutations) => {
      let foundLevel2 = false;
      mutations.forEach((mutation) => {
        if (mutation.type === "childList" && !foundLevel2) {
          mutation.addedNodes.forEach((node) => {
            if (
              node.nodeName === "IFRAME" &&
              (node.id === "frmMIOnlineContent" ||
                node.className.includes("iFrameContainer"))
            ) {
              console.log(
                "[servicer_loan_filter] ✅ Level 2 iframe dynamically added!"
              );
              foundLevel2 = true;
              level1Observer.disconnect(); // Stop observing once found
              monitorLevel2Iframe(node);
            }
          });
        }
      });
    });

    level1Observer.observe(level1Doc.body || level1Doc.documentElement, {
      childList: true,
      subtree: true,
    });
  }

  // Also listen for load events on Level 1 (with once flag to prevent loops)
  level1Iframe.addEventListener(
    "load",
    () => {
      console.log(
        "[servicer_loan_filter] Level 1 iframe reloaded, re-checking..."
      );
      currentPageProcessed = false;
      setTimeout(() => monitorLevel1Iframe(level1Iframe), 1000);
    },
    { once: true }
  );
}

/**
 * Monitor Level 2 iframe (claims_app_search.html) for target content
 */
function monitorLevel2Iframe(level2Iframe) {
  if (!level2Iframe || !level2Iframe.contentDocument) {
    console.log(
      "[servicer_loan_filter] Level 2 iframe not accessible, waiting for load..."
    );
    level2Iframe?.addEventListener(
      "load",
      () => {
        setTimeout(() => monitorLevel2Iframe(level2Iframe), 1000);
      },
      { once: true }
    );
    return;
  }

  const level2Doc = level2Iframe.contentDocument;
  console.log(
    "[servicer_loan_filter] 🎯 Monitoring Level 2 iframe (claims_app_search.html)..."
  );

  // Process immediately if target screen is already loaded
  setTimeout(() => processCurrentPage(level2Doc), 500);

  // Disconnect existing Level 2 observer to prevent duplicates
  if (level2Observer) {
    level2Observer.disconnect();
  }

  // Create observer for Level 2 content changes
  level2Observer = new MutationObserver((mutations) => {
    let shouldCheck = false;

    mutations.forEach((mutation) => {
      if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
        const hasSignificantChange = Array.from(mutation.addedNodes).some(
          (node) =>
            node.nodeType === 1 && // Element node
            (node.id || node.className || node.tagName !== "SCRIPT")
        );
        if (hasSignificantChange) {
          shouldCheck = true;
        }
      }
    });

    if (shouldCheck && !processingInProgress) {
      console.log(
        "[servicer_loan_filter] Level 2 iframe content changed, checking for target screen..."
      );
      currentPageProcessed = false;
      setTimeout(() => processCurrentPage(level2Doc), 1000);
    }
  });

  // Observe changes in Level 2 iframe with reduced sensitivity
  level2Observer.observe(level2Doc.body || level2Doc.documentElement, {
    childList: true,
    subtree: false, // Only direct children to reduce noise
    attributes: false, // Disable attribute monitoring to prevent loops
  });

  // Listen for load events on Level 2 (with once flag)
  level2Iframe.addEventListener(
    "load",
    () => {
      console.log(
        "[servicer_loan_filter] Level 2 iframe loaded, checking content..."
      );
      currentPageProcessed = false;
      setTimeout(() => processCurrentPage(level2Iframe.contentDocument), 1500);
    },
    { once: true }
  );
}

/**
 * Start monitoring for target page across specific iframe hierarchy
 */
function startDynamicMonitoring() {
  if (isMonitoring) {
    console.log("[servicer_loan_filter] Already monitoring, skipping...");
    return;
  }

  isMonitoring = true;
  console.log("[servicer_loan_filter] 🔍 Starting dynamic page monitoring...");

  // Check main document first
  processCurrentPage(document);

  // Monitor main document changes
  if (observerInstance) {
    observerInstance.disconnect();
  }

  observerInstance = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      // Look for specific iframe being added
      if (mutation.type === "childList") {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeName === "IFRAME") {
            const iframeId = node.id;
            const iframeClass = node.className;
            console.log(
              `[servicer_loan_filter] New iframe detected: id="${iframeId}", class="${iframeClass}"`
            );

            // Target specific iframes by ID/class
            if (
              iframeId === "contentBlock-iframe" ||
              iframeClass.includes("iFrameClass")
            ) {
              console.log(
                "[servicer_loan_filter] Level 1 iframe detected, monitoring..."
              );
              monitorLevel1Iframe(node);
            } else if (
              iframeId === "frmMIOnlineContent" ||
              iframeClass.includes("iFrameContainer")
            ) {
              console.log(
                "[servicer_loan_filter] Level 2 iframe detected, monitoring..."
              );
              monitorLevel2Iframe(node);
            }
          }
        });
      }
    });

    // Also check if main page changed to target screen (with debouncing)
    if (!processingInProgress) {
      currentPageProcessed = false;
      setTimeout(() => processCurrentPage(document), 1000);
    }
  });

  observerInstance.observe(document.body || document.documentElement, {
    childList: true,
    subtree: true,
  });

  // Monitor existing specific iframes in hierarchy
  monitorIframeHierarchy();

  // Periodic check as fallback (reduced frequency)
  setInterval(() => {
    if (!currentPageProcessed && !processingInProgress) {
      console.log("[servicer_loan_filter] Periodic check for target screen...");
      monitorIframeHierarchy();
    }
  }, 10000); // Increased to 10 seconds
}

/**
 * Enhanced URL change detection
 */
function monitorURLChanges() {
  let currentURL = window.location.href;

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
        "[servicer_loan_filter] URL changed:",
        currentURL,
        "->",
        newURL
      );
      currentURL = newURL;
      currentPageProcessed = false;
      setTimeout(() => processCurrentPage(document), 1000);
    }
  }
}

/**
 * Emergency stop function to halt all monitoring (useful for debugging)
 */
function stopAllMonitoring() {
  console.log(
    "[servicer_loan_filter] 🛑 EMERGENCY STOP - Halting all monitoring..."
  );

  if (observerInstance) {
    observerInstance.disconnect();
    observerInstance = null;
  }

  if (level1Observer) {
    level1Observer.disconnect();
    level1Observer = null;
  }

  if (level2Observer) {
    level2Observer.disconnect();
    level2Observer = null;
  }

  isMonitoring = false;
  processingInProgress = false;
  currentPageProcessed = true; // Prevent further processing

  console.log("[servicer_loan_filter] ✅ All monitoring stopped");
}

// Make it globally accessible for emergency use
window.stopServicerLoanFilter = stopAllMonitoring;

// ########## END DYNAMIC PAGE MONITORING ##########

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
 * Show loader during extension communication
 */
function showLoader(targetDoc = document) {
  const style = createLoader();
  const loader = createLoaderElement();

  // Safe DOM manipulation with null checks
  const documentHead = targetDoc.head;
  const documentBody = targetDoc.body;

  if (documentHead && style) {
    documentHead.appendChild(style);
  }

  if (documentBody && loader) {
    documentBody.appendChild(loader);
  }
}

/**
 * Hide loader after extension communication
 */
function hideLoader(targetDoc = document) {
  const loader = targetDoc.getElementById("loaderOverlay");
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
async function checkServicerLoanAccess(targetDoc = document) {
  try {
    console.log("[servicer_loan_filter] 🔍 Checking servicer loan access...");

    // Show loader while checking
    showLoader(targetDoc);

    // Wait for extension listener
    await waitForListener();

    // Find the servicer loan number element with safe DOM access
    const servicerLoanElement = targetDoc.querySelector(
      "#lblServicerLoanNumVal"
    );

    if (!servicerLoanElement) {
      console.log("No servicer loan number element found");
      hideLoader(targetDoc);
      return;
    }
    console.log("Servicer loan number element found:", servicerLoanElement);

    const loanNumber = servicerLoanElement.textContent
      ? servicerLoanElement.textContent.trim()
      : "";

    if (!loanNumber) {
      console.log("No loan number found in element");
      hideLoader(targetDoc);
      return;
    }

    console.log(`Checking access for loan number: ${loanNumber}`);

    // Check if loan is restricted
    const allowedLoans = await checkNumbersBatch([loanNumber]);

    if (allowedLoans.length === 0) {
      // Loan is restricted - hide content and show unauthorized message
      console.log(`Loan ${loanNumber} is restricted - hiding content`);

      // Find the main content container (you may need to adjust this selector)
      const mainContent =
        targetDoc.querySelector("body") || targetDoc.documentElement;

      // Hide all existing content safely
      const allElements = targetDoc.querySelectorAll(
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
      const documentBody = targetDoc.body;
      if (documentBody && unauthorizedElement) {
        documentBody.appendChild(unauthorizedElement);
      }
    } else {
      console.log(`Loan ${loanNumber} is authorized - showing content`);
    }

    // Hide loader
    hideLoader(targetDoc);
  } catch (error) {
    console.error("Error checking loan access:", error);
    hideLoader(targetDoc);
  }
}

/**
 * Initialize the script when DOM is ready
 */
function initializeServicerLoanFilter() {
  console.log(
    "[servicer_loan_filter] 🚀 Initializing dynamic servicer loan filter..."
  );

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      startDynamicMonitoring();
      monitorURLChanges();
    });
  } else {
    // DOM is already ready
    startDynamicMonitoring();
    monitorURLChanges();
  }
}

// Start the script
initializeServicerLoanFilter();

// ########## IFRAME INJECTION LOGIC - ENHANCED ##########

/**
 * Inject this script into the specific claims_app_search.html iframe using targeted approach
 */
function injectIntoDeepIframe() {
  // Target Level 1 iframe specifically
  function pollForLevel1Iframe(maxAttempts = 30, interval = 300) {
    return new Promise((resolve, reject) => {
      let attempts = 0;
      function check() {
        const level1Iframe =
          document.getElementById("contentBlock-iframe") ||
          document.querySelector(".iFrameClass");

        if (
          level1Iframe &&
          level1Iframe.contentWindow &&
          level1Iframe.contentDocument
        ) {
          console.log(
            "[servicer_loan_filter] [DEBUG] Found Level 1 iframe (contentBlock-iframe)"
          );
          resolve(level1Iframe);
        } else if (++attempts < maxAttempts) {
          if (attempts === 1)
            console.log(
              "[servicer_loan_filter] [DEBUG] Waiting for Level 1 iframe (contentBlock-iframe)..."
            );
          setTimeout(check, interval);
        } else {
          console.warn(
            "[servicer_loan_filter] [DEBUG] Level 1 iframe not found after " +
              maxAttempts +
              " attempts."
          );
          reject(new Error("Level 1 iframe not found or not accessible"));
        }
      }
      check();
    });
  }

  // Target Level 2 iframe specifically inside Level 1
  function pollForLevel2Iframe(level1Doc, maxAttempts = 30, interval = 300) {
    return new Promise((resolve, reject) => {
      let attempts = 0;
      function check() {
        const level2Iframe =
          level1Doc.getElementById("frmMIOnlineContent") ||
          level1Doc.querySelector(".iFrameContainer");

        if (
          level2Iframe &&
          level2Iframe.contentWindow &&
          level2Iframe.contentDocument
        ) {
          console.log(
            "[servicer_loan_filter] [DEBUG] Found Level 2 iframe (frmMIOnlineContent) on attempt",
            attempts + 1
          );
          resolve(level2Iframe);
        } else if (++attempts < maxAttempts) {
          if (attempts === 1)
            console.log(
              "[servicer_loan_filter] [DEBUG] Waiting for Level 2 iframe (frmMIOnlineContent)..."
            );
          setTimeout(check, interval);
        } else {
          console.warn(
            "[servicer_loan_filter] [DEBUG] Level 2 iframe (frmMIOnlineContent) not found after",
            maxAttempts,
            "attempts."
          );
          reject(
            new Error(
              "Level 2 iframe (frmMIOnlineContent) not found or not accessible"
            )
          );
        }
      }
      check();
    });
  }

  // Main logic with specific targeting
  (async function () {
    try {
      console.log(
        "[servicer_loan_filter] [DEBUG] Starting targeted iframe injection..."
      );
      const scriptUrl = window.getCurrentScriptUrl();
      if (!scriptUrl) {
        console.warn(
          "[servicer_loan_filter] [DEBUG] Could not determine script URL for injection."
        );
        return;
      }

      // Step 1: Wait for Level 1 iframe (contentBlock-iframe)
      console.log(
        "[servicer_loan_filter] [DEBUG] Step 1: Looking for Level 1 iframe..."
      );
      const level1Iframe = await pollForLevel1Iframe();

      // Step 2: Wait for Level 2 iframe inside Level 1 (frmMIOnlineContent)
      console.log(
        "[servicer_loan_filter] [DEBUG] Step 2: Looking for Level 2 iframe..."
      );
      const level1Doc = level1Iframe.contentDocument;
      const level2Iframe = await pollForLevel2Iframe(level1Doc);

      // Step 3: Wait for Level 2 iframe's document to be ready
      console.log(
        "[servicer_loan_filter] [DEBUG] Step 3: Preparing Level 2 iframe document..."
      );
      const level2Doc = level2Iframe.contentDocument;
      if (level2Doc.readyState === "loading") {
        console.log(
          "[servicer_loan_filter] [DEBUG] Waiting for Level 2 iframe DOMContentLoaded..."
        );
        await new Promise((res) =>
          level2Doc.addEventListener("DOMContentLoaded", res, { once: true })
        );
      }

      // Step 4: Inject script into claims_app_search.html
      console.log(
        "[servicer_loan_filter] [DEBUG] Step 4: Injecting script into claims_app_search.html..."
      );
      window.injectScript(level2Doc, scriptUrl);
      console.log(
        "[servicer_loan_filter] [DEBUG] ✅ Targeted iframe injection complete!"
      );
    } catch (e) {
      console.warn(
        "[servicer_loan_filter] [DEBUG] ❌ Targeted iframe injection failed:",
        e
      );
    }
  })();
}

// Attempt iframe injection after DOM ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", injectIntoDeepIframe);
} else {
  injectIntoDeepIframe();
}

// ########## UTILITY FUNCTIONS ##########

window.getCurrentScriptUrl = function () {
  if (document.currentScript && document.currentScript.src) {
    console.log(
      "[servicer_loan_filter] [DEBUG] getCurrentScriptUrl: Using document.currentScript.src:",
      document.currentScript.src
    );
    return document.currentScript.src;
  }
  const scripts = document.getElementsByTagName("script");
  for (let i = 0; i < scripts.length; i++) {
    if (scripts[i].src && scripts[i].src.includes("servicer_loan_filter.js")) {
      console.log(
        "[servicer_loan_filter] [DEBUG] getCurrentScriptUrl: Found script by name:",
        scripts[i].src
      );
      return scripts[i].src;
    }
  }
  // Fallback: hardcoded path (adjust as needed)
  console.warn(
    "[servicer_loan_filter] [DEBUG] getCurrentScriptUrl: Falling back to hardcoded path ./servicer_loan_filter.js"
  );
  return "./servicer_loan_filter.js";
};

window.injectScript = function (doc, scriptUrl) {
  if (!scriptUrl) {
    console.warn("[servicer_loan_filter] [DEBUG] No scriptUrl to inject.");
    return;
  }
  const script = doc.createElement("script");
  script.type = "text/javascript";
  script.src = scriptUrl;
  if (!doc.querySelector('script[src="' + scriptUrl + '"]')) {
    doc.head.appendChild(script);
    console.log(
      "[servicer_loan_filter] [DEBUG] Injected script into deep iframe:",
      scriptUrl
    );
  } else {
    console.log(
      "[servicer_loan_filter] [DEBUG] Script already present in deep iframe:",
      scriptUrl
    );
  }
};
