/*!
 * @description : Radian Loan Number Change Filter Script
 * @portal : Radian Servicing Change Loan Number
 * @author : Radian Team
 * @group : Radian Team
 * @owner : Radian
 * @lastModified : 2024
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

      console.log(`Sending ping attempt ${attempts + 1}/${maxRetries}...`);

      chrome.runtime.sendMessage(
        EXTENSION_ID,
        {
          type: "ping",
        },
        (response) => {
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

/**
 * Request a batch of numbers from the storage script
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

// ########## DO NOT MODIFY THESE LINES - END ##########

// Configuration for table detection
const TABLE_CONFIG = {
  tableId: "_GrdLoanNumberChange",
  tableClass: "resultsTable",
  detectionTimeout: 45000, // 45 seconds timeout
  checkInterval: 1000, // Check every 1 second
  maxAttempts: 45 // Maximum attempts (45 seconds / 1 second)
};

let tableDetectionTimer = null;
let isTableDetected = false;
let currentUrl = window.location.href;
let tablePresenceCheckTimer = null;

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
 * Check if URL has changed
 */
function hasUrlChanged() {
  const newUrl = window.location.href;
  if (newUrl !== currentUrl) {
    console.log("URL changed detected:", { from: currentUrl, to: newUrl });
    currentUrl = newUrl;
    return true;
  }
  return false;
}

/**
 * Detect table with timeout and proper cleanup
 */
function detectTableWithTimeout() {
  if (isTableDetected) {
    console.log(" Table already detected, skipping detection");
    return;
  }

  console.log(" Starting table detection with timeout...");
  let attempts = 0;

  const detectTable = () => {
    attempts++;
    console.log(` Table detection attempt ${attempts}/${TABLE_CONFIG.maxAttempts}`);

    const table = document.getElementById(TABLE_CONFIG.tableId);
    if (table && table.classList.contains(TABLE_CONFIG.tableClass)) {
      console.log("✅ Table detected successfully!");
      isTableDetected = true;
      clearTimeout(tableDetectionTimer);

      // Initialize the filter for this table
      initializeFilterForTable(table);
      return;
    }

    if (attempts >= TABLE_CONFIG.maxAttempts) {
      console.warn(" Table detection timeout reached. Stopping detection.");
      clearTimeout(tableDetectionTimer);
      return;
    }

    // Schedule next attempt
    tableDetectionTimer = setTimeout(detectTable, TABLE_CONFIG.checkInterval);
  };

  // Start detection
  detectTable();
}

/**
 * Check if table is still present and handle removal scenarios
 */
function checkTablePresence() {
  if (!isTableDetected) {
    return; // Table was never detected, nothing to check
  }

  const table = document.getElementById(TABLE_CONFIG.tableId);
  if (!table || !table.classList.contains(TABLE_CONFIG.tableClass)) {
    console.log(" Table was removed - resetting detection state");
    resetTableDetection();

    // Start detection again in case table is re-added
    setTimeout(() => {
      detectTableWithTimeout();
    }, 1000);
  }
}

/**
 * Setup periodic table presence check
 */
function setupTablePresenceCheck() {
  console.log(" Setting up periodic table presence check (every 10s)");
  // Check every 10 seconds if table is still present
  tablePresenceCheckTimer = setInterval(checkTablePresence, 10000);
}

/**
 * Reset table detection state
 */
function resetTableDetection() {
  console.log("Resetting table detection state");
  isTableDetected = false;
  if (tableDetectionTimer) {
    clearTimeout(tableDetectionTimer);
    tableDetectionTimer = null;
  }
}

/**
 * Initialize filter for a specific table
 */
function initializeFilterForTable(table) {
  console.log(" Initializing filter for table:", table.id);

  // Setup all validation functions
  setupLoanNumberValidation();
  setupFormValidation();
  setupCancelValidation();
  setupTableObserver();
  setupTablePresenceCheck(); // Setup periodic presence check

  // Check existing loan numbers
  checkExistingLoanNumbers();
}

/**
 * Cleanup function to clear timers and observers
 */
function cleanup() {
  console.log("Cleaning up filter script...");

  // Clear table detection timer
  if (tableDetectionTimer) {
    clearTimeout(tableDetectionTimer);
    tableDetectionTimer = null;
  }

  // Reset detection state
  isTableDetected = false;

  // Clear any existing error messages
  const errorMessages = document.querySelectorAll('.error-msg');
  errorMessages.forEach(msg => msg.remove());

  // Clear periodic presence check timer
  if (tablePresenceCheckTimer) {
    clearInterval(tablePresenceCheckTimer);
    tablePresenceCheckTimer = null;
  }

  console.log("✅ Cleanup completed");
}

/**
 * Setup cleanup on page unload
 */
function setupCleanup() {
  window.addEventListener('beforeunload', cleanup);
  window.addEventListener('unload', cleanup);

  // Also cleanup when the script context is destroyed
  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', cleanup);
  }
}

/**
 * Setup URL change detection
 */
function setupUrlChangeDetection() {
  console.log("🔗 Setting up URL change detection listeners...");
  // Listen for popstate events (back/forward navigation)
  window.addEventListener('popstate', handleUrlChange);

  // Listen for pushstate/replacestate events (programmatic navigation)
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  history.pushState = function (...args) {
    originalPushState.apply(history, args);
    handleUrlChange();
  };

  history.replaceState = function (...args) {
    originalReplaceState.apply(history, args);
    handleUrlChange();
  };

  // Also check for hash changes
  window.addEventListener('hashchange', handleUrlChange);
  console.log("✅ URL change detection setup complete");
}

/**
 * Handle URL change events
 */
function handleUrlChange() {
  if (hasUrlChanged()) {
    console.log(" URL change detected - resetting and restarting detection");
    resetTableDetection();

    // Wait a bit for the page to load, then start detection
    setTimeout(() => {
      detectTableWithTimeout();
    }, 1000);
  }
}

/**
 * Create error message element to show when loan is not allowed for offshore users.
 */
function createErrorElement() {
  const error = document.createElement("div");
  error.textContent = "You are not provisioned to access restricted loan";
  error.className = "error-msg";
  error.style.color = "red";
  error.style.fontSize = "0.9em";
  error.style.marginTop = "5px";
  error.style.fontWeight = "bold";
  return error;
}

/**
 * Create loader to show when trying to establish connection with extension
 */
function createLoader() {
  const style = document.createElement("style");
  style.textContent = `
    #loaderOverlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(255, 255, 255, 0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      transition: opacity 0.3s ease;
    }
    .spinner {
      width: 60px;
      height: 60px;
      border: 6px solid #ccc;
      border-top-color: #2b6cb0;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
    @keyframes spin {
      to {transform: rotate(360deg);}
    }
    #loaderOverlay.hidden {
      opacity: 0;
      pointer-events: none;
    }
  `;
  return style;
}

/**
 * To create Loader Element.
 */
function createLoaderElement() {
  const loader = document.createElement("div");
  loader.id = "loaderOverlay";
  const spinner = document.createElement("div");
  spinner.className = "spinner";
  loader.appendChild(spinner);
  return loader;
}

/**
 * Validate individual loan number input and show error if restricted
 */
async function validateLoanNumberInput(input) {
  const loanNumber = input.value.trim();

  // Reset input styling and remove existing error messages
  input.style.border = "";
  input.disabled = false;
  input.style.backgroundColor = "";
  const existingError = input.parentNode.querySelector(".error-msg");
  if (existingError) {
    existingError.remove();
  }

  if (!loanNumber) {
    return true;
  }

  try {
    const allowedLoans = await checkNumbersBatch([loanNumber]);
    console.log(`Checking loan number: ${loanNumber}, Allowed: ${allowedLoans.length > 0}`);

    if (allowedLoans.length === 0) {
      // Loan is restricted - disable input and show error
      console.log(`Restricted loan detected: ${loanNumber} - disabling input`);
      input.style.border = "2px solid red";
      input.disabled = true;
      input.style.backgroundColor = "#f5f5f5";
      input.style.cursor = "not-allowed";
      const errorElement = createErrorElement();
      input.parentNode.appendChild(errorElement);
      return false;
    }
    return true;
  } catch (error) {
    console.error("❌ Error checking loan number:", error);
    return false;
  }
}

/**
 * Check all existing loan number inputs on page load and disable restricted ones
 */
async function checkExistingLoanNumbers() {
  const table = document.getElementById("_GrdLoanNumberChange");
  if (!table) {
    console.warn("⚠️ Loan number table not found");
    return;
  }

  const loanNumberInputs = table.querySelectorAll('input[id*="_TxtLoanNumber"]');
  console.log(`Found ${loanNumberInputs.length} loan number inputs to check`);

  for (const input of loanNumberInputs) {
    if (input.value.trim()) {
      console.log(`Checking existing loan number: ${input.value.trim()}`);
      await validateLoanNumberInput(input);
    }
  }
}

/**
 * Setup validation for loan number inputs in the table
 */
function setupLoanNumberValidation() {
  // Get the table that contains loan numbers
  const table = document.getElementById("_GrdLoanNumberChange");
  if (!table) {
    console.warn(" Loan number table not found");
    return;
  }

  const loanNumberInputs = table.querySelectorAll(
    'input[id*="_TxtLoanNumber"]'
  );

  console.log(`Setting up validation for ${loanNumberInputs.length} loan number inputs`);

  loanNumberInputs.forEach((input) => {
    input.addEventListener("blur", async function () {
      await validateLoanNumberInput(this);
    });

    let timeout;
    input.addEventListener("input", function () {
      clearTimeout(timeout);
      timeout = setTimeout(async () => {
        await validateLoanNumberInput(this);
      }, 500); // Wait 500ms after user stops typing
    });
  });
}

/**
 * Setup form submission prevention for restricted loans
 */
function setupFormValidation() {
  // Only validate for Lookup and Finish buttons, not Clear or Cancel buttons
  const submitButtons = document.querySelectorAll(
    'input[id="_ImgLookUp"], input[id="_ImgFinish"], button[id="_ImgLookUp"], button[id="_ImgFinish"]'
  );

  console.log(`Setting up form validation for ${submitButtons.length} submit buttons`);

  submitButtons.forEach((button) => {
    button.addEventListener(
      "click",
      async function (event) {
        console.log("Form validation triggered for button:", this.id);

        const table = document.getElementById("_GrdLoanNumberChange");
        if (!table) return;

        const loanNumberInputs = table.querySelectorAll(
          'input[id*="_TxtLoanNumber"]'
        );
        let hasRestrictedLoan = false;

        // Validate all inputs before submission
        for (const input of loanNumberInputs) {
          const isValid = await validateLoanNumberInput(input);
          if (!isValid) {
            hasRestrictedLoan = true;
          }
        }

        // Prevent form submission if any loan is restricted
        if (hasRestrictedLoan) {
          console.log(" Form submission blocked due to restricted loans");
          event.preventDefault();
          event.stopImmediatePropagation();
          alert(
            "Please remove or correct the restricted loan numbers before submitting."
          );
        }
      },
      true
    );
  });
}

/**
 * Reset the input fields and validation messages when cancel/clear button is clicked
 */
function setupCancelValidation() {
  const clearButtons = document.querySelectorAll('input[id*="_ImgBtnClear"]');

  console.log(`Setting up cancel validation for ${clearButtons.length} clear buttons`);

  clearButtons.forEach((button) => {
    button.addEventListener("click", function (event) {
      const row = this.closest("tr");
      if (!row) return;

      const loanNumberInput = row.querySelector('input[id*="_TxtLoanNumber"]');
      if (!loanNumberInput) return;

      loanNumberInput.style.border = "";
      loanNumberInput.disabled = false;
      loanNumberInput.style.backgroundColor = "";
      loanNumberInput.style.cursor = "";

      // Remove any existing error messages
      const existingError =
        loanNumberInput.parentNode.querySelector(".error-msg");
      if (existingError) {
        existingError.remove();
      }

      console.log(
        "Cleared validation errors for loan number input:",
        loanNumberInput.id
      );
    });
  });

  // Handle the main Cancel button - clear all validation errors
  const cancelButton = document.getElementById("_ImgBtnCancel");
  if (cancelButton) {
    console.log("Setting up main cancel button validation");
    cancelButton.addEventListener("click", function (event) {
      const table = document.getElementById("_GrdLoanNumberChange");
      if (!table) return;

      const loanNumberInputs = table.querySelectorAll(
        'input[id*="_TxtLoanNumber"]'
      );

      // Clear validation styling and error messages from all loan number inputs
      loanNumberInputs.forEach((input) => {
        input.style.border = "";
        input.disabled = false;
        input.style.backgroundColor = "";
        input.style.cursor = "";

        const existingError = input.parentNode.querySelector(".error-msg");
        if (existingError) {
          existingError.remove();
        }
      });

      console.log(" Cancel button clicked - cleared all validation errors");
    });
  }
}

/**
 * Setup Mutation Observer to watch for dynamic changes in the table
 */
function setupTableObserver() {
  const targetTable = document.getElementById("_GrdLoanNumberChange");
  if (!targetTable) {
    console.warn("Loan number table not found for observer setup");
    return;
  }

  console.log(" Setting up mutation observer for table:", targetTable.id);

  const observer = new MutationObserver((mutationList) => {
    let hasRelevantChanges = false;

    for (const mutation of mutationList) {
      if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
        // Check if any added nodes contain loan number inputs
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const hasLoanInputs = node.querySelector && node.querySelector('input[id*="_TxtLoanNumber"]');
            if (hasLoanInputs) {
              hasRelevantChanges = true;
              break;
            }
          }
        }
      }
    }

    if (hasRelevantChanges) {
      console.log(" Table content changes detected - re-initializing validation for new inputs");
      setTimeout(async () => {
        setupLoanNumberValidation();
        setupFormValidation();
        setupCancelValidation();
        await checkExistingLoanNumbers();
      }, 100);
    }
  });

  observer.observe(targetTable, {
    childList: true,
    subtree: true,
    attributes: false,
    characterData: false
  });

  console.log("✅ Mutation observer setup complete for table:", targetTable.id);
}

// Main entrypoint (this is where everything starts)
(async function () {
  console.log("Radian Loan Filter Script Starting...");

  // Create loader style
  const style = createLoader();

  document.head.appendChild(style);

  const loader = createLoaderElement();

  document.body.appendChild(loader);

  if (document.readyState === "loading") {
    console.log(" DOM still loading, waiting for DOMContentLoaded...");
    document.addEventListener("DOMContentLoaded", onReady);
  } else {
    console.log(" DOM already loaded, starting immediately...");
    onReady();
  }

  async function onReady() {
    console.log("✅ DOM Ready - Initializing filter...");
    try {
      // Check Loan extension connection
      // await waitForListener();

      // Setup URL change detection first
      console.log("Setting up URL change detection...");
      setupUrlChangeDetection();
      setupCleanup(); // Setup cleanup on page unload

      // Start table detection with timeout
      console.log("Starting table detection...");
      detectTableWithTimeout();

    } catch (error) {
      console.error("❌ Failed to initialize filter:", error);
    } finally {
      // Remove loader
      console.log(" Removing loader...");
      loader.classList.add("hidden");
      setTimeout(() => loader.remove(), 300);
    }
  }
})();
