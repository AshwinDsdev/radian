/*!
 * @description : Radian Cancel MI Filter Script
 * @portal : Radian Cancel MI Portal
 * @author : Radian Team
 * @group : Radian
 * @owner : Radian
 * @lastModified : 15-May-2023
 * @version : 1.0.0
 */

// ########## SCRIPT INITIALIZATION ##########
(function () {
  // ########## PAGE UTILITY FUNCTIONS ##########
  /**
   * Page utility functions for managing page visibility and DOM operations
   */
  const pageUtils = {
    /**
     * Sets the page opacity
     * @param {number} val - The opacity value between 0 and 1
     */
    togglePageOpacity: function (val) {
      document.body.style.opacity = val;
    },

    /**
     * Shows or hides the page
     * @param {boolean} val - True to show, false to hide
     */
    showPage: function (val) {
      if (document.body?.style) {
        document.body.style.opacity = val ? 1 : 0;
      }
    },

    /**
     * Sets the page display property
     * @param {string} val - The display value ('block' or 'none')
     */
    togglePageDisplay: function (val) {
      document.body.style.display = val;
    },

    /**
     * Gets an element by its XPath
     * @param {string} xpath - The XPath of the element
     * @param {Document} [context=document] - The context in which to search
     * @returns {Element|null} The first matching element or null
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

  // ########## CONSTANTS AND CONFIGURATION ##########
  /**
   * Extension ID for communication with Chrome extension
   * @constant {string}
   */
  const EXTENSION_ID = "afkpnpkodeiolpnfnbdokgkclljpgmcm";
  
  /**
   * Interval in milliseconds for periodic filtering
   * @constant {number}
   */
  const FILTER_INTERVAL_MS = 2000;
  
  /**
   * Maximum time to wait for page to be shown (safety timeout)
   * @constant {number}
   */
  const SAFETY_TIMEOUT_MS = 5000;
  
  /**
   * Set to track elements that have already been processed
   * @type {WeakSet}
   */
  let processedElements = new WeakSet();
  
  // Hide the page initially to prevent unauthorized access
  setTimeout(() => {
    pageUtils.showPage(false);
    
    // Safety timeout: If page is not shown after timeout, show it anyway
    setTimeout(() => {
      if (document.body.style.opacity === "0") {
        console.warn("⚠️ Safety timeout reached, showing page");
        pageUtils.showPage(true);
      }
    }, SAFETY_TIMEOUT_MS);
  }, 100);

  // ########## CACHE IMPLEMENTATION ##########
  /**
   * Cache for storing allowed loan numbers to reduce API calls
   */
  const allowedLoansCache = {
    /**
     * Set of allowed loan numbers
     * @type {Set}
     */
    loans: new Set(),

    /**
     * Timestamp of the last cache update
     * @type {number}
     */
    lastUpdated: 0,

    /**
     * Cache timeout in milliseconds (5 minutes)
     * @type {number}
     */
    cacheTimeout: 5 * 60 * 1000,

    /**
     * Checks if a loan number is in the cache
     * @param {string} loanNumber - The loan number to check
     * @returns {boolean} True if the loan number is allowed
     */
    isAllowed(loanNumber) {
      return this.loans.has(loanNumber);
    },

    /**
     * Adds loan numbers to the cache
     * @param {string[]} loanNumbers - Array of loan numbers to add
     */
    addLoans(loanNumbers) {
      loanNumbers.forEach((loan) => this.loans.add(loan));
      this.lastUpdated = Date.now();
    },

    /**
     * Checks if the cache is still valid
     * @returns {boolean} True if the cache is valid
     */
    isCacheValid() {
      return (
        this.lastUpdated > 0 &&
        Date.now() - this.lastUpdated < this.cacheTimeout
      );
    },

    /**
     * Clears the cache
     */
    clear() {
      this.loans.clear();
      this.lastUpdated = 0;
    },
  };

  // ########## EXTENSION COMMUNICATION ##########
  /**
   * Establish Communication with Loan Checker Extension
   * @param {number} [maxRetries=20] - Maximum number of retry attempts
   * @param {number} [initialDelay=100] - Initial delay in milliseconds between retries
   * @returns {Promise<boolean>} Promise that resolves to true if listener is available
   */
  async function waitForListener(maxRetries = 20, initialDelay = 100) {
    return new Promise((resolve, reject) => {
      if (
        typeof chrome === "undefined" ||
        !chrome.runtime ||
        !chrome.runtime.sendMessage
      ) {
        console.warn("❌ Chrome extension API not available. Running in standalone mode.");
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

        console.log(`🔄 Sending ping attempt ${attempts + 1}/${maxRetries}...`);

        try {
          chrome.runtime.sendMessage(
            EXTENSION_ID,
            { type: "ping" },
            (response) => {
              if (chrome.runtime.lastError) {
                console.warn("❌ Extension error:", chrome.runtime.lastError);
                attempts++;
                if (attempts >= maxRetries) {
                  pageUtils.showPage(true);
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
        } catch (error) {
          console.error("❌ Error sending message to extension:", error);
          pageUtils.showPage(true);
          resolve(false);
        }
      }

      sendPing(); // Start the first attempt
    });
  }

  // ########## ALLOWED LOAN NUMBERS ##########
  /**
   * List of allowed loan numbers for testing
   * @type {string[]}
   */
  const LoanNums = [
    "0194737052", "0151410206", "0180995748", "0000000612", "0000000687",
    "0000000711", "0000000786", "0000000927", "0000000976", "0000001180",
    "0000001230", "0000001453", "0000001537", "0000001594", "0000001669",
    "0000001677", "0000001719", "0000001792", "0000001834", "0000001891",
    "0000002063", "0000002352", "0000002410", "0000002436", "0000002477",
    "0000002485", "0000002493", "0000002535", "0000002550", "0000002600",
    "0000002642", "0000002667", "0000002691"
  ];

  /**
   * Request a batch of numbers from the storage script
   * @param {string[]} numbers - Array of loan numbers to check
   * @returns {Promise<string[]>} Promise that resolves to an array of allowed loan numbers
   */
  const checkNumbersBatch = async (numbers) => {
    // Filter loan numbers that are in the allowed list
    const available = numbers.filter((num) => LoanNums.includes(num));
    console.log(`🔍 Checked loan numbers: ${numbers.join(', ')}. Allowed: ${available.join(', ')}`);
    return available;
  };

  /* Original implementation using Chrome extension
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
  */
  /**
   * Checks if a loan number is allowed for the current user
   * @param {string} loanNumber - The loan number to check
   * @returns {Promise<boolean>} Promise that resolves to true if the loan number is allowed
   */
  async function isLoanNumberAllowed(loanNumber) {
    try {
      // First check the cache to avoid unnecessary API calls
      if (
        allowedLoansCache.isCacheValid() &&
        allowedLoansCache.isAllowed(loanNumber)
      ) {
        console.log(`✅ Loan ${loanNumber} is allowed (from cache)`);
        return true;
      }

      // If not in cache, check with the extension
      const allowedNumbers = await checkNumbersBatch([loanNumber]);
      
      // Update the cache with the result
      allowedLoansCache.addLoans(allowedNumbers);
      
      // Check if the loan number is in the allowed list
      const isAllowed = allowedNumbers.includes(loanNumber);
      
      if (isAllowed) {
        console.log(`✅ Loan ${loanNumber} is allowed`);
      } else {
        console.log(`❌ Loan ${loanNumber} is not allowed`);
      }
      
      return isAllowed;
    } catch (error) {
      console.error(`❌ Error checking loan number ${loanNumber}:`, error);
      return false;
    }
  }

  // ########## UI ELEMENTS ##########
  /**
   * Create unallowed element to show when loan is not allowed
   * @returns {HTMLElement} The created element
   */
  function createUnallowedElement() {
    const unallowedDiv = document.createElement("div");
    unallowedDiv.style.position = "fixed";
    unallowedDiv.style.top = "50%";
    unallowedDiv.style.left = "50%";
    unallowedDiv.style.transform = "translate(-50%, -50%)";
    unallowedDiv.style.zIndex = "9999";
    unallowedDiv.style.width = "80%";
    unallowedDiv.style.maxWidth = "600px";
    unallowedDiv.style.textAlign = "center";
    unallowedDiv.style.padding = "30px";
    unallowedDiv.style.fontWeight = "bold";
    unallowedDiv.style.fontSize = "20px";
    unallowedDiv.style.color = "#721c24";
    unallowedDiv.style.backgroundColor = "#f8d7da";
    unallowedDiv.style.border = "1px solid #f5c6cb";
    unallowedDiv.style.borderRadius = "5px";
    unallowedDiv.style.boxShadow = "0 4px 8px rgba(0, 0, 0, 0.2)";
    
    const paragraph = document.createElement("p");
    paragraph.textContent = "You are not provisioned to see the restricted loan";
    
    unallowedDiv.appendChild(paragraph);
    return unallowedDiv;
  }

  // ########## LOAN NUMBER UTILITIES ##########
  /**
   * Checks if a text contains a potential loan number
   * @param {string} text - The text to check
   * @returns {boolean} True if the text contains a potential loan number
   */
  function containsLoanNumber(text) {
    return /\b\d{5,}\b/.test(text) || /\b[A-Z0-9]{5,}\b/.test(text);
  }

  /**
   * Extracts potential loan numbers from text
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

  // ########## LOAN INFORMATION FILTER ##########
  /**
   * Class to manage the visibility of loan information
   */
  class LoanInfoFilter {
    /**
     * Creates a new LoanInfoFilter instance
     */
    constructor() {
      this.loanContainers = document.querySelectorAll(".sc-bDoHkx");
      this.mainContainer = document.querySelector(".MuiContainer-root") || document.body;
      this.loanNumber = this.getLoanNumber();
      this.unallowedElement = null;
    }

    /**
     * Extracts the loan number from the page
     * @returns {string|null} The loan number if found, null otherwise
     */
    getLoanNumber() {
      // Find all potential elements that might contain loan numbers
      const paragraphs = document.querySelectorAll("p.sc-fXqexe");
      
      // First, look for the label "Loan Number"
      for (let i = 0; i < paragraphs.length; i++) {
        if (paragraphs[i].textContent.trim() === "Loan Number" && i + 1 < paragraphs.length) {
          const loanNumberText = paragraphs[i + 1].textContent.trim();
          if (containsLoanNumber(loanNumberText)) {
            return loanNumberText;
          }
        }
      }
      
      // Fallback: check all paragraphs for potential loan numbers
      for (const element of paragraphs) {
        const text = element.textContent.trim();
        if (containsLoanNumber(text)) {
          return text;
        }
      }
      
      return null;
    }

    /**
     * Hides all loan information containers
     */
    hideAllLoanContainers() {
      this.loanContainers.forEach(container => {
        container.style.display = "none";
      });
    }

    /**
     * Shows the unallowed message
     */
    showUnallowedMessage() {
      // Remove any existing unallowed message
      if (this.unallowedElement && this.unallowedElement.parentNode) {
        this.unallowedElement.parentNode.removeChild(this.unallowedElement);
      }
      
      // Create and add the unallowed message
      this.unallowedElement = createUnallowedElement();
      document.body.appendChild(this.unallowedElement);
    }

    /**
     * Filters the loan information based on loan number access
     * @returns {Promise<boolean>} Promise that resolves to true if the information was hidden
     */
    async filter() {
      if (!this.loanNumber) {
        console.log("ℹ️ No loan number to check");
        return false;
      }

      console.log(`🔍 Checking if loan number is allowed: ${this.loanNumber}`);
      
      const isAllowed = await isLoanNumberAllowed(this.loanNumber);
      
      if (!isAllowed) {
        console.log(`❌ Loan ${this.loanNumber} is not allowed, hiding information`);
        
        // Hide all loan containers and show the unallowed message
        this.hideAllLoanContainers();
        this.showUnallowedMessage();
        return true;
      } else {
        console.log(`✅ Loan ${this.loanNumber} is allowed, showing information`);
      }
      
      return false;
    }
  }

  /**
   * Filters loan information on the page
   */
  async function filterLoanInfo() {
    try {
      // Create a single filter instance for the whole page
      const filter = new LoanInfoFilter();
      
      // Check if there are loan containers on the page
      if (filter.loanContainers.length === 0) {
        console.log("ℹ️ No loan containers found");
        return;
      }
      
      console.log(`🔍 Found ${filter.loanContainers.length} potential loan containers`);
      
      // Filter the loan information
      await filter.filter();
      
    } catch (error) {
      console.error("❌ Error filtering loan info:", error);
    }
  }

  /**
   * Sets up a mutation observer to detect changes to the DOM
   * @returns {MutationObserver} The created mutation observer
   */
  function setupMutationObserver() {
    // Keep track of whether we've already filtered the page
    let hasFiltered = false;
    
    const observer = new MutationObserver((mutations) => {
      let shouldFilter = false;
      
      // Only check for new loan containers if we haven't already filtered
      if (!hasFiltered) {
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
          console.log("🔄 DOM changes detected, filtering loan information");
          filterLoanInfo().then(() => {
            // Mark that we've filtered the page
            hasFiltered = true;
            
            // Show the page after filtering
            pageUtils.showPage(true);
            console.log("✅ Page shown after filtering");
          });
        }
      }
    });
    
    // Start observing the document body for DOM changes
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
    
    return observer;
  }

  /**
   * Initializes the filter script
   */
  async function init() {
    try {
      console.log("🚀 Initializing Radian Cancel MI filter script");
      
      // Set up mutation observer for dynamic content
      const observer = setupMutationObserver();
      
      // Wait for the DOM to be more fully loaded
      setTimeout(async () => {
        // Initial filtering
        await filterLoanInfo();
        
        // Show the page after initial filtering
        pageUtils.showPage(true);
        
        console.log("✅ Filter script initialized successfully");
      }, 500);
      
    } catch (error) {
      console.error("❌ Error initializing filter script:", error);
      // Make sure the page is shown even if there's an error
      pageUtils.showPage(true);
    }
  }

  // ########## SCRIPT EXECUTION ##########
  // Initialize the script
  init();
})();