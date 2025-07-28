/*!
 * @fileoverview Radian Search Filter Script
 * @description This script filters loan information in the search results based on user permissions.
 * It hides unauthorized loan numbers and provides a secure browsing experience.
 * @author Radian Team
 * @version 2.0.0
 * @lastModified 15-Jan-2024
 */

// ########## DO NOT MODIFY THESE LINES ##########
const EXTENSION_ID = "afkpnpkodeiolpnfnbdokgkclljpgmcm";

/**
 * Constants and Configuration
 */
const FILTER_INTERVAL_MS = 2000;

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

/**
 * Establish Communication with Loan Checker Extension
 */
async function waitForListener(maxRetries = 20, initialDelay = 100) {
  return new Promise((resolve, reject) => {
    if (
      typeof chrome === "undefined" ||
      !chrome.runtime ||
      !chrome.runtime.sendMessage
    ) {
      console.warn(
        "❌ Chrome extension API not available. Running in standalone mode."
      );
      showPage(true);
      resolve(false);
      return;
    }

    let attempts = 0;
    let delay = initialDelay;
    let timeoutId;

    function sendPing() {
      if (attempts >= maxRetries) {
        console.warn("❌ No listener detected after maximum retries.");
        clearTimeout(timeoutId);
        showPage(true);
        resolve(false);
        return;
      }

      chrome.runtime.sendMessage(
        EXTENSION_ID,
        {
          type: "ping",
        },
        (response) => {
          if (chrome.runtime.lastError) {
            console.warn("Chrome extension error:", chrome.runtime.lastError);
            attempts++;
            if (attempts >= maxRetries) {
              showPage(true);
              resolve(false);
              return;
            }
            timeoutId = setTimeout(sendPing, delay);
            return;
          }

          if (response?.result === "pong") {
            clearTimeout(timeoutId);
            resolve(true);
          } else {
            timeoutId = setTimeout(() => {
              attempts++;
              delay *= 2; // Exponential backoff
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
 * Page utility functions
 */
function showPage(val) {
  if (document.body?.style) {
    document.body.style.opacity = val ? 1 : 0;
  }
}

function togglePageDisplay(val) {
  document.body.style.display = val;
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
 * Class to manage the visibility of table rows containing loan information
 */
class TableRowFilter {
  constructor(row) {
    this.row = row;
    this.parent = row.parentElement;
    this.loanNumber = this.getLoanNumber();
  }

  getLoanNumber() {
    if (!this.row.cells || this.row.cells.length === 0) {
      return null;
    }

    const table = this.row.closest("table");
    if (!table) {
      return null;
    }

    const headerRow = table.querySelector("thead tr");
    if (!headerRow) {
      if (this.row.cells.length >= 3) {
        return this.row.cells[2].textContent.trim();
      }
      return null;
    }

    // Find the index of the "Loan Number" column
    let loanNumberIndex = -1;
    const headerCells = headerRow.cells;
    for (let i = 0; i < headerCells.length; i++) {
      if (headerCells[i].textContent.trim() === "Loan Number") {
        loanNumberIndex = i;
        break;
      }
    }

    if (loanNumberIndex !== -1 && this.row.cells.length > loanNumberIndex) {
      return this.row.cells[loanNumberIndex].textContent.trim();
    }

    if (this.row.cells.length >= 3) {
      return this.row.cells[2].textContent.trim();
    }

    return null;
  }

  async filter() {
    if (!this.loanNumber) {
      return false;
    }

    const isAllowed = await isLoanNumberAllowed(this.loanNumber);

    if (!isAllowed) {
      this.hide();
      return true;
    }

    return false;
  }

  hide() {
    if (this.parent && this.row) {
      try {
        this.row.style.display = "none";
      } catch (error) {
        console.error("[radian_filter] Error hiding row:", error);
      }
    }
  }
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
 * Process generic elements that might contain loan information
 */
async function processGenericElements() {
  const potentialContainers = document.querySelectorAll(
    '.sc-kXOizl, .sc-dJkDXt, [class*="loan"], [class*="borrower"]'
  );

  for (const container of potentialContainers) {
    if (processedElements.has(container)) continue;
    processedElements.add(container);

    if (await shouldHideElement(container)) {
      if (container.parentElement) {
        container.parentElement.removeChild(container);
      }
    }
  }
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
          }
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
    attributeFilter: ["style", "class"],
  });

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
 * Validate loan number format
 * @param {string} value - The input value to validate
 * @returns {boolean} - True if the value matches loan number format
 */
function isValidLoanNumberFormat(value) {
  if (!value) return false;

  // Remove any whitespace
  value = value.trim();

  // Check length is 13 or less
  if (value.length > 13) return false;

  // Count digits in the value
  const digitCount = (value.match(/\d/g) || []).length;

  // Must have at least 9 digits
  return digitCount >= 9;
}

/**
 * Find the search button using multiple strategies
 * @returns {HTMLButtonElement|null}
 */
function findSearchButton() {
  // Strategy 1: Find button with "Search" text
  const buttons = Array.from(document.querySelectorAll('button'));
  const searchButton = buttons.find(btn =>
    btn.textContent.trim().toLowerCase() === 'search' &&
    btn.closest('[class*="MuiButton-containedPrimary"]')
  );

  if (searchButton) return searchButton;

  // Strategy 2: Find by MUI classes and type
  const muiButtons = document.querySelectorAll('button[class*="MuiButton-containedPrimary"]');
  for (const btn of muiButtons) {
    if (btn.textContent.trim().toLowerCase() === 'search') {
      return btn;
    }
  }

  return null;
}

/**
 * Handle input blur event for loan number validation
 * @param {Event} event - The blur event
 */
async function handleLoanNumberInputBlur(event) {
  const input = event.target;
  const value = input.value.trim();

  // Skip if empty or not matching format
  if (!value || !isValidLoanNumberFormat(value)) {
    return;
  }

  // Find the search button
  const searchButton = findSearchButton();

  // Check if loan number is allowed
  const isAllowed = await isLoanNumberAllowed(value);

  if (!isAllowed) {
    // Create or get message element
    let messageElement = document.getElementById('loan-restriction-message');
    if (!messageElement) {
      messageElement = document.createElement('div');
      messageElement.id = 'loan-restriction-message';
      messageElement.style.textAlign = 'center';
      messageElement.style.padding = '15px';
      messageElement.style.fontWeight = 'bold';
      messageElement.style.color = '#721c24';
      messageElement.style.backgroundColor = '#f8d7da';
      messageElement.style.border = '1px solid #f5c6cb';
      messageElement.style.marginTop = '10px';
      input.parentElement.appendChild(messageElement);
    }

    messageElement.textContent = 'You are not provisioned to see the restricted loan';

    // Disable search button if found
    if (searchButton) {
      searchButton.disabled = true;
      searchButton.style.opacity = '0.5';
      searchButton.style.cursor = 'not-allowed';
      searchButton.setAttribute('data-restricted', 'true');
    }

    // Mark input as restricted
    input.setAttribute('data-restricted', 'true');

    // Remove any existing keypress listeners
    const oldListener = input._keypressListener;
    if (oldListener) {
      input.removeEventListener('keypress', oldListener);
    }

    // Add new keypress listener
    const keypressListener = function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    input._keypressListener = keypressListener;
    input.addEventListener('keypress', keypressListener);

  } else {
    // Remove message if exists
    const messageElement = document.getElementById('loan-restriction-message');
    if (messageElement) {
      messageElement.remove();
    }

    // Enable search button if found
    if (searchButton) {
      searchButton.disabled = false;
      searchButton.style.opacity = '';
      searchButton.style.cursor = '';
      searchButton.removeAttribute('data-restricted');
    }

    // Remove restriction from input
    input.removeAttribute('data-restricted');

    // Remove keypress listener
    const oldListener = input._keypressListener;
    if (oldListener) {
      input.removeEventListener('keypress', oldListener);
      delete input._keypressListener;
    }
  }
}

/**
 * Set up event listeners for table updates
 */
function setupTableUpdateListeners() {
  console.log("[radian_filter] setupTableUpdateListeners");

  let isProcessingSearch = false;

  // Listen for search button clicks
  const searchButton = findSearchButton();
  if (searchButton) {
    searchButton.addEventListener("click", (e) => {
      if (searchButton.hasAttribute('data-restricted') || searchButton.disabled) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      if (isProcessingSearch) {
        return; // Prevent multiple simultaneous searches
      }

      console.log(
        "[radian_filter] Search button clicked, preparing for table update"
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
    });
  }

  // Add blur event listeners to all text inputs
  const inputs = document.querySelectorAll('input[type="text"]');
  inputs.forEach(input => {
    input.addEventListener('blur', handleLoanNumberInputBlur);
  });

  // Listen for Enter key in search inputs
  const searchInputs = document.querySelectorAll('input[type="text"]');
  searchInputs.forEach((input) => {
    input.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        if (input.hasAttribute('data-restricted') ||
          (searchButton && (searchButton.disabled || searchButton.hasAttribute('data-restricted')))) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }

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
