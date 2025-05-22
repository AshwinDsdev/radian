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

  // Hide the page immediately to prevent unauthorized loan numbers from being visible
  pageUtils.showPage(false);

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
  const processedElements = new WeakSet();

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
  // async function checkNumbersBatch(numbers) {
  //   return new Promise((resolve, reject) => {
  //     chrome.runtime.sendMessage(
  //       EXTENSION_ID,
  //       {
  //         type: "queryLoans",
  //         loanIds: numbers,
  //       },
  //       (response) => {
  //         if (chrome.runtime.lastError) {
  //           return reject(chrome.runtime.lastError.message);
  //         } else if (response.error) {
  //           return reject(response.error);
  //         }

  //         const available = Object.keys(response.result).filter(
  //           (key) => response.result[key]
  //         );
  //         resolve(available);
  //       }
  //     );
  //   });
  // }

   const LoanNums = [
    "0194737052",
    "0151410206",
    "0180995748",
    "0000000612",
    "0000000687",
    "0000000711",
    "0000000786",
    "0000000927",
    "0000000976",
    "0194737052",
    "0000001180",
    "0000001230",
    "0151410206",
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
    "0180995748",
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

  const checkNumbersBatch = async (numbers) => {
    const available = numbers.filter((num) => LoanNums.includes(num));
    return available;
  };

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
   * @function createUnallowedElement
   * @description Creates a DOM element to display when a loan is not provisioned to the user
   * @returns {HTMLElement} The created element
   */
  function createUnallowedElement() {
    const unallowed = document.createElement("tr");
    const td = document.createElement("td");
    td.setAttribute("colspan", "7");
    td.appendChild(
      document.createTextNode("Loan is not provisioned to the user")
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
      this.unallowed = createUnallowedElement();
      this.loanNumber = this.getLoanNumber();
    }

    /**
     * @method getLoanNumber
     * @description Extracts the loan number from the table row
     * @returns {string|null} The loan number if found, null otherwise
     */
    getLoanNumber() {
      // In the Radian search table, loan number is in the 3rd column (index 2)
      const loanNumberCell = this.row.cells[2];
      if (loanNumberCell) {
        return loanNumberCell.textContent.trim();
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
      if (!this.loanNumber) return false;

      const isAllowed = await isLoanNumberAllowed(this.loanNumber);
      if (!isAllowed) {
        this.hide();
        return true;
      }

      return false;
    }

    /**
     * @method hide
     * @description Hides the table row and shows the unallowed message
     */
    hide() {
      this.row.style.display = "none";
      if (this.parent) {
        this.parent.insertBefore(this.unallowed, this.row.nextSibling);
      }
    }
  }

  /**
   * @async
   * @function processTableRows
   * @description Processes all table rows in the search results and hides those containing unauthorized loan numbers
   */
  async function processTableRows() {
    const tableRows = document.querySelectorAll(".sc-jBIHhB tbody tr");
    
    for (const row of tableRows) {
      if (processedElements.has(row)) continue;
      processedElements.add(row);

      const filter = new TableRowFilter(row);
      await filter.filter();
    }
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
        container.style.display = "none";
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
      await processTableRows();
      await processGenericElements();
      
      // Show the page after processing
      pageUtils.showPage(true);
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
            if (node.nodeType === 1) { // Element node
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
        
        if (mutation.type === "attributes" && 
            mutation.attributeName === "style" &&
            (mutation.target.tagName === "TR" || mutation.target.tagName === "TD")) {
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
      // Wait for the extension listener to be available
      // const listenerAvailable = await waitForListener();

      // if (listenerAvailable) {
      //   console.log("✅ Extension listener connected successfully");
      // } else {
      //   console.warn("⚠️ Running in standalone mode without extension");
      // }

      // Process page will handle showing the page after filtering
      await processPage();

      // Set up mutation observer for dynamic content
      setupMutationObserver();

      // Set up interval for periodic processing
      setInterval(processPage, FILTER_INTERVAL_MS);
    } catch (error) {
      console.error("Error initializing filter:", error);
      // Show the page if there's an error initializing
      pageUtils.showPage(true);
    }
  }

  // Start the initialization process when the DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize);
  } else {
    initialize();
  }
})();