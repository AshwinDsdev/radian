(function () {
  // Constants
  const EXTENSION_ID = "afkpnpkodeiolpnfnbdokgkclljpgmcm";
  const processedElements = new WeakSet();

  // Cache for storing allowed loan numbers
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
    }
  };

  /**
   * Checks if a loan number is allowed for the current user
   * @param {string} loanNumber - The loan number to check
   * @returns {Promise<boolean>} Promise that resolves to true if the loan number is allowed
   */
  async function isLoanNumberAllowed(loanNumber) {
    try {
      if (allowedLoansCache.isCacheValid() && allowedLoansCache.isAllowed(loanNumber)) {
        return true;
      }

      const allowedNumbers = await checkNumbersBatch([loanNumber]);
      allowedLoansCache.addLoans(allowedNumbers);
      return allowedNumbers.includes(loanNumber);
    } catch (error) {
      console.warn("Failed to check loan access, assuming not allowed");
      return false;
    }
  }

  /**
   * Checks if the user has access to a batch of loan numbers
   * @param {string[]} numbers - Array of loan numbers to check
   * @returns {Promise<string[]>} Promise that resolves to an array of allowed loan numbers
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
   * Creates a message element to display when a loan is restricted
   * @returns {HTMLElement} The created message element
   */
  function createRestrictedMessage() {
    const messageDiv = document.createElement("div");
    messageDiv.className = "restricted-loan-message";
    messageDiv.style.cssText = `
      padding: 20px;
      margin: 20px 0;
      background-color: #f8d7da;
      border: 1px solid #f5c6cb;
      border-radius: 4px;
      color: #721c24;
      text-align: center;
      font-weight: bold;
    `;
    messageDiv.textContent = "You are not provisioned to see the restricted loan";
    return messageDiv;
  }

  /**
   * Processes search results and handles loan access control
   * @param {HTMLElement} container - The container element containing search results
   */
  async function processSearchResults(container) {
    const rows = container.querySelectorAll("tr");
    let hasVisibleResults = false;

    for (const row of rows) {
      if (processedElements.has(row)) continue;
      processedElements.add(row);

      // Extract loan number from the row (assuming it's in the 3rd column)
      const loanNumberCell = row.cells[2];
      if (!loanNumberCell) continue;

      const loanNumber = loanNumberCell.textContent.trim();
      if (!loanNumber) continue;

      const isAllowed = await isLoanNumberAllowed(loanNumber);
      if (!isAllowed) {
        // Replace the row with a restricted message
        const messageRow = document.createElement("tr");
        const messageCell = document.createElement("td");
        messageCell.colSpan = row.cells.length;
        messageCell.appendChild(createRestrictedMessage());
        messageRow.appendChild(messageCell);
        row.parentNode.replaceChild(messageRow, row);
      } else {
        hasVisibleResults = true;
      }
    }

    // If no results are visible, show a message
    if (!hasVisibleResults) {
      const noResultsMessage = document.createElement("div");
      noResultsMessage.style.cssText = `
        padding: 20px;
        margin: 20px 0;
        background-color: #e2e3e5;
        border: 1px solid #d6d8db;
        border-radius: 4px;
        color: #383d41;
        text-align: center;
      `;
      noResultsMessage.textContent = "No accessible loan records found";
      container.appendChild(noResultsMessage);
    }
  }

  // Initialize the advanced search functionality
  function initialize() {
    // Find the search results container
    const resultsContainer = document.querySelector("#searchResults");
    if (!resultsContainer) return;

    // Process search results when they are loaded
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
          processSearchResults(resultsContainer);
        }
      }
    });

    observer.observe(resultsContainer, {
      childList: true,
      subtree: true
    });

    // Initial processing
    processSearchResults(resultsContainer);
  }

  // Start the initialization when the DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize);
  } else {
    initialize();
  }
})(); 