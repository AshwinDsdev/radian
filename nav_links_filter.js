/*!
 * @description : Navigation Links Filter Script
 * @portal : MI Online - Radian Navigation
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
    if (
      typeof chrome === "undefined" ||
      !chrome.runtime ||
      !chrome.runtime.sendMessage
    ) {
      console.warn(
        "❌ Chrome extension API not available. Running in standalone mode."
      );
      resolve(false);
      return;
    }

    let attempts = 0;
    let delay = initialDelay;
    let timeoutId;

    function sendPing() {
      if (attempts >= maxRetries) {
        console.warn("❌ No listener detected after maximum retries.");
        clearTimeout(timeoutId);
        resolve(false);
        return;
      }

      chrome.runtime.sendMessage(
        EXTENSION_ID,
        {
          type: "ping",
        },
        (response) => {
          if (chrome.runtime.lastError) {
            console.warn("Chrome extension error:", chrome.runtime.lastError);
            attempts++;
            if (attempts >= maxRetries) {
              resolve(false);
              return;
            }
            timeoutId = setTimeout(sendPing, delay);
            return;
          }

          if (response?.result === "pong") {
            clearTimeout(timeoutId);
            resolve(true);
          } else {
            timeoutId = setTimeout(() => {
              attempts++;
              delay *= 2; // Exponential backoff
              sendPing();
            }, delay);
          }
        }
      );
    }

    sendPing();
  });
}
// ########## DO NOT MODIFY THESE LINES - END ##########

/**
 * Logger utility for consistent debug output
 */
const logger = {
  debug: (...args) => console.debug('[NavLinksFilter]', ...args),
  info: (...args) => console.info('[NavLinksFilter]', ...args),
  warn: (...args) => console.warn('[NavLinksFilter]', ...args),
  error: (...args) => console.error('[NavLinksFilter]', ...args),
};

// ########## NAVIGATION LINKS TO HIDE ##########
const HIDDEN_NAV_LINKS = [
  'Rate Finder',
  'New Application',
  'Activate Deferred',
  'Transfer Servicing',
  'Document Center'
];

// ########## MUTATION OBSERVER ##########

/**
 * Set up mutation observer to handle dynamic content loading
 */
function setupMutationObserver() {
  if (window.navLinksMutationObserver) {
    return; // Already set up
  }

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        // Check if new content contains navigation links
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node;
            if (element.querySelector && element.querySelector('a')) {
              logger.debug("🔄 Dynamic content detected with links");
              // Re-run link hiding
              setTimeout(() => {
                hideNavigationLinks();
              }, 100);
              break;
            }
          }
        }
      }
    });
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  window.navLinksMutationObserver = observer;
  logger.info("Mutation observer set up for navigation links");
}

// ########## LINK HIDING LOGIC ##########

/**
 * Hide specified navigation links
 */
function hideNavigationLinks() {
  logger.info("🔒 Hiding restricted navigation links");
  
  try {
    // Find all anchor tags
    const allLinks = document.querySelectorAll('a');
    let hiddenCount = 0;
    
    logger.debug(`🔍 Checking ${allLinks.length} links...`);
    
    allLinks.forEach((link, index) => {
      const text = link.textContent?.replace(/\s+/g, ' ').trim() || '';
      
      // Skip empty elements
      if (!text) return;
      
      // Check if this link should be hidden
      const shouldHide = HIDDEN_NAV_LINKS.some(hiddenText => 
        text.includes(hiddenText)
      );
      
      if (shouldHide) {
        link.style.display = 'none';
        hiddenCount++;
        logger.debug(`🚫 Hidden: "${text}"`);
      }
    });
    
    logger.info(`✅ Navigation links control applied - ${hiddenCount} links hidden`);
    
  } catch (error) {
    logger.error("❌ Error hiding navigation links:", error);
  }
}

// ########## INITIALIZATION ##########

/**
 * Global execution flag to prevent multiple runs
 */
window.navLinksFilterExecuted = window.navLinksFilterExecuted || false;

/**
 * Main initialization function
 */
async function initializeNavLinksFilter() {
  // Prevent multiple executions
  if (window.navLinksFilterExecuted) {
    logger.warn("⚠️ Navigation links filter already executed, skipping");
    return;
  }

  window.navLinksFilterExecuted = true;
  logger.info("🚀 Initializing Navigation Links Filter");

  try {
    // Set up mutation observer for dynamic content
    setupMutationObserver();

    // Establish connection with the extension
    logger.info("🔗 Establishing connection with extension...");
    const connectionEstablished = await waitForListener();
    
    if (connectionEstablished) {
      logger.info("✅ Extension connection established successfully");
    } else {
      logger.warn("⚠️ Extension connection failed, running in standalone mode");
    }
    
    // Hide navigation links after connection attempt
    hideNavigationLinks();

  } catch (error) {
    logger.error("❌ Error in navigation links filter:", error);
  }
}

// ########## AUTO-START ##########

// Start initialization when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(initializeNavLinksFilter, 300);
  });
} else {
  setTimeout(initializeNavLinksFilter, 300);
}

logger.info("📜 Navigation Links Filter script loaded");
