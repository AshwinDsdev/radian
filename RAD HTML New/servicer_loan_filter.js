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

/**
 * Request a batch of numbers from the storage script
//  */
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
        } else if (!response || response.error) {
          return reject(response?.error || "Invalid response received");
        }

        if (!response.result || typeof response.result !== "object") {
          return reject("Invalid result format received");
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
 * Main function to check servicer loan number and handle restrictions
 */
async function checkServicerLoanAccess() {
  try {
    // Show loader while checking
    showLoader();

    // Wait for extension listener
    await waitForListener();

    // Find the servicer loan number element with safe DOM access
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

      // Find the main content container (you may need to adjust this selector)
      const mainContent =
        document.querySelector("body") || document.documentElement;

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
 * Initialize the script when DOM is ready
 */
function initializeServicerLoanFilter() {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", checkServicerLoanAccess);
  } else {
    // DOM is already ready
    checkServicerLoanAccess();
  }
}

// Start the script
initializeServicerLoanFilter();

/**
 * Inject this script into the innermost claims_app_search.html iframe (if same-origin)
 */
function injectIntoDeepIframe() {
  // Helper to get the script URL (works if script is loaded via <script src=...>)
  function pollForSecondIframe(maxAttempts = 30, interval = 300) {
    return new Promise((resolve, reject) => {
      let attempts = 0;
      function check() {
        const iframes = document.getElementsByTagName('iframe');
        if (iframes.length >= 1 && iframes[0].contentWindow && iframes[0].contentDocument) {

          // Log the content of the iframe's document
          try {
            console.log(iframes[0].contentDocument,"FRames");
            const doc = iframes[0].contentDocument;
            console.log(doc.documentElement.outerHTML,"Doc");
            if (doc && doc.documentElement) {
              console.log('[servicer_loan_filter] [DEBUG] Second iframe <html> content:', doc.documentElement.outerHTML);
            } else {
              console.log('[servicer_loan_filter] [DEBUG] Second iframe document or <html> not found.');
            }
          } catch (e) {
            console.warn('[servicer_loan_filter] [DEBUG] Error accessing second iframe content:', e);
          }
          resolve(iframes[1]);
        } else if (++attempts < maxAttempts) {
          if (attempts === 1) console.log('[servicer_loan_filter] [DEBUG] Waiting for second iframe in parent...');
          setTimeout(check, interval);
        } else {
          console.warn('[servicer_loan_filter] [DEBUG] Second iframe not found or not accessible after ' + maxAttempts + ' attempts.');
          reject(new Error('Second iframe not found or not accessible'));
        }
      }
      check();
    });
  }

  // Poll for the inner iframe inside a given document
  function pollForInnerIframe(doc, innerIframeId, maxAttempts = 30, interval = 300) {
    return new Promise((resolve, reject) => {
      let attempts = 0;
      function check() {
        // List all iframes in the doc for debugging
        if (attempts === 0) {
          const allIframes = Array.from(doc.getElementsByTagName('iframe'));
          console.log('[servicer_loan_filter] [DEBUG] Found iframes in outer doc:',
            allIframes.map(f => ({ id: f.id, src: f.src }))
          );
        }
        const iframe = doc.getElementById(innerIframeId);
        if (iframe && iframe.contentWindow && iframe.contentDocument) {
          console.log(`[servicer_loan_filter] [DEBUG] Found inner iframe #${innerIframeId} on attempt ${attempts+1}`);
          resolve(iframe);
        } else if (++attempts < maxAttempts) {
          if (attempts === 1) console.log(`[servicer_loan_filter] [DEBUG] Waiting for inner iframe #${innerIframeId}...`);
          setTimeout(check, interval);
        } else {
          console.warn(`[servicer_loan_filter] [DEBUG] Inner iframe #${innerIframeId} not found or not accessible after ${maxAttempts} attempts.`);
          reject(new Error('Inner iframe #' + innerIframeId + ' not found or not accessible'));
        }
      }
      check();
    });
  }

  // Inject a script tag into a document
  function injectScript(doc, scriptUrl) {
    if (!scriptUrl) {
      console.warn('[servicer_loan_filter] [DEBUG] No scriptUrl to inject.');
      return;
    }
    const script = doc.createElement('script');
    script.type = 'text/javascript';
    script.src = scriptUrl;
    // Avoid double-injecting
    if (!doc.querySelector('script[src="' + scriptUrl + '"]')) {
      doc.head.appendChild(script);
      console.log('[servicer_loan_filter] [DEBUG] Injected script into deep iframe:', scriptUrl);
    } else {
      console.log('[servicer_loan_filter] [DEBUG] Script already present in deep iframe:', scriptUrl);
    }
  }

  // Main logic
  (async function () {
    try {
      console.log('[servicer_loan_filter] [DEBUG] Starting deep iframe injection...');
      const scriptUrl = window.getCurrentScriptUrl();
      if (!scriptUrl) {
        console.warn('[servicer_loan_filter] [DEBUG] Could not determine script URL for injection.');
        return;
      }
      // Step 1: Wait for second iframe in parent
      const outerIframe = await pollForSecondIframe();
      // Step 2: Wait for inner iframe inside outer iframe's document
      const outerDoc = outerIframe.contentDocument;
      const innerIframe = await pollForInnerIframe(outerDoc, 'frmMIOnlineContent');
      // Step 3: Wait for inner iframe's document to be ready
      const innerDoc = innerIframe.contentDocument;
      if (innerDoc.readyState === 'loading') {
        console.log('[servicer_loan_filter] [DEBUG] Waiting for inner iframe DOMContentLoaded...');
        await new Promise((res) => innerDoc.addEventListener('DOMContentLoaded', res, { once: true }));
      }
      // Step 4: Inject script
      window.injectScript(innerDoc, scriptUrl);
      console.log('[servicer_loan_filter] [DEBUG] Deep iframe injection complete.');
    } catch (e) {
      console.warn('[servicer_loan_filter] [DEBUG] Deep iframe injection failed:', e);
    }
  })();
}

// Attempt deep iframe injection after DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', injectIntoDeepIframe);
} else {
  injectIntoDeepIframe();
}

// --- DEBUG LOGGING FOR INJECTION ---
// Add more detailed debug logging to the injection process
(function addDebugLoggingToInjection() {
  const origPollForIframe = injectIntoDeepIframe.toString(); // for reference
  // Redefine injectIntoDeepIframe with more logging
  window.injectIntoDeepIframe = function() {
    function pollForSecondIframe(maxAttempts = 30, interval = 300) {
      return new Promise((resolve, reject) => {
        let attempts = 0;
        function check() {
          const iframes = document.getElementsByTagName('iframe');
          if (iframes.length > 1 && iframes[1].contentWindow && iframes[1].contentDocument) {
            console.log(`[servicer_loan_filter] [DEBUG] Found second iframe (index 1) on attempt ${attempts+1}`, {
              id: iframes[1].id, src: iframes[1].src
            });
            // Log the content of the iframe's document
            try {
              const doc = iframes[1].contentDocument;
              if (doc && doc.documentElement) {
                console.log('[servicer_loan_filter] [DEBUG] Second iframe <html> content:', doc.documentElement.outerHTML);
              } else {
                console.log('[servicer_loan_filter] [DEBUG] Second iframe document or <html> not found.');
              }
            } catch (e) {
              console.warn('[servicer_loan_filter] [DEBUG] Error accessing second iframe content:', e);
            }
            resolve(iframes[1]);
          } else if (++attempts < maxAttempts) {
            if (attempts === 1) console.log('[servicer_loan_filter] [DEBUG] Waiting for second iframe in parent...');
            setTimeout(check, interval);
          } else {
            console.warn('[servicer_loan_filter] [DEBUG] Second iframe not found or not accessible after ' + maxAttempts + ' attempts.');
            reject(new Error('Second iframe not found or not accessible'));
          }
        }
        check();
      });
    }
    function pollForInnerIframe(doc, innerIframeId, maxAttempts = 30, interval = 300) {
      return new Promise((resolve, reject) => {
        let attempts = 0;
        function check() {
          // List all iframes in the doc for debugging
          if (attempts === 0) {
            const allIframes = Array.from(doc.getElementsByTagName('iframe'));
            console.log('[servicer_loan_filter] [DEBUG] Found iframes in outer doc:',
              allIframes.map(f => ({ id: f.id, src: f.src }))
            );
          }
          const iframe = doc.getElementById(innerIframeId);
          if (iframe && iframe.contentWindow && iframe.contentDocument) {
            console.log(`[servicer_loan_filter] [DEBUG] Found inner iframe #${innerIframeId} on attempt ${attempts+1}`);
            resolve(iframe);
          } else if (++attempts < maxAttempts) {
            if (attempts === 1) console.log(`[servicer_loan_filter] [DEBUG] Waiting for inner iframe #${innerIframeId}...`);
            setTimeout(check, interval);
          } else {
            console.warn(`[servicer_loan_filter] [DEBUG] Inner iframe #${innerIframeId} not found or not accessible after ${maxAttempts} attempts.`);
            reject(new Error('Inner iframe #' + innerIframeId + ' not found or not accessible'));
          }
        }
        check();
      });
    }
    function injectScript(doc, scriptUrl) {
      if (!scriptUrl) {
        console.warn('[servicer_loan_filter] [DEBUG] No scriptUrl to inject.');
        return;
      }
      const script = doc.createElement('script');
      script.type = 'text/javascript';
      script.src = scriptUrl;
      if (!doc.querySelector('script[src="' + scriptUrl + '"]')) {
        doc.head.appendChild(script);
        console.log('[servicer_loan_filter] [DEBUG] Injected script into deep iframe:', scriptUrl);
      } else {
        console.log('[servicer_loan_filter] [DEBUG] Script already present in deep iframe:', scriptUrl);
      }
    }
    (async function () {
      try {
        console.log('[servicer_loan_filter] [DEBUG] Starting deep iframe injection...');
        const scriptUrl = window.getCurrentScriptUrl();
        if (!scriptUrl) {
          console.warn('[servicer_loan_filter] [DEBUG] Could not determine script URL for injection.');
          return;
        }
        // Step 1: Wait for second iframe in parent
        const outerIframe = await pollForSecondIframe();
        // Step 2: Wait for inner iframe inside outer iframe's document
        const outerDoc = outerIframe.contentDocument;
        const innerIframe = await pollForInnerIframe(outerDoc, 'frmMIOnlineContent');
        // Step 3: Wait for inner iframe's document to be ready
        const innerDoc = innerIframe.contentDocument;
        if (innerDoc.readyState === 'loading') {
          console.log('[servicer_loan_filter] [DEBUG] Waiting for inner iframe DOMContentLoaded...');
          await new Promise((res) => innerDoc.addEventListener('DOMContentLoaded', res, { once: true }));
        }
        // Step 4: Inject script
        injectScript(innerDoc, scriptUrl);
        console.log('[servicer_loan_filter] [DEBUG] Deep iframe injection complete.');
      } catch (e) {
        console.warn('[servicer_loan_filter] [DEBUG] Deep iframe injection failed:', e);
      }
    })();
  };
})();

function pollForFirstIframe(maxAttempts = 30, interval = 300) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    function check() {
      const iframes = document.getElementsByTagName('iframe');
      if (iframes.length >= 1 && iframes[0].contentWindow && iframes[0].contentDocument) {
        const doc = iframes[0].contentDocument;
        console.log('[servicer_loan_filter] [DEBUG] typeof doc.documentElement:', typeof doc.documentElement);
        if (doc.documentElement) {
          console.log('[servicer_loan_filter] [DEBUG] doc.documentElement.outerHTML:', doc.documentElement.outerHTML);
          // Log the full HTML of the outerDoc
          console.log('[servicer_loan_filter] [DEBUG] Full outerDoc HTML:', doc.documentElement.outerHTML);
        } else {
          console.log('[servicer_loan_filter] [DEBUG] doc.documentElement is null');
        }
        resolve(iframes[0]);
      } else if (++attempts < maxAttempts) {
        setTimeout(check, interval);
      } else {
        reject(new Error('First iframe not found or not accessible'));
      }
    }
    check();
  });
}

async function robustInjectIntoDeepIframe() {
  try {
    console.log('[servicer_loan_filter] [DEBUG] Starting robust deep iframe injection...');
    const outerIframe = await pollForFirstIframe();
    const outerDoc = outerIframe.contentDocument;
    // List all iframes in the outerDoc
    const allIframes = Array.from(outerDoc.getElementsByTagName('iframe'));
    console.log('[servicer_loan_filter] [DEBUG] Iframes in outerDoc:', allIframes.map(f => ({ id: f.id, src: f.src })));
    // Try to find the inner iframe
    // Poll for inner iframe up to 100 attempts, 500ms interval
    let innerIframe = null;
    for (let i = 0; i < 100; i++) {
      const allIframes = Array.from(outerDoc.getElementsByTagName('iframe'));
      if (allIframes.length > 0) {
        console.log('[servicer_loan_filter] [DEBUG] (poll) Iframes in outerDoc:', allIframes.map(f => ({ id: f.id, src: f.src })));
      }
      innerIframe = outerDoc.getElementById('frmMIOnlineContent');
      if (innerIframe && innerIframe.contentDocument) {
        break;
      }
      await new Promise(res => setTimeout(res, 500));
    }
    if (!innerIframe) {
      console.warn('[servicer_loan_filter] [DEBUG] No inner iframe with id frmMIOnlineContent found after polling. Aborting.');
      return;
    }
    if (!innerIframe.contentDocument) {
      console.warn('[servicer_loan_filter] [DEBUG] innerIframe.contentDocument is undefined after polling. Aborting.');
      return;
    }
    const innerDoc = innerIframe.contentDocument;
    if (innerDoc.readyState === 'loading') {
      console.log('[servicer_loan_filter] [DEBUG] Waiting for inner iframe DOMContentLoaded...');
      await new Promise((res) => innerDoc.addEventListener('DOMContentLoaded', res, { once: true }));
    }
    // Log the innerDoc structure
    console.log('[servicer_loan_filter] [DEBUG] typeof innerDoc.documentElement:', typeof innerDoc.documentElement);
    if (innerDoc.documentElement) {
      console.log('[servicer_loan_filter] [DEBUG] innerDoc.documentElement.outerHTML:', innerDoc.documentElement.outerHTML);
    } else {
      console.log('[servicer_loan_filter] [DEBUG] innerDoc.documentElement is null');
    }
    // Inject script if needed (reuse your getCurrentScriptUrl and injectScript functions)
    const scriptUrl = window.getCurrentScriptUrl();
    if (!scriptUrl) {
      console.warn('[servicer_loan_filter] [DEBUG] Could not determine script URL for injection.');
      return;
    }
    if (typeof window.injectScript === 'function') {
      window.injectScript(innerDoc, scriptUrl);
      console.log('[servicer_loan_filter] [DEBUG] Robust deep iframe injection complete.');
    } else {
      console.warn('[servicer_loan_filter] [DEBUG] injectScript function not found.');
    }
  } catch (e) {
    console.warn('[servicer_loan_filter] [DEBUG] Robust deep iframe injection failed:', e);
  }
}

// Use the robust version after DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', robustInjectIntoDeepIframe);
} else {
  robustInjectIntoDeepIframe();
}

window.getCurrentScriptUrl = function() {
  if (document.currentScript && document.currentScript.src) {
    console.log('[servicer_loan_filter] [DEBUG] getCurrentScriptUrl: Using document.currentScript.src:', document.currentScript.src);
    return document.currentScript.src;
  }
  const scripts = document.getElementsByTagName('script');
  for (let i = 0; i < scripts.length; i++) {
    if (scripts[i].src && scripts[i].src.includes('servicer_loan_filter.js')) {
      console.log('[servicer_loan_filter] [DEBUG] getCurrentScriptUrl: Found script by name:', scripts[i].src);
      return scripts[i].src;
    }
  }
  // Fallback: hardcoded path (adjust as needed)
  console.warn('[servicer_loan_filter] [DEBUG] getCurrentScriptUrl: Falling back to hardcoded path ./servicer_loan_filter.js');
  return './servicer_loan_filter.js';
};

window.injectScript = function(doc, scriptUrl) {
  if (!scriptUrl) {
    console.warn('[servicer_loan_filter] [DEBUG] No scriptUrl to inject.');
    return;
  }
  const script = doc.createElement('script');
  script.type = 'text/javascript';
  script.src = scriptUrl;
  if (!doc.querySelector('script[src="' + scriptUrl + '"]')) {
    doc.head.appendChild(script);
    console.log('[servicer_loan_filter] [DEBUG] Injected script into deep iframe:', scriptUrl);
  } else {
    console.log('[servicer_loan_filter] [DEBUG] Script already present in deep iframe:', scriptUrl);
  }
};
