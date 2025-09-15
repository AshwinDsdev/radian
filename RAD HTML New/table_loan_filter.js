/*!
 * @description : Table Loan Filter Script - Filters table rows based on servicer loan number restrictions
 * @portal : MI Online - Radian Claims Reports
 * @author : Accelirate Team
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
