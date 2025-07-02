/*!
 * @description : Radian Cancel MI Filter Script
 * @portal : Radian Cancel MI Portal
 * @author : Radian Team
 * @group : Radian
 * @owner : Radian
 * @lastModified : 15-May-2023
 * @version : 1.0.0
 */

// ########## DO NOT MODIFY THESE LINES ##########
const EXTENSION_ID = "afkpnpkodeiolpnfnbdokgkclljpgmcm";

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
        } else if (!response || response.error) {
          return reject(response?.error || "Invalid response received");
        }

        if (!response.result || typeof response.result !== "object") {
          return reject("Invalid result format received");
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

function applyElementStyles(element, styles) {
  if (!element || !styles) return;

  Object.entries(styles).forEach(([property, value]) => {
    element.style[property] = value;
  });
}

function createUnauthorizedElement() {
  const unauthorizedContainer = document.createElement("div");

  applyElementStyles(unauthorizedContainer, {
    position: "fixed",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    zIndex: "9999",
    width: "80%",
    maxWidth: "600px",
    textAlign: "center",
    padding: "30px",
    backgroundColor: "#f8d7da",
    border: "2px solid #f5c6cb",
    borderRadius: "8px",
    boxShadow: "0 4px 8px rgba(0, 0, 0, 0.2)",
  });

  const messageContainer = document.createElement("div");

  applyElementStyles(messageContainer, {
    color: "#721c24",
    fontSize: "20px",
    fontWeight: "bold",
    position: "relative",
  });

  const iconElement = document.createElement("i");
  iconElement.className = "fas fa-exclamation-triangle";
  applyElementStyles(iconElement, {
    fontSize: "24px",
    marginBottom: "10px",
    display: "block",
  });

  const textElement = document.createElement("div");
  textElement.textContent =
    "You are not provisioned to see the restricted loan";
  applyElementStyles(textElement, {
    marginTop: "10px",
  });

  const closeButton = document.createElement("button");
  closeButton.textContent = "×";
  applyElementStyles(closeButton, {
    position: "absolute",
    top: "-20px",
    right: "-10px",
    background: "none",
    border: "none",
    fontSize: "24px",
    fontWeight: "bold",
    color: "#721c24",
    cursor: "pointer",
    padding: "0 5px",
    lineHeight: "1",
  });
  closeButton.title = "Close and go back";

  closeButton.addEventListener("click", function () {
    if (unauthorizedContainer.parentNode) {
      unauthorizedContainer.parentNode.removeChild(unauthorizedContainer);
    }
    window.history.back();
  });

  messageContainer.appendChild(iconElement);
  messageContainer.appendChild(textElement);
  messageContainer.appendChild(closeButton);
  unauthorizedContainer.appendChild(messageContainer);

  return unauthorizedContainer;
}

function createLoader() {
  const style = document.createElement("style");
  style.textContent = `
    #radianLoaderOverlay {
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
    .radian-spinner {
      width: 60px;
      height: 60px;
      border: 6px solid #ccc;
      border-top-color: #2b6cb0;
      border-radius: 50%;
      animation: radianSpin 1s linear infinite;
    }
    @keyframes radianSpin {
      to {transform: rotate(360deg);}
    }
    #radianLoaderOverlay.hidden {
      opacity: 0;
      pointer-events: none;
    }
  `;
  return style;
}

function createLoaderElement() {
  const loader = document.createElement("div");
  loader.id = "radianLoaderOverlay";

  const spinner = document.createElement("div");
  spinner.className = "radian-spinner";

  const loadingText = document.createElement("div");
  loadingText.textContent = "Verifying loan access permissions...";
  applyElementStyles(loadingText, {
    marginLeft: "20px",
    fontSize: "16px",
    color: "#2b6cb0",
  });

  loader.appendChild(spinner);
  loader.appendChild(loadingText);

  return loader;
}

/**
 * Show loader during extension communication
 */
function showLoader() {
  const style = createLoader();
  const loader = createLoaderElement();

  const documentHead = document.head;
  const documentBody = document.body;

  if (documentHead && style) {
    documentHead.appendChild(style);
  }

  if (documentBody && loader) {
    documentBody.appendChild(loader);
  }
}

/**
 * Hide loader after extension communication
 */
function hideLoader() {
  const loader = document.getElementById("radianLoaderOverlay");
  if (loader && loader.parentNode) {
    loader.classList.add("hidden");
    setTimeout(() => {
      if (loader.parentNode) {
        loader.parentNode.removeChild(loader);
      }
    }, 300);
  }
}

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

/**
 * Get loan number from the page
 * @returns {string|null} The loan number if found, null otherwise
 */
function getLoanNumberFromPage() {
  const paragraphs = document.querySelectorAll("p.sc-fXqexe");
  for (let i = 0; i < paragraphs.length; i++) {
    if (
      paragraphs[i].textContent.trim() === "Loan Number" &&
      i + 1 < paragraphs.length
    ) {
      const loanNumberText = paragraphs[i + 1].textContent.trim();
      if (containsLoanNumber(loanNumberText)) {
        return loanNumberText;
      }
    }
  }
  for (const element of paragraphs) {
    const text = element.textContent.trim();
    if (containsLoanNumber(text)) {
      return text;
    }
  }

  return null;
}

/**
 * Hide loan content and show unauthorized message
 */
function hideLoanContentAndShowMessage() {
  const loanContainers = document.querySelectorAll(".sc-bDoHkx");
  if (loanContainers && loanContainers.length > 0) {
    loanContainers.forEach((container) => {
      container.style.display = "none";
    });
  }

  const contentMenuElements = document.querySelectorAll(".contentmenu");
  if (contentMenuElements.length > 0) {
    contentMenuElements.forEach((element) => {
      element.style.display = "none";
    });
  }

  const unauthorizedElement = createUnauthorizedElement();
  const documentBody = document.body;
  if (documentBody && unauthorizedElement) {
    documentBody.appendChild(unauthorizedElement);
  }
}

/**
 * Main function to check loan access and handle restrictions
 */
async function checkRadianLoanAccess() {
  try {
    showLoader();

    await waitForListener();

    const loanNumber = getLoanNumberFromPage();

    if (!loanNumber) {
      hideLoader();
      return;
    }

    const allowedLoans = await checkNumbersBatch([loanNumber]);

    if (allowedLoans.length === 0 || !allowedLoans.includes(loanNumber)) {
      hideLoanContentAndShowMessage();
    } else {
      console.log(`Loan ${loanNumber} is authorized - showing content`);
    }

    // Hide loader
    hideLoader();
  } catch (error) {
    hideLoader();
  }
}

/**
 * Set up mutation observer to watch for dynamic content
 */
function setupMutationObserver() {
  let hasFiltered = false;

  const observer = new MutationObserver((mutations) => {
    let shouldFilter = false;

    if (!hasFiltered) {
      for (const mutation of mutations) {
        if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              // Check if the added node or its children contain loan info
              if (
                node.classList?.contains("sc-bDoHkx") ||
                node.querySelector?.(".sc-bDoHkx") ||
                node.classList?.contains("sc-fXqexe") ||
                node.querySelector?.(".sc-fXqexe")
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
        checkRadianLoanAccess().then(() => {
          hasFiltered = true;
        });
      }
    }
  });

  // Start observing the document body for DOM changes
  if (document.body) {
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  return observer;
}

/**
 * Initialize the script when DOM is ready
 */
function initializeRadianLoanFilter() {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      setupMutationObserver();

      setTimeout(checkRadianLoanAccess, 500);
    });
  } else {
    setupMutationObserver();

    checkRadianLoanAccess();
  }
}

initializeRadianLoanFilter();
