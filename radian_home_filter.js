/*!
 * @description : Radian Loan Filter Script
 * @portal : MI Online Radian
 * @author : Rohit
 * @group : Radian Team
 * @owner : Radian
 * @lastModified : 14-May-2025
 */

// ########## DO NOT MODIFY THESE LINES ##########
const EXTENSION_ID = "hellpeipojbghaaopdnddjakinlmocjl";

/**
 * Establish Communication with Loan Checker Extension
 */
async function waitForListener(maxRetries = 20, initialDelay = 100) {
  console.log("🔌 Starting extension listener connection...");
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
  console.log(`🔍 Checking batch of ${numbers.length} loan numbers:`, numbers);
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      EXTENSION_ID,
      {
        type: "queryLoans",
        loanIds: numbers,
      },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error("❌ Extension communication error:", chrome.runtime.lastError.message);
          return reject(chrome.runtime.lastError.message);
        } else if (response.error) {
          console.error("❌ Extension response error:", response.error);
          return reject(response.error);
        }

        console.log("📊 Extension response received:", response);
        const available = Object.keys(response.result).filter(
          (key) => response.result[key]
        );
        console.log("✅ Allowed loan numbers:", available);
        resolve(available);
      }
    );
  });
}

// ########## DO NOT MODIFY THESE LINES - END ##########

/**
 * Find all tables that contain loan numbers in the third column
 */
function findLoanTables() {
  const tables = document.querySelectorAll('table');

  const loanTables = [];

  tables.forEach((table, index) => {
    // Check if table has a header row with "Loan Number" in the third column
    const headerRow = table.querySelector('thead tr, tr:first-child');
    if (!headerRow) {
      console.log(`   ⚠️  Table ${index + 1}: No header row found`);
      return;
    }

    const headerCells = headerRow.querySelectorAll('th, td');

    if (headerCells.length < 3) {
      return;
    }

    const thirdHeaderCell = headerCells[2];
    const headerText = thirdHeaderCell.textContent.trim();

    // Check if the third column header contains "Loan Number"
    if (headerText.toLowerCase().includes('loan number')) {
      loanTables.push(table);
    } else {
      console.log(`   ❌ Table ${index + 1}: No loan number column found`);
    }
  });

  console.log(`🎯 Found ${loanTables.length} tables with loan numbers`);
  return loanTables;
}

/**
 * Extract loan numbers from table rows
 */
function extractLoanNumbers(table) {
  const rows = table.querySelectorAll('tbody tr, tr:not(:first-child)');
  console.log(`📊 Found ${rows.length} data rows`);

  const loanNumbers = [];

  rows.forEach((row, index) => {
    const cells = row.querySelectorAll('td');

    if (cells.length >= 3) {
      const thirdCell = cells[2];
      const loanNumber = thirdCell.textContent.trim();
      console.log(`   🔢 Row ${index + 1}: Third cell content = "${loanNumber}"`);

      if (loanNumber && loanNumber !== '') {
        loanNumbers.push(loanNumber);
      } else {
        console.log(`   ⚠️  Row ${index + 1}: Empty loan number cell`);
      }
    } else {
      console.log(`   ⚠️  Row ${index + 1}: Less than 3 cells, skipping`);
    }
  });

  console.log(`📋 Extracted ${loanNumbers.length} loan numbers:`, loanNumbers);
  return loanNumbers;
}

/**
 * Create restricted loan message element
 */
console.log("🚫 Creating restricted loan message...");
const message = document.createElement("div");
message.textContent = "You are not provisioned to see the Restricted Loan";
message.style.cssText = `
    color: red;
    display: flex;
    justify-content: center;
    align-items: center;
    font-size: 1.2em;
    font-weight: bold;
    padding: 40px;
    text-align: center;
    background-color: #fff3f3;
    border: 2px solid #ffcccc;
    border-radius: 8px;
    margin: 20px 0;
  `;
return message;
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
      background: rgba(255, 255, 255, 0.9);
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
 * Create loader element
 */
function createLoaderElement() {
  const loader = document.createElement("div");
  loader.id = "loaderOverlay";
  loader.innerHTML = `<div class="spinner"></div>`;
  return loader;
}

/**
 * Check loan numbers in tables and hide restricted ones
 */
async function checkAndFilterLoanTables() {
  console.log("🚀 Starting loan table filtering process...");
  const loanTables = findLoanTables();

  if (loanTables.length === 0) {
    console.log("ℹ️  No loan tables found on this page");
    return;
  }

  console.log(`🎯 Processing ${loanTables.length} loan table(s)`);

  for (let i = 0; i < loanTables.length; i++) {
    const table = loanTables[i];
    console.log(`📋 Processing table ${i + 1}/${loanTables.length}`);

    const loanNumbers = extractLoanNumbers(table);

    if (loanNumbers.length === 0) {
      continue;
    }


    try {
      const allowedLoans = await checkNumbersBatch(loanNumbers);
      console.log(`📊 Table ${i + 1}: Allowed loans count: ${allowedLoans.length}/${loanNumbers.length}`);

      // If any loan is restricted, hide the entire table
      if (allowedLoans.length < loanNumbers.length) {
        console.log(`🚫 Table ${i + 1}: Restricted loans detected, hiding table`);

        // Hide the table
        table.style.display = 'none';
        console.log(`✅ Table ${i + 1}: Hidden successfully`);

        // Create and insert restricted message
        const message = createRestrictedMessage();
        table.parentNode.insertBefore(message, table);
        console.log(`✅ Table ${i + 1}: Restricted message inserted`);
      } else {
      }
    } catch (error) {
      console.error(`❌ Table ${i + 1}: Error checking loan numbers:`, error);
    }
  }

  console.log("🏁 Loan table filtering process completed");
}

/**
 * Setup Mutation Observer to watch for dynamic table changes
 */
function setupTableObserver() {
  console.log("👀 Setting up mutation observer for dynamic table changes...");
  const observer = new MutationObserver((mutations) => {
    console.log(`🔄 Mutation observer triggered with ${mutations.length} mutations`);

    for (const mutation of mutations) {
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {

        // Check if any new tables were added
        const hasNewTables = Array.from(mutation.addedNodes).some(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const isTable = node.tagName === 'TABLE';
            const hasTable = node.querySelector('table');
            if (isTable || hasTable) {
              return true;
            }
          }
          return false;
        });

        if (hasNewTables) {
          setTimeout(() => {
            checkAndFilterLoanTables();
          }, 100);
        }
      }
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

}

// Main entrypoint
(async function () {


  // Create loader style
  const style = createLoader();
  document.head.appendChild(style);

  // Create loader element
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
      console.log("✅ Extension connection established");

      console.log("🔍 Starting loan table filtering...");
      // Check and filter loan tables
      await checkAndFilterLoanTables();
      console.log("✅ Loan table filtering completed");

      // Setup observer for dynamic changes
      setupTableObserver();

      console.log("🎉 Radian loan filter initialized successfully!");
    } catch (error) {
      console.error("❌ Error initializing Radian loan filter:", error);
      console.error("🔍 Error details:", {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
    } finally {
      // Remove loader
      loader.remove();
    }
  }
})();