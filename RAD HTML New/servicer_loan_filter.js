/*!
 * @description : Servicer Loan Filter Script
 * @portal : MI Online - Radian
 * @author :  Accelirate Team
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
 * Create unauthorized access message element
 */
function createUnauthorizedElement() {
  const unauthorized = document.createElement("div");
  unauthorized.innerHTML = `
    <div style="
      display: flex;
      justify-content: center;
      align-items: center;
      height: 200px;
      background-color: #f8f9fa;
      border: 2px solid #dc3545;
      border-radius: 8px;
      margin: 20px;
    ">
      <div style="
        text-align: center;
        color: #dc3545;
        font-size: 18px;
        font-weight: bold;
        padding: 20px;
      ">
        <i class="fas fa-exclamation-triangle" style="font-size: 24px; margin-bottom: 10px;"></i>
        <br>
        You are not authorized to view restricted loans
      </div>
    </div>
  `;
  
  return unauthorized;
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
 * Create Loader Element
 */
function createLoaderElement() {
  const loader = document.createElement("div");
  loader.id = "loaderOverlay";
  loader.innerHTML = `
    <div class="spinner"></div>
    <div style="margin-left: 20px; font-size: 16px; color: #2b6cb0;">
      Verifying loan access permissions...
    </div>
  `;
  return loader;
}

/**
 * Show loader during extension communication
 */
function showLoader() {
  const style = createLoader();
  const loader = createLoaderElement();
  
  document.head.appendChild(style);
  document.body.appendChild(loader);
}

/**
 * Hide loader after extension communication
 */
function hideLoader() {
  const loader = document.getElementById("loaderOverlay");
  if (loader) {
    loader.classList.add("hidden");
    setTimeout(() => loader.remove(), 300);
  }
}

/**
 * Main function to check servicer loan number and handle restrictions
 */
async function checkServicerLoanAccess() {
  try {
    // Show loader while checking
    showLoader();
    
    // Wait for extension listener
    await waitForListener();
    
    // Find the servicer loan number element
    const servicerLoanElement = document.querySelector("#lblServicerLoanNumVal");
    
    if (!servicerLoanElement) {
      console.log("No servicer loan number element found");
      hideLoader();
      return;
    }
    
    const loanNumber = servicerLoanElement.textContent.trim();
    
    if (!loanNumber) {
      console.log("No loan number found in element");
      hideLoader();
      return;
    }
    
    console.log(`Checking access for loan number: ${loanNumber}`);
    
    // Check if loan is restricted
    const allowedLoans = await checkNumbersBatch([loanNumber]);
    
    if (allowedLoans.length === 0) {
      // Loan is restricted - hide content and show unauthorized message
      console.log(`Loan ${loanNumber} is restricted - hiding content`);
      
      // Find the main content container (you may need to adjust this selector)
      const mainContent = document.querySelector("body") || document.documentElement;
      
      // Hide all existing content
      const allElements = document.querySelectorAll("body > *:not(script):not(style)");
      allElements.forEach(element => {
        if (element.id !== "loaderOverlay") {
          element.style.display = "none";
        }
      });
      
      // Show unauthorized message
      const unauthorizedElement = createUnauthorizedElement();
      document.body.appendChild(unauthorizedElement);
      
    } else {
      console.log(`Loan ${loanNumber} is authorized - showing content`);
    }
    
    // Hide loader
    hideLoader();
    
  } catch (error) {
    console.error("Error checking loan access:", error);
    hideLoader();
    
    // Show error message
    const errorElement = document.createElement("div");
    errorElement.innerHTML = `
      <div style="
        display: flex;
        justify-content: center;
        align-items: center;
        height: 200px;
        background-color: #fff3cd;
        border: 2px solid #ffc107;
        border-radius: 8px;
        margin: 20px;
        color: #856404;
        font-size: 16px;
        font-weight: bold;
      ">
        Error: Unable to verify loan access permissions. Please try again later.
      </div>
    `;
    document.body.appendChild(errorElement);
  }
}

/**
 * Initialize the script when DOM is ready
 */
function initializeServicerLoanFilter() {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", checkServicerLoanAccess);
  } else {
    // DOM is already ready
    checkServicerLoanAccess();
  }
}

// Start the script
initializeServicerLoanFilter();