/*!
 * @fileoverview Radian Search Filter Script
 * @description This script filters loan information in the search results based on user permissions.
 * It hides unauthorized loan numbers and provides a secure browsing experience.
 * @author Radian Team
 * @version 2.0.0
 * @lastModified 15-Jan-2024
 */

/*
 * DEBUG LOGGING ENABLED
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
  return document.querySelector("table");
}

/**
 * Establish Communication with Loan Checker Extension
 */
async function waitForListener(maxRetries = 20, initialDelay = 100) {
  console.log('[radian_filter] waitForListener: Start, maxRetries:', maxRetries, 'initialDelay:', initialDelay);
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

      console.log(`[radian_filter] Sending ping attempt ${attempts + 1}/${maxRetries}...`);

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
            console.log("✅ Listener detected!");
            clearTimeout(timeoutId);
            resolve(true);
          } else {
            console.warn("❌ No listener detected, retrying...");
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
  console.log('[radian_filter] checkNumbersBatch: Checking numbers', numbers);
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      EXTENSION_ID,
      {
        type: "queryLoans",
        loanIds: numbers,
      },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error('[radian_filter] checkNumbersBatch: chrome.runtime.lastError', chrome.runtime.lastError);
          return reject(chrome.runtime.lastError.message);
        } else if (response.error) {
          console.error('[radian_filter] checkNumbersBatch: response.error', response.error);
          return reject(response.error);
        }

        const available = Object.keys(response.result).filter(
          (key) => response.result[key]
        );
        console.log('[radian_filter] checkNumbersBatch: available', available);
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
  console.log('[radian_filter] isLoanNumberAllowed: Checking', loanNumber);
  try {
    if (
      allowedLoansCache.isCacheValid() &&
      allowedLoansCache.isAllowed(loanNumber)
    ) {
      console.log('[radian_filter] isLoanNumberAllowed: Cache hit for', loanNumber);
      return true;
    }

    const allowedNumbers = await checkNumbersBatch([loanNumber]);
    allowedLoansCache.addLoans(allowedNumbers);
    const isAllowed = allowedNumbers.includes(loanNumber);
    console.log('[radian_filter] isLoanNumberAllowed: Result for', loanNumber, isAllowed);
    return isAllowed;
  } catch (error) {
    console.error('[radian_filter] isLoanNumberAllowed: Error for', loanNumber, error);
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
        const table = this.row.closest("table");
        let columnCount = 7;

        if (table) {
          const headerRow = table.querySelector("thead tr");
          if (headerRow && headerRow.cells) {
            columnCount = headerRow.cells.length;
          }
        }

        this.parent.removeChild(this.row);
      } catch (error) {
        console.error("[radian_filter] Error removing row:", error);
      }
    }
  }
}

/**
 * Process all table rows in the search results and hide those containing unauthorized loan numbers
 */
async function processTableRows() {
  console.log('[radian_filter] processTableRows: Start');
  processedElements = new WeakSet();

  // NOTE: Use generic table selector for robustness against dynamic class names
  const table = getTargetTable();
  if (!table) {
    console.warn('[radian_filter] processTableRows: Table not found');
    showPage(true);
    return;
  }

  const tbody = table.querySelector("tbody");
  if (!tbody) {
    console.warn('[radian_filter] processTableRows: Tbody not found');
    showPage(true);
    return;
  }

  const headerRow = table.querySelector("thead tr");
  if (!headerRow) {
    console.warn('[radian_filter] processTableRows: Header row not found');
    showPage(true);
    return;
  }

  const columnCount = headerRow.cells.length;

  const originalRows = Array.from(tbody.querySelectorAll("tr"));
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
      console.log('[radian_filter] processTableRows: Row loanNumber', loanNumber, 'isAllowed', isAllowed);

      if (isAllowed) {
        allowedRows.push(row);
      } else {
        dataRowsRemoved++;
      }
    } else {
      allowedRows.push(row);
    }
  }

  // Clear tbody without using innerHTML
  while (tbody.firstChild) {
    tbody.removeChild(tbody.firstChild);
  }

  let actualDisplayedRows = 0;

  if (allowedRows.length === 0) {
    if (dataRowsCount === 1 && dataRowsRemoved === 1) {
      const unallowedElement = createUnallowedElement();
      unallowedElement
        .querySelector("td")
        .setAttribute("colspan", columnCount.toString());
      tbody.appendChild(unallowedElement);
      actualDisplayedRows = 0; // No actual data rows to display
      console.log('[radian_filter] processTableRows: All rows removed, showing unallowed message');
    } else {
      const noResultsRow = document.createElement("tr");
      const td = document.createElement("td");
      td.setAttribute("colspan", columnCount.toString());
      td.textContent = "No results found.";
      td.style.textAlign = "center";
      noResultsRow.appendChild(td);
      tbody.appendChild(noResultsRow);
      actualDisplayedRows = 0; // No actual data rows to display
      console.log('[radian_filter] processTableRows: All rows removed, showing no results');
    }
  } else {
    // Count only actual data rows (exclude rows with colspan like headers/messages)
    actualDisplayedRows = allowedRows.filter((row) => {
      return !(row.cells.length === 1 && row.cells[0].hasAttribute("colspan"));
    }).length;

    allowedRows.forEach((row) => {
      const clonedRow = row.cloneNode(true);
      tbody.appendChild(clonedRow);
    });
    console.log('[radian_filter] processTableRows: Displayed rows', actualDisplayedRows);
  }

  // Update pagination counts
  updatePaginationCounts(actualDisplayedRows);

  showPage(true);
  console.log('[radian_filter] processTableRows: End');
}

/**
 * Update pagination counts to reflect the actual number of filtered rows
 */
function updatePaginationCounts(actualRowCount) {
  console.log('[radian_filter] updatePaginationCounts: actualRowCount', actualRowCount);
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
  console.log('[radian_filter] setupMutationObserver');
  const observerState = {
    processingDebounce: null,
    lastProcessed: Date.now(),
    ignoreNextMutations: false,
  };

  const observer = new MutationObserver((mutations) => {
    if (observerState.ignoreNextMutations) {
      observerState.ignoreNextMutations = false;
      return;
    }

    if (observerState.processingDebounce) {
      clearTimeout(observerState.processingDebounce);
    }

    let shouldProcess = false;
    let tableChanged = false;

    for (const mutation of mutations) {
      if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === 1) {
            shouldProcess = true;

            if (
              node.nodeName === "TR" ||
              (node.nodeType === 1 && node.querySelector?.("tr"))
            ) {
              tableChanged = true;
              break;
            }
          }
        }
      }

      if (
        mutation.type === "attributes" &&
        mutation.attributeName === "style" &&
        (mutation.target.tagName === "TR" || mutation.target.tagName === "TD")
      ) {
        tableChanged = true;
      }
    }

    if (shouldProcess || tableChanged) {
      observerState.processingDebounce = setTimeout(() => {
        observerState.lastProcessed = Date.now();
        observerState.ignoreNextMutations = true;
        console.log('[radian_filter] MutationObserver: Detected change, processing page');
        processPage();
      }, 300);
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["style", "class", "display"],
  });

  return observer;
}

/**
 * Wait for table to be available
 */
async function waitForTable(maxAttempts = 10, delay = 300) {
  console.log('[radian_filter] waitForTable: Start, maxAttempts', maxAttempts, 'delay', delay);
  for (let i = 0; i < maxAttempts; i++) {
    const table = getTargetTable();
    if (table) {
      console.log('[radian_filter] waitForTable: Table found');
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
  console.warn('[radian_filter] waitForTable: Table not found after attempts');
  return false;
}

/**
 * Manually refresh pagination counts based on current table state
 */
function refreshPaginationCounts() {
  console.log('[radian_filter] refreshPaginationCounts');
  try {
    const table = getTargetTable();
    if (!table) {
      console.warn('[radian_filter] refreshPaginationCounts: Table not found');
      return;
    }

    const tbody = table.querySelector("tbody");
    if (!tbody) {
      console.warn('[radian_filter] refreshPaginationCounts: Tbody not found');
      return;
    }

    // Count actual data rows (exclude rows with colspan like messages)
    const dataRows = Array.from(tbody.querySelectorAll("tr")).filter((row) => {
      return !(row.cells.length === 1 && row.cells[0].hasAttribute("colspan"));
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
  console.log('[radian_filter] setupTableUpdateListeners');
  const searchButtons = document.querySelectorAll("button");
  searchButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      console.log('[radian_filter] Search button clicked, refreshing table');
      showPage(false);
      setTimeout(async () => {
        await waitForTable(5, 200);
        processPage();
      }, 800);
    });
  });

  const searchInputs = document.querySelectorAll('input[type="text"]');
  searchInputs.forEach((input) => {
    input.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        console.log('[radian_filter] Search input Enter pressed, refreshing table');
        showPage(false);
        setTimeout(async () => {
          await waitForTable(5, 200);
          processPage();
        }, 800);
      }
    });
  });
}

/**
 * Initialize the filter script
 */
async function initialize() {
  console.log('[radian_filter] initialize: Start');
  try {
    // Hide the page initially
    setTimeout(() => {
      showPage(false);
    }, 100);

    const listener = await waitForListener();
    if (!listener) {
      console.warn('[radian_filter] initialize: No listener, aborting');
      return;
    }

    const tableReady = await waitForTable();
    if (!tableReady) {
      showPage(true);
      console.warn('[radian_filter] initialize: Table not ready, aborting');
      return;
    }

    setTimeout(async () => {
      await processPage();
      setupTableUpdateListeners();
      console.log('[radian_filter] initialize: Complete');
    }, 500);
  } catch (error) {
    showPage(true);
    console.error('[radian_filter] initialize: Error', error);
  }
}

// Initialize the script when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    window.addEventListener("load", () => {
      setTimeout(() => { console.log('[radian_filter] DOMContentLoaded + load event'); initialize(); }, 1000);
    });
  });
} else if (document.readyState === "interactive") {
  window.addEventListener("load", () => {
    setTimeout(() => { console.log('[radian_filter] interactive + load event'); initialize(); }, 1000);
  });
} else {
  setTimeout(() => { console.log('[radian_filter] document ready, initializing'); initialize(); }, 1000);
}

window.radianFilter = {
  refreshPaginationCounts,
  updatePaginationCounts,
  processPage,
  allowedLoansCache,
};
