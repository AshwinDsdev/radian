
/*!
 * @description : Unified Radian Filter Script
 * @portal : All Radian CLAIMS Online Portals
 * @business area: CLAIMS
 * @author : Rohith Kandikattu
 * @group : Accelirate
 * @owner : Cenlar
 * @lastModified : October 10th 2025
 * @version : 1.0.7
 */

// ########## EXTENSION CONFIGURATION ##########
const EXTENSION_ID = "hellpeipojbghaaopdnddjakinlmocjl";

// ########## COMMON UTILITIES ##########
const Logger = {
    prefix: '[Radian Unified Filter]',
    log: (message, data = null) => {
        const timestamp = new Date().toISOString();
        console.log(`${Logger.prefix} [${timestamp}] ${message}`, data || '');
    },
    info: (message, data = null) => {
        const timestamp = new Date().toISOString();
        console.info(`${Logger.prefix} [${timestamp}] ℹ️ ${message}`, data || '');
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
    },
    debug: (message, data = null) => {
        const timestamp = new Date().toISOString();
        console.log(`${Logger.prefix} [${timestamp}] debug ${message}`, data || '');
    }
};

// ########## GLOBAL NAVIGATION CONFIGURATION ##########
const GLOBAL_HIDDEN_ACTION_ELEMENTS = [
    'Send Decision Doc',
    'Quick Actions',
    'Rate Finder',
    'Order MI',
    'Servicing',
    'Advanced Search'
];

const GLOBAL_PRESERVED_ACTION_ELEMENTS = [
    'Notes',
    'Print'
];

/**
 * validation the Restricted Page & disabling it
 */
function checkRestrictedUrl() {
  const windowURL = window.location.href;
  console.log(windowURL,"windowURL");
  const restrictedPath = [
    "/Rate-Quote",
    "/Order-Services/New-Application",
    "/Order-Services/Resubmit-Application",
    "/Loan-Servicing/Activate-Deferred",
    "/Loan-Servicing/Servicing-Transfer",
    "/Loan-Servicing/Cancel-Refund",
    "/Loan-Servicing/Loan-Number-Change"
     ];

  const foundURL = restrictedPath.find((path) => windowURL.includes(path));
  if (foundURL) {
    const overlay = document.createElement("div");
    overlay.id = "custom-wait-overlay";
    overlay.innerText = "You are not provisioned to view this page";
    // Style it
    Object.assign(overlay.style, {
      position: "fixed",
      top: "0",
      left: "0",
      width: "100vw",
      height: "100vh",
      backgroundColor: "white", // or use 'black' with white text
      color: "black",
      fontSize: "2rem",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: "999999",
      fontFamily: "sans-serif",
    });
    // Append loader element in to body.
    document.body.appendChild(overlay);

    return foundURL;
  }
}


/**
 * Global Navigation Links Hiding Function
 * Hides specific action elements except Notes and Print
 * This function is designed to be called repeatedly to handle dynamic content
 */
function hideNavigationLinks() {
    Logger.log("🔒 Hiding specific action elements except Notes and Print");

    try {
        // Find all links and buttons
        const allElements = document.querySelectorAll('a,button, .menu-item, [role="menuitem"], [role="button"], .nav-link, .navigation-item');
        let hiddenCount = 0;
        let preservedCount = 0;

        Logger.log(`🔍 Checking ${allElements.length} potential navigation elements...`);

        allElements.forEach((element) => {
            const text = element.textContent?.replace(/\s+/g, ' ').trim() || '';

            // Skip empty elements
            if (!text) return;

            // Check if this element should be hidden
            const shouldHide = GLOBAL_HIDDEN_ACTION_ELEMENTS.some(hiddenText =>
                text.toLowerCase().includes(hiddenText.toLowerCase())
            );

            // Check if this element should be preserved
            const shouldPreserve = GLOBAL_PRESERVED_ACTION_ELEMENTS.some(preservedText =>
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

        // Specifically hide "Advanced Search" span and its next sibling span
        const advancedSearchSpans = document.querySelectorAll('span');
        advancedSearchSpans.forEach(span => {
            const text = span.textContent?.replace(/\s+/g, ' ').trim() || '';
            if (text.toLowerCase().includes('advanced search')) {
                // Hide the Advanced Search span
                span.style.display = 'none';
                span.setAttribute('data-hidden-by-filter', 'true');
                hiddenCount++;
                Logger.log(`    🚫 Hidden Advanced Search span: "${text}"`);
                
                // Hide the next sibling span if it exists
                const nextSpan = span.nextElementSibling;
                if (nextSpan && nextSpan.tagName === 'SPAN') {
                    nextSpan.style.display = 'none';
                    nextSpan.setAttribute('data-hidden-by-filter', 'true');
                    hiddenCount++;
                    Logger.log(`🚫 Hidden next sibling span: "${nextSpan.textContent?.trim() || ''}"`);
                }
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

                            const shouldHide = GLOBAL_HIDDEN_ACTION_ELEMENTS.some(hiddenText =>
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

        Logger.log(`✅ Action elements control applied - ${hiddenCount} elements hidden, ${preservedCount} elements preserved`);

    } catch (error) {
        Logger.error("❌ Error hiding action elements:", error);
    }
}

/**
 * URL Detection and Filter Router
 */
function detectCurrentFilter() {
    const currentUrl = window.location.href;

    Logger.log(`Current URL: ${currentUrl}`);

    // Check for specific URL patterns
   if (currentUrl.includes('/Search/Inquiry-details')) {
        return 'SEARCH_INQUIRY_DETAILS';
    } else if (currentUrl.includes('/home') || currentUrl.includes('/Home')) {
        return 'HOME_PAGE';
    } else if (currentUrl.includes('/Search/Inquiry')) {
        return 'SEARCH_INQUIRY';
    } else if (currentUrl.includes('/Claims/Search') || currentUrl.includes('member/claims/claims_app_search')) {
        return 'VIEW CLAIMS';
    } else if (currentUrl.includes('/Claims/Reports') || currentUrl.includes('member/claims/ClaimsViewReport')) {
        return 'CLAIMS REPORTS'
    }

    return 'UNKNOWN';
}

async function handleUnknownUrlPage() {
    try {
        Logger.log("🔍 Handling unknown URL page");

        // Create and show loader
        const LoaderUtil = window.LoaderUtil || createDefaultLoaderUtil();
        LoaderUtil.showLoader("Connecting to Radian extension...");

        // Create throttled version of hideNavigationLinks for event listeners
        // This ensures we don't call it repeatedly in short succession
        const throttledHideLinks = (() => {
            let lastCallTime = 0;
            const minInterval = 2000; // Minimum 2 seconds between calls
            let scheduled = false;

            return () => {
                const now = Date.now();
                if (scheduled || now - lastCallTime < minInterval) {
                    return; // Skip if already scheduled or called recently
                }

                scheduled = true;

                // Schedule for next animation frame to align with browser rendering
                requestAnimationFrame(() => {
                    hideNavigationLinks();
                    lastCallTime = Date.now();
                    scheduled = false;
                });
            };
        })();

        // Set up mutation observer to handle dynamic content changes
        // This uses our optimized version that minimizes performance impact
        setupDynamicContentObserver();

        // Hide navigation links immediately (first-time execution)
        hideNavigationLinks();

        // Set up event listeners for critical page lifecycle events only
        // Using the throttled version to prevent excessive calls
        window.addEventListener('DOMContentLoaded', throttledHideLinks, { once: true });

        // For load event, use once: true to ensure it only fires once
        window.addEventListener('load', () => {
            throttledHideLinks();

            // After initial load, we only need to rely on the mutation observer
            // This reduces the number of active event listeners
            Logger.log("✅ Initial page load complete, relying on mutation observer");
        }, { once: true });

        // Find and monitor iframes using our optimized implementation
        monitorIframes();

        // Hide loader after a short delay to ensure UI is properly handled
        setTimeout(() => {
            LoaderUtil.hideLoader();
            Logger.success("✅ Unknown page protection applied successfully");
        }, 1500);

        return true;
    } catch (error) {
        Logger.error("❌ Error handling unknown URL page:", error);
        return false;
    }
}

/**
 * Setup mutation observer to monitor dynamic content changes
 * This ensures navigation links are hidden even when content loads dynamically
 * Performance-optimized to minimize impact on page responsiveness
 */
function setupDynamicContentObserver() {
    try {
        // Track last execution time to prevent excessive calls
        let lastExecutionTime = 0;
        const minInterval = 1500; // Minimum 1.5 seconds between executions

        // Create a throttled version of hideNavigationLinks with strict timing control
        const throttledHideLinks = throttle(hideNavigationLinks, minInterval);

        // Create mutation observer with optimized filtering
        const observer = new MutationObserver((mutations) => {
            // Skip if execution happened very recently
            const now = Date.now();
            if (now - lastExecutionTime < minInterval) return;

            // Only process if we have relevant mutations
            const hasRelevantMutation = mutations.some(mutation => {
                // Only care about added nodes (new content)
                if (mutation.type !== 'childList' || mutation.addedNodes.length === 0) {
                    return false;
                }

                // Check if any added node could contain navigation elements
                return Array.from(mutation.addedNodes).some(node => {
                    // Only process element nodes
                    if (node.nodeType !== Node.ELEMENT_NODE) return false;

                    // Check if this is a navigation-related element or could contain one
                    const nodeType = node.nodeName.toLowerCase();
                    return nodeType === 'nav' ||
                        nodeType === 'header' ||
                        nodeType === 'div' ||
                        nodeType === 'ul' ||
                        nodeType === 'iframe' ||
                        node.classList?.contains('nav') ||
                        node.classList?.contains('menu') ||
                        node.classList?.contains('header') ||
                        node.hasAttribute('role');
                });
            });

            if (hasRelevantMutation) {
                throttledHideLinks();
                lastExecutionTime = now;
            }
        });

        // Start observing with optimized configuration
        observer.observe(document.body || document.documentElement, {
            childList: true,
            subtree: true,
            attributes: false,  // Don't watch attribute changes
            characterData: false  // Don't watch text content changes
        });

        // Store observer reference to prevent garbage collection
        window._navigationObserver = observer;

        Logger.log("👀 Performance-optimized dynamic content observer set up successfully");
    } catch (error) {
        Logger.error("❌ Error setting up dynamic content observer:", error);
    }
}

/**
 * Monitor iframes for navigation elements
 * Performance-optimized to minimize impact on page responsiveness
 */
function monitorIframes() {
    try {
        // Track processed iframes to avoid duplicate handlers
        const processedIframes = new WeakSet();

        // Track last execution time
        let lastIframeProcessTime = 0;
        const minIframeInterval = 2000; // Minimum 2 seconds between iframe scans

        // Create optimized iframe handler with throttling
        const handleIframeLoad = (iframe) => {
            // Skip if already processed
            if (processedIframes.has(iframe)) return;

            // Mark as processed
            processedIframes.add(iframe);

            // Use once option to ensure the event handler only runs once
            iframe.addEventListener('load', () => {
                // Throttle the actual processing
                const now = Date.now();
                if (now - lastIframeProcessTime < minIframeInterval) {
                    // Skip if too frequent
                    return;
                }

                // Process the iframe with throttled hideNavigationLinks
                throttle(hideNavigationLinks, minIframeInterval)();
                lastIframeProcessTime = now;
            }, { once: true });
        };

        // Process existing iframes with delay to prioritize main content loading
        setTimeout(() => {
            const iframes = document.querySelectorAll('iframe');
            if (iframes.length > 0) {
                // Process iframes in batches to avoid blocking the main thread
                let index = 0;
                const processNextBatch = () => {
                    const endIndex = Math.min(index + 2, iframes.length);
                    for (let i = index; i < endIndex; i++) {
                        handleIframeLoad(iframes[i]);
                    }
                    index = endIndex;

                    if (index < iframes.length) {
                        setTimeout(processNextBatch, 200);
                    }
                };

                processNextBatch();
            }
        }, 1000);

        // Monitor for new iframes with reduced sensitivity
        const iframeObserver = new MutationObserver(mutations => {
            // Check if we need to process now or wait
            const now = Date.now();
            if (now - lastIframeProcessTime < minIframeInterval) return;

            // Look for iframe additions
            let hasNewIframe = false;

            for (const mutation of mutations) {
                if (mutation.type === 'childList') {
                    for (let i = 0; i < mutation.addedNodes.length; i++) {
                        const node = mutation.addedNodes[i];
                        if (node.nodeName === 'IFRAME') {
                            handleIframeLoad(node);
                            hasNewIframe = true;
                        }
                    }
                }
            }

            if (hasNewIframe) {
                lastIframeProcessTime = now;
            }
        });

        // Start observing with optimized configuration
        iframeObserver.observe(document.body || document.documentElement, {
            childList: true,
            subtree: true,
            attributes: false,
            characterData: false
        });

        // Store observer reference
        window._iframeObserver = iframeObserver;

        Logger.log("🖼️ Performance-optimized iframe monitoring set up successfully");
    } catch (error) {
        Logger.error("❌ Error monitoring iframes:", error);
    }
}

/**
 * Create default loader utility if not available
 * Uses the existing loader styles and elements from the codebase
 */
function createDefaultLoaderUtil() {
    return {
        loaderInstance: null,

        createLoader() {
            if (this.loaderInstance && document.body.contains(this.loaderInstance)) {
                return this.loaderInstance;
            }

            // Use existing createLoaderElement function if available
            if (typeof createLoaderElement === 'function') {
                this.loaderInstance = createLoaderElement();
                return this.loaderInstance;
            }

            // Fallback implementation based on existing loader style
            const loader = document.createElement("div");
            loader.id = "loaderOverlay";
            loader.innerHTML = `
          <div class="spinner"></div>
          <div class="loader-text">Connecting to Radian extension...</div>
        `;

            this.loaderInstance = loader;
            return loader;
        },

        updateLoaderText(text) {
            // Use existing updateLoaderText function if available
            if (typeof updateLoaderText === 'function') {
                updateLoaderText(text);
                return;
            }

            // Fallback implementation
            const loaderText = document.querySelector('#loaderOverlay .loader-text');
            if (loaderText) {
                loaderText.textContent = text;
            }
        },

        showLoader(text = "Connecting to Radian extension...") {
            // Add loader style if not present
            if (!document.head.querySelector('style[id^="loader"]')) {
                // Use existing createLoader function if available
                if (typeof createLoader === 'function') {
                    const style = createLoader();
                    document.head.appendChild(style);
                } else {
                    // Fallback implementation
                    const style = document.createElement('style');
                    style.id = "loader-style";
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
                margin-bottom: 20px;
              }
              .loader-text {
                color: #2b6cb0;
                font-size: 16px;
                font-weight: 500;
                text-align: center;
              }
              @keyframes spin {
                to {transform: rotate(360deg);}
              }
              #loaderOverlay.hidden {
                opacity: 0;
                pointer-events: none;
              }
            `;
                    document.head.appendChild(style);
                }
            }

            let loader = document.getElementById("loaderOverlay");
            if (!loader) {
                loader = this.createLoader();
                document.body.appendChild(loader);
            }

            this.updateLoaderText(text);
            loader.classList.remove("hidden");

            return loader;
        },

        hideLoader() {
            const loader = document.getElementById("loaderOverlay");
            if (loader) {
                loader.classList.add("hidden");
                setTimeout(() => {
                    if (loader && loader.parentNode) {
                        loader.parentNode.removeChild(loader);
                    }
                }, 300);
            }
            this.loaderInstance = null;
        }
    };
}

/**
 * Utility function to throttle function calls
 * This ensures the function is called at most once in a specified time period
 */
function throttle(func, limit) {
    let inThrottle = false;
    let lastExec = 0;

    return function (...args) {
        const now = Date.now();

        // If it's been longer than the limit since last execution, execute immediately
        if (now - lastExec >= limit) {
            func(...args);
            lastExec = now;
        } else if (!inThrottle) {
            // Otherwise schedule one more execution at the end of the throttle period
            inThrottle = true;
            setTimeout(() => {
                inThrottle = false;
                lastExec = Date.now();
                func(...args);
            }, limit - (now - lastExec));
        }
        // If we're in throttle period and already have a scheduled execution, do nothing
    };
}

/**
 * Establish Communication with Loan Checker Extension
 */
async function waitForListener(maxRetries = 20, initialDelay = 100) {
    return new Promise((resolve) => {
        if (typeof chrome === "undefined" || !chrome.runtime || !chrome.runtime.sendMessage) {
            Logger.warn("Chrome extension API not available. Running in standalone mode.");
            resolve(false);
            return;
        }

        let attempts = 0;
        let delay = initialDelay;
        let timeoutId;

        function sendPing() {
            if (attempts >= maxRetries) {
                Logger.warn("No listener detected after maximum retries.");
                clearTimeout(timeoutId);
                resolve(false);
                return;
            }

            chrome.runtime.sendMessage(
                EXTENSION_ID,
                { type: "ping" },
                (response) => {
                    if (response?.result === "pong") {
                        Logger.success("Listener detected!");
                        clearTimeout(timeoutId);
                        resolve(true);
                    } else {
                        Logger.warn(`No listener detected, retrying... (${attempts + 1}/${maxRetries})`);
                        timeoutId = setTimeout(() => {
                            attempts++;
                            delay *= 2;
                            sendPing();
                        }, delay);
                    }
                }
            );
        }

        sendPing();
    });
}

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

/**
 * Main Initialization Function
 */
async function initializeFilter() {
    try {
        const currentFilter = detectCurrentFilter();
        Logger.log(`Detected filter type: ${currentFilter}`);

        // Wait for extension listener
        const hasListener = await waitForListener();

        if (hasListener) {
            Logger.success("Extension communication established");
        } else {
            Logger.warn("Running in standalone mode");
        }
    const isStillRestricted = checkRestrictedUrl();
    if (isStillRestricted) {
      Logger.warn("🚫 Restricted page detected after extension connection, blocking access");
      return; // Exit early if page is restricted
    }
function setupRestrictedUrlMonitoring() {
  let lastUrl = window.location.href;
  
  // Monitor URL changes
  const checkUrlChange = () => {
    if (lastUrl !== window.location.href) {
      lastUrl = window.location.href;
      Logger.log("🔄 URL changed, checking for restrictions...");
      
      // Check if new URL is restricted
      const isRestricted = checkRestrictedUrl();
      if (isRestricted) {
        Logger.warn("🚫 Navigation to restricted page detected, blocking access");
        return;
      }
    }
  };
  
  // Listen for browser navigation events
  window.addEventListener('popstate', checkUrlChange);
  window.addEventListener('hashchange', checkUrlChange);
  
  // Override history methods to catch programmatic navigation
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;
  
  history.pushState = (...args) => {
    originalPushState.apply(history, args);
    setTimeout(checkUrlChange, 100); // Small delay to ensure URL is updated
  };
  
  history.replaceState = (...args) => {
    originalReplaceState.apply(history, args);
    setTimeout(checkUrlChange, 100); // Small delay to ensure URL is updated
  };
  
  Logger.log("👀 Restricted URL monitoring setup complete");
}

 setupRestrictedUrlMonitoring()
        // Handle UNKNOWN URLs
        if (currentFilter === 'UNKNOWN') {
            Logger.warn("Unknown page type, initializing generic protection");
            await handleUnknownUrlPage();
            return;
        }

        // Route to appropriate filter
        switch (currentFilter) {
            case 'SEARCH_INQUIRY_DETAILS':
                await initializeSearchInquiryDetailsFilter();
                break;
            case 'HOME_PAGE':
                await initializeHomePageFilter();
                break;
            case 'SEARCH_INQUIRY':
                await initializeSearchInquiryFilter();
                break;
            case 'VIEW CLAIMS':
                await initializeViewClaimsFilter();
                break;
            case 'CLAIMS REPORTS':
                await initializeClaimsReportsFilter();
                break;
            default:
                Logger.warn(`No filter implementation for: ${currentFilter}`);
        }

    } catch (error) {
        Logger.error("Failed to initialize filter", error);
    }
}


// ########## FILTER IMPLEMENTATIONS ##########


/**
 * SEARCH INQUIRY DETAILS FILTER
 * URL: https://www.mionline.biz/Search/Inquiry-details
 */



async function initializeSearchInquiryDetailsFilter() {
    Logger.log("Initializing Search Inquiry Details Filter");
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
            console.log("allowedLoans",allowedLoans);

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
}
/**
 * HOME PAGE FILTER
 * URL: www.mionline.biz/Home
 */
async function initializeHomePageFilter() {
    Logger.log("Initializing Home Page Filter");

    /**
     * Wait for element to be present in DOM with timeout
     */
    function waitForElement(selector, timeout = 10000, interval = 100) {
        Logger.info(`🔍 Waiting for element: ${selector} (timeout: ${timeout}ms)`);

        return new Promise((resolve, reject) => {
            const startTime = Date.now();

            const checkElement = () => {
                const element = document.querySelector(selector);

                if (element) {
                    Logger.info(`✅ Element found: ${selector} after ${Date.now() - startTime}ms`);
                    resolve(element);
                    return;
                }

                if (Date.now() - startTime >= timeout) {
                    Logger.error(`❌ Element not found within timeout: ${selector}`);
                    reject(new Error(`Element ${selector} not found within ${timeout}ms`));
                    return;
                }

                setTimeout(checkElement, interval);
            };

            checkElement();
        });
    }
    /**
     * Define the links that should be hidden
     */

    // ########## END NAVIGATION CONTROL ##########

    /**
     * Find all tables that contain loan numbers in the third column
     */
    function findLoanTables() {
        Logger.info("🔍 Searching for loan tables...");
        const tables = document.querySelectorAll('table');
        Logger.debug(`📊 Found ${tables.length} total tables`);

        const loanTables = [];

        tables.forEach((table, index) => {
            // Check if table has a header row with "Loan Number" in the third column
            const headerRow = table.querySelector('thead tr, tr:first-child');
            if (!headerRow) {
                Logger.debug(`   ⚠️  Table ${index + 1}: No header row found`);
                return;
            }

            const headerCells = headerRow.querySelectorAll('th, td');

            if (headerCells.length < 3) {
                Logger.debug(`   ⚠️  Table ${index + 1}: Less than 3 columns`);
                return;
            }

            const thirdHeaderCell = headerCells[2];
            const headerText = thirdHeaderCell.textContent.trim();

            // Check if the third column header contains "Loan Number"
            if (headerText.toLowerCase().includes('loan number')) {
                loanTables.push(table);
                Logger.debug(`   ✅ Table ${index + 1}: Loan number column found`);
            } else {
                Logger.debug(`   ❌ Table ${index + 1}: No loan number column found (header: "${headerText}")`);
            }
        });

        Logger.info(`🎯 Found ${loanTables.length} tables with loan numbers`);
        return loanTables;
    }

    /**
     * Extract loan numbers from table rows
     */
    function extractLoanNumbers(table) {
        const rows = table.querySelectorAll('tbody tr, tr:not(:first-child)');
        Logger.debug(`📊 Found ${rows.length} data rows`);

        const loanNumbers = [];

        rows.forEach((row, index) => {
            const cells = row.querySelectorAll('td');

            if (cells.length >= 3) {
                const thirdCell = cells[2];
                const loanNumber = thirdCell.textContent.trim();
                Logger.debug(`   🔢 Row ${index + 1}: Third cell content = "${loanNumber}"`);

                if (loanNumber && loanNumber !== '') {
                    loanNumbers.push(loanNumber);
                } else {
                    Logger.debug(`   ⚠️  Row ${index + 1}: Empty loan number cell`);
                }
            } else {
                Logger.debug(`   ⚠️  Row ${index + 1}: Less than 3 cells, skipping`);
            }
        });

        Logger.info(`📋 Extracted ${loanNumbers.length} loan numbers:`, loanNumbers);
        return loanNumbers;
    }

    /**
     * Create restricted loan message element
     */
    function createRestrictedMessage() {
        Logger.info("🚫 Creating restricted loan message...");
        const message = document.createElement("div");
        message.textContent = "You are not provisioned to see the restricted loan details";
        message.style.cssText = `
      color: red;
      display: flex;
      justify-content: center;
      align-items: center;
      font-size: 1.2em;
      font-weight: bold;
      padding: 40px;
      text-align: center;
      background-color: #fff3f3;
      border: 2px solid #ffcccc;
      border-radius: 8px;
      margin: 20px 0;
    `;
        return message;
    }

    /**
     * Create loader to show when trying to establish connection with extension
     */
    function createLoader() {
        Logger.info("🎨 Creating loader styles...");
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
        margin-bottom: 20px;
      }
      .loader-text {
        color: #2b6cb0;
        font-size: 16px;
        font-weight: 500;
        text-align: center;
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
        Logger.info("🎯 Creating loader element...");
        const loader = document.createElement("div");
        loader.id = "loaderOverlay";
        loader.innerHTML = `
      <div class="spinner"></div>
      <div class="loader-text">Checking loan access permissions...</div>
    `;
        return loader;
    }

    /**
     * Update loader text
     */
    function updateLoaderText(text) {
        const loaderText = document.querySelector('#loaderOverlay .loader-text');
        if (loaderText) {
            loaderText.textContent = text;
            Logger.debug(`🔄 Loader text updated: ${text}`);
        }
    }

    /**
     * Check loan numbers in tables and hide restricted ones
     */
    async function checkAndFilterLoanTables() {
        Logger.info("🚀 Starting loan table filtering process...");
        updateLoaderText("Scanning for loan tables...");

        const loanTables = findLoanTables();

        if (loanTables.length === 0) {
            Logger.info("ℹ️  No loan tables found on this page");
            return;
        }

        Logger.info(`🎯 Processing ${loanTables.length} loan table(s)`);

        for (let i = 0; i < loanTables.length; i++) {
            const table = loanTables[i];
            Logger.info(`📋 Processing table ${i + 1}/${loanTables.length}`);
            updateLoaderText(`Processing table ${i + 1} of ${loanTables.length}...`);

            const loanNumbers = extractLoanNumbers(table);

            if (loanNumbers.length === 0) {
                Logger.warn(`⚠️  Table ${i + 1}: No loan numbers found, skipping`);
                continue;
            }

            try {
                updateLoaderText(`Checking ${loanNumbers.length} loan numbers...`);
                const allowedLoans = await checkNumbersBatch(loanNumbers);
                Logger.info(`📊 Table ${i + 1}: Allowed loans count: ${allowedLoans.length}/${loanNumbers.length}`);

                // Get all data rows in the table
                const rows = table.querySelectorAll('tbody tr, tr:not(:first-child)');
                const dataRows = Array.from(rows).filter(row => row.querySelectorAll('td').length >= 3);

                Logger.debug(`📊 Table ${i + 1}: Found ${dataRows.length} data rows`);

                // If only one row and it's restricted, show message instead of hiding
                if (dataRows.length === 1 && allowedLoans.length === 0) {
                    Logger.info(`🚫 Table ${i + 1}: Single row with restricted loan - showing message`);

                    // Hide the table
                    table.style.display = 'none';

                    // Create and insert restricted message
                    const message = createRestrictedMessage();
                    table.parentNode.insertBefore(message, table);
                    Logger.info(`✅ Table ${i + 1}: Restricted message inserted for single row`);
                    continue;
                }

                // Check each row individually and hide restricted ones
                let restrictedRowsFound = false;
                dataRows.forEach((row, rowIndex) => {
                    const cells = row.querySelectorAll('td');
                    if (cells.length >= 3) {
                        const thirdCell = cells[2];
                        const loanNumber = thirdCell.textContent.trim();

                        // Check if this loan number is in the allowed list
                        if (loanNumber && !allowedLoans.includes(loanNumber)) {
                            Logger.debug(`🚫 Table ${i + 1}, Row ${rowIndex + 1}: Hiding restricted loan "${loanNumber}"`);
                            row.style.display = 'none';
                            restrictedRowsFound = true;
                        } else {
                            Logger.debug(`✅ Table ${i + 1}, Row ${rowIndex + 1}: Loan "${loanNumber}" is accessible`);
                        }
                    }
                });

                if (restrictedRowsFound) {
                    Logger.info(`✅ Table ${i + 1}: Row-level filtering completed - restricted rows hidden`);
                } else {
                    Logger.info(`✅ Table ${i + 1}: All loans are accessible`);
                }

            } catch (error) {
                Logger.error(`❌ Table ${i + 1}: Error checking loan numbers:`, error);
            }
        }

        Logger.info("🏁 Loan table filtering process completed");
    }

    /**
     * Enhanced DOM Change Observer with debouncing
     */
    class DOMChangeObserver {
        constructor() {
            this.observer = null;
            this.debounceTimer = null;
            this.debounceDelay = 500; // 500ms debounce
            this.isProcessing = false;
            Logger.info("👀 Initializing DOM Change Observer");
        }

        start() {
            if (this.observer) {
                Logger.warn("⚠️ Observer already running");
                return;
            }

            Logger.info("🔍 Starting DOM change observer...");

            this.observer = new MutationObserver((mutations) => {
                if (this.isProcessing) {
                    Logger.debug("⏳ Skipping mutation - already processing");
                    return;
                }

                const hasRelevantChanges = this.checkForRelevantChanges(mutations);

                if (hasRelevantChanges) {
                    Logger.info(`🔄 DOM changes detected: ${mutations.length} mutations`);
                    this.debounceCheck();
                }
            });

            this.observer.observe(document.body, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['style', 'class', 'display', 'visibility'],
                characterData: false
            });

            Logger.info("✅ DOM change observer started");
        }

        checkForRelevantChanges(mutations) {
            let hasRelevantChanges = false;

            for (const mutation of mutations) {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    // Check if any new tables were added
                    const hasNewTables = Array.from(mutation.addedNodes).some(node => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            const isTable = node.tagName === 'TABLE';
                            const hasTable = node.querySelector && node.querySelector('table');
                            return isTable || hasTable;
                        }
                        return false;
                    });

                    if (hasNewTables) {
                        Logger.debug("📊 New table(s) detected in DOM changes");
                        hasRelevantChanges = true;
                    }

                    // Check for navigation elements
                    const hasNavigationElements = Array.from(mutation.addedNodes).some(node => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            return node.querySelector &&
                                (node.querySelector('a') ||
                                    node.querySelector('button') ||
                                    node.querySelector('[role="menuitem"]') ||
                                    node.querySelector('.menu-item'));
                        }
                        return false;
                    });

                    if (hasNavigationElements) {
                        Logger.debug("🔗 Navigation elements detected in DOM changes");
                        hasRelevantChanges = true;
                    }
                }

                // For attribute changes, check if they're on navigation elements
                if (mutation.type === 'attributes') {
                    const target = mutation.target;
                    if (target.tagName === 'A' || target.tagName === 'BUTTON' ||
                        target.getAttribute('role') === 'menuitem' ||
                        target.getAttribute('role') === 'button' ||
                        target.classList.contains('menu-item') ||
                        target.classList.contains('nav-link')) {
                        Logger.debug("🔗 Navigation element attribute changed");
                        hasRelevantChanges = true;
                    }
                }
            }
            return hasRelevantChanges;
        }

        debounceCheck() {
            if (this.debounceTimer) {
                clearTimeout(this.debounceTimer);
            }

            this.debounceTimer = setTimeout(() => {
                this.performCheck();
            }, this.debounceDelay);
        }

        async performCheck() {
            if (this.isProcessing) {
                Logger.debug("⏳ Check already in progress, skipping");
                return;
            }

            this.isProcessing = true;
            Logger.info("🔄 Performing loan table check due to DOM changes...");

            try {
                // Show loader during check
                const loader = document.getElementById('loaderOverlay');
                if (loader) {
                    loader.classList.remove('hidden');
                    updateLoaderText("Re-checking loan access due to page changes...");
                }

                // Hide navigation links first
                hideNavigationLinks();

                // Then check and filter loan tables
                await checkAndFilterLoanTables();
                Logger.info("✅ DOM change check completed");
            } catch (error) {
                Logger.error("❌ Error during DOM change check:", error);
            } finally {
                this.isProcessing = false;

                // Hide loader after check
                const loader = document.getElementById('loaderOverlay');
                if (loader) {
                    loader.classList.add('hidden');
                }
            }
        }

        stop() {
            if (this.observer) {
                Logger.info("🛑 Stopping DOM change observer...");
                this.observer.disconnect();
                this.observer = null;

                if (this.debounceTimer) {
                    clearTimeout(this.debounceTimer);
                    this.debounceTimer = null;
                }

                Logger.info("✅ DOM change observer stopped");
            }
        }
    }

    // Global observer instance
    const domObserver = new DOMChangeObserver();

    /**
     * Setup navigation control with periodic checks and event listeners
     */
    function setupNavigationControl() {
        Logger.info("🔗 Setting up navigation control system...");

        // Set up periodic check for navigation links as a fallback
        const periodicCheckInterval = setInterval(() => {
            hideNavigationLinks();
        }, 3000);

        // Add event listeners for page load events to catch all possible DOM changes
        window.addEventListener('DOMContentLoaded', hideNavigationLinks);
        window.addEventListener('load', hideNavigationLinks);

        // Store references to clean up if needed
        window._radianNavInterval = periodicCheckInterval;

        Logger.info("✅ Navigation control system setup complete");
    }

    /**
     * Initialize the loan filter system
     */
    async function initializeLoanFilter() {
        Logger.info("🚀 Initializing Radian Loan Filter System...");

        try {
            // Step 1: Wait for page to be ready
            Logger.info("📄 Waiting for page to be ready...");
            updateLoaderText("Initializing loan filter system...");

            // Step 2: Check Extension connection
            Logger.info("🔌 Establishing extension connection...");
            updateLoaderText("Connecting to loan checker extension...");
            await waitForListener();
            Logger.info("✅ Extension connection established");

            // Hide navigation links after successful connection
            hideNavigationLinks();

            // Reveal content immediately after nav links are hidden to avoid restricted link flash
            try {
                const tempStyle = document.getElementById('temporary-content-hide');
                if (tempStyle) {
                    tempStyle.remove();
                }
                // Restore document visibility
                if (document && document.documentElement) {
                    document.documentElement.style.visibility = "";
                }
            } catch (revealErr) {
                Logger.warn("⚠️ Failed to remove temporary content hide style:", revealErr);
            }

            // Step 3: Wait for potential tables to load
            Logger.info("⏳ Waiting for page content to load...");
            updateLoaderText("Waiting for page content to load...");

            // Wait a bit for dynamic content
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Step 4: Check and filter loan tables
            Logger.info("🔍 Starting loan table filtering...");
            updateLoaderText("Scanning and filtering loan tables...");
            await checkAndFilterLoanTables();
            Logger.info("✅ Loan table filtering completed");

            // Step 5: Setup observer for dynamic changes
            Logger.info("👀 Setting up dynamic change observer...");
            domObserver.start();

            // Step 6: Setup periodic navigation check and event listeners
            Logger.info("🔗 Setting up navigation control...");
            setupNavigationControl();

            Logger.info("🎉 Radian loan filter initialized successfully!");
            updateLoaderText("Loan filter system ready!");

            // Hide loader after successful initialization
            setTimeout(() => {
                const loader = document.getElementById('loaderOverlay');
                if (loader) {
                    loader.classList.add('hidden');
                }
            }, 1000);

        } catch (error) {
            Logger.error("❌ Error initializing Radian loan filter:", error);
            Logger.error("🔍 Error details:", {
                message: error.message,
                stack: error.stack,
                name: error.name
            });

            updateLoaderText("Error initializing loan filter. Please refresh the page.");

            // Hide loader after error
            setTimeout(() => {
                const loader = document.getElementById('loaderOverlay');
                if (loader) {
                    loader.classList.add('hidden');
                }
            }, 3000);
        }
    }

    // Main entrypoint
    (async function () {
        Logger.info("🎬 Radian Loan Filter Script Starting...");

        // Create loader style
        const style = createLoader();
        document.head.appendChild(style);

        // Create loader element
        const loader = createLoaderElement();
        document.body.appendChild(loader);

        // Immediately hide all content except the loader to prevent restricted nav flash
        try {
            // Ensure loader is visible
            const existingHide = document.getElementById('temporary-content-hide');
            if (!existingHide) {
                const tempStyle = document.createElement('style');
                tempStyle.id = 'temporary-content-hide';
                tempStyle.textContent = `
          body > *:not(#loaderOverlay) { visibility: hidden !important; }
          #loaderOverlay { visibility: visible !important; }
        `;
                document.head.appendChild(tempStyle);
            }
            if (document && document.documentElement) {
                document.documentElement.style.visibility = "hidden";
            }
        } catch (e) {
            Logger.warn("⚠️ Could not apply temporary content hide:", e);
        }

        // Wait for DOM to be ready
        if (document.readyState === "loading") {
            Logger.info("📄 DOM still loading, waiting for DOMContentLoaded...");
            document.addEventListener("DOMContentLoaded", initializeLoanFilter);
        } else {
            Logger.info("📄 DOM already ready, starting initialization...");
            initializeLoanFilter();
        }

        // Cleanup on page unload
        window.addEventListener('beforeunload', () => {
            Logger.info("🔄 Page unloading, cleaning up...");
            domObserver.stop();
        });

    })();
}

/**
 * SEARCH INQUIRY FILTER
 * URL: https://www.mionline.biz/Search/Inquiry
 */

async function initializeSearchInquiryFilter() {


    let processedElements = new WeakSet();

    /**
     * Cache for storing allowed loan numbers to reduce API calls
     */
    const allowedLoansCache = {
        loans: new Set(),
        lastUpdated: 0,
        cacheTimeout: 5 * 60 * 1000, // 5 minutes

        isAllowed(loanNumber) {
            return this.loans.has(loanNumber);
        },

        addLoans(loanNumbers) {
            loanNumbers.forEach((loan) => this.loans.add(loan));
            this.lastUpdated = Date.now();
        },

        isCacheValid() {
            return (
                this.lastUpdated > 0 && Date.now() - this.lastUpdated < this.cacheTimeout
            );
        },

        clear() {
            this.loans.clear();
            this.lastUpdated = 0;
        },
    };

    /**
     * Returns the main data table element.
     * Uses a generic selector for robustness against dynamic class names.
     */
    function getTargetTable() {
        const selectors = [
            "table",
            'table[class*="table"]',
            'table[class*="data"]',
            'table[class*="grid"]',
            ".table table",
            ".data-table table",
            ".results table",
        ];

        for (const selector of selectors) {
            const table = document.querySelector(selector);
            if (table) {
                const tbody = table.querySelector("tbody");
                const rows = table.querySelectorAll("tr");

                if (tbody || rows.length > 1) {
                    console.log(
                        "[radian_filter] getTargetTable: Found table with selector:",
                        selector
                    );
                    return table;
                }
            }
        }

        console.log("[radian_filter] getTargetTable: No suitable table found");
        return null;
    }
    // ########## END NAVIGATION CONTROL ##########

    /**
     * Page utility functions
     */
    function showPage(val) {
        if (document.body?.style) {
            document.body.style.opacity = val ? 1 : 0;
        }
    }

    /**
     * Create unallowed element to show when loan is not allowed
     */
    function createUnallowedElement() {
        const unallowed = document.createElement("tr");
        const td = document.createElement("td");
        td.setAttribute("colspan", "7");
        td.appendChild(
            document.createTextNode(
                "You are not provisioned to see the restricted loan"
            )
        );
        td.style.textAlign = "center";
        td.style.padding = "15px";
        td.style.fontWeight = "bold";
        td.style.color = "#721c24";
        td.style.backgroundColor = "#f8d7da";
        td.style.border = "1px solid #f5c6cb";

        unallowed.appendChild(td);
        return unallowed;
    }

    /**
     * Check if a loan number is allowed for the current user
     */
    async function isLoanNumberAllowed(loanNumber) {
        try {
            if (
                allowedLoansCache.isCacheValid() &&
                allowedLoansCache.isAllowed(loanNumber)
            ) {
                return true;
            }

            const allowedNumbers = await checkNumbersBatch([loanNumber]);
            console.log("allowedNumbers",allowedNumbers);
            allowedLoansCache.addLoans(allowedNumbers);
            const isAllowed = allowedNumbers.includes(loanNumber);
            return isAllowed;
        } catch (error) {
            console.error(
                "[radian_filter] isLoanNumberAllowed: Error for",
                loanNumber,
                error
            );
            return false;
        }
    }

    /**
     * Check if text contains a potential loan number
     */
    function containsLoanNumber(text) {
        return /\b\d{5,}\b/.test(text) || /\b[A-Z0-9]{5,}\b/.test(text);
    }

    /**
     * Extract potential loan numbers from text
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
     * Clear any existing restriction or no-results messages from the table
     */
    function clearExistingMessages(tbody) {
        if (!tbody) return;

        const existingMessages = tbody.querySelectorAll('tr td[colspan]');
        existingMessages.forEach(td => {
            const text = td.textContent.trim();
            if (text === "No results found." ||
                text === "You are not provisioned to see the restricted loan" ||
                text.includes("not provisioned") ||
                text.includes("restricted loan")) {
                const row = td.closest('tr');
                if (row) {
                    row.remove();
                    console.log("[radian_filter] clearExistingMessages: Removed existing message:", text);
                }
            }
        });
    }

    /**
     * Process all table rows in the search results and hide those containing unauthorized loan numbers
     */
    async function processTableRows() {
        console.log("[radian_filter] processTableRows: Start");
        processedElements = new WeakSet();

        const table = getTargetTable();
        if (!table) {
            console.warn("[radian_filter] processTableRows: Table not found");
            showPage(true);
            return;
        }

        const tbody = table.querySelector("tbody");
        if (!tbody) {
            console.warn("[radian_filter] processTableRows: Tbody not found");
            showPage(true);
            return;
        }

        const headerRow = table.querySelector("thead tr");
        if (!headerRow) {
            console.warn("[radian_filter] processTableRows: Header row not found");
            showPage(true);
            return;
        }

        const columnCount = headerRow.cells.length;

        // Clear any existing "no results" or restriction messages first
        clearExistingMessages(tbody);

        const originalRows = Array.from(tbody.querySelectorAll("tr"));

        // Reset all rows to visible before filtering
        originalRows.forEach(row => {
            row.style.display = "";
        });

        const allowedRows = [];
        let dataRowsCount = 0;
        let dataRowsRemoved = 0;

        for (const row of originalRows) {
            if (row.cells.length === 1 && row.cells[0].hasAttribute("colspan")) {
                allowedRows.push(row);
                continue;
            }

            if (row.cells.length > 1) {
                dataRowsCount++;

                let loanNumber = null;
                if (row.cells.length > 2) {
                    loanNumber = row.cells[2].textContent.trim();
                }

                if (!loanNumber) {
                    allowedRows.push(row);
                    continue;
                }
                const isAllowed = await isLoanNumberAllowed(loanNumber);
                console.log(
                    "[radian_filter] processTableRows: Row loanNumber",
                    loanNumber,
                    "isAllowed",
                    isAllowed
                );

                if (isAllowed) {
                    allowedRows.push(row);
                } else {
                    row.style.display = "none";
                    dataRowsRemoved++;
                }
            } else {
                allowedRows.push(row);
            }
        }

        // Count only visible rows (not hidden)
        let actualDisplayedRows = originalRows.filter(row => row.style.display !== "none").length;

        // If all rows are hidden, show appropriate message
        if (actualDisplayedRows === 0) {
            // Remove all rows first
            while (tbody.firstChild) {
                tbody.removeChild(tbody.firstChild);
            }

            if (dataRowsCount === 1 && dataRowsRemoved === 1) {
                const unallowedElement = createUnallowedElement();
                unallowedElement
                    .querySelector("td")
                    .setAttribute("colspan", columnCount.toString());
                tbody.appendChild(unallowedElement);
                actualDisplayedRows = 0;
                console.log(
                    "[radian_filter] processTableRows: All rows removed, showing unallowed message"
                );
            } else {
                const noResultsRow = document.createElement("tr");
                const td = document.createElement("td");
                td.setAttribute("colspan", columnCount.toString());
                td.textContent = "No results found.";
                td.style.textAlign = "center";
                noResultsRow.appendChild(td);
                tbody.appendChild(noResultsRow);
                actualDisplayedRows = 0;
                console.log(
                    "[radian_filter] processTableRows: All rows removed, showing no results"
                );
            }
        }

        // Update pagination counts
        updatePaginationCounts(actualDisplayedRows);

        showPage(true);
        console.log("[radian_filter] processTableRows: End");
    }

    /**
     * Update pagination counts to reflect the actual number of filtered rows
     */
    function updatePaginationCounts(actualRowCount) {
        try {
            // Primary target: find the pagination element with class "number_styling"
            const paginationElement = document.querySelector(".number_styling");

            if (paginationElement) {
                updateSinglePaginationElement(paginationElement, actualRowCount);
            } else {
                console.log(
                    "[radian_filter] Primary pagination element (.number_styling) not found"
                );
            }

            // Fallback: search for other common pagination patterns
            const alternativePaginationSelectors = [
                ".pagination-info",
                ".results-count",
                ".page-info",
                ".styling_ordering .number_styling", // More specific selector
                '[class*="pagination"] [class*="number"]',
                '[class*="results"] [class*="count"]',
                '[class*="page"] [class*="info"]',
            ];

            let alternativeFound = false;
            alternativePaginationSelectors.forEach((selector) => {
                const elements = document.querySelectorAll(selector);
                elements.forEach((element) => {
                    if (updateSinglePaginationElement(element, actualRowCount)) {
                        alternativeFound = true;
                    }
                });
            });

            // Last resort: search for any element containing pagination-like text pattern
            if (!paginationElement && !alternativeFound) {
                const allElements = document.querySelectorAll("*");
                for (const element of allElements) {
                    const text = element.textContent?.trim() || "";
                    if (text.match(/^\d+\s*-\s*\d+\s*of\s*\d+$/)) {
                        updateSinglePaginationElement(element, actualRowCount);
                        break;
                    }
                }
            }
        } catch (error) {
            console.error("[radian_filter] Error updating pagination counts:", error);
        }
    }

    /**
     * Update a single pagination element
     */
    function updateSinglePaginationElement(element, actualRowCount) {
        try {
            const originalText = element.textContent?.trim() || "";

            // Check if this element contains pagination-like text
            if (!originalText.match(/\d+\s*-\s*\d+\s*of\s*\d+/)) {
                return false;
            }

            // Extract the original total count from the text (e.g., "1 - 10 of 174930")
            const totalMatch = originalText.match(/of\s*(\d+)/);
            const originalTotal = totalMatch ? totalMatch[1] : "0";

            let newText;
            if (actualRowCount === 0) {
                newText = `0 - 0 of ${originalTotal}`;
            } else if (actualRowCount === 1) {
                newText = `1 - 1 of ${originalTotal}`;
            } else {
                // For multiple rows, show 1 to actualRowCount
                newText = `1 - ${actualRowCount} of ${originalTotal}`;
            }

            element.textContent = newText;
            return true;
        } catch (error) {
            console.error(
                "[radian_filter] Error updating single pagination element:",
                error
            );
            return false;
        }
    }

    /**
     * Determine if an element should be hidden based on the loan numbers it contains
     */
    async function shouldHideElement(element) {
        if (
            element.tagName === "SCRIPT" ||
            element.tagName === "STYLE" ||
            element.tagName === "META" ||
            element.tagName === "LINK"
        ) {
            return false;
        }

        const text = element.innerText || element.textContent || "";
        if (!containsLoanNumber(text)) return false;

        const potentialLoanNumbers = extractLoanNumbers(text);
        if (potentialLoanNumbers.length === 0) return false;

        for (const loanNumber of potentialLoanNumbers) {
            if (await isLoanNumberAllowed(loanNumber)) {
                return false;
            }
        }

        return true;
    }

    /**
     * Process the entire page to hide unauthorized loan information
     */
    async function processPage() {
        try {
            await processTableRows();

            showPage(true);
        } catch (error) {
            console.error("Error processing page:", error);
            showPage(true);
        }
    }

    /**
     * Set up mutation observer to monitor DOM changes
     */
    function setupMutationObserver() {
        console.log("[radian_filter] setupMutationObserver");
        const observerState = {
            processingDebounce: null,
            lastProcessed: Date.now(),
            ignoreNextMutations: false,
            isProcessing: false,
            lastTableHash: null,
            processingCount: 0,
            maxProcessingCount: 10, // Prevent infinite loops
            navLinksDebounce: null,
        };

        const observer = new MutationObserver((mutations) => {
            if (observerState.ignoreNextMutations || observerState.isProcessing) {
                return;
            }

            // Prevent processing if we just processed recently (within 3 seconds)
            const timeSinceLastProcess = Date.now() - observerState.lastProcessed;
            if (timeSinceLastProcess < 3000) {
                console.log("[radian_filter] MutationObserver: Skipping - too soon since last process");
                return;
            }

            // Prevent excessive processing
            if (observerState.processingCount >= observerState.maxProcessingCount) {
                console.log("[radian_filter] MutationObserver: Skipping - max processing count reached");
                return;
            }

            if (observerState.processingDebounce) {
                clearTimeout(observerState.processingDebounce);
            }

            let shouldProcess = false;
            let newTableDetected = false;
            let shouldCheckLinks = false;

            // Create a debounced version of hideNavigationLinks to avoid excessive calls
            const debouncedHideNavigationLinks = () => {
                clearTimeout(observerState.navLinksDebounce);
                observerState.navLinksDebounce = setTimeout(() => {
                    hideNavigationLinks();
                }, 300);
            };

            for (const mutation of mutations) {
                if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
                    for (const node of mutation.addedNodes) {
                        if (node.nodeType === 1) {
                            // Check if a table was added
                            if (
                                node.nodeName === "TABLE" ||
                                (node.querySelector && node.querySelector("table"))
                            ) {
                                newTableDetected = true;
                                shouldProcess = true;
                                console.log(
                                    "[radian_filter] MutationObserver: New table detected"
                                );
                                break;
                            }

                            // Check if table rows were added to existing table
                            if (
                                node.nodeName === "TR" ||
                                (node.querySelector && node.querySelector("tr"))
                            ) {
                                const table = getTargetTable();
                                if (table) {
                                    const tbody = table.querySelector("tbody");
                                    if (tbody && tbody.contains(node)) {
                                        shouldProcess = true;
                                        console.log("[radian_filter] MutationObserver: Table rows added");
                                    }
                                }
                            }

                            // Check if tbody was added (common in dynamic tables)
                            if (
                                node.nodeName === "TBODY" ||
                                (node.querySelector && node.querySelector("tbody"))
                            ) {
                                shouldProcess = true;
                                console.log("[radian_filter] MutationObserver: Tbody added");
                            }

                            // Check for navigation elements
                            if (node.querySelector &&
                                (node.querySelector('a') ||
                                    node.querySelector('button') ||
                                    node.querySelector('[role="menuitem"]') ||
                                    node.querySelector('.menu-item'))) {
                                shouldCheckLinks = true;
                            }
                        }
                    }
                }

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

                // Only process attribute changes if they're significant
                if (
                    mutation.type === "attributes" &&
                    mutation.target &&
                    mutation.target.tagName === "TABLE" &&
                    (mutation.attributeName === "class" || mutation.attributeName === "style")
                ) {
                    shouldProcess = true;
                    console.log(
                        "[radian_filter] MutationObserver: Table attribute changed"
                    );
                }
            }

            // Handle navigation links if needed
            if (shouldCheckLinks) {
                console.log("[radian_filter] 🔄 Navigation-related changes detected - re-applying link controls");
                debouncedHideNavigationLinks();
            }

            if (shouldProcess) {
                const delay = newTableDetected ? 1500 : 500; // Longer delay to prevent flickering

                observerState.processingDebounce = setTimeout(async () => {
                    // Check if table content has actually changed
                    const table = getTargetTable();
                    if (table) {
                        const tbody = table.querySelector("tbody");
                        if (tbody) {
                            const currentHash = getTableContentHash(tbody);
                            if (currentHash === observerState.lastTableHash) {
                                console.log("[radian_filter] MutationObserver: No actual change, skipping processing");
                                return; // No actual change, skip processing
                            }
                            observerState.lastTableHash = currentHash;
                        }
                    }

                    observerState.lastProcessed = Date.now();
                    observerState.isProcessing = true;
                    observerState.processingCount++;

                    console.log(
                        "[radian_filter] MutationObserver: Processing changes, newTable:",
                        newTableDetected,
                        "processingCount:",
                        observerState.processingCount
                    );

                    try {
                        if (newTableDetected) {
                            // Wait for table to be fully populated
                            const tableReady = await waitForDynamicTable(15, 400);
                            if (tableReady) {
                                showPage(false);
                                await processPage();
                            } else {
                                console.warn(
                                    "[radian_filter] MutationObserver: New table not ready after waiting"
                                );
                            }
                        } else {
                            // Regular table update
                            await processPage();
                        }
                    } catch (error) {
                        console.error(
                            "[radian_filter] MutationObserver: Error processing changes:",
                            error
                        );
                        showPage(true);
                    } finally {
                        observerState.isProcessing = false;
                    }
                }, delay);
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ["style", "class", "display", "visibility"],
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

        console.log("[radian_filter] Mutation observer setup complete with navigation control");
        return observer;
    }

    /**
     * Wait for table to be available
     */
    async function waitForTable(maxAttempts = 10, delay = 300) {
        console.log(
            "[radian_filter] waitForTable: Start, maxAttempts",
            maxAttempts,
            "delay",
            delay
        );
        for (let i = 0; i < maxAttempts; i++) {
            const table = getTargetTable();
            if (table) {
                console.log("[radian_filter] waitForTable: Table found");
                return true;
            }
            await new Promise((resolve) => setTimeout(resolve, delay));
        }
        console.warn("[radian_filter] waitForTable: Table not found after attempts");
        return false;
    }

    /**
     * Generate a hash of table content to detect actual changes
     */
    function getTableContentHash(tbody) {
        const rows = Array.from(tbody.querySelectorAll("tr"));
        const content = rows.map(row => {
            const cells = Array.from(row.querySelectorAll("td, th"));
            return cells.map(cell => cell.textContent.trim()).join("|");
        }).join("||");

        // Simple hash function
        let hash = 0;
        for (let i = 0; i < content.length; i++) {
            const char = content.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return hash;
    }

    /**
     * Wait for table to be available with longer timeout for dynamic content
     */
    async function waitForDynamicTable(maxAttempts = 30, delay = 500) {
        console.log(
            "[radian_filter] waitForDynamicTable: Start, maxAttempts",
            maxAttempts,
            "delay",
            delay
        );
        for (let i = 0; i < maxAttempts; i++) {
            const table = getTargetTable();
            if (table) {
                // Also check if table has actual data rows
                const tbody = table.querySelector("tbody");
                const rows = tbody ? tbody.querySelectorAll("tr") : [];
                if (rows.length > 0) {
                    console.log(
                        "[radian_filter] waitForDynamicTable: Table with data found"
                    );
                    return true;
                }
            }
            await new Promise((resolve) => setTimeout(resolve, delay));
        }
        console.warn(
            "[radian_filter] waitForDynamicTable: Table with data not found after attempts"
        );
        return false;
    }

    /**
     * Manually refresh pagination counts based on current table state
     */
    function refreshPaginationCounts() {
        try {
            const table = getTargetTable();
            if (!table) {
                console.warn("[radian_filter] refreshPaginationCounts: Table not found");
                return;
            }

            const tbody = table.querySelector("tbody");
            if (!tbody) {
                console.warn("[radian_filter] refreshPaginationCounts: Tbody not found");
                return;
            }

            // Count actual data rows (exclude rows with colspan like messages and hidden rows)
            const dataRows = Array.from(tbody.querySelectorAll("tr")).filter((row) => {
                return row.style.display !== "none" && !(row.cells.length === 1 && row.cells[0].hasAttribute("colspan"));
            });

            updatePaginationCounts(dataRows.length);
        } catch (error) {
            console.error("[radian_filter] Error refreshing pagination counts:", error);
        }
    }
    /**
     * Set up event listeners for table updates
     */
    function setupTableUpdateListeners() {
        console.log("[radian_filter] setupTableUpdateListeners");

        let isProcessingSearch = false;

        // Listen for Enter key in search inputs
        const searchInputs = document.querySelectorAll('input[type="text"]');
        searchInputs.forEach((input) => {
            input.addEventListener("keypress", (e) => {
                if (e.key === "Enter") {
                    if (isProcessingSearch) {
                        e.preventDefault();
                        return; // Prevent multiple simultaneous searches
                    }

                    console.log(
                        "[radian_filter] Search input Enter pressed, preparing for table update"
                    );
                    isProcessingSearch = true;
                    showPage(false);

                    setTimeout(async () => {
                        const tableReady = await waitForDynamicTable(20, 500);
                        if (tableReady) {
                            await processPage();
                        } else {
                            showPage(true);
                        }
                        isProcessingSearch = false;
                    }, 1500);
                }
            });
        });
    }

    /**
     * Initialize the filter script
     */
    async function initialize() {
        console.log("[radian_filter] initialize: Start");
        try {
            await waitForListener();

            // Hide navigation links after successful connection
            hideNavigationLinks();

            // Wait a bit longer for initial page load to complete
            await new Promise(resolve => setTimeout(resolve, 2000));

            const initialTable = getTargetTable();

            console.log(
                "[radian_filter] initialize: Initial table exists:",
                !!initialTable
            );

            if (initialTable) {
                console.log(
                    "[radian_filter] initialize: Initial table found, processing immediately"
                );
                showPage(false);

                const tableReady = await waitForTable();
                if (tableReady) {
                    await processPage();
                } else {
                    showPage(true);
                    console.warn("[radian_filter] initialize: Initial table not ready");
                }
            } else {
                console.log(
                    "[radian_filter] initialize: No table and no search functionality - showing page as-is"
                );
                showPage(true);
            }

            // Always set up the mutation observer to watch for dynamic table creation
            setupMutationObserver();

            // Set up event listeners for search operations
            setupTableUpdateListeners();

            // Set up periodic table check as fallback for dynamic content
            setupPeriodicTableCheck();

            console.log("[radian_filter] initialize: Complete");
        } catch (error) {
            showPage(true);
            console.error("[radian_filter] initialize: Error", error);
        }
    }

    /**
     * Periodic check for new tables (fallback for mutation observer)
     */
    function setupPeriodicTableCheck() {
        console.log("[radian_filter] setupPeriodicTableCheck: Starting periodic checks");
        let lastTableCheck = 0;
        const checkInterval = 5000; // Check every 5 seconds (increased to reduce flickering)
        let lastTableHash = null;

        setInterval(async () => {
            const now = Date.now();
            if (now - lastTableCheck < checkInterval) {
                return;
            }

            const table = getTargetTable();
            if (table) {
                const tbody = table.querySelector("tbody");
                if (!tbody) {
                    return;
                }

                const currentHash = getTableContentHash(tbody);

                // Only process if table content has actually changed
                if (currentHash !== lastTableHash) {
                    const rows = tbody.querySelectorAll("tr");

                    // Check if this is a new table with data that we haven't processed
                    if (rows.length > 0) {
                        // Check if any row contains unprocessed loan data
                        let hasUnprocessedData = false;
                        for (const row of rows) {
                            if (row.cells && row.cells.length > 2) {
                                const cellText = row.cells[2].textContent.trim();
                                if (cellText && /\b\d{5,}\b/.test(cellText)) {
                                    hasUnprocessedData = true;
                                    break;
                                }
                            }
                        }

                        if (hasUnprocessedData) {
                            console.log(
                                "[radian_filter] setupPeriodicTableCheck: Found unprocessed table data, processing..."
                            );
                            showPage(false);
                            await processPage();
                            lastTableCheck = now;
                            lastTableHash = currentHash;
                        }
                    }
                }
            }
        }, checkInterval);
    }

    // Initialize the script when DOM is ready
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => {
            window.addEventListener("load", () => {
                setTimeout(() => {
                    initialize();
                }, 1000);
            });
        });
    } else if (document.readyState === "interactive") {
        window.addEventListener("load", () => {
            setTimeout(() => {
                initialize();
            }, 1000);
        });
    } else {
        setTimeout(() => {
            initialize();
        }, 1000);
    }

    window.radianFilter = {
        refreshPaginationCounts,
        updatePaginationCounts,
        processPage,
        allowedLoansCache,
    };

}

/**
 * VIEW CLAIMS FILTER
 * URL: https://www.mionline.biz/Claims/Search
 */
async function initializeViewClaimsFilter() {
    Logger.log("Initializing View Claims Filter");
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
            console.log("allowedLoans",allowedLoans);

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
     * Set up mutation observer to handle dynamic navigation content
     */
    function setupNavigationMutationObserver() {
        if (window.servicerNavMutationObserver) {
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

            // Check if URL changed (navigation happened)
            if (lastUrl !== window.location.href) {
                lastUrl = window.location.href;
                console.log("[servicer_loan_filter] 🔄 URL changed - will re-apply navigation controls");
                shouldCheckLinks = true;
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

                // For added nodes, check for navigation elements
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
                        }
                    }
                }
            });

            // Handle navigation links if needed
            if (shouldCheckLinks) {
                console.log("[servicer_loan_filter] 🔄 Navigation-related changes detected - re-applying link controls");
                debouncedHideNavigationLinks();
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
        window.servicerNavMutationObserver = observer;
        window.servicerNavPeriodicCheck = periodicCheckInterval;

        console.log("[servicer_loan_filter] ✅ Enhanced mutation observer set up for dynamic content and navigation");
    }

    /**
     * Initialize the script and check loan access
     */
    async function initializeServicerLoanFilter() {
        console.log("[servicer_loan_filter] 🚀 Initializing servicer loan filter...");

        try {
            // First, establish connection with the extension
            console.log("[servicer_loan_filter] 🔗 Establishing connection with extension...");
            await waitForListener();
            console.log("[servicer_loan_filter] ✅ Extension connection established successfully");

            // Hide navigation links after successful connection
            hideNavigationLinks();
            const isRestricted = checkRestrictedUrl();
      if (isRestricted) {
        console.log("Restricted Page Detected");
        return;
      }

            // Start monitoring for loan element to appear
            startElementMonitoring();

            // Start URL change monitoring
            monitorURLChanges();

            // Set up mutation observer for dynamic content
            setupNavigationMutationObserver();

        } catch (error) {
            console.error("[servicer_loan_filter] ❌ Failed to establish extension connection:", error);
            console.warn("[servicer_loan_filter] ⚠️ Script will not function without extension connection");
        }
    }

    // Start the script when DOM is ready
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initializeServicerLoanFilter);
    } else {
        // DOM is already ready
        initializeServicerLoanFilter();
    }
}
/**
 *VIEW CLAIMS REPORTS FILTER
 *URL: https://www.mionline.biz/Claims/Reports
 */
async function initializeClaimsReportsFilter() {
    Logger.log("Intializing Claims Reports Filter");

    // ########## IMPROVED TABLE FILTER WITH PROPER CONTROLS ##########

    /**
     * Global state management
     */
    const TableFilterState = {
        isInitialized: false,
        isProcessing: false,
        isTableFound: false,
        isTableProcessed: false,
        observer: null,
        timeoutId: null,
        maxWaitTime: 30000, // 30 seconds max wait time
        checkInterval: 2000, // Check every 2 seconds
        startTime: null
    };

    /**
     * Enhanced logging function with timestamps
     */
    function log(message, level = 'info') {
        const timestamp = new Date().toISOString();
        const prefix = `[table_loan_filter:${timestamp}]`;

        switch (level) {
            case 'error':
                console.error(`${prefix} ❌ ${message}`);
                break;
            case 'warn':
                console.warn(`${prefix} ⚠️ ${message}`);
                break;
            case 'success':
                console.log(`${prefix} ✅ ${message}`);
                break;
            default:
                console.log(`${prefix} ℹ️ ${message}`);
        }
    }

    /**
     * Check if current page is the specific Claims Reports page with the target table
     */
    function isClaimsReportsPage(doc = document) {
        log('Checking if current page is Claims Reports page...');

        // Primary check: Look for the specific claims table
        const claimsTable = doc.querySelector("#ClaimsGridView");
        if (!claimsTable) {
            log('ClaimsGridView table not found', 'warn');
            return false;
        }

        // Secondary checks to ensure this is the correct page
        const hasClaimsContent = doc.querySelector(".claims-content") ||
            doc.querySelector("[id*='Claims']") ||
            doc.body?.textContent?.includes("Claims") ||
            doc.body?.textContent?.includes("Report");

        // Check for specific table structure
        const hasCorrectTableStructure = claimsTable.querySelector("tr.text-black") !== null;

        log(`Claims table found: ${!!claimsTable}, Claims content: ${!!hasClaimsContent}, Correct structure: ${hasCorrectTableStructure}`);

        return !!(claimsTable && hasClaimsContent && hasCorrectTableStructure);
    }

    /**
     * Check if table has loaded with actual data
     */
    function isTableLoaded(doc = document) {
        const claimsTable = doc.querySelector("#ClaimsGridView");
        if (!claimsTable) {
            return false;
        }

        // Check if table has data rows (excluding header and pagination)
        const dataRows = claimsTable.querySelectorAll("tr.text-black");
        const hasData = dataRows.length > 0;

        // Check if table is visible
        const isVisible = claimsTable.offsetParent !== null &&
            claimsTable.style.display !== 'none' &&
            claimsTable.style.visibility !== 'hidden';

        log(`Table loaded check - Data rows: ${dataRows.length}, Visible: ${isVisible}`);

        return hasData && isVisible;
    }

    /**
     * Stop all monitoring and cleanup
     */
    function stopMonitoring() {
        log('Stopping all monitoring and cleanup...');

        if (TableFilterState.observer) {
            TableFilterState.observer.disconnect();
            TableFilterState.observer = null;
        }

        if (TableFilterState.timeoutId) {
            clearTimeout(TableFilterState.timeoutId);
            TableFilterState.timeoutId = null;
        }

        TableFilterState.isInitialized = false;
        TableFilterState.isProcessing = false;

        log('Monitoring stopped successfully', 'success');
    }

    /**
     * Create and inject CSS styles for the loan filter loader
     */
    function createLoaderStyles() {
        const existingStyle = document.getElementById("loanFilterStyles");
        if (existingStyle) {
            return; // Styles already exist
        }

        const style = document.createElement("style");
        style.id = "loanFilterStyles";
        style.textContent = `
    #loanFilterLoader {
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
    .loan-filter-spinner {
      width: 50px;
      height: 50px;
      border: 5px solid #ccc;
      border-top-color: #007bff;
      border-radius: 50%;
      animation: loanFilterSpin 1s linear infinite;
    }
    @keyframes loanFilterSpin {
      to {transform: rotate(360deg);}
    }
    #loanFilterLoader.hidden {
      opacity: 0;
      pointer-events: none;
    }
  `;

        const documentHead = document.head;
        if (documentHead) {
            documentHead.appendChild(style);
        }
    }

    /**
     * Create loader element structure using safe DOM manipulation
     */
    function createLoaderElement() {
        const loader = document.createElement("div");
        loader.id = "loanFilterLoader";

        // Create container div
        const containerDiv = document.createElement("div");
        containerDiv.style.textAlign = "center";

        // Create spinner div
        const spinner = document.createElement("div");
        spinner.className = "loan-filter-spinner";

        // Create text div
        const textDiv = document.createElement("div");
        textDiv.style.marginTop = "15px";
        textDiv.style.fontSize = "16px";
        textDiv.style.color = "#007bff";
        textDiv.style.fontWeight = "500";
        textDiv.textContent = "Filtering loan records...";

        // Assemble the structure
        containerDiv.appendChild(spinner);
        containerDiv.appendChild(textDiv);
        loader.appendChild(containerDiv);

        return loader;
    }

    /**
     * Create and display the loan filter loader
     */
    function createAndDisplayLoader(targetDoc = document) {
        log('Creating and displaying loader...');

        // Ensure styles are injected
        createLoaderStyles();

        // Create loader element
        const loader = createLoaderElement();

        // Safely append to document body
        const documentBody = targetDoc.body;
        if (documentBody) {
            documentBody.appendChild(loader);
            log('Loader displayed successfully', 'success');
        } else {
            log('Document body not available for loader insertion', 'error');
        }
    }

    /**
     * Hide and remove the loan filter loader with safe DOM manipulation
     */
    function hideAndRemoveLoader(targetDoc = document) {
        log('Hiding and removing loader...');

        const loader = targetDoc.getElementById("loanFilterLoader");
        if (loader) {
            loader.classList.add("hidden");
            setTimeout(() => {
                if (loader.parentNode) {
                    loader.parentNode.removeChild(loader);
                    log('Loader removed successfully', 'success');
                }
            }, 300);
        }
    }

    /**
     * Create "No Records Found" message using safe DOM manipulation
     */
    function createNoAuthorizedRecordsMessage() {
        // Create main container
        const messageContainer = document.createElement("div");

        // Create inner content container
        const contentContainer = document.createElement("div");
        contentContainer.style.display = "flex";
        contentContainer.style.justifyContent = "center";
        contentContainer.style.alignItems = "center";
        contentContainer.style.height = "200px";
        contentContainer.style.backgroundColor = "#f8f9fa";
        contentContainer.style.border = "2px solid #6c757d";
        contentContainer.style.borderRadius = "8px";
        contentContainer.style.margin = "20px";
        contentContainer.style.color = "#6c757d";
        contentContainer.style.fontSize = "18px";
        contentContainer.style.fontWeight = "500";
        contentContainer.style.textAlign = "center";

        // Create inner text container
        const textContainer = document.createElement("div");

        // Create icon element
        const iconElement = document.createElement("i");
        iconElement.className = "fas fa-info-circle";
        iconElement.style.fontSize = "24px";
        iconElement.style.marginBottom = "10px";
        iconElement.style.display = "block";

        // Create text element
        const textElement = document.createElement("div");
        textElement.textContent = "No authorized loan records found";

        // Assemble the structure
        textContainer.appendChild(iconElement);
        textContainer.appendChild(textElement);
        contentContainer.appendChild(textContainer);
        messageContainer.appendChild(contentContainer);

        return messageContainer;
    }

    /**
     * Extract loan numbers from table rows with safe DOM access
     */
    function extractLoanNumbersFromTableRows(dataRows) {
        log(`Extracting loan numbers from ${dataRows.length} rows...`);

        const loanNumbers = [];
        const rowLoanMap = new Map();

        if (!dataRows || dataRows.length === 0) {
            log('No data rows found', 'warn');
            return { loanNumbers, rowLoanMap };
        }

        dataRows.forEach((row, index) => {
            if (!row) return;

            // Servicer Loan Number is in the second column (index 1)
            const servicerLoanCell = row.querySelector("td:nth-child(2)");

            if (servicerLoanCell) {
                const loanNumber = servicerLoanCell.textContent?.trim();
                if (loanNumber && loanNumber !== "&nbsp;" && loanNumber !== "") {
                    loanNumbers.push(loanNumber);
                    rowLoanMap.set(row, loanNumber);
                    log(`Row ${index + 1}: Found loan number ${loanNumber}`);
                }
            }
        });

        log(`Extracted ${loanNumbers.length} loan numbers`, 'success');
        return { loanNumbers, rowLoanMap };
    }

    /**
     * Apply loan authorization filtering to table rows
     */
    function applyLoanAuthorizationFilter(rowLoanMap, authorizedLoans) {
        log(`Applying authorization filter to ${rowLoanMap.size} rows with ${authorizedLoans.length} authorized loans...`);

        let visibleRowCount = 0;
        let hiddenRowCount = 0;

        if (!rowLoanMap || !authorizedLoans) {
            log('Invalid parameters for loan authorization filtering', 'error');
            return visibleRowCount;
        }

        rowLoanMap.forEach((loanNumber, row) => {
            if (!row) return;

            if (authorizedLoans.includes(loanNumber)) {
                // Loan is authorized - keep the row visible
                row.style.display = "";
                visibleRowCount++;
                log(`Row authorized: ${loanNumber}`);
            } else {
                // Loan is restricted - hide the row
                row.style.display = "none";
                hiddenRowCount++;
                log(`Row hidden: ${loanNumber}`);
            }
        });

        log(`Filtering complete - Visible: ${visibleRowCount}, Hidden: ${hiddenRowCount}`, 'success');
        return visibleRowCount;
    }

    /**
     * Update pagination display based on filtered results
     */
    function updatePaginationDisplay(
        visibleRowCount,
        totalRowCount,
        targetDoc = document
    ) {
        log(`Updating pagination display - Visible: ${visibleRowCount}, Total: ${totalRowCount}`);

        try {
            // Find the pagination row with the results text
            const paginationRow = targetDoc.querySelector(
                ".pagingDiv.pagingDivNewStyle td"
            );

            if (paginationRow) {
                // Extract original total from existing text or use totalRowCount parameter
                const currentText = paginationRow.textContent.trim();
                const totalMatch = currentText.match(/of\s+(\d+)\s+results/i);
                const originalTotal = totalMatch
                    ? parseInt(totalMatch[1])
                    : totalRowCount;

                // Update pagination text based on visible count
                if (visibleRowCount === 0) {
                    paginationRow.textContent = `Displaying 0-0 of ${originalTotal} results`;
                } else {
                    paginationRow.textContent = `Displaying 1-${visibleRowCount} of ${originalTotal} results`;
                }

                log(`Pagination updated successfully`, 'success');
            } else {
                log('Pagination element not found for update', 'warn');
            }
        } catch (error) {
            log(`Error updating pagination display: ${error}`, 'error');
        }
    }

    /**
     * Handle case when no authorized records are found
     */
    function handleNoAuthorizedRecords(claimsTable) {
        log('Handling case when no authorized records found...');

        if (!claimsTable) {
            log('Claims table not available for no records handling', 'error');
            return;
        }

        const tableContainer = claimsTable.closest("#divClaimsGridView");
        if (tableContainer) {
            // Hide the original table
            claimsTable.style.display = "none";

            // Add "No Records Found" message
            const noRecordsMessage = createNoAuthorizedRecordsMessage();
            tableContainer.appendChild(noRecordsMessage);

            log('No records message displayed', 'success');
        }
    }

    /**
     * Main function to filter table rows based on servicer loan numbers
     */
    async function filterTableByAuthorizedLoanNumbers(targetDoc = document) {
        if (TableFilterState.isProcessing) {
            log('Processing already in progress, skipping...', 'warn');
            return;
        }

        if (TableFilterState.isTableProcessed) {
            log('Table already processed, skipping...', 'warn');
            return;
        }

        log('Starting table filtering process...');
        TableFilterState.isProcessing = true;

        try {
            // Show loader
            createAndDisplayLoader(targetDoc);

            // Find the claims table with null check
            const claimsTable = targetDoc.getElementById("ClaimsGridView");

            if (!claimsTable) {
                log('ClaimsGridView table not found', 'error');
                hideAndRemoveLoader(targetDoc);
                return;
            }

            // Get all data rows (excluding header row) with null check
            const dataRows = claimsTable.querySelectorAll("tr.text-black");

            if (!dataRows || dataRows.length === 0) {
                log('No data rows found in table', 'warn');
                hideAndRemoveLoader(targetDoc);
                return;
            }

            log(`Found ${dataRows.length} data rows to process`);

            // Extract all servicer loan numbers from the table
            const { loanNumbers, rowLoanMap } =
                extractLoanNumbersFromTableRows(dataRows);

            if (loanNumbers.length === 0) {
                log('No loan numbers extracted from table', 'warn');
                hideAndRemoveLoader(targetDoc);
                return;
            }

            console.log(loanNumbers, "Checking authorization for loan numbers");

            // Check which loans are authorized
            const authorizedLoans = await checkNumbersBatch(loanNumbers);

            console.log(authorizedLoans, "Authorized loans");

            if (!authorizedLoans) {
                console.log("Failed to retrieve authorized loans", loanNumbers);
                log('Failed to retrieve authorized loans', 'error');
                hideAndRemoveLoader(targetDoc);
                return;
            }


            // Apply loan authorization filtering
            const visibleRowCount = applyLoanAuthorizationFilter(
                rowLoanMap,
                authorizedLoans
            );

            // Update pagination display with filtered results
            updatePaginationDisplay(visibleRowCount, dataRows.length, targetDoc);

            // Handle case when no rows are visible
            if (visibleRowCount === 0) {
                handleNoAuthorizedRecords(claimsTable);
            }

            // Mark table as processed
            TableFilterState.isTableProcessed = true;

            log(`Table filtering completed successfully. Visible rows: ${visibleRowCount}`, 'success');

            // Stop monitoring since we've processed the table
            stopMonitoring();

            hideAndRemoveLoader(targetDoc);
        } catch (error) {
            log(`Error during loan filtering: ${error}`, 'error');
            hideAndRemoveLoader(targetDoc);
        } finally {
            TableFilterState.isProcessing = false;
        }
    }

    /**
     * Wait for table to load with timeout
     */
    function waitForTableLoad(targetDoc = document) {
        return new Promise((resolve, reject) => {
            log('Waiting for table to load...');

            const startTime = Date.now();

            function checkTable() {
                const elapsed = Date.now() - startTime;

                if (elapsed > TableFilterState.maxWaitTime) {
                    log(`Timeout waiting for table (${TableFilterState.maxWaitTime}ms)`, 'error');
                    reject(new Error('Table load timeout'));
                    return;
                }

                if (isTableLoaded(targetDoc)) {
                    log('Table loaded successfully', 'success');
                    resolve(true);
                    return;
                }

                // Continue checking
                TableFilterState.timeoutId = setTimeout(checkTable, TableFilterState.checkInterval);
            }

            checkTable();
        });
    }

    /**
     * Initialize the loan filter with proper controls
     */
    async function initializeLoanAuthorizationFilter() {
        if (TableFilterState.isInitialized) {
            log('Filter already initialized, skipping...', 'warn');
            return;
        }

        log('🚀 Initializing table loan filter...');
        TableFilterState.startTime = Date.now();

        try {
            // Wait for extension listener
            await waitForListener();
            log('Extension listener ready', 'success');

            // Hide navigation links after successful connection
            hideNavigationLinks();

            // Set up mutation observer for dynamic content
            setupNavigationMutationObserver();

            // Check if this is the correct page
            if (!isClaimsReportsPage()) {
                log('Not on Claims Reports page, stopping initialization', 'warn');
                return;
            }

            log('On correct Claims Reports page, proceeding...', 'success');

            // Wait for table to load
            await waitForTableLoad();

            // Process the table
            await filterTableByAuthorizedLoanNumbers();

            log('Table filter initialization completed successfully', 'success');

        } catch (error) {
            log(`Initialization failed: ${error}`, 'error');
            stopMonitoring();
        } finally {
            TableFilterState.isInitialized = true;
        }
    }
    /**
     * Set up mutation observer to handle dynamic navigation content
     */
    function setupNavigationMutationObserver() {
        if (window.tableNavMutationObserver) {
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

            // Check if URL changed (navigation happened)
            if (lastUrl !== window.location.href) {
                lastUrl = window.location.href;
                log('URL changed - will re-apply navigation controls');
                shouldCheckLinks = true;
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

                // For added nodes, check for navigation elements
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
                        }
                    }
                }
            });

            // Handle navigation links if needed
            if (shouldCheckLinks) {
                log('Navigation-related changes detected - re-applying link controls');
                debouncedHideNavigationLinks();
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
        window.tableNavMutationObserver = observer;
        window.tableNavPeriodicCheck = periodicCheckInterval;

        log('Enhanced mutation observer set up for dynamic content and navigation', 'success');
    }

    /**
     * Emergency stop function (globally accessible)
     */
    function emergencyStop() {
        log('🛑 EMERGENCY STOP - Halting all operations...', 'error');
        stopMonitoring();
        TableFilterState.isTableProcessed = true; // Prevent further processing
    }

    // Make emergency stop globally accessible
    window.stopTableLoanFilter = emergencyStop;

    // Start the script only if DOM is ready
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initializeLoanAuthorizationFilter);
    } else {
        // DOM is already ready
        initializeLoanAuthorizationFilter();
    }
}
// ########## INITIALIZATION ##########
// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeFilter);
} else {
    initializeFilter();
}