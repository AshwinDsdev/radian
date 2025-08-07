/*!
 * @description : Radian Loan Number Change Filter Script
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
        {
          type: "ping",
        },
        (response) => {
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
 * Logger utility for consistent debug output
 */
const logger = {
  debug: (...args) => console.debug('[LoanNumberFilter]', ...args),
  info: (...args) => console.info('[LoanNumberFilter]', ...args),
  warn: (...args) => console.warn('[LoanNumberFilter]', ...args),
  error: (...args) => console.error('[LoanNumberFilter]', ...args),
};

// Configuration for table detection
const TABLE_CONFIG = {
  tableId: "_GrdLoanNumberChange",
  tableClass: "resultsTable",
  detectionTimeout: 45000, // 45 seconds timeout
  checkInterval: 1000, // Check every 1 second
  maxAttempts: 45, // Maximum attempts (45 seconds / 1 second)
  domChangeDebounce: 300, // Debounce DOM change events
  loanExtractionResetDelay: 500 // Delay before resetting loan extraction after DOM changes
};

let tableDetectionTimer = null;
let isTableDetected = false;
let currentUrl = window.location.href;
let tablePresenceCheckTimer = null;
let domChangeTimer = null;
let mutationObserver = null;
let lastTableContent = null;
let loanExtractionResetTimer = null;

// ########## DOM MONITORING & LOAN EXTRACTION RESET ##########

/**
 * Generate a hash of table content for change detection
 */
function getTableContentHash(table) {
  if (!table) return null;
  
  try {
    // Get all loan number inputs and their values
    const loanInputs = table.querySelectorAll('input[id*="_TxtLoanNumber"]');
    const content = Array.from(loanInputs).map(input => ({
      id: input.id,
      value: input.value,
      disabled: input.disabled,
      hasError: !!input.parentNode.querySelector('.error-msg')
    }));
    
    // Also include table structure (row count, etc.)
    const rows = table.querySelectorAll('tr');
    const structure = {
      rowCount: rows.length,
      loanInputCount: loanInputs.length
    };
    
    return JSON.stringify({ content, structure });
  } catch (error) {
    console.warn('Error generating table content hash:', error);
    return null;
  }
}

/**
 * Check if table content has changed significantly
 */
function hasTableContentChanged(table) {
  const currentHash = getTableContentHash(table);
  
  if (lastTableContent === null) {
    lastTableContent = currentHash;
    return false; // First time, no change
  }
  
  const hasChanged = lastTableContent !== currentHash;
  if (hasChanged) {
    console.log('📊 Table content change detected - resetting loan extraction');
    lastTableContent = currentHash;
  }
  
  return hasChanged;
}

/**
 * Reset loan extraction and re-validate all loan numbers
 */
async function resetLoanExtraction() {
  console.log('🔄 Resetting loan extraction and re-validating...');
  
  try {
    // Clear any existing error messages
    const errorMessages = document.querySelectorAll('.error-msg');
    errorMessages.forEach(msg => msg.remove());
    
    // Reset all loan number inputs styling
    const table = document.getElementById(TABLE_CONFIG.tableId);
    if (table) {
      const loanInputs = table.querySelectorAll('input[id*="_TxtLoanNumber"]');
      loanInputs.forEach(input => {
        input.style.border = '';
        input.disabled = false;
        input.style.backgroundColor = '';
        input.style.cursor = '';
      });
    }
    
    // Re-setup validation for new inputs
    setupLoanNumberValidation();
    setupFormValidation();
    setupCancelValidation();
    
    // Re-check all existing loan numbers
    await checkExistingLoanNumbers();
    
    console.log('✅ Loan extraction reset completed');
  } catch (error) {
    console.error('❌ Error during loan extraction reset:', error);
  }
}

/**
 * Debounced function to handle DOM changes
 */
function handleDomChange() {
  if (domChangeTimer) {
    clearTimeout(domChangeTimer);
  }
  
  domChangeTimer = setTimeout(() => {
    const table = document.getElementById(TABLE_CONFIG.tableId);
    if (table && hasTableContentChanged(table)) {
      // Reset loan extraction after a short delay to ensure DOM is stable
      if (loanExtractionResetTimer) {
        clearTimeout(loanExtractionResetTimer);
      }
      
      loanExtractionResetTimer = setTimeout(() => {
        resetLoanExtraction();
      }, TABLE_CONFIG.loanExtractionResetDelay);
    }
  }, TABLE_CONFIG.domChangeDebounce);
}

/**
 * Enhanced mutation observer for comprehensive DOM monitoring
 */
function setupEnhancedTableObserver() {
  const targetTable = document.getElementById(TABLE_CONFIG.tableId);
  if (!targetTable) {
    console.warn('⚠️ Loan number table not found for enhanced observer setup');
    return;
  }

  console.log('🔍 Setting up enhanced mutation observer for table:', targetTable.id);

  // Disconnect existing observer if any
  if (mutationObserver) {
    mutationObserver.disconnect();
  }

  mutationObserver = new MutationObserver((mutationList) => {
    let hasRelevantChanges = false;

    for (const mutation of mutationList) {
      // Check for added/removed nodes
      if (mutation.type === 'childList') {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Check if added node contains loan inputs or is a loan input
            const hasLoanInputs = node.querySelector && 
              (node.querySelector('input[id*="_TxtLoanNumber"]') || 
               node.matches && node.matches('input[id*="_TxtLoanNumber"]'));
            
            if (hasLoanInputs) {
              hasRelevantChanges = true;
              console.log('➕ New loan input detected in DOM change');
              break;
            }
          }
        }
        
        for (const node of mutation.removedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Check if removed node contains loan inputs
            const hadLoanInputs = node.querySelector && 
              node.querySelector('input[id*="_TxtLoanNumber"]');
            
            if (hadLoanInputs) {
              hasRelevantChanges = true;
              console.log('➖ Loan input removed from DOM');
              break;
            }
          }
        }
      }
      
      // Check for attribute changes on loan inputs
      if (mutation.type === 'attributes' && 
          mutation.target.matches && 
          mutation.target.matches('input[id*="_TxtLoanNumber"]')) {
        hasRelevantChanges = true;
        console.log('🔄 Loan input attribute changed:', mutation.attributeName);
      }
    }

    if (hasRelevantChanges) {
      console.log('📊 Relevant DOM changes detected - triggering loan extraction reset');
      handleDomChange();
    }
  });

  // Observe the entire table with comprehensive options
  mutationObserver.observe(targetTable, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['value', 'disabled', 'style', 'class'],
    characterData: false
  });

  console.log('✅ Enhanced mutation observer setup complete for table:', targetTable.id);
}

/**
 * Monitor for table structure changes (new rows, removed rows, etc.)
 */
function setupTableStructureMonitoring() {
  const targetTable = document.getElementById(TABLE_CONFIG.tableId);
  if (!targetTable) return;

  console.log('📊 Setting up table structure monitoring');

  // Monitor for changes in table structure
  const structureObserver = new MutationObserver((mutationList) => {
    let structureChanged = false;

    for (const mutation of mutationList) {
      if (mutation.type === 'childList') {
        // Check if rows were added or removed
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE && 
              (node.tagName === 'TR' || node.querySelector && node.querySelector('tr'))) {
            structureChanged = true;
            console.log('➕ Table row structure changed (added)');
            break;
          }
        }
        
        for (const node of mutation.removedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE && 
              (node.tagName === 'TR' || node.querySelector && node.querySelector('tr'))) {
            structureChanged = true;
            console.log('➖ Table row structure changed (removed)');
            break;
          }
        }
      }
    }

    if (structureChanged) {
      console.log('📊 Table structure change detected - resetting loan extraction');
      handleDomChange();
    }
  });

  structureObserver.observe(targetTable, {
    childList: true,
    subtree: true,
    attributes: false,
    characterData: false
  });

  return structureObserver;
}

/**
 * Check if URL has changed
 */
function hasUrlChanged() {
  const newUrl = window.location.href;
  if (newUrl !== currentUrl) {
    console.log("URL changed detected:", { from: currentUrl, to: newUrl });
    currentUrl = newUrl;
    return true;
  }
  return false;
}

/**
 * Detect table with timeout and proper cleanup
 */
function detectTableWithTimeout() {
  if (isTableDetected) {
    console.log(" Table already detected, skipping detection");
    return;
  }

  logger.info("🔄 Starting table detection with timeout...");
  let attempts = 0;

  const detectTable = () => {
    attempts++;
    logger.debug(`📋 Table detection attempt ${attempts}/${TABLE_CONFIG.maxAttempts}`);

    const table = document.getElementById(TABLE_CONFIG.tableId);
    if (table && table.classList.contains(TABLE_CONFIG.tableClass)) {
      logger.info("✅ Table detected successfully!");
      isTableDetected = true;
      clearTimeout(tableDetectionTimer);

      // Initialize the filter for this table
      initializeFilterForTable(table);
      return;
    }

    if (attempts >= TABLE_CONFIG.maxAttempts) {
      logger.warn("⚠️ Table detection timeout reached. Stopping detection.");
      clearTimeout(tableDetectionTimer);
      return;
    }

    // Schedule next attempt
    tableDetectionTimer = setTimeout(detectTable, TABLE_CONFIG.checkInterval);
  };

  // Start detection
  detectTable();
}

/**
 * Check if table is still present and handle removal scenarios
 */
function checkTablePresence() {
  if (!isTableDetected) {
    return; // Table was never detected, nothing to check
  }

  const table = document.getElementById(TABLE_CONFIG.tableId);
  if (!table || !table.classList.contains(TABLE_CONFIG.tableClass)) {
    console.log(" Table was removed - resetting detection state");
    resetTableDetection();

    // Start detection again in case table is re-added
    setTimeout(() => {
      detectTableWithTimeout();
    }, 1000);
  }
}

/**
 * Setup periodic table presence check and loan number discovery
 */
function setupTablePresenceCheck() {
  console.log("🔄 Setting up periodic table presence check and loan discovery (every 10s)");
  
  // Check every 10 seconds if table is still present and discover new loan numbers
  tablePresenceCheckTimer = setInterval(() => {
    checkTablePresence();
    discoverNewLoanNumbers();
  }, 10000);
}

/**
 * Discover new loan numbers that might have been added dynamically
 */
function discoverNewLoanNumbers() {
  const table = document.getElementById(TABLE_CONFIG.tableId);
  if (!table) return;

  const currentLoanInputs = table.querySelectorAll('input[id*="_TxtLoanNumber"]');
  const currentCount = currentLoanInputs.length;
  
  // Check if we have new loan inputs that aren't being monitored
  let hasNewInputs = false;
  
  currentLoanInputs.forEach(input => {
    // Check if this input has our validation event listeners
    const hasValidationListeners = input._hasValidationListeners;
    
    if (!hasValidationListeners) {
      hasNewInputs = true;
      console.log('🔍 Discovered new loan input:', input.id);
    }
  });
  
  if (hasNewInputs) {
    console.log('🔄 New loan inputs discovered - resetting validation');
    handleDomChange();
  }
}

/**
 * Reset table detection state
 */
function resetTableDetection() {
  console.log("Resetting table detection state");
  isTableDetected = false;
  
  if (tableDetectionTimer) {
    clearTimeout(tableDetectionTimer);
    tableDetectionTimer = null;
  }
  
  // Reset DOM monitoring state
  if (domChangeTimer) {
    clearTimeout(domChangeTimer);
    domChangeTimer = null;
  }
  
  if (loanExtractionResetTimer) {
    clearTimeout(loanExtractionResetTimer);
    loanExtractionResetTimer = null;
  }
  
  if (mutationObserver) {
    mutationObserver.disconnect();
    mutationObserver = null;
  }
  
  lastTableContent = null;
}

/**
 * Initialize filter for a specific table
 */
function initializeFilterForTable(table) {
  console.log(" Initializing filter for table:", table.id);

  // Initialize table content hash for change detection
  lastTableContent = getTableContentHash(table);

  // Setup all validation functions
  setupLoanNumberValidation();
  setupFormValidation();
  setupCancelValidation();
  
  // Setup enhanced DOM monitoring
  setupEnhancedTableObserver();
  setupTableStructureMonitoring();
  setupTablePresenceCheck(); // Setup periodic presence check

  // Check existing loan numbers
  checkExistingLoanNumbers();
}

/**
 * Cleanup function to clear timers and observers
 */
function cleanup() {
  console.log("Cleaning up filter script...");

  // Clear table detection timer
  if (tableDetectionTimer) {
    clearTimeout(tableDetectionTimer);
    tableDetectionTimer = null;
  }

  // Reset detection state
  isTableDetected = false;

  // Clear any existing error messages
  const errorMessages = document.querySelectorAll('.error-msg');
  errorMessages.forEach(msg => msg.remove());

  // Clear periodic presence check timer
  if (tablePresenceCheckTimer) {
    clearInterval(tablePresenceCheckTimer);
    tablePresenceCheckTimer = null;
  }

  // Clear DOM change timer
  if (domChangeTimer) {
    clearTimeout(domChangeTimer);
    domChangeTimer = null;
  }

  // Disconnect mutation observers
  if (mutationObserver) {
    mutationObserver.disconnect();
    mutationObserver = null;
  }

  // Clear loan extraction reset timer
  if (loanExtractionResetTimer) {
    clearTimeout(loanExtractionResetTimer);
    loanExtractionResetTimer = null;
  }

  // Reset table content hash
  lastTableContent = null;

  console.log("✅ Cleanup completed");
}

/**
 * Setup cleanup on page unload
 */
function setupCleanup() {
  window.addEventListener('beforeunload', cleanup);
  window.addEventListener('unload', cleanup);

  // Also cleanup when the script context is destroyed
  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', cleanup);
  }
}

/**
 * Setup URL change detection
 */
function setupUrlChangeDetection() {
  console.log("🔗 Setting up URL change detection listeners...");
  // Listen for popstate events (back/forward navigation)
  window.addEventListener('popstate', handleUrlChange);

  // Listen for pushstate/replacestate events (programmatic navigation)
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  history.pushState = function (...args) {
    originalPushState.apply(history, args);
    handleUrlChange();
  };

  history.replaceState = function (...args) {
    originalReplaceState.apply(history, args);
    handleUrlChange();
  };

  // Also check for hash changes
  window.addEventListener('hashchange', handleUrlChange);
  console.log("✅ URL change detection setup complete");
}

/**
 * Handle URL change events
 */
function handleUrlChange() {
  if (hasUrlChanged()) {
    console.log(" URL change detected - resetting and restarting detection");
    resetTableDetection();

    // Wait a bit for the page to load, then start detection
    setTimeout(() => {
      detectTableWithTimeout();
    }, 1000);
  }
}

/**
 * Create error message element to show when loan is not allowed for offshore users.
 */
function createErrorElement() {
  const error = document.createElement("div");
  error.textContent = "You are not provisioned to access restricted loan";
  error.className = "error-msg";
  error.style.color = "red";
  error.style.fontSize = "0.9em";
  error.style.marginTop = "5px";
  error.style.fontWeight = "bold";
  return error;
}

/**
 * Create loader to show when trying to establish connection with extension
 */
function createLoader() {
  try {
    const style = document.createElement("style");
    style.textContent = `
      #loaderOverlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(255, 255, 255, 0.8);
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
  } catch (error) {
    logger.error("❌ Error creating loader styles:", error);
    return null;
  }
}

/**
 * To create Loader Element.
 */
function createLoaderElement() {
  try {
    const loader = document.createElement("div");
    loader.id = "loaderOverlay";
    const spinner = document.createElement("div");
    spinner.className = "spinner";
    loader.appendChild(spinner);
    return loader;
  } catch (error) {
    logger.error("❌ Error creating loader element:", error);
    return null;
  }
}

/**
 * Validate individual loan number input and show error if restricted
 */
async function validateLoanNumberInput(input) {
  const loanNumber = input.value.trim();

  // Reset input styling and remove existing error messages
  input.style.border = "";
  input.disabled = false;
  input.style.backgroundColor = "";
  const existingError = input.parentNode.querySelector(".error-msg");
  if (existingError) {
    existingError.remove();
  }

  if (!loanNumber) {
    return true;
  }

  try {
    const allowedLoans = await checkNumbersBatch([loanNumber]);
    console.log(`Checking loan number: ${loanNumber}, Allowed: ${allowedLoans.length > 0}`);

    if (allowedLoans.length === 0) {
      // Loan is restricted - disable input and show error
      console.log(`Restricted loan detected: ${loanNumber} - disabling input`);
      input.style.border = "2px solid red";
      input.disabled = true;
      input.style.backgroundColor = "#f5f5f5";
      input.style.cursor = "not-allowed";
      const errorElement = createErrorElement();
      input.parentNode.appendChild(errorElement);
      return false;
    }
    return true;
  } catch (error) {
    console.error("❌ Error checking loan number:", error);
    return false;
  }
}

/**
 * Check all existing loan number inputs on page load and disable restricted ones
 */
async function checkExistingLoanNumbers() {
  const table = document.getElementById("_GrdLoanNumberChange");
  if (!table) {
    console.warn("⚠️ Loan number table not found");
    return;
  }

  const loanNumberInputs = table.querySelectorAll('input[id*="_TxtLoanNumber"]');
  console.log(`Found ${loanNumberInputs.length} loan number inputs to check`);

  for (const input of loanNumberInputs) {
    if (input.value.trim()) {
      console.log(`Checking existing loan number: ${input.value.trim()}`);
      await validateLoanNumberInput(input);
    }
  }
}

/**
 * Setup validation for loan number inputs in the table
 */
function setupLoanNumberValidation() {
  // Get the table that contains loan numbers
  const table = document.getElementById("_GrdLoanNumberChange");
  if (!table) {
    console.warn("⚠️ Loan number table not found");
    return;
  }

  const loanNumberInputs = table.querySelectorAll(
    'input[id*="_TxtLoanNumber"]'
  );

  console.log(`🔧 Setting up validation for ${loanNumberInputs.length} loan number inputs`);

  loanNumberInputs.forEach((input) => {
    // Remove existing event listeners to prevent duplicates
    const newInput = input.cloneNode(true);
    input.parentNode.replaceChild(newInput, input);
    
    // Add event listeners to the new input
    newInput.addEventListener("blur", async function () {
      await validateLoanNumberInput(this);
    });

    let timeout;
    newInput.addEventListener("input", function () {
      clearTimeout(timeout);
      timeout = setTimeout(async () => {
        await validateLoanNumberInput(this);
      }, 500); // Wait 500ms after user stops typing
    });
    
    // Also validate on focus to handle programmatic changes
    newInput.addEventListener("focus", async function () {
      if (this.value.trim()) {
        await validateLoanNumberInput(this);
      }
    });
    
    // Mark this input as having validation listeners
    newInput._hasValidationListeners = true;
  });
}

/**
 * Setup form submission prevention for restricted loans
 */
function setupFormValidation() {
  // Only validate for Lookup and Finish buttons, not Clear or Cancel buttons
  const submitButtons = document.querySelectorAll(
    'input[id="_ImgLookUp"], input[id="_ImgFinish"], button[id="_ImgLookUp"], button[id="_ImgFinish"]'
  );

  console.log(`Setting up form validation for ${submitButtons.length} submit buttons`);

  submitButtons.forEach((button) => {
    button.addEventListener(
      "click",
      async function (event) {
        console.log("Form validation triggered for button:", this.id);

        const table = document.getElementById("_GrdLoanNumberChange");
        if (!table) return;

        const loanNumberInputs = table.querySelectorAll(
          'input[id*="_TxtLoanNumber"]'
        );
        let hasRestrictedLoan = false;

        // Validate all inputs before submission
        for (const input of loanNumberInputs) {
          const isValid = await validateLoanNumberInput(input);
          if (!isValid) {
            hasRestrictedLoan = true;
          }
        }
      },
      true
    );
  });
}

/**
 * Reset the input fields and validation messages when cancel/clear button is clicked
 */
function setupCancelValidation() {
  const clearButtons = document.querySelectorAll('input[id*="_ImgBtnClear"]');

  console.log(`Setting up cancel validation for ${clearButtons.length} clear buttons`);

  clearButtons.forEach((button) => {
    button.addEventListener("click", function (event) {
      const row = this.closest("tr");
      if (!row) return;

      const loanNumberInput = row.querySelector('input[id*="_TxtLoanNumber"]');
      if (!loanNumberInput) return;

      loanNumberInput.style.border = "";
      loanNumberInput.disabled = false;
      loanNumberInput.style.backgroundColor = "";
      loanNumberInput.style.cursor = "";

      // Remove any existing error messages
      const existingError =
        loanNumberInput.parentNode.querySelector(".error-msg");
      if (existingError) {
        existingError.remove();
      }

      console.log(
        "Cleared validation errors for loan number input:",
        loanNumberInput.id
      );
    });
  });

  // Handle the main Cancel button - clear all validation errors
  const cancelButton = document.getElementById("_ImgBtnCancel");
  if (cancelButton) {
    console.log("Setting up main cancel button validation");
    cancelButton.addEventListener("click", function (event) {
      const table = document.getElementById("_GrdLoanNumberChange");
      if (!table) return;

      const loanNumberInputs = table.querySelectorAll(
        'input[id*="_TxtLoanNumber"]'
      );

      // Clear validation styling and error messages from all loan number inputs
      loanNumberInputs.forEach((input) => {
        input.style.border = "";
        input.disabled = false;
        input.style.backgroundColor = "";
        input.style.cursor = "";

        const existingError = input.parentNode.querySelector(".error-msg");
        if (existingError) {
          existingError.remove();
        }
      });

      console.log(" Cancel button clicked - cleared all validation errors");
    });
  }
}

/**
 * Setup Mutation Observer to watch for dynamic changes in the table
 * @deprecated - Use setupEnhancedTableObserver instead
 */
function setupTableObserver() {
  console.log("⚠️ setupTableObserver is deprecated - using enhanced observer instead");
  setupEnhancedTableObserver();
}

// Global execution flag to prevent multiple runs
window.loanNumberFilterExecuted = window.loanNumberFilterExecuted || false;

// Main entrypoint (this is where everything starts)
(async function () {
  // Prevent multiple executions
  if (window.loanNumberFilterExecuted) {
    logger.warn("⚠️ Loan number filter already executed, skipping");
    return;
  }

  window.loanNumberFilterExecuted = true;
  logger.info("🚀 Radian Loan Filter Script Starting...");

  // Wait for DOM to be ready before creating loader
  function initializeScript() {
    try {
      // Create loader style only if head exists
      if (document.head) {
        const style = createLoader();
        if (style) {
          document.head.appendChild(style);
        }
      }

      // Create loader element only if body exists
      let loader = null;
      if (document.body) {
        loader = createLoaderElement();
        if (loader) {
          document.body.appendChild(loader);
        }
      }

      // Start the main initialization
      onReady(loader);
    } catch (error) {
      logger.error("❌ Error during script initialization:", error);
      // Try to start without loader if there's an error
      onReady(null);
    }
  }

  async function onReady(loader) {
    logger.info("✅ DOM Ready - Initializing filter...");
    try {
      // Check Loan extension connection
      await waitForListener();

      // Setup URL change detection first
      logger.info("🔗 Setting up URL change detection...");
      setupUrlChangeDetection();
      setupCleanup(); // Setup cleanup on page unload

      // Start table detection with timeout
      logger.info("🔍 Starting table detection...");
      detectTableWithTimeout();

    } catch (error) {
      logger.error("❌ Failed to initialize filter:", error);
    } finally {
      // Remove loader if it exists
      if (loader) {
        logger.info("🔄 Removing loader...");
        try {
          loader.classList.add("hidden");
          setTimeout(() => {
            if (loader && loader.parentNode) {
              loader.remove();
            }
          }, 300);
        } catch (loaderError) {
          logger.warn("⚠️ Error removing loader:", loaderError);
        }
      }
    }
  }

  // Check if DOM is ready
  function waitForDOMReady() {
    // Check if document and body exist
    if (document && document.body) {
      logger.info("📋 DOM ready, starting initialization...");
      initializeScript();
    } else if (document.readyState === "loading") {
      logger.info("📋 DOM still loading, waiting for DOMContentLoaded...");
      document.addEventListener("DOMContentLoaded", initializeScript);
    } else {
      logger.info("📋 DOM state unclear, waiting with timeout...");
      // Fallback: wait a bit and try again
      setTimeout(() => {
        if (document && document.body) {
          initializeScript();
        } else {
          logger.warn("⚠️ DOM not ready after timeout, starting without loader...");
          onReady(null);
        }
      }, 500);
    }
  }

  waitForDOMReady();
})();
