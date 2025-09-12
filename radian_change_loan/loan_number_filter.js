/*!
 * @description : Radian Loan Number Change Filter Script (Optimized)
 * @portal : Radian Servicing Change Loan Number
 * @author : Radian Team
 * @group : Radian Team
 * @owner : Radian
 * @lastModified : 2024
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

      console.log(`Sending ping attempt ${attempts + 1}/${maxRetries}...`);

      chrome.runtime.sendMessage(
        EXTENSION_ID,
        { type: "ping" },
        (response) => {
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
    }

    sendPing();
  });
}

/**
 * Request a batch of numbers from the storage script
 */
async function checkNumbersBatch(numbers) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      EXTENSION_ID,
      { type: "queryLoans", loanIds: numbers },
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

/**
 * Optimized logger utility
 */
const logger = {
  debug: (...args) => console.debug('[LoanNumberFilter]', ...args),
  info: (...args) => console.info('[LoanNumberFilter]', ...args),
  warn: (...args) => console.warn('[LoanNumberFilter]', ...args),
  error: (...args) => console.error('[LoanNumberFilter]', ...args),
};

// Optimized configuration
const CONFIG = {
  tableId: "_GrdLoanNumberChange",
  tableClass: "resultsTable",
  detectionTimeout: 120000, // 2 minutes for slow-loading live site
  checkInterval: 2000, // Check every 2 seconds to reduce CPU usage
  maxAttempts: 60, // 60 attempts * 2 seconds = 2 minutes
  domChangeDebounce: 300,
  loanExtractionResetDelay: 500,
  presenceCheckInterval: 10000,
  validationDebounce: 500
};

// Optimized state management
const state = {
  tableDetectionTimer: null,
  isTableDetected: false,
  currentUrl: window.location.href,
  tablePresenceCheckTimer: null,
  domChangeTimer: null,
  mutationObserver: null,
  lastTableContent: null,
  loanExtractionResetTimer: null,
  table: null,
  loanInputs: new Set(),
  errorElements: new Set(),
  validationCache: new Map()
};

// Optimized DOM utilities
const DOM = {
  // Cache DOM queries
  getTable() {
    if (!state.table || !state.table.isConnected) {
      state.table = document.getElementById(CONFIG.tableId);
    }
    return state.table;
  },

  getLoanInputs() {
    const table = this.getTable();
    if (!table) return [];

    const inputs = table.querySelectorAll('input[id*="_TxtLoanNumber"]');
    // Update our cached set
    state.loanInputs.clear();
    inputs.forEach(input => state.loanInputs.add(input));
    return inputs;
  },

  // Efficient content hash generation
  getContentHash() {
    const table = this.getTable();
    if (!table) return null;

    try {
      const inputs = this.getLoanInputs();
      if (inputs.length === 0) return null;

      // Use a more efficient hash method
      let hash = 0;
      for (const input of inputs) {
        const value = input.value.trim();
        const disabled = input.disabled;
        const hasError = !!input.parentNode.querySelector('.error-msg');

        // Simple but effective hash
        hash = ((hash << 5) - hash + value.length + (disabled ? 1 : 0) + (hasError ? 1 : 0)) | 0;
      }
      return hash;
    } catch (error) {
      console.warn('Error generating content hash:', error);
      return null;
    }
  },

  // Efficient error element creation
  createErrorElement() {
    const error = document.createElement("div");
    error.textContent = "You are not provisioned to access restricted loan";
    error.className = "error-msg";
    error.style.cssText = "color: red; font-size: 0.9em; margin-top: 5px; font-weight: bold;";
    return error;
  },

  // Batch DOM operations
  resetInputStyling(input) {
    input.style.border = '';
    input.disabled = false;
    input.style.backgroundColor = '';
    input.style.cursor = '';
  },

  // Efficient error cleanup
  clearErrors() {
    state.errorElements.forEach(error => {
      if (error.isConnected) error.remove();
    });
    state.errorElements.clear();
  },

};

// Optimized timer management
const TimerManager = {
  timers: new Set(),

  setTimeout(callback, delay) {
    const timer = setTimeout(callback, delay);
    this.timers.add(timer);
    return timer;
  },

  setInterval(callback, delay) {
    const timer = setInterval(callback, delay);
    this.timers.add(timer);
    return timer;
  },

  clearAll() {
    this.timers.forEach(timer => {
      clearTimeout(timer);
      clearInterval(timer);
    });
    this.timers.clear();
  }
};

// Optimized validation system
const ValidationSystem = {
  // Track active validation state
  isValidating: false,

  // Debounced validation with cache
  async validateInput(input, showLoader = false) {
    const loanNumber = input.value.trim();
    if (!loanNumber) return true;

    // Check cache first
    if (state.validationCache.has(loanNumber)) {
      return state.validationCache.get(loanNumber);
    }

    // Show loader if requested
    if (showLoader) {
      LoaderManager.show(`Verifying loan number ${loanNumber}...`);
      this.isValidating = true;
    }

    // Reset styling
    DOM.resetInputStyling(input);
    const existingError = input.parentNode.querySelector(".error-msg");
    if (existingError) existingError.remove();

    try {
      const allowedLoans = await checkNumbersBatch([loanNumber]);
      const isValid = allowedLoans.length > 0;

      // Cache result
      state.validationCache.set(loanNumber, isValid);

      if (!isValid) {
        input.style.cssText = "border: 2px solid red; background-color: #f5f5f5; cursor: not-allowed;";
        input.disabled = true;
        const errorElement = DOM.createErrorElement();
        input.parentNode.appendChild(errorElement);
        state.errorElements.add(errorElement);
      }

      return isValid;
    } catch (error) {
      console.error("❌ Error checking loan number:", error);
      return false;
    }
  },

  // Batch validation
  async validateAllInputs() {
    const inputs = DOM.getLoanInputs();
    if (inputs.length === 0) {
      return [];
    }

    // Only validate inputs that have loan numbers
    const inputsWithValues = inputs.filter(input => input.value.trim());
    if (inputsWithValues.length === 0) {
      return [];
    }

    try {
      // Show loader only when we have loan numbers to validate
      this.isValidating = true;
      LoaderManager.show("Verifying loan access permissions...");

      // Process inputs in sequence for better UX feedback
      const results = [];
      for (let i = 0; i < inputsWithValues.length; i++) {
        const input = inputsWithValues[i];
        const loanNumber = input.value.trim();

        LoaderManager.updateText(`Verifying loan ${i + 1} of ${inputsWithValues.length}: ${loanNumber}`);
        const result = await this.validateInput(input, false); // Don't show loader again
        results.push(result);
      }

      return results;
    } finally {
      this.isValidating = false;
      LoaderManager.hide();
    }
  },

  // Setup validation for inputs
  setupValidation() {
    const inputs = DOM.getLoanInputs();

    inputs.forEach(input => {
      if (input._hasValidationListeners) return;

      // Debounced input validation
      let timeout;
      const debouncedValidation = () => {
        clearTimeout(timeout);
        timeout = TimerManager.setTimeout(() => {
          // Only validate if we have a value and not in batch validation
          if (input.value.trim() && !this.isValidating) {
            this.validateInput(input, true);
          }
        }, CONFIG.validationDebounce);
      };

      // Event listeners
      input.addEventListener("blur", () => {
        if (input.value.trim() && !this.isValidating) {
          this.validateInput(input, true);
        }
      });

      input.addEventListener("input", debouncedValidation);

      input.addEventListener("focus", () => {
        if (input.value.trim() && !this.isValidating) {
          this.validateInput(input, true);
        }
      });

      // Monitor for programmatic value changes using property descriptor
      this.setupValueChangeMonitoring(input);

      input._hasValidationListeners = true;
    });
  },

  // Monitor for programmatic value changes without polling
  setupValueChangeMonitoring(input) {
    let lastValue = input.value;

    // Override the value setter to detect programmatic changes
    const originalDescriptor = Object.getOwnPropertyDescriptor(input, 'value') ||
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');

    if (originalDescriptor && originalDescriptor.set) {
      const originalSetter = originalDescriptor.set;

      Object.defineProperty(input, 'value', {
        get: originalDescriptor.get,
        set: function (newValue) {
          originalSetter.call(this, newValue);

          // Check if this is a programmatic change with a meaningful value
          if (newValue !== lastValue && newValue && newValue.trim()) {
            lastValue = newValue;
            console.log('🔄 Programmatic value change detected:', newValue);

            // Trigger validation immediately - loader will be shown inside validateInput
            setTimeout(() => {
              ValidationSystem.validateInput(input, true);
            }, 100);
          }
        },
        configurable: true
      });
    }
  }
};

// Optimized DOM monitoring for dynamic content
const DOMMonitor = {
  setupObserver() {
    // Disconnect existing observer
    if (state.mutationObserver) {
      state.mutationObserver.disconnect();
    }

    // Enhanced observer that watches the entire document for dynamic loan number inputs and navigation changes
    state.mutationObserver = new MutationObserver((mutations) => {
      let hasRelevantChanges = false;
      let hasNewLoanInputs = false;
      let hasNavigationChanges = false;

      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              // Check if the added node is a loan input or contains loan inputs
              if (node.matches && node.matches('input[id*="_TxtLoanNumber"]')) {
                hasRelevantChanges = true;
                hasNewLoanInputs = true;
                break;
              }
              if (node.querySelector && node.querySelector('input[id*="_TxtLoanNumber"]')) {
                hasRelevantChanges = true;
                hasNewLoanInputs = true;
                break;
              }
              
              // Check for navigation elements
              if (node.matches && (node.matches('a') || node.matches('button') || 
                  node.matches('[role="menuitem"]') || node.matches('[role="button"]') ||
                  node.matches('.menu-item') || node.matches('.nav-link'))) {
                hasNavigationChanges = true;
              }
              if (node.querySelector && (node.querySelector('a') || node.querySelector('button') ||
                  node.querySelector('[role="menuitem"]') || node.querySelector('.menu-item'))) {
                hasNavigationChanges = true;
              }
            }
          }
        } else if (mutation.type === 'attributes') {
          const target = mutation.target;
          if (target.matches && target.matches('input[id*="_TxtLoanNumber"]') &&
              (mutation.attributeName === 'value' || mutation.attributeName === 'disabled')) {
            hasRelevantChanges = true;
          } else if (target.matches && (target.matches('a') || target.matches('button') ||
                     target.matches('[role="menuitem"]') || target.matches('[role="button"]') ||
                     target.matches('.menu-item') || target.matches('.nav-link'))) {
            hasNavigationChanges = true;
          }
        }
      }

      // Handle navigation changes immediately
      if (hasNavigationChanges) {
        logger.debug("🔄 Navigation changes detected - re-applying link controls");
        hideNavigationLinks();
      }

      if (hasRelevantChanges) {
        this.handleChange(hasNewLoanInputs);
      }
    });

    // Observe the entire document for maximum coverage of dynamic content
    state.mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['value', 'disabled', 'style', 'class']
    });

    logger.info("✅ DOM observer is now listening for table and loan number changes...");
  },

  handleChange(hasNewLoanInputs = false) {
    if (state.domChangeTimer) {
      clearTimeout(state.domChangeTimer);
    }

    state.domChangeTimer = TimerManager.setTimeout(() => {
      const currentHash = DOM.getContentHash();
      if (currentHash !== state.lastTableContent) {
        state.lastTableContent = currentHash;
        this.resetAndRevalidate(hasNewLoanInputs);
      }
    }, CONFIG.domChangeDebounce);
  },

  async resetAndRevalidate(hasNewLoanInputs = false) {
    console.log('🔄 Resetting loan extraction and re-validating...');

    try {
      const table = DOM.getTable();

      // Clear previous errors and cached results to force a fresh extraction/validation
      DOM.clearErrors();
      state.validationCache.clear();

      if (table) {
        const inputs = DOM.getLoanInputs();
        inputs.forEach(input => DOM.resetInputStyling(input));
      }

      ValidationSystem.setupValidation();

      // Only validate if we have loan numbers to check
      const inputs = DOM.getLoanInputs();
      const hasLoanNumbers = inputs.some(input => input.value.trim());

      if (hasLoanNumbers) {
        await ValidationSystem.validateAllInputs();
      }

      console.log('✅ Loan extraction reset completed');
    } catch (error) {
      console.error('❌ Error during loan extraction reset:', error);
    }
  }
};

// Optimized table detection with continuous monitoring
const TableDetector = {
  startDetection() {
    if (state.isTableDetected) return;

    logger.info("🔄 Starting table detection (2-minute timeout)...");
    logger.info("📡 Setting up DOM observer to listen for table changes...");

    // Set up DOM observer immediately for dynamic content detection
    DOMMonitor.setupObserver();

    let attempts = 0;

    const detect = () => {
      attempts++;
      const table = DOM.getTable();

      if (table && table.classList.contains(CONFIG.tableClass)) {
        logger.info(`✅ Table detected successfully after ${attempts} attempts (${attempts * CONFIG.checkInterval / 1000}s)!`);
        state.isTableDetected = true;

        // Clear the detection timer since we found the table
        if (state.tableDetectionTimer) {
          clearTimeout(state.tableDetectionTimer);
          state.tableDetectionTimer = null;
        }

        this.initializeFilter(table);
        return;
      }

      if (attempts >= CONFIG.maxAttempts) {
        logger.warn(`⚠️ Table detection timeout reached after ${CONFIG.maxAttempts} attempts (${CONFIG.maxAttempts * CONFIG.checkInterval / 1000}s).`);
        return;
      }

      // Log progress every 10 attempts (20 seconds)
      if (attempts % 10 === 0) {
        logger.info(`🔍 Still searching for table... (${attempts}/${CONFIG.maxAttempts} attempts)`);
      }

      state.tableDetectionTimer = TimerManager.setTimeout(detect, CONFIG.checkInterval);
    };

    detect();
  },

  initializeFilter(table) {
    logger.info("🔧 Initializing filter for table:", table.id);

    state.lastTableContent = DOM.getContentHash();
    state.table = table;

    ValidationSystem.setupValidation();
    this.setupPresenceCheck();

    // Only validate if we have loan numbers to check
    const inputs = DOM.getLoanInputs();
    const hasLoanNumbers = inputs.some(input => input.value.trim());

    if (hasLoanNumbers) {
      // Hide the table temporarily until validation completes
      if (table) {
        table.style.visibility = "hidden";
      }

      ValidationSystem.validateAllInputs().finally(() => {
        // Show the table after validation completes
        if (table) {
          table.style.visibility = "";
        }
      });
    }
  },

  setupPresenceCheck() {
    state.tablePresenceCheckTimer = TimerManager.setInterval(() => {
      const table = DOM.getTable();
      if (!table || !table.classList.contains(CONFIG.tableClass)) {
        this.resetDetection();
        setTimeout(() => this.startDetection(), 1000);
      }
    }, CONFIG.presenceCheckInterval);
  },


  resetDetection() {
    logger.info("🔄 Resetting table detection state");
    state.isTableDetected = false;
    state.table = null;
    state.lastTableContent = null;

    // Clear the detection timer
    if (state.tableDetectionTimer) {
      clearTimeout(state.tableDetectionTimer);
      state.tableDetectionTimer = null;
    }

    if (state.mutationObserver) {
      state.mutationObserver.disconnect();
      state.mutationObserver = null;
    }
  }
};

// Optimized form handling
const FormHandler = {
  setupValidation() {
    const submitButtons = document.querySelectorAll(
      'input[id="_ImgLookUp"], input[id="_ImgFinish"], button[id="_ImgLookUp"], button[id="_ImgFinish"]'
    );

    submitButtons.forEach(button => {
      button.addEventListener("click", async (event) => {
        logger.info("Form validation triggered for button:", button.id);

        try {
          // Validate all inputs before form submission
          const validationResults = await ValidationSystem.validateAllInputs();

          // If any validation failed, prevent form submission
          if (validationResults.includes(false)) {
            event.preventDefault();
            event.stopPropagation();
            return false;
          }

          // All validations passed, allow form submission

        } catch (error) {
          logger.error("Error during form validation:", error);
          // Let the form submit normally if there's an error in validation
        }
      }, true);
    });
  },

  setupCancelHandlers() {
    // Clear buttons
    document.querySelectorAll('input[id*="_ImgBtnClear"]').forEach(button => {
      button.addEventListener("click", (event) => {
        const row = button.closest("tr");
        if (!row) return;

        const loanInput = row.querySelector('input[id*="_TxtLoanNumber"]');
        if (loanInput) {
          // Clear validation cache for this input
          if (loanInput.value.trim()) {
            state.validationCache.delete(loanInput.value.trim());
          }

          DOM.resetInputStyling(loanInput);
          const error = loanInput.parentNode.querySelector(".error-msg");
          if (error) error.remove();
        }
      });
    });

    // Main cancel button
    const cancelButton = document.getElementById("_ImgBtnCancel");
    if (cancelButton) {
      cancelButton.addEventListener("click", () => {
        const inputs = DOM.getLoanInputs();
        inputs.forEach(input => {
          // Clear validation cache for all inputs
          if (input.value.trim()) {
            state.validationCache.delete(input.value.trim());
          }

          DOM.resetInputStyling(input);
          const error = input.parentNode.querySelector(".error-msg");
          if (error) error.remove();
        });
        logger.info("Cancel button clicked - cleared all validation errors");
      });
    }
  }
};

// Optimized URL change detection
const URLMonitor = {
  setup() {
    logger.info("🔗 Setting up URL change detection...");

    window.addEventListener('popstate', this.handleChange);
    window.addEventListener('hashchange', this.handleChange);

    // Override history methods
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = (...args) => {
      originalPushState.apply(history, args);
      this.handleChange();
    };

    history.replaceState = (...args) => {
      originalReplaceState.apply(history, args);
      this.handleChange();
    };
  },

  handleChange() {
    const newUrl = window.location.href;
    if (newUrl !== state.currentUrl) {
      logger.info("URL change detected - resetting detection");
      state.currentUrl = newUrl;
      TableDetector.resetDetection();
      setTimeout(() => TableDetector.startDetection(), 1000);
    }
  }
};

// Optimized cleanup system
const CleanupManager = {
  setup() {
    window.addEventListener('beforeunload', this.cleanup);
    window.addEventListener('unload', this.cleanup);
    window.addEventListener('pagehide', this.cleanup);
  },

  cleanup() {
    logger.info("🧹 Cleaning up filter script...");

    TimerManager.clearAll();
    DOMMonitor.resetAndRevalidate();
    DOM.clearErrors();
    state.validationCache.clear();

    if (state.mutationObserver) {
      state.mutationObserver.disconnect();
      state.mutationObserver = null;
    }

    logger.info("✅ Cleanup completed");
  }
};

// Optimized loader system
const LoaderManager = {
  loaderInstance: null,
  styleAdded: false,

  createStyles() {
    if (this.styleAdded) return null;

    const style = document.createElement("style");
    style.textContent = `
      #loaderOverlay {
        position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
        background: rgba(255, 255, 255, 0.9); display: flex;
        flex-direction: column; align-items: center; justify-content: center; 
        z-index: 9999; transition: opacity 0.3s ease;
      }
      .spinner {
        width: 60px; height: 60px; border: 6px solid #ccc;
        border-top-color: #2b6cb0; border-radius: 50%;
        animation: spin 1s linear infinite;
      }
      .loader-text {
        margin-top: 15px; font-family: Arial, sans-serif;
        color: #2b6cb0; font-size: 16px; font-weight: 500;
      }
      @keyframes spin { to {transform: rotate(360deg);} }
      #loaderOverlay.hidden { opacity: 0; pointer-events: none; }
    `;
    this.styleAdded = true;
    return style;
  },

  createLoader() {
    if (this.loaderInstance && document.body.contains(this.loaderInstance)) {
      return this.loaderInstance;
    }

    const loader = document.createElement("div");
    loader.id = "loaderOverlay";

    const spinner = document.createElement("div");
    spinner.className = "spinner";

    const text = document.createElement("div");
    text.className = "loader-text";
    text.textContent = "Verifying loan access...";
    text.id = "loaderText";

    loader.appendChild(spinner);
    loader.appendChild(text);

    this.loaderInstance = loader;
    return loader;
  },

  updateText(message) {
    const textElement = document.getElementById("loaderText");
    if (textElement) {
      textElement.textContent = message;
    }
  },

  show(message = "Verifying loan access...") {
    if (!document.head.querySelector('style#loader-style')) {
      const style = this.createStyles();
      if (style) {
        style.id = "loader-style";
        document.head.appendChild(style);
      }
    }

    let loader = document.getElementById("loaderOverlay");
    if (!loader) {
      loader = this.createLoader();
      document.body.appendChild(loader);
    }

    loader.classList.remove("hidden");
    this.updateText(message);
    return loader;
  },

  hide() {
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

// Main initialization
const Main = {
  async initialize() {
    if (window.loanNumberFilterExecuted) {
      logger.warn("⚠️ Loan number filter already executed, skipping");
      return;
    }

    window.loanNumberFilterExecuted = true;
    logger.info("🚀 Radian Loan Filter Script Starting...");

    try {
      // Initialize
      await this.setup();

      // Loader will be hidden after validation completes in ValidationSystem
      // We don't remove it here anymore

    } catch (error) {
      logger.error("❌ Failed to initialize filter:", error);
    }
  },

  async setup() {
    logger.info("✅ DOM Ready - Initializing filter...");

    await waitForListener();

    URLMonitor.setup();
    CleanupManager.setup();
    FormHandler.setupValidation();
    FormHandler.setupCancelHandlers();

    // Hide navigation links immediately
    hideNavigationLinks();
    
    // Set up periodic navigation link checks as fallback
    this.setupNavigationMonitoring();

    TableDetector.startDetection();
  },

  setupNavigationMonitoring() {
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
    
    // Initial iframe setup
    setupIframeListeners();
    
    logger.info("✅ Navigation monitoring set up for dynamic content (event-driven only)");
  }
};

// Entry point
(function () {
  function waitForDOM() {
    if (document && document.body) {
      Main.initialize();
    } else if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", Main.initialize);
    } else {
      setTimeout(() => {
        if (document && document.body) {
          Main.initialize();
        } else {
          Main.initialize();
        }
      }, 500);
    }
  }

  waitForDOM();
})();
