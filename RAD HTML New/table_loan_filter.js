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
          if (chrome.runtime.lastError) {
            console.warn(
              "❌ Chrome runtime error:",
              chrome.runtime.lastError.message
            );
            timeoutId = setTimeout(() => {
              attempts++;
              delay *= 2; // Exponential backoff (100ms → 200ms → 400ms...)
              sendPing();
            }, delay);
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

// ########## DO NOT MODIFY THESE LINES - END ##########
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

// ########## DYNAMIC PAGE MONITORING FOR LEVEL 3 IFRAME ##########

/**
 * Global monitoring state
 */
let isMonitoring = false;
let currentPageProcessed = false;
let observerInstance = null;
let level1Observer = null;
let level2Observer = null;
let level3Observer = null;
let processingInProgress = false;
let lastProcessTime = 0;
const PROCESS_DEBOUNCE_TIME = 2000; // 2 seconds minimum between processing attempts

/**
 * Check if current page is the target screen (ClaimsReports.html) by looking for specific elements
 */
function isTargetScreen(doc = document) {
  // Check if this is specifically the MI Online - Radian-ViewClaimRpts page
  const isClaimReportsPage =
    doc.title?.includes("MI Online - Radian") &&
    (window.location.href.includes("ViewClaimRpts") ||
      window.location.href.includes("Claims/Reports") ||
      doc.body?.textContent?.includes("View Claim Reports"));

  // Look for the claims table that indicates this is ClaimsReports.html
  const claimsTable = doc.querySelector("#ClaimsGridView");
  const claimsContainer = doc.querySelector("#divClaimsGridView");

  // Additional checks to ensure this is the claims reports screen
  const hasClaimsContent =
    doc.querySelector(".claims-content") ||
    doc.querySelector("[id*='Claims']") ||
    doc.querySelector("[class*='claims']") ||
    doc.body?.textContent?.includes("Claims") ||
    doc.body?.textContent?.includes("Report");

  console.log(
    `[table_loan_filter] Page check: isClaimReportsPage: ${!!isClaimReportsPage}, claims table: ${!!claimsTable}, claims container: ${!!claimsContainer}, claims content: ${!!hasClaimsContent}`
  );

  return !!(
    claimsTable ||
    claimsContainer ||
    (hasClaimsContent && isClaimReportsPage)
  );
}

/**
 * Process the current page if it's the target screen (ClaimsReports.html)
 */
async function processCurrentPage(doc = document) {
  const now = Date.now();

  // Debounce processing to prevent loops
  if (processingInProgress) {
    console.log(
      "[table_loan_filter] Processing already in progress, skipping..."
    );
    return;
  }

  if (now - lastProcessTime < PROCESS_DEBOUNCE_TIME) {
    console.log(
      "[table_loan_filter] Too soon since last process, debouncing..."
    );
    return;
  }

  if (currentPageProcessed) {
    console.log("[table_loan_filter] Page already processed, skipping...");
    return;
  }

  if (!isTargetScreen(doc)) {
    console.log(
      "[table_loan_filter] Not target screen (ClaimsReports.html), waiting for correct page..."
    );
    return;
  }

  console.log(
    "[table_loan_filter] ✅ Target screen (ClaimsReports.html) detected! Processing table filtering..."
  );

  processingInProgress = true;
  currentPageProcessed = true;
  lastProcessTime = now;

  try {
    await filterTableByAuthorizedLoanNumbers(doc);
  } catch (error) {
    console.error("[table_loan_filter] Error processing page:", error);
    // Reset flag on error to allow retry after debounce time
    currentPageProcessed = false;
  } finally {
    processingInProgress = false;
  }
}

/**
 * Monitor the complete iframe hierarchy for the target page (Level 3)
 */
function monitorIframeHierarchy() {
  console.log(
    "[table_loan_filter] 🎯 Monitoring specific iframe hierarchy for Level 3..."
  );

  // First check if we're on the correct parent page (MI Online - Radian-ViewClaimRpts)
  const isCorrectParentPage =
    document.title?.includes("MI Online - Radian") &&
    (window.location.href.includes("ViewClaimRpts") ||
      window.location.href.includes("Claims/Reports"));

  if (!isCorrectParentPage) {
    console.log(
      "[table_loan_filter] ⏳ Not on correct parent page (ViewClaimRpts), skipping monitoring..."
    );
    return;
  }

  console.log(
    "[table_loan_filter] ✅ On correct parent page, looking for iframe hierarchy..."
  );

  // Level 1: Look for contentBlock-iframe (parent -> mionlineNavigation.html)
  const level1Iframe = document.getElementById("contentBlock-iframe");

  if (level1Iframe) {
    console.log(
      "[table_loan_filter] ✅ Found Level 1 iframe (contentBlock-iframe)"
    );
    monitorLevel1Iframe(level1Iframe);
  } else {
    console.log(
      "[table_loan_filter] ⏳ Level 1 iframe (contentBlock-iframe) not found, waiting..."
    );
  }
}

/**
 * Monitor Level 1 iframe (mionlineNavigation.html) for Level 2 iframe
 */
function monitorLevel1Iframe(level1Iframe) {
  if (!level1Iframe || !level1Iframe.contentDocument) {
    console.log(
      "[table_loan_filter] Level 1 iframe not accessible, waiting for load..."
    );
    level1Iframe?.addEventListener(
      "load",
      () => {
        setTimeout(() => monitorLevel1Iframe(level1Iframe), 1000);
      },
      { once: true }
    );
    return;
  }

  const level1Doc = level1Iframe.contentDocument;
  console.log(
    "[table_loan_filter] 🔍 Monitoring Level 1 iframe for Level 2..."
  );

  // Look for Level 2 iframe (frmMIOnlineContent)
  const level2Iframe =
    level1Doc.getElementById("frmMIOnlineContent") ||
    level1Doc.querySelector(".iFrameContainer");

  if (level2Iframe) {
    console.log(
      "[table_loan_filter] ✅ Found Level 2 iframe (frmMIOnlineContent)"
    );
    monitorLevel2Iframe(level2Iframe);
  } else {
    console.log(
      "[table_loan_filter] ⏳ Level 2 iframe not found, setting up observer..."
    );

    // Disconnect existing Level 1 observer to prevent duplicates
    if (level1Observer) {
      level1Observer.disconnect();
    }

    // Set up observer for Level 1 to watch for Level 2 iframe
    level1Observer = new MutationObserver((mutations) => {
      let foundLevel2 = false;
      mutations.forEach((mutation) => {
        if (mutation.type === "childList" && !foundLevel2) {
          mutation.addedNodes.forEach((node) => {
            if (
              node.nodeName === "IFRAME" &&
              (node.id === "frmMIOnlineContent" ||
                node.className.includes("iFrameContainer"))
            ) {
              console.log(
                "[table_loan_filter] ✅ Level 2 iframe dynamically added!"
              );
              foundLevel2 = true;
              level1Observer.disconnect(); // Stop observing once found
              monitorLevel2Iframe(node);
            }
          });
        }
      });
    });

    level1Observer.observe(level1Doc.body || level1Doc.documentElement, {
      childList: true,
      subtree: true,
    });
  }

  // Also listen for load events on Level 1 (with once flag to prevent loops)
  level1Iframe.addEventListener(
    "load",
    () => {
      console.log(
        "[table_loan_filter] Level 1 iframe reloaded, re-checking..."
      );
      currentPageProcessed = false;
      setTimeout(() => monitorLevel1Iframe(level1Iframe), 1000);
    },
    { once: true }
  );
}

/**
 * Monitor Level 2 iframe for Level 3 iframe (ClaimsReports.html)
 */
function monitorLevel2Iframe(level2Iframe) {
  if (!level2Iframe || !level2Iframe.contentDocument) {
    console.log(
      "[table_loan_filter] Level 2 iframe not accessible, waiting for load..."
    );
    level2Iframe?.addEventListener(
      "load",
      () => {
        setTimeout(() => monitorLevel2Iframe(level2Iframe), 1000);
      },
      { once: true }
    );
    return;
  }

  const level2Doc = level2Iframe.contentDocument;
  console.log(
    "[table_loan_filter] 🔍 Monitoring Level 2 iframe for Level 3 (ClaimsReports.html)..."
  );

  // Look for Level 3 iframe that loads ClaimsReports.html - be very specific
  const level3Iframe = level2Doc.getElementById("frmMIOnlineContent");

  if (level3Iframe) {
    console.log(
      "[table_loan_filter] ✅ Found Level 3 iframe (frmMIOnlineContent -> ClaimsReports.html)"
    );

    // Verify this iframe is actually loading ClaimsReports.html
    const iframeSrc = level3Iframe.src;
    if (
      iframeSrc &&
      (iframeSrc.includes("ClaimsReports") ||
        iframeSrc.includes("ClaimsViewReport"))
    ) {
      console.log(
        "[table_loan_filter] ✅ Confirmed Level 3 iframe is loading ClaimsReports.html"
      );
      monitorLevel3Iframe(level3Iframe);
    } else {
      console.log(
        "[table_loan_filter] ⚠️ Level 3 iframe found but not loading ClaimsReports.html, src:",
        iframeSrc
      );
      // Still monitor it in case the src is relative or gets updated
      monitorLevel3Iframe(level3Iframe);
    }
  } else {
    console.log(
      "[table_loan_filter] ⏳ Level 3 iframe (frmMIOnlineContent) not found, setting up observer..."
    );

    // Disconnect existing Level 2 observer to prevent duplicates
    if (level2Observer) {
      level2Observer.disconnect();
    }

    // Set up observer for Level 2 to watch for Level 3 iframe
    level2Observer = new MutationObserver((mutations) => {
      let foundLevel3 = false;
      mutations.forEach((mutation) => {
        if (mutation.type === "childList" && !foundLevel3) {
          mutation.addedNodes.forEach((node) => {
            if (
              node.nodeName === "IFRAME" &&
              node.id === "frmMIOnlineContent"
            ) {
              console.log(
                "[table_loan_filter] ✅ Level 3 iframe (frmMIOnlineContent) dynamically added!"
              );
              foundLevel3 = true;
              level2Observer.disconnect(); // Stop observing once found
              monitorLevel3Iframe(node);
            }
          });
        }
      });
    });

    level2Observer.observe(level2Doc.body || level2Doc.documentElement, {
      childList: true,
      subtree: true,
    });
  }

  // Also listen for load events on Level 2 (with once flag)
  level2Iframe.addEventListener(
    "load",
    () => {
      console.log(
        "[table_loan_filter] Level 2 iframe reloaded, re-checking..."
      );
      currentPageProcessed = false;
      setTimeout(() => monitorLevel2Iframe(level2Iframe), 1000);
    },
    { once: true }
  );
}

/**
 * Monitor Level 3 iframe (ClaimsReports.html) for target content
 */
function monitorLevel3Iframe(level3Iframe) {
  if (!level3Iframe || !level3Iframe.contentDocument) {
    console.log(
      "[table_loan_filter] Level 3 iframe not accessible, waiting for load..."
    );
    level3Iframe?.addEventListener(
      "load",
      () => {
        setTimeout(() => monitorLevel3Iframe(level3Iframe), 1000);
      },
      { once: true }
    );
    return;
  }

  const level3Doc = level3Iframe.contentDocument;
  console.log(
    "[table_loan_filter] 🎯 Monitoring Level 3 iframe (ClaimsReports.html)..."
  );

  // Process immediately if target screen is already loaded
  setTimeout(() => processCurrentPage(level3Doc), 500);

  // Disconnect existing Level 3 observer to prevent duplicates
  if (level3Observer) {
    level3Observer.disconnect();
  }

  // Create observer for Level 3 content changes
  level3Observer = new MutationObserver((mutations) => {
    let shouldCheck = false;

    mutations.forEach((mutation) => {
      if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
        const hasSignificantChange = Array.from(mutation.addedNodes).some(
          (node) =>
            node.nodeType === 1 && // Element node
            (node.id || node.className || node.tagName !== "SCRIPT")
        );
        if (hasSignificantChange) {
          shouldCheck = true;
        }
      }
    });

    if (shouldCheck && !processingInProgress) {
      console.log(
        "[table_loan_filter] Level 3 iframe content changed, checking for target screen..."
      );
      currentPageProcessed = false;
      setTimeout(() => processCurrentPage(level3Doc), 1000);
    }
  });

  // Observe changes in Level 3 iframe with reduced sensitivity
  level3Observer.observe(level3Doc.body || level3Doc.documentElement, {
    childList: true,
    subtree: false, // Only direct children to reduce noise
    attributes: false, // Disable attribute monitoring to prevent loops
  });

  // Listen for load events on Level 3 (with once flag)
  level3Iframe.addEventListener(
    "load",
    () => {
      console.log(
        "[table_loan_filter] Level 3 iframe loaded, checking content..."
      );
      currentPageProcessed = false;
      setTimeout(() => processCurrentPage(level3Iframe.contentDocument), 1500);
    },
    { once: true }
  );
}

/**
 * Start monitoring for target page across specific iframe hierarchy
 */
function startDynamicMonitoring() {
  if (isMonitoring) {
    console.log("[table_loan_filter] Already monitoring, skipping...");
    return;
  }

  isMonitoring = true;
  console.log("[table_loan_filter] 🔍 Starting dynamic page monitoring...");

  // Check main document first
  processCurrentPage(document);

  // Monitor main document changes
  if (observerInstance) {
    observerInstance.disconnect();
  }

  observerInstance = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      // Look for specific iframe being added
      if (mutation.type === "childList") {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeName === "IFRAME") {
            const iframeId = node.id;
            const iframeClass = node.className;
            const iframeSrc = node.src;
            console.log(
              `[table_loan_filter] New iframe detected: id="${iframeId}", class="${iframeClass}", src="${iframeSrc}"`
            );

            // Target specific iframes by exact ID for the Claims Reports hierarchy
            if (iframeId === "contentBlock-iframe") {
              console.log(
                "[table_loan_filter] Level 1 iframe (contentBlock-iframe) detected, monitoring..."
              );
              monitorLevel1Iframe(node);
            } else if (iframeId === "frmMIOnlineContent") {
              console.log(
                "[table_loan_filter] Level 3 iframe (frmMIOnlineContent) detected directly, monitoring..."
              );
              monitorLevel3Iframe(node);
            }
          }
        });
      }
    });

    // Also check if main page changed to target screen (with debouncing)
    if (!processingInProgress) {
      currentPageProcessed = false;
      setTimeout(() => processCurrentPage(document), 1000);
    }
  });

  observerInstance.observe(document.body || document.documentElement, {
    childList: true,
    subtree: true,
  });

  // Monitor existing specific iframes in hierarchy
  monitorIframeHierarchy();

  // Periodic check as fallback (reduced frequency)
  setInterval(() => {
    if (!currentPageProcessed && !processingInProgress) {
      console.log("[table_loan_filter] Periodic check for target screen...");
      monitorIframeHierarchy();
    }
  }, 10000); // Increased to 10 seconds
}

/**
 * Enhanced URL change detection
 */
function monitorURLChanges() {
  let currentURL = window.location.href;

  // Override pushState and replaceState to detect programmatic navigation
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  history.pushState = function (...args) {
    originalPushState.apply(history, args);
    handleURLChange();
  };

  history.replaceState = function (...args) {
    originalReplaceState.apply(history, args);
    handleURLChange();
  };

  // Listen for popstate events
  window.addEventListener("popstate", handleURLChange);

  function handleURLChange() {
    const newURL = window.location.href;
    if (newURL !== currentURL) {
      console.log("[table_loan_filter] URL changed:", currentURL, "->", newURL);
      currentURL = newURL;
      currentPageProcessed = false;
      setTimeout(() => processCurrentPage(document), 1000);
    }
  }
}

/**
 * Emergency stop function to halt all monitoring (useful for debugging)
 */
function stopAllMonitoring() {
  console.log(
    "[table_loan_filter] 🛑 EMERGENCY STOP - Halting all monitoring..."
  );

  if (observerInstance) {
    observerInstance.disconnect();
    observerInstance = null;
  }

  if (level1Observer) {
    level1Observer.disconnect();
    level1Observer = null;
  }

  if (level2Observer) {
    level2Observer.disconnect();
    level2Observer = null;
  }

  if (level3Observer) {
    level3Observer.disconnect();
    level3Observer = null;
  }

  isMonitoring = false;
  processingInProgress = false;
  currentPageProcessed = true; // Prevent further processing

  console.log("[table_loan_filter] ✅ All monitoring stopped");
}

// Make it globally accessible for emergency use
window.stopTableLoanFilter = stopAllMonitoring;

// ########## END DYNAMIC PAGE MONITORING ##########

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
function createAndDisplayLoader(targetDoc = document) {
  // Ensure styles are injected
  createLoaderStyles();

  // Create loader element
  const loader = createLoaderElement();

  // Safely append to document body
  const documentBody = targetDoc.body;
  if (documentBody) {
    documentBody.appendChild(loader);
  } else {
    console.warn("Document body not available for loader insertion");
  }
}

/**
 * Hide and remove the loan filter loader with safe DOM manipulation
 */
function hideAndRemoveLoader(targetDoc = document) {
  const loader = targetDoc.getElementById("loanFilterLoader");
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
function updatePaginationDisplay(
  visibleRowCount,
  totalRowCount,
  targetDoc = document
) {
  try {
    // Find the pagination row with the results text
    const paginationRow = targetDoc.querySelector(
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
async function filterTableByAuthorizedLoanNumbers(targetDoc = document) {
  try {
    // Show loader
    createAndDisplayLoader(targetDoc);

    // Wait for extension listener
    // await waitForListener();

    // Find the claims table with null check
    const claimsTable = targetDoc.getElementById("ClaimsGridView");

    if (!claimsTable) {
      hideAndRemoveLoader(targetDoc);
      return;
    }

    // Get all data rows (excluding header row) with null check
    const dataRows = claimsTable.querySelectorAll("tr.text-black");

    if (!dataRows || dataRows.length === 0) {
      hideAndRemoveLoader(targetDoc);
      return;
    }

    // Extract all servicer loan numbers from the table
    const { loanNumbers, rowLoanMap } =
      extractLoanNumbersFromTableRows(dataRows);

    if (loanNumbers.length === 0) {
      hideAndRemoveLoader(targetDoc);
      return;
    }

    // Check which loans are authorized
    const authorizedLoans = await checkNumbersBatch(loanNumbers);

    if (!authorizedLoans) {
      console.error("Failed to retrieve authorized loans");
      hideAndRemoveLoader(targetDoc);
      return;
    }

    // Apply loan authorization filtering
    const visibleRowCount = applyLoanAuthorizationFilter(
      rowLoanMap,
      authorizedLoans
    );

    // Update pagination display with filtered results
    updatePaginationDisplay(visibleRowCount, dataRows.length, targetDoc);

    // Handle case when no rows are visible
    if (visibleRowCount === 0) {
      handleNoAuthorizedRecords(claimsTable);
    }

    hideAndRemoveLoader(targetDoc);
  } catch (error) {
    console.error("Error during loan filtering:", error);
    hideAndRemoveLoader(targetDoc);
  }
}

/**
 * Initialize the loan filter when DOM is ready with safe DOM state checking
 */
function initializeLoanAuthorizationFilter() {
  console.log(
    "[table_loan_filter] 🚀 Initializing dynamic table loan filter..."
  );

  // Check if we're on the correct page before starting monitoring
  const isClaimReportsPage =
    document.title?.includes("MI Online - Radian") &&
    (window.location.href.includes("ViewClaimRpts") ||
      window.location.href.includes("Claims/Reports"));

  if (!isClaimReportsPage) {
    console.log(
      "[table_loan_filter] ⏳ Not on Claims Reports page, script will remain dormant until correct page is reached"
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      startDynamicMonitoring();
      monitorURLChanges();
    });
  } else {
    // DOM is already ready
    startDynamicMonitoring();
    monitorURLChanges();
  }
}

// Start the script
initializeLoanAuthorizationFilter();

// ########## IFRAME INJECTION LOGIC - ENHANCED FOR LEVEL 3 ##########

/**
 * Inject this script into the specific Level 3 iframe (ClaimsReports.html) using targeted approach
 */
function injectIntoDeepIframe() {
  // Target Level 1 iframe specifically
  function pollForLevel1Iframe(maxAttempts = 30, interval = 300) {
    return new Promise((resolve, reject) => {
      let attempts = 0;
      function check() {
        const level1Iframe =
          document.getElementById("contentBlock-iframe") ||
          document.querySelector(".iFrameClass");

        if (
          level1Iframe &&
          level1Iframe.contentWindow &&
          level1Iframe.contentDocument
        ) {
          console.log(
            "[table_loan_filter] [DEBUG] Found Level 1 iframe (contentBlock-iframe)"
          );
          resolve(level1Iframe);
        } else if (++attempts < maxAttempts) {
          if (attempts === 1)
            console.log(
              "[table_loan_filter] [DEBUG] Waiting for Level 1 iframe (contentBlock-iframe)..."
            );
          setTimeout(check, interval);
        } else {
          console.warn(
            "[table_loan_filter] [DEBUG] Level 1 iframe not found after " +
              maxAttempts +
              " attempts."
          );
          reject(new Error("Level 1 iframe not found or not accessible"));
        }
      }
      check();
    });
  }

  // Target Level 2 iframe specifically inside Level 1
  function pollForLevel2Iframe(level1Doc, maxAttempts = 30, interval = 300) {
    return new Promise((resolve, reject) => {
      let attempts = 0;
      function check() {
        const level2Iframe =
          level1Doc.getElementById("frmMIOnlineContent") ||
          level1Doc.querySelector(".iFrameContainer");

        if (
          level2Iframe &&
          level2Iframe.contentWindow &&
          level2Iframe.contentDocument
        ) {
          console.log(
            "[table_loan_filter] [DEBUG] Found Level 2 iframe (frmMIOnlineContent) on attempt",
            attempts + 1
          );
          resolve(level2Iframe);
        } else if (++attempts < maxAttempts) {
          if (attempts === 1)
            console.log(
              "[table_loan_filter] [DEBUG] Waiting for Level 2 iframe (frmMIOnlineContent)..."
            );
          setTimeout(check, interval);
        } else {
          console.warn(
            "[table_loan_filter] [DEBUG] Level 2 iframe (frmMIOnlineContent) not found after",
            maxAttempts,
            "attempts."
          );
          reject(
            new Error(
              "Level 2 iframe (frmMIOnlineContent) not found or not accessible"
            )
          );
        }
      }
      check();
    });
  }

  // Target Level 3 iframe specifically inside Level 2
  function pollForLevel3Iframe(level2Doc, maxAttempts = 30, interval = 300) {
    return new Promise((resolve, reject) => {
      let attempts = 0;
      function check() {
        // Look specifically for frmMIOnlineContent which loads ClaimsReports.html
        const level3Iframe = level2Doc.getElementById("frmMIOnlineContent");

        if (
          level3Iframe &&
          level3Iframe.contentWindow &&
          level3Iframe.contentDocument
        ) {
          console.log(
            "[table_loan_filter] [DEBUG] Found Level 3 iframe (frmMIOnlineContent -> ClaimsReports.html) on attempt",
            attempts + 1
          );

          // Verify the iframe src if possible
          const iframeSrc = level3Iframe.src;
          console.log(
            "[table_loan_filter] [DEBUG] Level 3 iframe src:",
            iframeSrc
          );

          resolve(level3Iframe);
        } else if (++attempts < maxAttempts) {
          if (attempts === 1)
            console.log(
              "[table_loan_filter] [DEBUG] Waiting for Level 3 iframe (frmMIOnlineContent -> ClaimsReports.html)..."
            );
          setTimeout(check, interval);
        } else {
          console.warn(
            "[table_loan_filter] [DEBUG] Level 3 iframe (frmMIOnlineContent) not found after",
            maxAttempts,
            "attempts."
          );
          reject(
            new Error(
              "Level 3 iframe (frmMIOnlineContent) not found or not accessible"
            )
          );
        }
      }
      check();
    });
  }

  // Main logic with specific targeting for Level 3
  (async function () {
    try {
      console.log(
        "[table_loan_filter] [DEBUG] Starting targeted Level 3 iframe injection..."
      );
      const scriptUrl = window.getCurrentScriptUrl();
      if (!scriptUrl) {
        console.warn(
          "[table_loan_filter] [DEBUG] Could not determine script URL for injection."
        );
        return;
      }

      // Step 1: Wait for Level 1 iframe (contentBlock-iframe)
      console.log(
        "[table_loan_filter] [DEBUG] Step 1: Looking for Level 1 iframe..."
      );
      const level1Iframe = await pollForLevel1Iframe();

      // Step 2: Wait for Level 2 iframe inside Level 1 (frmMIOnlineContent)
      console.log(
        "[table_loan_filter] [DEBUG] Step 2: Looking for Level 2 iframe..."
      );
      const level1Doc = level1Iframe.contentDocument;
      const level2Iframe = await pollForLevel2Iframe(level1Doc);

      // Step 3: Wait for Level 3 iframe inside Level 2 (ClaimsReports.html)
      console.log(
        "[table_loan_filter] [DEBUG] Step 3: Looking for Level 3 iframe..."
      );
      const level2Doc = level2Iframe.contentDocument;
      const level3Iframe = await pollForLevel3Iframe(level2Doc);

      // Step 4: Wait for Level 3 iframe's document to be ready
      console.log(
        "[table_loan_filter] [DEBUG] Step 4: Preparing Level 3 iframe document..."
      );
      const level3Doc = level3Iframe.contentDocument;
      if (level3Doc.readyState === "loading") {
        console.log(
          "[table_loan_filter] [DEBUG] Waiting for Level 3 iframe DOMContentLoaded..."
        );
        await new Promise((res) =>
          level3Doc.addEventListener("DOMContentLoaded", res, { once: true })
        );
      }

      // Step 5: Inject script into ClaimsReports.html
      console.log(
        "[table_loan_filter] [DEBUG] Step 5: Injecting script into ClaimsReports.html..."
      );
      window.injectScript(level3Doc, scriptUrl);
      console.log(
        "[table_loan_filter] [DEBUG] ✅ Targeted Level 3 iframe injection complete!"
      );
    } catch (e) {
      console.warn(
        "[table_loan_filter] [DEBUG] ❌ Targeted Level 3 iframe injection failed:",
        e
      );
    }
  })();
}

// Attempt iframe injection after DOM ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", injectIntoDeepIframe);
} else {
  injectIntoDeepIframe();
}

// ########## UTILITY FUNCTIONS ##########

window.getCurrentScriptUrl = function () {
  if (document.currentScript && document.currentScript.src) {
    console.log(
      "[table_loan_filter] [DEBUG] getCurrentScriptUrl: Using document.currentScript.src:",
      document.currentScript.src
    );
    return document.currentScript.src;
  }
  const scripts = document.getElementsByTagName("script");
  for (let i = 0; i < scripts.length; i++) {
    if (scripts[i].src && scripts[i].src.includes("table_loan_filter.js")) {
      console.log(
        "[table_loan_filter] [DEBUG] getCurrentScriptUrl: Found script by name:",
        scripts[i].src
      );
      return scripts[i].src;
    }
  }
  // Fallback: hardcoded path (adjust as needed)
  console.warn(
    "[table_loan_filter] [DEBUG] getCurrentScriptUrl: Falling back to hardcoded path ./table_loan_filter.js"
  );
  return "./table_loan_filter.js";
};

window.injectScript = function (doc, scriptUrl) {
  if (!scriptUrl) {
    console.warn("[table_loan_filter] [DEBUG] No scriptUrl to inject.");
    return;
  }
  const script = doc.createElement("script");
  script.type = "text/javascript";
  script.src = scriptUrl;
  if (!doc.querySelector('script[src="' + scriptUrl + '"]')) {
    doc.head.appendChild(script);
    console.log(
      "[table_loan_filter] [DEBUG] Injected script into Level 3 iframe:",
      scriptUrl
    );
  } else {
    console.log(
      "[table_loan_filter] [DEBUG] Script already present in Level 3 iframe:",
      scriptUrl
    );
  }
};
