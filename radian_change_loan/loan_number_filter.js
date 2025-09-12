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
  // Multiple possible table selectors to handle different page structures
  tableSelectors: [
    "#_GrdLoanNumberChange", // Original selector
    "table.resultsTable",    // Class-based selector
    "table[id*='LoanNumber']", // Partial ID match
    "table.dataTable",      // Common data table class
    "div.contentmenu table" // Table within content menu
  ],
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
  // Cache DOM queries with improved table detection
  getTable() {
    if (!state.table || !state.table.isConnected) {
      // Try each selector until we find a matching table
      for (const selector of CONFIG.tableSelectors) {
        const table = document.querySelector(selector);
        if (table) {
          logger.info(`✅ Table found with selector: ${selector}`);
          state.table = table;
          break;
        }
      }
    }
    return state.table;
  },

  getLoanInputs() {
    const table = this.getTable();
    if (!table) return [];

    // STRICT selectors that ONLY match loan number inputs (not certificate inputs)
    // Looking at the HTML structure, loan inputs have specific IDs like "_GrdLoanNumberChange_ctl02__TxtLoanNumber"
    const loanInputs = table.querySelectorAll('input[id$="_TxtLoanNumber"]');

    logger.info(`✅ Found ${loanInputs.length} loan inputs with strict selector`);

    // Update our cached set
    state.loanInputs.clear();
    loanInputs.forEach(input => state.loanInputs.add(input));
    return Array.from(loanInputs);
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
    // Only validate if this is actually a loan number input (not certificate)
    if (!input.id || !input.id.endsWith('_TxtLoanNumber')) {
      return true;
    }

    const loanNumber = input.value.trim();

    // Don't validate empty loan numbers
    if (!loanNumber) {
      // Clean up any existing error messages
      DOM.resetInputStyling(input);
      const existingError = input.parentNode.querySelector(".error-msg");
      if (existingError) existingError.remove();
      return true;
    }

    // Check cache first
    if (state.validationCache.has(loanNumber)) {
      const isValid = state.validationCache.get(loanNumber);

      // Apply styling based on cached result
      if (!isValid) {
        this.applyRestrictedStyling(input);
      }

      return isValid;
    }

    // Show loader if requested and we have a value to check
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
        this.applyRestrictedStyling(input);
      }

      return isValid;
    } catch (error) {
      console.error("❌ Error checking loan number:", error);
      return true; // Default to allowing access on error
    }
  },

  // Apply restricted styling without affecting other elements
  applyRestrictedStyling(input) {
    // Only modify the input element itself
    input.style.border = "2px solid red";
    input.style.backgroundColor = "#f5f5f5";
    input.style.cursor = "not-allowed";
    input.disabled = true;

    // Add error message as a sibling element
    const errorElement = DOM.createErrorElement();
    input.parentNode.appendChild(errorElement);
    state.errorElements.add(errorElement);
  },

  // Batch validation
  async validateAllInputs() {
    const inputs = DOM.getLoanInputs();
    if (inputs.length === 0) {
      return [];
    }

    // Only validate inputs that have loan numbers and are loan number inputs (not certificates)
    const inputsWithValues = inputs.filter(input =>
      input.id &&
      input.id.endsWith('_TxtLoanNumber') &&
      input.value.trim()
    );

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

      // Only clear errors for loan number inputs, not certificate inputs
      if (table) {
        const loanInputs = DOM.getLoanInputs();

        // Only clear errors for loan inputs, not certificate inputs
        state.errorElements.forEach(error => {
          // Check if the error is attached to a loan input
          const parentElement = error.parentNode;
          if (parentElement) {
            const loanInput = parentElement.querySelector('input[id$="_TxtLoanNumber"]');
            if (loanInput) {
              error.remove();
            }
          }
        });

        // Only reset styling for loan inputs
        loanInputs.forEach(input => {
          if (input.id && input.id.endsWith('_TxtLoanNumber')) {
            DOM.resetInputStyling(input);
          }
        });
      }

      // Clear validation cache for a fresh start
      state.validationCache.clear();

      // Setup validation for loan inputs
      ValidationSystem.setupValidation();

      // Only validate if we have loan numbers to check
      const inputs = DOM.getLoanInputs();
      const inputsWithValues = inputs.filter(input =>
        input.id &&
        input.id.endsWith('_TxtLoanNumber') &&
        input.value.trim()
      );

      if (inputsWithValues.length > 0) {
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

      if (table) {
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

    // Set up validation event listeners but don't validate empty inputs
    ValidationSystem.setupValidation();
    this.setupPresenceCheck();

    // Only validate if we have loan numbers to check - not on initial load
    const inputs = DOM.getLoanInputs();
    const inputsWithValues = inputs.filter(input =>
      input.id &&
      input.id.endsWith('_TxtLoanNumber') &&
      input.value.trim()
    );

    // Only run validation if we have actual loan numbers with values
    if (inputsWithValues.length > 0) {
      logger.info(`Found ${inputsWithValues.length} loan inputs with values - validating`);

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
    } else {
      logger.info("No loan inputs with values found - skipping initial validation");
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
    // Simple execution guard for this window context
    if (window.loanNumberFilterExecuted) {
      logger.warn("⚠️ Loan number filter already executed in this context, skipping");
      return;
    }

    // Set execution flag for this window context
    window.loanNumberFilterExecuted = true;

    // Release the global execution lock
    window.loanNumberFilterExecuting = false;

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

// Entry point with global execution guard
(function () {
  // Global guard to prevent multiple executions
  if (window.loanNumberFilterExecuting) {
    logger.warn("⚠️ Loan number filter already executing in another context, skipping");
    return;
  }

  // Set global flag to prevent other instances from running
  window.loanNumberFilterExecuting = true;

  function waitForDOM() {
    if (document && document.body) {
      // Fix the 'this' binding issue by using a bound function
      const boundInitialize = Main.initialize.bind(Main);
      boundInitialize();
    } else if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", function () {
        const boundInitialize = Main.initialize.bind(Main);
        boundInitialize();
      });
    } else {
      setTimeout(() => {
        if (document && document.body) {
          const boundInitialize = Main.initialize.bind(Main);
          boundInitialize();
        }
      }, 500);
    }
  }

  waitForDOM();
})();
