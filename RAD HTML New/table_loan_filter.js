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
 * Create and inject CSS styles for the loan filter loader
 */
function createLoaderStyles() {
  const existingStyle = document.getElementById("loanFilterStyles");
  if (existingStyle) {
    return; // Styles already exist
  }

  const style = document.createElement("style");
  style.id = "loanFilterStyles";
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

  const documentHead = document.head;
  if (documentHead) {
    documentHead.appendChild(style);
  }
}

/**
 * Create loader element structure using safe DOM manipulation
 */
function createLoaderElement() {
  const loader = document.createElement("div");
  loader.id = "loanFilterLoader";

  // Create container div
  const containerDiv = document.createElement("div");
  containerDiv.style.textAlign = "center";

  // Create spinner div
  const spinner = document.createElement("div");
  spinner.className = "loan-filter-spinner";

  // Create text div
  const textDiv = document.createElement("div");
  textDiv.style.marginTop = "15px";
  textDiv.style.fontSize = "16px";
  textDiv.style.color = "#007bff";
  textDiv.style.fontWeight = "500";
  textDiv.textContent = "Filtering loan records...";

  // Assemble the structure
  containerDiv.appendChild(spinner);
  containerDiv.appendChild(textDiv);
  loader.appendChild(containerDiv);

  return loader;
}

/**
 * Create and display the loan filter loader
 */
function createAndDisplayLoader() {
  // Ensure styles are injected
  createLoaderStyles();

  // Create loader element
  const loader = createLoaderElement();

  // Safely append to document body
  const documentBody = document.body;
  if (documentBody) {
    documentBody.appendChild(loader);
  } else {
    console.warn("Document body not available for loader insertion");
  }
}

/**
 * Hide and remove the loan filter loader with safe DOM manipulation
 */
function hideAndRemoveLoader() {
  const loader = document.getElementById("loanFilterLoader");
  if (loader) {
    loader.classList.add("hidden");
    setTimeout(() => {
      if (loader.parentNode) {
        loader.parentNode.removeChild(loader);
      }
    }, 300);
  }
}

/**
 * Create "No Records Found" message using safe DOM manipulation
 */
function createNoAuthorizedRecordsMessage() {
  // Create main container
  const messageContainer = document.createElement("div");

  // Create inner content container
  const contentContainer = document.createElement("div");
  contentContainer.style.display = "flex";
  contentContainer.style.justifyContent = "center";
  contentContainer.style.alignItems = "center";
  contentContainer.style.height = "200px";
  contentContainer.style.backgroundColor = "#f8f9fa";
  contentContainer.style.border = "2px solid #6c757d";
  contentContainer.style.borderRadius = "8px";
  contentContainer.style.margin = "20px";
  contentContainer.style.color = "#6c757d";
  contentContainer.style.fontSize = "18px";
  contentContainer.style.fontWeight = "500";
  contentContainer.style.textAlign = "center";

  // Create inner text container
  const textContainer = document.createElement("div");

  // Create icon element
  const iconElement = document.createElement("i");
  iconElement.className = "fas fa-info-circle";
  iconElement.style.fontSize = "24px";
  iconElement.style.marginBottom = "10px";
  iconElement.style.display = "block";

  // Create text element
  const textElement = document.createElement("div");
  textElement.textContent = "No authorized loan records found";

  // Assemble the structure
  textContainer.appendChild(iconElement);
  textContainer.appendChild(textElement);
  contentContainer.appendChild(textContainer);
  messageContainer.appendChild(contentContainer);

  return messageContainer;
}

/**
 * Extract loan numbers from table rows with safe DOM access
 */
function extractLoanNumbersFromTableRows(dataRows) {
  const loanNumbers = [];
  const rowLoanMap = new Map();

  if (!dataRows || dataRows.length === 0) {
    return { loanNumbers, rowLoanMap };
  }

  dataRows.forEach((row) => {
    if (!row) return;

    // Servicer Loan Number is in the second column (index 1)
    const servicerLoanCell = row.querySelector("td:nth-child(2)");

    if (servicerLoanCell) {
      const loanNumber = servicerLoanCell.textContent?.trim();
      if (loanNumber && loanNumber !== "&nbsp;" && loanNumber !== "") {
        loanNumbers.push(loanNumber);
        rowLoanMap.set(row, loanNumber);
      }
    }
  });

  return { loanNumbers, rowLoanMap };
}

/**
 * Apply loan authorization filtering to table rows
 */
function applyLoanAuthorizationFilter(rowLoanMap, authorizedLoans) {
  let visibleRowCount = 0;

  if (!rowLoanMap || !authorizedLoans) {
    console.warn("Invalid parameters for loan authorization filtering");
    return visibleRowCount;
  }

  rowLoanMap.forEach((loanNumber, row) => {
    if (!row) return;

    if (authorizedLoans.includes(loanNumber)) {
      // Loan is authorized - keep the row visible
      row.style.display = "";
      visibleRowCount++;
    } else {
      // Loan is restricted - hide the row
      row.style.display = "none";
    }
  });

  return visibleRowCount;
}

/**
 * Update pagination display based on filtered results
 */
function updatePaginationDisplay(visibleRowCount, totalRowCount) {
  try {
    // Find the pagination row with the results text
    const paginationRow = document.querySelector(
      ".pagingDiv.pagingDivNewStyle td"
    );

    if (paginationRow) {
      // Extract original total from existing text or use totalRowCount parameter
      const currentText = paginationRow.textContent.trim();
      const totalMatch = currentText.match(/of\s+(\d+)\s+results/i);
      const originalTotal = totalMatch
        ? parseInt(totalMatch[1])
        : totalRowCount;

      // Update pagination text based on visible count
      if (visibleRowCount === 0) {
        paginationRow.textContent = `Displaying 0-0 of ${originalTotal} results`;
      } else {
        paginationRow.textContent = `Displaying 1-${visibleRowCount} of ${originalTotal} results`;
      }
    } else {
      console.warn("Pagination element not found for update");
    }
  } catch (error) {
    console.error("Error updating pagination display:", error);
  }
}

/**
 * Handle case when no authorized records are found
 */
function handleNoAuthorizedRecords(claimsTable) {
  if (!claimsTable) {
    console.warn("Claims table not available for no records handling");
    return;
  }

  const tableContainer = claimsTable.closest("#divClaimsGridView");
  if (tableContainer) {
    // Hide the original table
    claimsTable.style.display = "none";

    // Add "No Records Found" message
    const noRecordsMessage = createNoAuthorizedRecordsMessage();
    tableContainer.appendChild(noRecordsMessage);
  }
}

/**
 * Main function to filter table rows based on servicer loan numbers
 */
async function filterTableByAuthorizedLoanNumbers() {
  try {
    // Show loader
    createAndDisplayLoader();

    // Wait for extension listener
    // await waitForListener();

    // Find the claims table with null check
    const claimsTable = document.getElementById("ClaimsGridView");

    if (!claimsTable) {
      hideAndRemoveLoader();
      return;
    }

    // Get all data rows (excluding header row) with null check
    const dataRows = claimsTable.querySelectorAll("tr.text-black");

    if (!dataRows || dataRows.length === 0) {
      hideAndRemoveLoader();
      return;
    }

    // Extract all servicer loan numbers from the table
    const { loanNumbers, rowLoanMap } =
      extractLoanNumbersFromTableRows(dataRows);

    if (loanNumbers.length === 0) {
      hideAndRemoveLoader();
      return;
    }

    // Check which loans are authorized
    const authorizedLoans = await checkNumbersBatch(loanNumbers);

    if (!authorizedLoans) {
      console.error("Failed to retrieve authorized loans");
      hideAndRemoveLoader();
      return;
    }

    // Apply loan authorization filtering
    const visibleRowCount = applyLoanAuthorizationFilter(
      rowLoanMap,
      authorizedLoans
    );

    // Update pagination display with filtered results
    updatePaginationDisplay(visibleRowCount, dataRows.length);

    // Handle case when no rows are visible
    if (visibleRowCount === 0) {
      handleNoAuthorizedRecords(claimsTable);
    }

    hideAndRemoveLoader();
  } catch (error) {
    console.error("Error during loan filtering:", error);
    hideAndRemoveLoader();
  }
}

/**
 * Initialize the loan filter when DOM is ready with safe DOM state checking
 */
function initializeLoanAuthorizationFilter() {
  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      filterTableByAuthorizedLoanNumbers
    );
  } else {
    // DOM is already ready, run immediately
    filterTableByAuthorizedLoanNumbers();
  }
}

// Start the script
initializeLoanAuthorizationFilter();
