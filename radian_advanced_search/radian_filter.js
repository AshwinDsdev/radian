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
      this.lastUpdated > 0 &&
      Date.now() - this.lastUpdated < this.cacheTimeout
    );
  },

  clear() {
    this.loans.clear();
    this.lastUpdated = 0;
  },
};

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

      console.log(`🔄 Sending ping attempt ${attempts + 1}/${maxRetries}...`);

      chrome.runtime.sendMessage(
        EXTENSION_ID,
        {
          type: "ping",
        },
        (response) => {
          if (chrome.runtime.lastError) {
            console.warn(
              "Chrome extension error:",
              chrome.runtime.lastError
            );
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
      console.log(`[radian_filter] Loan ${loanNumber} is allowed (from cache)`);
      return true;
    }

    const allowedNumbers = await checkNumbersBatch([loanNumber]);
    allowedLoansCache.addLoans(allowedNumbers);
    const isAllowed = allowedNumbers.includes(loanNumber);
    return isAllowed;
  } catch (error) {
    console.error("[radian_filter] Error checking loan number:", error);
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
      console.log("[radian_filter] No loan number to check");
      return false;
    }

    console.log(
      "[radian_filter] Checking if loan number is allowed:",
      this.loanNumber
    );
    const isAllowed = await isLoanNumberAllowed(this.loanNumber);
    console.log("[radian_filter] Loan number check result:", {
      loanNumber: this.loanNumber,
      isAllowed,
    });

    if (!isAllowed) {
      console.log("[radian_filter] Loan number not allowed, hiding row");
      this.hide();
      return true;
    }

    console.log("[radian_filter] Loan number allowed, showing row");
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

        console.log(
          `[radian_filter] Removing row with loan number: ${this.loanNumber}, column count: ${columnCount}`
        );

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
  processedElements = new WeakSet();

  const table = document.querySelector("table.sc-jBIHhB");
  if (!table) {
    console.log("[radian_filter] No table found with class sc-jBIHhB");
    showPage(true);
    return;
  }

  const tbody = table.querySelector("tbody");
  if (!tbody) {
    console.log("[radian_filter] No tbody found in table");
    showPage(true);
    return;
  }

  const headerRow = table.querySelector("thead tr");
  if (!headerRow) {
    console.log("[radian_filter] No header row found in table");
    showPage(true);
    return;
  }

  const columnCount = headerRow.cells.length;
  console.log(`[radian_filter] Table has ${columnCount} columns`);

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
        console.log("[radian_filter] No loan number found in row");
        allowedRows.push(row);
        continue;
      }

      console.log(
        `[radian_filter] Processing row with loan number: ${loanNumber}`
      );
      const isAllowed = await isLoanNumberAllowed(loanNumber);

      if (isAllowed) {
        allowedRows.push(row);
      } else {
        dataRowsRemoved++;
      }
    } else {
      allowedRows.push(row);
    }
  }

  console.log(
    `[radian_filter] Processed ${dataRowsCount} rows, removed ${dataRowsRemoved} unauthorized rows`
  );

  tbody.innerHTML = "";

  if (allowedRows.length === 0) {
    if (dataRowsCount === 1 && dataRowsRemoved === 1) {
      const unallowedElement = createUnallowedElement();
      unallowedElement
        .querySelector("td")
        .setAttribute("colspan", columnCount.toString());
      tbody.appendChild(unallowedElement);
      console.log(
        "[radian_filter] Showing restricted loan message for single restricted result"
      );
    } else {
      const noResultsRow = document.createElement("tr");
      const td = document.createElement("td");
      td.setAttribute("colspan", columnCount.toString());
      td.textContent = "No results found.";
      td.style.textAlign = "center";
      noResultsRow.appendChild(td);
      tbody.appendChild(noResultsRow);
      console.log("[radian_filter] Showing no results message");
    }
  } else {
    allowedRows.forEach((row) => {
      const clonedRow = row.cloneNode(true);
      tbody.appendChild(clonedRow);
    });
    console.log(
      `[radian_filter] Added ${allowedRows.length} allowed rows to table`
    );
  }

  showPage(true);
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
    console.log("[radian_filter] Processing page...");

    await processTableRows();

    showPage(true);
    console.log("[radian_filter] Page processing complete");
  } catch (error) {
    console.error("Error processing page:", error);
    showPage(true);
  }
}

/**
 * Set up mutation observer to monitor DOM changes
 */
function setupMutationObserver() {
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
  for (let i = 0; i < maxAttempts; i++) {
    const table = document.querySelector("table.sc-jBIHhB");
    if (table) {
      console.log("[radian_filter] Table found, proceeding with filtering");
      return true;
    }
    console.log(
      `[radian_filter] Table not found, waiting (attempt ${
        i + 1
      }/${maxAttempts})`
    );
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
  console.warn("[radian_filter] Table not found after maximum attempts");
  return false;
}

/**
 * Set up event listeners for table updates
 */
function setupTableUpdateListeners() {
  const searchButtons = document.querySelectorAll("button");
  searchButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      console.log(
        "[radian_filter] Button clicked, will process table after delay"
      );
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
        console.log(
          "[radian_filter] Enter pressed in search input, will process table after delay"
        );
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
  try {
    console.log("[radian_filter] Initializing filter script");

    // Hide the page initially
    setTimeout(() => {
      showPage(false);
    }, 100);

    const listener = await waitForListener();
    if (!listener) return;

    const tableReady = await waitForTable();
    if (!tableReady) {
      console.warn(
        "[radian_filter] Table not found, showing page without filtering"
      );
      showPage(true);
      return;
    }

    setTimeout(async () => {
      await processPage();
      setupTableUpdateListeners();
    }, 500);
  } catch (error) {
    console.error("Error initializing filter:", error);
    showPage(true);
  }
}

// Initialize the script when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    window.addEventListener("load", () => {
      setTimeout(initialize, 1000);
    });
  });
} else if (document.readyState === "interactive") {
  window.addEventListener("load", () => {
    setTimeout(initialize, 1000);
  });
} else {
  setTimeout(initialize, 1000);
}
