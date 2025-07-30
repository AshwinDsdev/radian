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
      if (!chrome.runtime?.sendMessage) {
        reject(new Error("Chrome runtime not available"));
        return;
      }

      chrome.runtime?.sendMessage(
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
//         } else if (!response || response.error) {
//           return reject(response?.error || "Invalid response received");
//         }

//         if (!response.result || typeof response.result !== "object") {
//           return reject("Invalid result format received");
//         }

//         const available = Object.keys(response.result).filter(
//           (key) => response.result[key]
//         );
//         resolve(available);
//       }
//     );
//   });
// }


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

function createLoader() {
  const style = document.createElement("style");
  style.textContent = `
    #loaderOverlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(255, 255, 255, 5);
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
 * To grab the DOM elements and perform action like adding and removing.
 */
class FormElement {
  constructor() {
    this.element = document.querySelectorAll(".contentmenu");
    this.parent = this.element[0] && this.element[0].parentElement;
    this.unallowed = createUnallowedElement();
  }

  removeCancelMIElement() {
    this.element.forEach((section) => {
      if (
        section.innerHTML.includes("Cancel MI") ||
        section.innerHTML.includes("Certificate Number") ||
        section.innerHTML.includes("Company Name") ||
        section.innerHTML.includes("Borrower Name") ||
        section.innerHTML.includes("Policy Status") ||
        section.innerHTML.includes("Address") ||
        section.innerHTML.includes("Loan Number") ||
        section.innerHTML.includes("Cancellation Reason") ||
        section.innerHTML.includes("Cancellation Date")
      ) {
        section.remove();
      }
    });
  }

  addCancelMIElement() {
    if (this.parent) {
      this.parent.appendChild(this.unallowed);
    }
  }

  getCancelMITargetElement() {
    return Array.from(this.element).find((section) => {
      return section.innerHTML.includes("Cancel MI");
    });
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
  // Method 1: Look for the specific pattern in the HTML structure
  const allDivs = document.querySelectorAll("div");
  for (const div of allDivs) {
    const paragraphs = div.querySelectorAll("p");
    for (let i = 0; i < paragraphs.length; i++) {
      const currentText = paragraphs[i].textContent.trim();
      if (currentText === "Loan Number" && i + 1 < paragraphs.length) {
        const loanNumberText = paragraphs[i + 1].textContent.trim();
        if (containsLoanNumber(loanNumberText)) {
          return loanNumberText;
        }
      }
    }
  }

  // Method 2: Look for any paragraph containing "Loan Number" and get the next sibling
  const allParagraphs = document.querySelectorAll("p");
  for (let i = 0; i < allParagraphs.length; i++) {
    const currentText = allParagraphs[i].textContent.trim();
    if (currentText === "Loan Number" && i + 1 < allParagraphs.length) {
      const loanNumberText = allParagraphs[i + 1].textContent.trim();
      if (containsLoanNumber(loanNumberText)) {
        return loanNumberText;
      }
    }
  }

  // Method 3: Look for any text that looks like a loan number in the content
  const allTextElements = document.querySelectorAll("p, div, span, td");
  for (const element of allTextElements) {
    const text = element.textContent.trim();
    if (containsLoanNumber(text) && text.length >= 5 && text.length <= 15) {
      // Additional validation: make sure it's not just a label
      if (!text.toLowerCase().includes("loan") &&
        !text.toLowerCase().includes("number") &&
        !text.toLowerCase().includes("certificate") &&
        !text.toLowerCase().includes("company") &&
        !text.toLowerCase().includes("borrower") &&
        !text.toLowerCase().includes("policy") &&
        !text.toLowerCase().includes("address")) {
        return text;
      }
    }
  }

  // Method 4: Look for the specific structure from the HTML
  const contentMenu = document.querySelector(".contentmenu");
  if (contentMenu) {
    const loanNumberElements = contentMenu.querySelectorAll("p");
    for (let i = 0; i < loanNumberElements.length; i++) {
      const currentText = loanNumberElements[i].textContent.trim();
      if (currentText === "Loan Number" && i + 1 < loanNumberElements.length) {
        const loanNumberText = loanNumberElements[i + 1].textContent.trim();
        if (containsLoanNumber(loanNumberText)) {
          return loanNumberText;
        }
      }
    }
  }

  return null;
}

/**
 * Check loan number and handle restricted loans for offshore users
 */
async function handleFormElement() {
  try {
    // Getting Form Element
    const formElement = new FormElement();

    // Find loan number from the page
    const loanNumber = getLoanNumberFromPage();

    if (!loanNumber) {
      console.log("No loan number found yet, continuing to wait...");
      return false; // Return false to indicate we should keep waiting
    }

    console.log("Processing loan number:", loanNumber);

    // Check if loan is restricted
    const allowedLoans = await checkNumbersBatch([loanNumber]);
    if (allowedLoans.length === 0) {
      console.log("Loan is restricted, hiding content");
      formElement.removeCancelMIElement();
      formElement.addCancelMIElement();
    } else {
      console.log("Loan is allowed, showing content");
    }

    return true; // Return true to indicate we're done processing
  } catch (error) {
    console.error("Error in handleFormElement:", error);
    return false;
  }
}

/**
 * Setup Mutation Observer to watch for dynamic changes
 */
function setupCaseObserver() {
  const observer = new MutationObserver((mutationList) => {
    for (const mutation of mutationList) {
      if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
        console.log("New content detected, checking for loan number...");
        // Check if loan number is now available
        const loanNumber = getLoanNumberFromPage();
        if (loanNumber) {
          console.log("Loan number found:", loanNumber);
          handleFormElement();
        }
      }
    }
  });

  // Observe the entire document body for changes
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  return observer;
}

// Main entrypoint (this is where everything starts)
(async function () {
  // create loader style.
  const style = createLoader();

  // Append loader style into header.
  document.head.appendChild(style);

  // Create loader element to load while connecting to extension.
  const loader = createLoaderElement();

  // Append loader element in to body.
  document.body.appendChild(loader);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", onReady);
  } else {
    onReady();
  }

  async function onReady() {
    try {
      // Check Loan extension connection
      // await waitForListener();

      // Setup mutation observer to watch for content changes
      const observer = setupCaseObserver();

      // Initial check for loan number
      let isProcessed = await handleFormElement();

      // If loan number not found, keep checking periodically
      if (!isProcessed) {

        const checkInterval = setInterval(async () => {
          isProcessed = await handleFormElement();
          if (isProcessed) {
            console.log("Loan number processed successfully, stopping periodic checks");
            clearInterval(checkInterval);
            // Remove loader only after successful processing
            loader.remove();
          }
        }, 1000); // Check every 1 second

        // Set a maximum timeout to prevent infinite loading
        setTimeout(() => {
          if (!isProcessed) {
            console.warn("Timeout reached, removing loader and continuing");
            clearInterval(checkInterval);
            loader.remove();
          }
        }, 30000); // 30 second timeout
      } else {
        // Loan number was found and processed immediately
        console.log("Loan number processed immediately");
        loader.remove();
      }

    } catch (error) {
      console.error("Extension connection failed:", error);
      // Continue without extension functionality
      loader.remove();
    }
  }
})();
