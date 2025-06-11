/*!
 * @description : Radian Loan Number Change Filter Script
 * @portal : Radian Servicing Change Loan Number
 * @author : AI Assistant
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
 * Create unallowed element to show when loan is not allowed for offshore users.
 */
function createUnallowedElement() {
  const unallowed = document.createElement("span");
  unallowed.appendChild(
    document.createTextNode("Loan is not provisioned to the user")
  );
  unallowed.className = "body";
  unallowed.style.display = "flex";
  unallowed.style.paddingLeft = "250px";
  unallowed.style.alignItems = "center";
  unallowed.style.height = "100px";
  unallowed.style.fontSize = "20px";
  unallowed.style.fontWeight = "bold";
  unallowed.style.color = "black";
  unallowed.style.position = "relative";

  return unallowed;
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
  loader.innerHTML = `<div class="spinner"></div>`;
  return loader;
}

/**
 * Filter loan numbers in the table based on allowed loans
 */
async function filterLoanNumbersInTable() {
  // Get the table that contains loan numbers
  const table = document.getElementById("_GrdLoanNumberChange");
  if (!table) {
    console.warn("Loan number table not found");
    return;
  }

  // Get all rows in the table (skip the header row)
  const rows = table.querySelectorAll("tr.mioResultsTableRow, tr.mioResultsTableRowAlternating");
  
  let visibleCount = 0;
  
  // Process each row
  for (const row of rows) {
    // Find the loan number input in the row
    const loanNumberInput = row.querySelector('input[id*="_TxtLoanNumber"]');
    if (!loanNumberInput) continue;

    const loanNumber = loanNumberInput.value.trim();
    if (!loanNumber) continue;

    // Check if loan is allowed
    try {
      const allowedLoans = await checkNumbersBatch([loanNumber]);
      if (allowedLoans.length === 0) {
        // If loan is not allowed, hide the row
        row.style.display = "none";
      } else {
        // Count visible rows
        visibleCount++;
      }
    } catch (error) {
      console.error("Error checking loan number:", error);
    }
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
        console.log("Table changes detected");
        setTimeout(filterLoanNumbersInTable, 50);
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

  // Append loader style into header
  document.head.appendChild(style);

  // Create loader element to show while connecting to extension
  const loader = createLoaderElement();

  // Append loader element to body
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

      // Filter loan numbers in the table
      await filterLoanNumbersInTable();

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