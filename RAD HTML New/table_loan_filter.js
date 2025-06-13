/*!
 * @description : Table Loan Filter Script - Filters table rows based on servicer loan number restrictions
 * @portal : MI Online - Radian Claims Reports
 * @author : Accelirate Team
 * @group : Accelirate Team
 * @owner : Cenlar
 * @lastModified : 14-May-2025
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
 * Create loader to show during processing
 */
function createLoader() {
  const style = document.createElement("style");
  style.textContent = `
    #loanFilterLoader {
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
    .loan-filter-spinner {
      width: 50px;
      height: 50px;
      border: 5px solid #ccc;
      border-top-color: #007bff;
      border-radius: 50%;
      animation: loanFilterSpin 1s linear infinite;
    }
    @keyframes loanFilterSpin {
      to {transform: rotate(360deg);}
    }
    #loanFilterLoader.hidden {
      opacity: 0;
      pointer-events: none;
    }
  `;
  document.head.appendChild(style);

  const loader = document.createElement("div");
  loader.id = "loanFilterLoader";
  loader.innerHTML = `
    <div style="text-align: center;">
      <div class="loan-filter-spinner"></div>
      <div style="margin-top: 15px; font-size: 16px; color: #007bff; font-weight: 500;">
        Filtering loan records...
      </div>
    </div>
  `;

  document.body.appendChild(loader);
}

/**
 * Hide loader
 */
function hideLoader() {
  const loader = document.getElementById("loanFilterLoader");
  if (loader) {
    loader.classList.add("hidden");
    setTimeout(() => loader.remove(), 300);
  }
}

/**
 * Create "No Records Found" message
 */
function createNoRecordsMessage() {
  const message = document.createElement("div");
  message.innerHTML = `
    <div style="
      display: flex;
      justify-content: center;
      align-items: center;
      height: 200px;
      background-color: #f8f9fa;
      border: 2px solid #6c757d;
      border-radius: 8px;
      margin: 20px;
      color: #6c757d;
      font-size: 18px;
      font-weight: 500;
      text-align: center;
    ">
      <div>
        <i class="fas fa-info-circle" style="font-size: 24px; margin-bottom: 10px; display: block;"></i>
        No authorized loan records found
      </div>
    </div>
  `;
  return message;
}

/**
 * Main function to filter table rows based on servicer loan numbers
 */
async function filterTableByLoanNumbers() {
  try {
    // Show loader
    createLoader();

    // Wait for extension listener
    await waitForListener();

    // Find the claims table
    const claimsTable = document.getElementById("ClaimsGridView");

    if (!claimsTable) {
      console.log("Claims table not found");
      hideLoader();
      return;
    }

    // Get all data rows (excluding header row)
    const dataRows = claimsTable.querySelectorAll("tr.text-black");

    if (dataRows.length === 0) {
      console.log("No data rows found in table");
      hideLoader();
      return;
    }

    console.log(`Found ${dataRows.length} data rows to process`);

    // Extract all servicer loan numbers from the table
    const loanNumbers = [];
    const rowLoanMap = new Map(); // Map to store row-to-loan relationships

    dataRows.forEach((row, index) => {
      // Servicer Loan Number is in the second column (index 1)
      const servicerLoanCell = row.querySelector("td:nth-child(2)");

      if (servicerLoanCell) {
        const loanNumber = servicerLoanCell.textContent.trim();
        if (loanNumber && loanNumber !== "&nbsp;") {
          loanNumbers.push(loanNumber);
          rowLoanMap.set(row, loanNumber);
        }
      }
    });

    if (loanNumbers.length === 0) {
      console.log("No loan numbers found in table");
      hideLoader();
      return;
    }

    console.log(
      `Checking authorization for ${loanNumbers.length} loan numbers:`,
      loanNumbers
    );

    // Check which loans are authorized
    const allowedLoans = await checkNumbersBatch(loanNumbers);

    console.log(`Authorized loans:`, allowedLoans);

    // Filter rows: hide unauthorized loans
    let visibleRowCount = 0;

    rowLoanMap.forEach((loanNumber, row) => {
      if (allowedLoans.includes(loanNumber)) {
        // Loan is authorized - keep the row visible
        row.style.display = "";
        visibleRowCount++;
      } else {
        // Loan is restricted - hide the row
        row.style.display = "none";
        console.log(`Hiding row with restricted loan: ${loanNumber}`);
      }
    });

    console.log(
      `Filtering complete. ${visibleRowCount} rows remain visible out of ${dataRows.length} total rows.`
    );

    // If no rows are visible, show "No Records Found" message
    if (visibleRowCount === 0) {
      const tableContainer = claimsTable.closest("#divClaimsGridView");
      if (tableContainer) {
        // Hide the original table
        claimsTable.style.display = "none";

        // Add "No Records Found" message
        const noRecordsMessage = createNoRecordsMessage();
        tableContainer.appendChild(noRecordsMessage);
      }
    }

    hideLoader();
  } catch (error) {
    console.error("Error during loan filtering:", error);
    hideLoader();
  }
}

/**
 * Initialize the loan filter when DOM is ready
 */
function initializeTableLoanFilter() {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", filterTableByLoanNumbers);
  } else {
    // DOM is already ready, run immediately
    filterTableByLoanNumbers();
  }
}

// Start the script
initializeTableLoanFilter();
