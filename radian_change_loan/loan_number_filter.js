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

      console.log(`🔄 Sending ping attempt ${attempts + 1}/${maxRetries}...`);

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

// ########## DO NOT MODIFY THESE LINES - END ##########

/**
 * Create error message element to show when loan is not allowed for offshore users.
 */
function createErrorElement() {
  const error = document.createElement("div");
  error.textContent = "This is a restricted loan number";
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
  const existingError = input.parentNode.querySelector(".error-msg");
  if (existingError) {
    existingError.remove();
  }

  if (!loanNumber) {
    return true;
  }

  try {
    const allowedLoans = await checkNumbersBatch([loanNumber]);
    if (allowedLoans.length === 0) {
      input.style.border = "2px solid red";
      const errorElement = createErrorElement();
      input.parentNode.appendChild(errorElement);
      return false;
    }
    return true;
  } catch (error) {
    console.error("Error checking loan number:", error);
    return false;
  }
}

/**
 * Setup validation for loan number inputs in the table
 */
function setupLoanNumberValidation() {
  // Get the table that contains loan numbers
  const table = document.getElementById("_GrdLoanNumberChange");
  if (!table) {
    console.warn("Loan number table not found");
    return;
  }

  const loanNumberInputs = table.querySelectorAll(
    'input[id*="_TxtLoanNumber"]'
  );

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

  clearButtons.forEach((button) => {
    button.addEventListener("click", function (event) {
      const row = this.closest("tr");
      if (!row) return;

      const loanNumberInput = row.querySelector('input[id*="_TxtLoanNumber"]');
      if (!loanNumberInput) return;

      loanNumberInput.style.border = "";

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
    cancelButton.addEventListener("click", function (event) {
      const table = document.getElementById("_GrdLoanNumberChange");
      if (!table) return;

      const loanNumberInputs = table.querySelectorAll(
        'input[id*="_TxtLoanNumber"]'
      );

      // Clear validation styling and error messages from all loan number inputs
      loanNumberInputs.forEach((input) => {
        input.style.border = "";

        const existingError = input.parentNode.querySelector(".error-msg");
        if (existingError) {
          existingError.remove();
        }
      });

      console.log("Cancel button clicked - cleared all validation errors");
    });
  }
}

/**
 * Setup Mutation Observer to watch for dynamic changes in the table
 */
function setupTableObserver() {
  const targetTable = document.getElementById("_GrdLoanNumberChange");
  if (!targetTable) return;

  const observer = new MutationObserver((mutationList) => {
    for (const mutation of mutationList) {
      if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
        console.log(
          "Table changes detected - setting up validation for new inputs"
        );
        setTimeout(() => {
          setupLoanNumberValidation();
          setupFormValidation();
          setupCancelValidation();
        }, 100);
      }
    }
  });

  observer.observe(targetTable, {
    childList: true,
    subtree: true,
  });
}

// Main entrypoint (this is where everything starts)
(async function () {
  // Create loader style
  const style = createLoader();

  document.head.appendChild(style);

  const loader = createLoaderElement();

  document.body.appendChild(loader);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", onReady);
  } else {
    onReady();
  }

  async function onReady() {
    try {
      // Check Loan extension connection
      await waitForListener();

      // Setup loan number input validation
      setupLoanNumberValidation();

      // Setup form validation to prevent submission of restricted loans
      setupFormValidation();

      // Setup cancel button validation clearing
      setupCancelValidation();

      // Watch for dynamic changes
      setupTableObserver();
    } catch (error) {
      console.error("Failed to initialize filter:", error);
    } finally {
      // Remove loader
      loader.classList.add("hidden");
      setTimeout(() => loader.remove(), 300);
    }
  }
})();
