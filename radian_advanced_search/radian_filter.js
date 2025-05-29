/**
 * @fileoverview Radian Search Filter Script
 * @description This script filters loan information in the search results based on user permissions.
 * It hides unauthorized loan numbers and provides a secure browsing experience.
 * @author Radian Team
 * @version 1.0.0
 */

(function () {
  // Page utility functions
  const pageUtils = {
    /**
     * @function togglePageOpacity
     * @description Sets the page opacity. It can be used to show and hide the page content.
     * @param {number} val - The value in-between 0 and 1.
     */
    togglePageOpacity: function (val) {
      document.body.style.opacity = val;
    },

    /**
     * @function showPage
     * @description Shows or hides the page.
     * @param {boolean} val - The value can be true or false.
     */
    showPage: function (val) {
      if (document.body?.style) {
        document.body.style.opacity = val ? 1 : 0;
      }
    },

    /**
     * @function togglePageDisplay
     * @description Sets the page display. It can be used to show and hide the page content.
     * @param {string} val - The value can be 'block' or 'none'.
     */
    togglePageDisplay: function (val) {
      document.body.style.display = val;
    },

    /**
     * @function getElementByXPath
     * @description Get an element by its XPath.
     * @param {string} xpath - The XPath of the element.
     * @param {Document} [context=document] - The context in which to search for the XPath.
     * @returns {Element|null} The first element matching the XPath, or null if no match is found.
     */
    getElementByXPath: function (xpath, context = document) {
      const result = document.evaluate(
        xpath,
        context,
        null,
        XPathResult.FIRST_ORDERED_NODE_TYPE,
        null
      );
      return result.singleNodeValue;
    },
  };

  // We'll delay hiding the page to allow the initial table to render properly
  setTimeout(() => {
    pageUtils.showPage(false);
  }, 100);

  /**
   * @constant {number} FILTER_INTERVAL_MS
   * @description Interval in milliseconds for periodic filtering
   */
  const FILTER_INTERVAL_MS = 2000;

  /**
   * @constant {string} EXTENSION_ID
   * @description Chrome extension ID for communication
   */
  const EXTENSION_ID = "afkpnpkodeiolpnfnbdokgkclljpgmcm";

  /**
   * @constant {WeakSet} processedElements
   * @description Set to track elements that have already been processed
   */
  let processedElements = new WeakSet();

  /**
   * @constant {Object} allowedLoansCache
   * @description Cache for storing allowed loan numbers to reduce API calls
   */
  const allowedLoansCache = {
    /**
     * @property {Set} loans
     * @description Set of allowed loan numbers
     */
    loans: new Set(),

    /**
     * @property {number} lastUpdated
     * @description Timestamp of the last cache update
     */
    lastUpdated: 0,

    /**
     * @property {number} cacheTimeout
     * @description Cache timeout in milliseconds (5 minutes)
     */
    cacheTimeout: 5 * 60 * 1000,

    /**
     * @method isAllowed
     * @description Checks if a loan number is in the cache
     * @param {string} loanNumber - The loan number to check
     * @returns {boolean} True if the loan number is allowed, false otherwise
     */
    isAllowed(loanNumber) {
      return this.loans.has(loanNumber);
    },

    /**
     * @method addLoans
     * @description Adds loan numbers to the cache
     * @param {string[]} loanNumbers - Array of loan numbers to add
     */
    addLoans(loanNumbers) {
      loanNumbers.forEach((loan) => this.loans.add(loan));
      this.lastUpdated = Date.now();
    },

    /**
     * @method isCacheValid
     * @description Checks if the cache is still valid
     * @returns {boolean} True if the cache is valid, false otherwise
     */
    isCacheValid() {
      return (
        this.lastUpdated > 0 &&
        Date.now() - this.lastUpdated < this.cacheTimeout
      );
    },

    /**
     * @method clear
     * @description Clears the cache
     */
    clear() {
      this.loans.clear();
      this.lastUpdated = 0;
    },
  };

  /**
   * @async
   * @function waitForListener
   * @description Waits for the Chrome extension listener to be available
   * @param {number} [maxRetries=20] - Maximum number of retry attempts
   * @param {number} [initialDelay=100] - Initial delay in milliseconds between retries
   * @returns {Promise<boolean>} Promise that resolves to true if listener is available, false otherwise
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
        // Show the page if Chrome extension API is not available
        pageUtils.showPage(true);
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
          // Show the page if no listener is detected after maximum retries
          pageUtils.showPage(true);
          resolve(false);
          return;
        }

        try {
          chrome.runtime.sendMessage(
            EXTENSION_ID,
            { type: "ping" },
            (response) => {
              if (chrome.runtime.lastError) {
                console.warn(
                  "Chrome extension error:",
                  chrome.runtime.lastError
                );
                attempts++;
                if (attempts >= maxRetries) {
                  // Show the page if there's an error with the extension
                  pageUtils.showPage(true);
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
                  delay *= 2;
                  sendPing();
                }, delay);
              }
            }
          );
        } catch (error) {
          console.error("Error sending message to extension:", error);
          // Show the page if there's an error sending message to the extension
          pageUtils.showPage(true);
          resolve(false);
        }
      }

      sendPing();
    });
  }

  /**
   * @async
   * @function checkNumbersBatch
   * @description Checks if the user has access to a batch of loan numbers
   * @param {string[]} numbers - Array of loan numbers to check
   * @returns {Promise<string[]>} Promise that resolves to an array of allowed loan numbers
   */

  // List of allowed loan numbers (for demo/testing)
  const LoanNums = [
    "0194737052",
    "0151410206",
    "0180995748",
    "RTX0000044259",
    "2720025946559",
    "2502337783",
    "0000000612",
    "0000000687",
    "0000000711",
    "0000000786",
    "0000000927",
    "0000000976",
    "0000001180",
    "0000001230",
    "0000001453",
    "0000001537",
    "0000001594",
    "0000001669",
    "0000001677",
    "0000001719",
    "0000001792",
    "0000001834",
    "0000001891",
    "0000002063",
    "0000002352",
    "0000002410",
    "0000002436",
    "0000002477",
    "0000002485",
    "0000002493",
    "0000002535",
    "0000002550",
    "0000002600",
    "0000002642",
    "0000002667",
    "0000002691",
  ];

  async function checkNumbersBatch(numbers) {
    try {
      // For testing the "single restricted loan" scenario:
      // If there's only one loan number in the request and it's "0000000001",
      // return an empty array to simulate a restricted loan
      if (numbers.length === 1 && numbers[0] === "0000000001") {
        console.log(
          "[radian_filter] Test case: Single restricted loan detected"
        );
        return [];
      }

      // In a real implementation, we would call the extension API
      // For demo purposes, we'll just filter against our allowed list
      const available = numbers.filter((num) => LoanNums.includes(num));
      console.log(
        `[radian_filter] Checked ${numbers.length} loan numbers, ${available.length} are allowed`
      );

      return available;
    } catch (error) {
      console.error("[radian_filter] Error checking loan numbers:", error);
      return [];
    }
  }

  /**
   * @async
   * @function isLoanNumberAllowed
   * @description Checks if a loan number is allowed for the current user
   * @param {string} loanNumber - The loan number to check
   * @returns {Promise<boolean>} Promise that resolves to true if the loan number is allowed, false otherwise
   */
  async function isLoanNumberAllowed(loanNumber) {
    try {
      if (
        allowedLoansCache.isCacheValid() &&
        allowedLoansCache.isAllowed(loanNumber)
      ) {
        console.log(
          `[radian_filter] Loan ${loanNumber} is allowed (from cache)`
        );
        return true;
      }

      const allowedNumbers = await checkNumbersBatch([loanNumber]);
      allowedLoansCache.addLoans(allowedNumbers);
      const isAllowed = allowedNumbers.includes(loanNumber);
      return isAllowed;
    } catch (error) {
      return false;
    }
  }

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
  // This function is used to create the "You are not provisioned to see the restricted loan" message

  /**
   * @function containsLoanNumber
   * @description Checks if a text contains a potential loan number
   * @param {string} text - The text to check
   * @returns {boolean} True if the text contains a potential loan number, false otherwise
   */
  function containsLoanNumber(text) {
    return /\b\d{5,}\b/.test(text) || /\b[A-Z0-9]{5,}\b/.test(text);
  }

  /**
   * @function extractLoanNumbers
   * @description Extracts potential loan numbers from text
   * @param {string} text - The text to extract loan numbers from
   * @returns {string[]} Array of unique potential loan numbers
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
   * @class TableRowFilter
   * @description Class to manage the visibility of table rows containing loan information
   */
  class TableRowFilter {
    /**
     * @constructor
     * @description Creates a new TableRowFilter instance
     * @param {HTMLElement} row - The table row element to filter
     */
    constructor(row) {
      this.row = row;
      this.parent = row.parentElement;
      this.loanNumber = this.getLoanNumber();
    }

    /**
     * @method getLoanNumber
     * @description Extracts the loan number from the table row
     * @returns {string|null} The loan number if found, null otherwise
     */
    getLoanNumber() {
      // Check if the row has cells
      if (!this.row.cells || this.row.cells.length === 0) {
        return null;
      }

      // Find the loan number by checking the header row
      const table = this.row.closest("table");
      if (!table) {
        return null;
      }

      const headerRow = table.querySelector("thead tr");
      if (!headerRow) {
        // Fallback to the 3rd column if header row not found
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

      // If we found the loan number column and the row has that many cells
      if (loanNumberIndex !== -1 && this.row.cells.length > loanNumberIndex) {
        return this.row.cells[loanNumberIndex].textContent.trim();
      }

      // Fallback to the 3rd column (index 2) if we couldn't find it by header
      if (this.row.cells.length >= 3) {
        return this.row.cells[2].textContent.trim();
      }

      return null;
    }

    /**
     * @async
     * @method filter
     * @description Filters the table row based on loan number access
     * @returns {Promise<boolean>} Promise that resolves to true if the row was hidden, false otherwise
     */
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

    /**
     * @method hide
     * @description Completely removes the table row with unauthorized loan numbers
     */
    hide() {
      if (this.parent && this.row) {
        try {
          // Get the number of columns from the table header
          const table = this.row.closest("table");
          let columnCount = 7; // Default fallback

          if (table) {
            const headerRow = table.querySelector("thead tr");
            if (headerRow && headerRow.cells) {
              columnCount = headerRow.cells.length;
            }
          }

          // Log the removal for debugging
          console.log(
            `[radian_filter] Removing row with loan number: ${this.loanNumber}, column count: ${columnCount}`
          );

          // Remove the row
          this.parent.removeChild(this.row);
        } catch (error) {
          console.error("[radian_filter] Error removing row:", error);
        }
      }
    }
  }

  /**
   * @async
   * @function processTableRows
   * @description Processes all table rows in the search results and hides those containing unauthorized loan numbers
   */
  async function processTableRows() {
    // Create a new WeakSet for processed elements
    processedElements = new WeakSet();

    const table = document.querySelector("table.sc-jBIHhB");
    if (!table) {
      console.log("[radian_filter] No table found with class sc-jBIHhB");
      pageUtils.showPage(true);
      return;
    }

    const tbody = table.querySelector("tbody");
    if (!tbody) {
      console.log("[radian_filter] No tbody found in table");
      pageUtils.showPage(true);
      return;
    }

    // Get the number of columns from the header row
    const headerRow = table.querySelector("thead tr");
    if (!headerRow) {
      console.log("[radian_filter] No header row found in table");
      pageUtils.showPage(true);
      return;
    }

    const columnCount = headerRow.cells.length;
    console.log(`[radian_filter] Table has ${columnCount} columns`);

    // Instead of modifying the existing table, we'll create a new filtered table
    // This approach preserves the original structure and styling
    const originalRows = Array.from(tbody.querySelectorAll("tr"));
    const allowedRows = [];
    let dataRowsCount = 0;
    let dataRowsRemoved = 0;

    // First, identify which rows are allowed
    for (const row of originalRows) {
      // Skip rows that are clearly not data rows (like "No results found" rows)
      if (row.cells.length === 1 && row.cells[0].hasAttribute("colspan")) {
        allowedRows.push(row); // Keep message rows
        continue;
      }

      // Process data rows (rows with multiple cells)
      if (row.cells.length > 1) {
        dataRowsCount++;

        // Extract loan number from the row (3rd column, index 2)
        let loanNumber = null;
        if (row.cells.length > 2) {
          loanNumber = row.cells[2].textContent.trim();
        }

        if (!loanNumber) {
          console.log("[radian_filter] No loan number found in row");
          allowedRows.push(row); // Keep rows without loan numbers
          continue;
        }

        console.log(
          `[radian_filter] Processing row with loan number: ${loanNumber}`
        );
        const isAllowed = await isLoanNumberAllowed(loanNumber);

        if (isAllowed) {
          allowedRows.push(row); // Keep allowed rows
        } else {
          dataRowsRemoved++;
        }
      } else {
        allowedRows.push(row); // Keep non-data rows
      }
    }

    console.log(
      `[radian_filter] Processed ${dataRowsCount} rows, removed ${dataRowsRemoved} unauthorized rows`
    );

    // Clear the tbody and add only the allowed rows
    tbody.innerHTML = "";

    // Add the allowed rows back to the table
    if (allowedRows.length === 0) {
      // Check if this was a case where we had exactly one row that was restricted
      if (dataRowsCount === 1 && dataRowsRemoved === 1) {
        // This is the special case: exactly one record that was restricted
        // Use the existing createUnallowedElement function
        const unallowedElement = createUnallowedElement();
        // Make sure the colspan matches the current table
        unallowedElement
          .querySelector("td")
          .setAttribute("colspan", columnCount.toString());
        tbody.appendChild(unallowedElement);
        console.log(
          "[radian_filter] Showing restricted loan message for single restricted result"
        );
      } else {
        // Standard "No results found" message for other cases
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
      // Add all allowed rows back to the table
      allowedRows.forEach((row) => {
        // Clone the row to avoid any reference issues
        const clonedRow = row.cloneNode(true);
        tbody.appendChild(clonedRow);
      });
      console.log(
        `[radian_filter] Added ${allowedRows.length} allowed rows to table`
      );
    }

    // Show the page after filtering
    pageUtils.showPage(true);
  }

  /**
   * @async
   * @function shouldHideElement
   * @description Determines if an element should be hidden based on the loan numbers it contains
   * @param {HTMLElement} element - The element to check
   * @returns {Promise<boolean>} Promise that resolves to true if the element should be hidden, false otherwise
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
   * @async
   * @function processGenericElements
   * @description Processes generic elements that might contain loan information and hides those with unauthorized loan numbers
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
   * @async
   * @function processPage
   * @description Processes the entire page to hide unauthorized loan information
   */
  async function processPage() {
    try {
      console.log("[radian_filter] Processing page...");

      // First process the table rows (most important)
      await processTableRows();

      // Then process any other elements on the page that might contain loan numbers
      // Commenting this out for now as it might be causing issues with the table
      // await processGenericElements();

      // Show the page after processing
      pageUtils.showPage(true);
      console.log("[radian_filter] Page processing complete");
    } catch (error) {
      console.error("Error processing page:", error);
      // Show the page even if there's an error
      pageUtils.showPage(true);
    }
  }

  /**
   * @function setupMutationObserver
   * @description Sets up a mutation observer to monitor DOM changes and filter new content
   * @returns {MutationObserver} The created mutation observer
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
              // Element node
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
   * @async
   * @function initialize
   * @description Initializes the filter script
   */
  async function initialize() {
    try {
      console.log("[radian_filter] Initializing filter script");

      // Wait for the extension listener to be available
      const listenerAvailable = await waitForListener();

      if (listenerAvailable) {
        console.log("✅ Extension listener connected successfully");
      } else {
        console.warn("⚠️ Running in standalone mode without extension");
      }

      // Wait for the table to be available before processing
      const waitForTable = async (maxAttempts = 10, delay = 300) => {
        for (let i = 0; i < maxAttempts; i++) {
          const table = document.querySelector("table.sc-jBIHhB");
          if (table) {
            console.log(
              "[radian_filter] Table found, proceeding with filtering"
            );
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
      };

      // Wait for table to be available and fully rendered
      const tableReady = await waitForTable();
      if (!tableReady) {
        console.warn(
          "[radian_filter] Table not found, showing page without filtering"
        );
        pageUtils.showPage(true);
        return;
      }

      // Process page immediately after table is ready
      await processPage();

      // Set up event listeners for table updates
      const setupTableUpdateListeners = () => {
        // Listen for search button clicks
        const searchButtons = document.querySelectorAll("button");
        searchButtons.forEach((btn) => {
          btn.addEventListener("click", () => {
            console.log(
              "[radian_filter] Button clicked, will process table after delay"
            );
            // Hide the page while processing
            pageUtils.showPage(false);
            setTimeout(async () => {
              await waitForTable(5, 200);
              processPage(); // This will show the page when done
            }, 800); // Longer delay to ensure table is fully rendered
          });
        });

        // Listen for Enter key in search inputs
        const searchInputs = document.querySelectorAll('input[type="text"]');
        searchInputs.forEach((input) => {
          input.addEventListener("keypress", (e) => {
            if (e.key === "Enter") {
              console.log(
                "[radian_filter] Enter pressed in search input, will process table after delay"
              );
              // Hide the page while processing
              pageUtils.showPage(false);
              setTimeout(async () => {
                await waitForTable(5, 200);
                processPage(); // This will show the page when done
              }, 800); // Longer delay to ensure table is fully rendered
            }
          });
        });
      };

      setupTableUpdateListeners();

      // Set up a lightweight mutation observer just for table changes
      const tableObserver = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          if (
            mutation.type === "childList" &&
            (mutation.target.tagName === "TBODY" ||
              mutation.target.tagName === "TABLE" ||
              mutation.target.closest("table"))
          ) {
            console.log("[radian_filter] Table mutation detected, processing");
            processPage();
            break;
          }
        }
      });

      // Start observing the document with the configured parameters
      const tableContainer = document.querySelector(".table-container");
      if (tableContainer) {
        tableObserver.observe(tableContainer, {
          childList: true,
          subtree: true,
        });
        console.log("[radian_filter] Table observer set up");
      }
    } catch (error) {
      console.error("Error initializing filter:", error);
      // Show the page if there's an error initializing
      pageUtils.showPage(true);
    }
  }

  // Start the initialization process when the DOM is fully loaded and all resources are loaded
  if (document.readyState === "loading") {
    // If the document is still loading, wait for DOMContentLoaded
    document.addEventListener("DOMContentLoaded", () => {
      // After DOM is loaded, wait for window.load to ensure all resources are loaded
      window.addEventListener("load", () => {
        // Wait a bit after load to ensure all scripts have run and the table is rendered
        setTimeout(initialize, 1000);
      });
    });
  } else if (document.readyState === "interactive") {
    // If DOM is loaded but resources are still loading, wait for window.load
    window.addEventListener("load", () => {
      setTimeout(initialize, 1000);
    });
  } else {
    // If everything is already loaded, just wait a bit to ensure the table is rendered
    setTimeout(initialize, 1000);
  }
})();
