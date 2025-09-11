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
  detectionTimeout: 45000,
  checkInterval: 1000,
  maxAttempts: 10,
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
  }
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
      LoaderManager.hide();
      return [];
    }
    
    try {
      // Show loader if not already showing
      this.isValidating = true;
      
      // Process inputs in sequence for better UX feedback
      const results = [];
      for (let i = 0; i < inputs.length; i++) {
        const input = inputs[i];
        const loanNumber = input.value.trim();
        
        if (loanNumber) {
          LoaderManager.updateText(`Verifying loan ${i+1} of ${inputs.length}: ${loanNumber}`);
          const result = await this.validateInput(input);
          results.push(result);
        } else {
          results.push(true); // Empty inputs are considered valid
        }
      }
      
      return results;
    } finally {
      this.isValidating = false;
      // Note: We don't hide the loader here as it's handled by TableDetector.initializeFilter
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
          // Only show loader for manual input validation if we're not in batch validation
          this.validateInput(input, !this.isValidating);
        }, CONFIG.validationDebounce);
      };

      // Event listeners
      input.addEventListener("blur", () => {
        if (input.value.trim()) {
          // Only show loader for manual input validation if we're not in batch validation
          this.validateInput(input, !this.isValidating);
        }
      });
      
      input.addEventListener("input", debouncedValidation);
      
      input.addEventListener("focus", () => {
        if (input.value.trim()) {
          // Only show loader for manual input validation if we're not in batch validation
          this.validateInput(input, !this.isValidating);
        }
      });

      input._hasValidationListeners = true;
    });
  }
};

// Optimized DOM monitoring
const DOMMonitor = {
  setupObserver() {
    const table = DOM.getTable();
    if (!table) return;

    // Disconnect existing observer
    if (state.mutationObserver) {
      state.mutationObserver.disconnect();
    }

    // Single optimized observer
    state.mutationObserver = new MutationObserver((mutations) => {
      let hasRelevantChanges = false;

      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              if (node.matches && node.matches('input[id*="_TxtLoanNumber"]') ||
                node.querySelector && node.querySelector('input[id*="_TxtLoanNumber"]')) {
                hasRelevantChanges = true;
                break;
              }
            }
          }

          for (const node of mutation.removedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              if (node.querySelector && node.querySelector('input[id*="_TxtLoanNumber"]')) {
                hasRelevantChanges = true;
                break;
              }
            }
          }
        } else if (mutation.type === 'attributes' &&
          mutation.target.matches &&
          mutation.target.matches('input[id*="_TxtLoanNumber"]')) {
          hasRelevantChanges = true;
        }
      }

      if (hasRelevantChanges) {
        this.handleChange();
      }
    });

    // Observe with optimized options
    state.mutationObserver.observe(table, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['value', 'disabled', 'style', 'class']
    });
  },

  handleChange() {
    if (state.domChangeTimer) {
      clearTimeout(state.domChangeTimer);
    }

    state.domChangeTimer = TimerManager.setTimeout(() => {
      const currentHash = DOM.getContentHash();
      if (currentHash !== state.lastTableContent) {
        state.lastTableContent = currentHash;
        this.resetAndRevalidate();
      }
    }, CONFIG.domChangeDebounce);
  },

  async resetAndRevalidate() {
    console.log('🔄 Resetting loan extraction and re-validating...');

    try {
      DOM.clearErrors();

      const table = DOM.getTable();
      if (table) {
        const inputs = DOM.getLoanInputs();
        inputs.forEach(input => DOM.resetInputStyling(input));
      }

      ValidationSystem.setupValidation();
      await ValidationSystem.validateAllInputs();

      console.log('✅ Loan extraction reset completed');
    } catch (error) {
      console.error('❌ Error during loan extraction reset:', error);
    }
  }
};

// Optimized table detection
const TableDetector = {
  startDetection() {
    if (state.isTableDetected) return;

    logger.info("🔄 Starting table detection...");
    let attempts = 0;

    const detect = () => {
      attempts++;
      const table = DOM.getTable();

      if (table && table.classList.contains(CONFIG.tableClass)) {
        logger.info("✅ Table detected successfully!");
        state.isTableDetected = true;
        LoaderManager.updateText("Table found - initializing validation...");
        this.initializeFilter(table);
        return;
      }

      if (attempts >= CONFIG.maxAttempts) {
        logger.warn("⚠️ Table detection timeout reached.");
        LoaderManager.hide(); // Hide loader if we can't find the table
        return;
      }

      state.tableDetectionTimer = TimerManager.setTimeout(detect, CONFIG.checkInterval);
    };

    detect();
  },

  initializeFilter(table) {
    logger.info("🔧 Initializing filter for table:", table.id);

    state.lastTableContent = DOM.getContentHash();
    state.table = table;

    // Hide the table temporarily until validation completes
    if (table) {
      table.style.visibility = "hidden";
    }

    ValidationSystem.setupValidation();
    DOMMonitor.setupObserver();
    this.setupPresenceCheck();

    // Start validation with loader visible
    ValidationSystem.validateAllInputs().finally(() => {
      // Show the table after validation completes
      if (table) {
        table.style.visibility = "";
      }
      LoaderManager.hide();
    });
  },

  setupPresenceCheck() {
    state.tablePresenceCheckTimer = TimerManager.setInterval(() => {
      const table = DOM.getTable();
      if (!table || !table.classList.contains(CONFIG.tableClass)) {
        this.resetDetection();
        LoaderManager.show("Table changed - reinitializing verification...");
        setTimeout(() => this.startDetection(), 1000);
      }
    }, CONFIG.presenceCheckInterval);
  },

  resetDetection() {
    logger.info("🔄 Resetting table detection state");
    state.isTableDetected = false;
    state.table = null;
    state.lastTableContent = null;

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
        
        // Show loader for form submission
        LoaderManager.show("Validating loan numbers before submission...");
        
        try {
          // Validate all inputs before form submission
          const validationResults = await ValidationSystem.validateAllInputs();
          
          // If any validation failed, prevent form submission
          if (validationResults.includes(false)) {
            event.preventDefault();
            event.stopPropagation();
            LoaderManager.updateText("Some loan numbers are restricted");
            setTimeout(() => LoaderManager.hide(), 1500);
            return false;
          }
          
          // All validations passed, allow form submission
          LoaderManager.updateText("All loan numbers validated successfully");
          // Don't hide loader here as the form will submit and page will refresh
          
        } catch (error) {
          logger.error("Error during form validation:", error);
          LoaderManager.hide();
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
        // Hide any active loader
        LoaderManager.hide();
        
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
      LoaderManager.hide();
    }
  },

  async setup() {
    logger.info("✅ DOM Ready - Initializing filter...");

    LoaderManager.updateText("Connecting to verification service...");
    await waitForListener();

    URLMonitor.setup();
    CleanupManager.setup();
    FormHandler.setupValidation();
    FormHandler.setupCancelHandlers();

    LoaderManager.updateText("Searching for loan number table...");
    TableDetector.startDetection();
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
