
const EXTENSION_ID = "hellpeipojbghaaopdnddjakinlmocjl";

/**
 * Establish Communication with Loan Checker Extension
 * @param {number} [maxRetries=20] - Max attempts.
 * @param {number} [delay=100] - Initial delay in ms.
 * @returns {Promise<boolean>} Resolves when extension responds.
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
 * @param {string[]} loanIds - List of numeric loan IDs.
 * @returns {Promise<string[]>} Restricted loan IDs returned by extension.
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
 * Create restricted message element
 */
function createRestrictedMessage() {
    const message = document.createElement("div");
    message.id = "solicitation-restricted-message";
    message.style.cssText = `
    display: flex;
    justify-content: center;
    align-items: center;
    height: 200px;
    font-size: 18px;
    color: #003b4d;
    background-color: #f8f9fa;
    border: 2px solid #dee2e6;
    border-radius: 8px;
    margin: 20px;
    text-align: center;
  `;
    message.textContent = "Loan is not provisioned to you.";
    return message;
}

/**
 * Extract loan number from the page
 * @returns {string|null} The loan number or null if not found
 */
function extractLoanNumber() {
    // Document Center specific: Look for the servicing loan number span
    const servicingNumSpan = document.getElementById('_LblServicingNumValue');
    if (servicingNumSpan) {
        const value = (servicingNumSpan.textContent || '').trim();
        if (value && /^\d{10}$/.test(value)) {
            return value;
        }
    }

    // Alternative: Look for any span with lableValue_column class that contains a 10-digit number
    const valueSpans = document.querySelectorAll('span.lableValue_column');
    for (const span of valueSpans) {
        const text = (span.textContent || '').trim();
        if (/^\d{10}$/.test(text)) {
            return text;
        }
    }

    // Fallback: Look for any span containing a 10-digit loan number
    const allSpans = document.querySelectorAll('span');
    for (const span of allSpans) {
        const text = (span.textContent || '').trim();
        if (/^\d{10}$/.test(text)) {
            return text;
        }
    }

    return null;
}

/**
 * Hide pageBody section and show restricted message
 */
function hidePageAndShowRestricted() {
    const loanInfoPanel = document.getElementById('_PnlLoanInfo');
    if (loanInfoPanel) {
        loanInfoPanel.style.display = 'none';

        // Create and show restricted message
        const restrictedMessage = createRestrictedMessage();
        loanInfoPanel.parentNode.insertBefore(restrictedMessage, loanInfoPanel.nextSibling);
    }
}

/**
 * Show pageBody section and hide restricted message
 */
function showPageAndHideRestricted() {
    const loanInfoPanel = document.getElementById('_PnlLoanInfo');
    const restrictedMessage = document.getElementById('solicitation-restricted-message');

    if (loanInfoPanel) {
        loanInfoPanel.style.display = 'block';
    }

    if (restrictedMessage) {
        restrictedMessage.remove();
    }
}

/**
 * Main function to check loan access
 */
async function checkLoanAccess() {
    try {
        // Use cached loan number if available, otherwise extract it
        const loanNumber = currentLoanNumber || extractLoanNumber();

        if (!loanNumber) {
            console.warn("No loan number found on page");
            return;
        }

        // Store in cache for future reference
        currentLoanNumber = loanNumber;

        // Check if loan is allowed
        const allowedNumbers = await checkNumbersBatch([loanNumber]);

        if (allowedNumbers.length === 0) {
            console.log("Loan not allowed, hiding page content");
            hidePageAndShowRestricted();
        } else {
            console.log("Loan allowed, showing page content");
            showPageAndHideRestricted();
        }

    } catch (error) {
        console.error("Error checking loan access:", error);
        // On error, hide the page for security
        hidePageAndShowRestricted();
    }
}

/**
 * Wait for page to be ready
 */
function waitForPageReady() {
    return new Promise((resolve) => {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', resolve);
        } else {
            resolve();
        }
    });
}

/**
 * Debounce function to limit frequent executions
 */
function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

// Cache for the current loan number to avoid unnecessary checks
let currentLoanNumber = null;
let isCheckingAccess = false;

/**
 * Setup Mutation Observer to watch for loan number changes
 */
function setupMutationObserver() {
    // Target the document body to catch changes in iframes and dynamic content
    const targetNode = document.body;

    const observer = new MutationObserver(
        debounce(async (mutations) => {
            // Skip if already checking access
            if (isCheckingAccess) {
                return;
            }

            // Only process if there are relevant mutations
            const relevantChanges = mutations.some(mutation => {
                // Check if this mutation affects elements with our target classes or IDs
                return Array.from(mutation.addedNodes).some(node => {
                    if (node.nodeType !== Node.ELEMENT_NODE) return false;
                    return node.querySelector?.('span.lableValue_column, #_LblServicingNumValue') ||
                        node.classList?.contains('lableValue_column') ||
                        node.id === '_LblServicingNumValue';
                });
            });

            if (!relevantChanges) {
                return;
            }

            console.log("Relevant DOM changes detected, checking for loan number...");

            // Check if loan number is now available and has changed
            const newLoanNumber = extractLoanNumber();
            if (newLoanNumber && newLoanNumber !== currentLoanNumber) {
                console.log("New loan number found:", newLoanNumber);
                currentLoanNumber = newLoanNumber;

                isCheckingAccess = true;
                try {
                    await checkLoanAccess();
                } finally {
                    isCheckingAccess = false;
                }
            }
        }, 500) // 500ms debounce for better performance
    );

    // Start observing with more specific options
    observer.observe(targetNode, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style', 'class', 'id'], // Watch for style/class/id changes
        characterData: false
    });

    console.log("Optimized mutation observer started on document body");
    return observer;
}

// Main execution
(async function () {
    try {
        // Wait for page to be ready
        await waitForPageReady();

        // Wait for extension connection
        await waitForListener();

        // Setup mutation observer for dynamic content
        setupMutationObserver();

        // Initial check
        await checkLoanAccess();

    } catch (error) {
        console.error("Solicitation filter failed:", error);
    }
})();