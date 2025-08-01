/*!
 * @description : Radian Loan Filter Script
 * @portal : MI Online Radian
 * @author : Rohit
 * @group : Radian Team
 * @owner : Radian
 * @lastModified : 14-May-2025
 */

// ########## DO NOT MODIFY THESE LINES ##########
const EXTENSION_ID = "hellpeipojbghaaopdnddjakinlmocjl";

// Enhanced Logger Configuration
const LOGGER_CONFIG = {
  enabled: true,
  level: 'debug', // 'debug', 'info', 'warn', 'error'
  prefix: '[RADIAN_FILTER]',
  timestamp: true
};

/**
 * Enhanced Logger Class
 */
class Logger {
  static log(level, message, data = null) {
    if (!LOGGER_CONFIG.enabled) return;
    
    const timestamp = LOGGER_CONFIG.timestamp ? `[${new Date().toISOString()}]` : '';
    const prefix = LOGGER_CONFIG.prefix;
    const logMessage = `${timestamp} ${prefix} ${level.toUpperCase()}: ${message}`;
    
    switch (level) {
      case 'debug':
        console.debug(logMessage, data || '');
        break;
      case 'info':
        console.info(logMessage, data || '');
        break;
      case 'warn':
        console.warn(logMessage, data || '');
        break;
      case 'error':
        console.error(logMessage, data || '');
        break;
      default:
        console.log(logMessage, data || '');
    }
  }

  static debug(message, data = null) { this.log('debug', message, data); }
  static info(message, data = null) { this.log('info', message, data); }
  static warn(message, data = null) { this.log('warn', message, data); }
  static error(message, data = null) { this.log('error', message, data); }
}

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
 * Wait for multiple elements to be present
 */
function waitForElements(selectors, timeout = 10000) {
  Logger.info(`🔍 Waiting for multiple elements: ${selectors.join(', ')}`);
  
  const promises = selectors.map(selector => 
    waitForElement(selector, timeout).catch(error => {
      Logger.warn(`⚠️ Element not found: ${selector}`, error.message);
      return null;
    })
  );
  
  return Promise.all(promises);
}

/**
 * Establish Communication with Loan Checker Extension
 */
async function waitForListener(maxRetries = 20, initialDelay = 100) {
  Logger.info("🔌 Starting extension listener connection...");
  return new Promise((resolve, reject) => {
    let attempts = 0;
    let delay = initialDelay;
    let timeoutId;

    function sendPing() {
      if (attempts >= maxRetries) {
        Logger.error("❌ No listener detected after maximum retries.");
        clearTimeout(timeoutId);
        reject(new Error("Listener not found"));
        return;
      }

      Logger.debug(`🔄 Sending ping attempt ${attempts + 1}/${maxRetries}...`);

      chrome.runtime.sendMessage(
        EXTENSION_ID,
        {
          type: "ping",
        },
        (response) => {
          if (response?.result === "pong") {
            Logger.info("✅ Listener detected!");
            clearTimeout(timeoutId);
            resolve(true);
          } else {
            Logger.warn("❌ No listener detected, retrying...");
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
  Logger.info(`🔍 Checking batch of ${numbers.length} loan numbers:`, numbers);
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      EXTENSION_ID,
      {
        type: "queryLoans",
        loanIds: numbers,
      },
      (response) => {
        if (chrome.runtime.lastError) {
          Logger.error("❌ Extension communication error:", chrome.runtime.lastError.message);
          return reject(chrome.runtime.lastError.message);
        } else if (response.error) {
          Logger.error("❌ Extension response error:", response.error);
          return reject(response.error);
        }

        Logger.debug("📊 Extension response received:", response);
        const available = Object.keys(response.result).filter(
          (key) => response.result[key]
        );
        Logger.info("✅ Allowed loan numbers:", available);
        resolve(available);
      }
    );
  });
}

// ########## DO NOT MODIFY THESE LINES - END ##########

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
      attributes: false,
      characterData: false
    });

    Logger.info("✅ DOM change observer started");
  }

  checkForRelevantChanges(mutations) {
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
          return true;
        }
      }
    }
    return false;
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