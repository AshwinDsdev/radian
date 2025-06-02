/**
 * @fileoverview Radian Cancel MI Filter Script
 * @description This script filters loan information in the Cancel MI page based on user permissions.
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

  // We'll delay hiding the page to allow the initial content to render properly
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

  /**
   * @function createUnallowedElement
   * @description Creates an element to display when a loan is not allowed
   * @returns {HTMLElement} The created element
   */
  function createUnallowedElement() {
    const unallowedDiv = document.createElement("div");
    unallowedDiv.className = "sc-bDoHkx bJPUrZ";
    unallowedDiv.style.textAlign = "center";
    unallowedDiv.style.padding = "15px";
    unallowedDiv.style.fontWeight = "bold";
    unallowedDiv.style.color = "#721c24";
    unallowedDiv.style.backgroundColor = "#f8d7da";
    unallowedDiv.style.border = "1px solid #f5c6cb";
    
    const paragraph = document.createElement("p");
    paragraph.className = "sc-fXqexe fAoMkQ MuiTypography-root MuiTypography-body2";
    paragraph.textContent = "You are not provisioned to see the restricted loan";
    
    unallowedDiv.appendChild(paragraph);
    return unallowedDiv;
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
   * @class LoanInfoFilter
   * @description Class to manage the visibility of loan information
   */
  class LoanInfoFilter {
    /**
     * @constructor
     * @description Creates a new LoanInfoFilter instance
     * @param {HTMLElement} container - The container element with loan information
     */
    constructor(container) {
      this.container = container;
      this.parent = container.parentElement;
      this.loanNumber = this.getLoanNumber();
    }

    /**
     * @method getLoanNumber
     * @description Extracts the loan number from the container
     * @returns {string|null} The loan number if found, null otherwise
     */
    getLoanNumber() {
      // Find the loan number in the container
      const loanNumberElements = Array.from(this.container.querySelectorAll("p.sc-fXqexe"));
      
      // First, look for the label "Loan Number"
      const labelElement = loanNumberElements.find(el => 
        el.textContent.trim() === "Loan Number"
      );
      
      if (labelElement) {
        // Find the next element which should contain the actual loan number
        const index = loanNumberElements.indexOf(labelElement);
        if (index >= 0 && index + 1 < loanNumberElements.length) {
          const loanNumberText = loanNumberElements[index + 1].textContent.trim();
          if (containsLoanNumber(loanNumberText)) {
            return loanNumberText;
          }
        }
      }
      
      // Fallback: check all paragraphs for potential loan numbers
      for (const element of loanNumberElements) {
        const text = element.textContent.trim();
        if (containsLoanNumber(text)) {
          return text;
        }
      }
      
      return null;
    }

    /**
     * @async
     * @method filter
     * @description Filters the loan information based on loan number access
     * @returns {Promise<boolean>} Promise that resolves to true if the information was hidden, false otherwise
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
      
      if (!isAllowed) {
        console.log(
          `[radian_filter] Loan ${this.loanNumber} is not allowed, hiding information`
        );
        
        // Replace the container with the unallowed element
        const unallowedElement = createUnallowedElement();
        if (this.parent) {
          this.parent.replaceChild(unallowedElement, this.container);
          return true;
        }
      } else {
        console.log(
          `[radian_filter] Loan ${this.loanNumber} is allowed, showing information`
        );
      }
      
      return false;
    }
  }

  /**
   * @async
   * @function filterLoanInfo
   * @description Filters loan information on the page
   */
  async function filterLoanInfo() {
    try {
      // Find all loan info containers
      const loanContainers = document.querySelectorAll(".sc-bDoHkx");
      
      if (loanContainers.length === 0) {
        console.log("[radian_filter] No loan containers found");
        return;
      }
      
      console.log(`[radian_filter] Found ${loanContainers.length} potential loan containers`);
      
      // Process each container that hasn't been processed yet
      for (const container of loanContainers) {
        if (processedElements.has(container)) {
          continue;
        }
        
        const filter = new LoanInfoFilter(container);
        await filter.filter();
        
        // Mark as processed
        processedElements.add(container);
      }
    } catch (error) {
      console.error("[radian_filter] Error filtering loan info:", error);
    }
  }

  /**
   * @function setupMutationObserver
   * @description Sets up a mutation observer to detect changes to the DOM
   */
  function setupMutationObserver() {
    const observer = new MutationObserver((mutations) => {
      let shouldFilter = false;
      
      for (const mutation of mutations) {
        if (
          mutation.type === "childList" &&
          mutation.addedNodes.length > 0
        ) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              // Check if the added node or its children contain loan info
              if (
                node.classList?.contains("sc-bDoHkx") ||
                node.querySelector(".sc-bDoHkx")
              ) {
                shouldFilter = true;
                break;
              }
            }
          }
        }
        
        if (shouldFilter) break;
      }
      
      if (shouldFilter) {
        filterLoanInfo();
      }
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
    
    return observer;
  }

  /**
   * @async
   * @function init
   * @description Initializes the filter script
   */
  async function init() {
    try {
      console.log("[radian_filter] Initializing filter script");
      
      // Wait for the extension listener to be available
      const listenerAvailable = await waitForListener();
      
      if (!listenerAvailable) {
        console.warn(
          "[radian_filter] Extension listener not available, showing page without filtering"
        );
        pageUtils.showPage(true);
        return;
      }
      
      console.log("[radian_filter] Extension listener available, setting up filtering");
      
      // Initial filtering
      await filterLoanInfo();
      
      // Set up mutation observer for dynamic content
      const observer = setupMutationObserver();
      
      // Set up periodic filtering
      const intervalId = setInterval(filterLoanInfo, FILTER_INTERVAL_MS);
      
      // Show the page after initial filtering
      pageUtils.showPage(true);
      
      console.log("[radian_filter] Filter script initialized successfully");
    } catch (error) {
      console.error("[radian_filter] Error initializing filter script:", error);
      pageUtils.showPage(true);
    }
  }

  // Initialize the script
  init();
})();