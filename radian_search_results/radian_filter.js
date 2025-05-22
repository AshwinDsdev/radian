/**
 * @fileoverview Radian Certificate Filter Script
 * @description This script filters certificate information based on user permissions.
 * It hides unauthorized certificate/loan numbers and provides a secure browsing experience.
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

  // Hide the page immediately to prevent unauthorized certificate/loan numbers from being visible
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
   * @description Creates a DOM element to display when a certificate is not provisioned to the user
   * @returns {HTMLElement} The created element
   */
  function createUnallowedElement() {
    const unallowed = document.createElement("div");
    unallowed.appendChild(
      document.createTextNode("Loan is not provisioned to the user")
    );
    unallowed.className = "result-item unauthorized-message";
    unallowed.style.display = "flex";
    unallowed.style.justifyContent = "center";
    unallowed.style.alignItems = "center";
    unallowed.style.height = "100px";
    unallowed.style.fontSize = "20px";
    unallowed.style.fontWeight = "bold";
    unallowed.style.color = "#721c24";
    unallowed.style.backgroundColor = "#f8d7da";
    unallowed.style.border = "1px solid #f5c6cb";
    unallowed.style.borderRadius = "4px";
    unallowed.style.padding = "20px";
    unallowed.style.margin = "20px 0";
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
   * @class ResultItemFilter
   * @description Class to manage the visibility of certificate result items
   */
  class ResultItemFilter {
    /**
     * @constructor
     * @description Creates a new ResultItemFilter instance
     * @param {HTMLElement} resultItem - The result item element to filter
     */
    constructor(resultItem) {
      this.resultItem = resultItem;
      this.parent = resultItem.parentElement;
      this.unallowed = createUnallowedElement();
    }

    /**
     * @method getLoanNumber
     * @description Extracts the loan number from the result item
     * @returns {string|null} The loan number if found, null otherwise
     */
    getLoanNumber() {
      // Look for loan number in the result details
      const resultDetails = this.resultItem.querySelector(".result-details");
      if (resultDetails) {
        // Find the paragraph that contains "Loan Number:"
        const paragraphs = resultDetails.querySelectorAll("p");
        for (const p of paragraphs) {
          if (p.textContent.includes("Loan Number:")) {
            // Extract the loan number using regex
            const match = p.textContent.match(/Loan Number:\s*(\d+)/);
            if (match && match[1]) {
              return match[1];
            }
          }
        }
      }

      // Look for certificate number in the result title as a fallback
      const titleElement = this.resultItem.querySelector(".result-title");
      if (titleElement) {
        const titleText = titleElement.textContent;
        const match = titleText.match(/Certificate #(\d+)/);
        if (match && match[1]) {
          return match[1];
        }
      }

      // As a last resort, extract any potential loan numbers from the entire result item
      const text =
        this.resultItem.innerText || this.resultItem.textContent || "";
      const potentialLoanNumbers = extractLoanNumbers(text);
      return potentialLoanNumbers.length > 0 ? potentialLoanNumbers[0] : null;
    }

    /**
     * @async
     * @method filter
     * @description Filters the result item based on loan number access
     * @param {string[]} [allowedNumbers=[]] - Optional array of pre-checked allowed loan numbers
     * @returns {Promise<boolean>} Promise that resolves to true if the item was hidden, false otherwise
     */
    async filter(allowedNumbers = []) {
      const loanNumber = this.getLoanNumber();
      if (!loanNumber) return false;

      let isAllowed = false;

      // First check if the loan number is in the provided allowed numbers
      if (allowedNumbers.length > 0) {
        isAllowed = allowedNumbers.includes(loanNumber);
      } else {
        // If not provided, check individually
        isAllowed = await isLoanNumberAllowed(loanNumber);
      }

      if (!isAllowed) {
        this.hide();
        return true;
      }

      return false;
    }

    /**
     * @method hide
     * @description Hides the result item and shows the unallowed message
     */
    hide() {
      this.resultItem.style.display = "none";
      this.parent.insertBefore(this.unallowed, this.resultItem);
    }
  }

  /**
   * @async
   * @function processResultItems
   * @description Processes all result items in the document and hides those containing unauthorized loan numbers
   */
  async function processResultItems() {
    const resultItems = document.querySelectorAll(".result-item");
    if (!resultItems || resultItems.length === 0) return;

    // Collect all loan numbers first to batch process them
    const loanNumbersMap = new Map();

    for (const item of resultItems) {
      if (processedElements.has(item)) continue;

      const filter = new ResultItemFilter(item);
      const loanNumber = filter.getLoanNumber();

      if (loanNumber) {
        loanNumbersMap.set(loanNumber, item);
      }
    }

    if (loanNumbersMap.size === 0) {
      // No loan numbers found, show the page
      pageUtils.showPage(true);
      return;
    }

    try {
      // Batch check all loan numbers at once
      const loanNumbers = Array.from(loanNumbersMap.keys());
      const allowedNumbers = await checkNumbersBatch(loanNumbers);

      // Add allowed numbers to cache
      allowedLoansCache.addLoans(allowedNumbers);

      // Process each result item
      for (const [loanNumber, item] of loanNumbersMap.entries()) {
        processedElements.add(item);

        if (!allowedNumbers.includes(loanNumber)) {
          // Loan number not allowed, hide the item
          const filter = new ResultItemFilter(item);
          filter.hide();
        }
      }
    } catch (error) {
      console.error("Error processing result items:", error);
    }
  }

  /**
   * @async
   * @function processPage
   * @description Processes the entire page to hide unauthorized loan information
   */
  async function processPage() {
    try {
      console.log("Processing page to filter unauthorized loan information...");

      // Process result items first
      await processResultItems();

      // Then process any other elements that might contain loan numbers
      const otherElements = document.querySelectorAll(
        "div:not(.result-item), p, span, a"
      );
      for (const element of otherElements) {
        if (processedElements.has(element)) continue;

        const text = element.innerText || element.textContent || "";
        if (containsLoanNumber(text)) {
          processedElements.add(element);

          const potentialLoanNumbers = extractLoanNumbers(text);
          if (potentialLoanNumbers.length > 0) {
            let shouldHide = true;

            for (const loanNumber of potentialLoanNumbers) {
              if (await isLoanNumberAllowed(loanNumber)) {
                shouldHide = false;
                break;
              }
            }
            console.log(`Loan number access: ${shouldHide}`);
          }
        }
      }

      console.log("Page processing complete.");

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

      for (const mutation of mutations) {
        if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === 1) {
              // Element node
              shouldProcess = true;
              break;
            }
          }
        }
      }

      if (shouldProcess) {
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
      // // Wait for the extension listener to be available
      const listenerAvailable = await waitForListener();

      if (listenerAvailable) {
        console.log("✅ Extension listener connected successfully");
      } else {
        console.warn("⚠️ Running in standalone mode without extension");
      }

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
