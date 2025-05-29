/**
 * @function createUnallowedElement
 * @description Creates a DOM element to display when a loan is not provisioned to the user
 * @returns {HTMLElement} The created element
 */
function createUnallowedElement() {
  const unallowed = document.createElement("div");
  unallowed.appendChild(
    document.createTextNode("You are not provisioned to see the restricted loan")
  );
  unallowed.style.textAlign = "center";
  unallowed.style.padding = "15px";
  unallowed.style.margin = "10px 0";
  unallowed.style.fontWeight = "bold";
  unallowed.style.color = "#721c24";
  unallowed.style.backgroundColor = "#f8d7da";
  unallowed.style.border = "1px solid #f5c6cb";
  unallowed.style.borderRadius = "4px";

  return unallowed;
}

// Track if initial processing is done
let initialProcessingDone = false;

/**
 * @class TableRowFilter
 * @description Class to manage the visibility of table rows containing loan information
 */
class TableRowFilter {
  constructor(row) {
    this.row = row;
    this.parent = row.parentElement;
    this.loanNumber = this.getLoanNumber();
    console.log('[radian_filter] Created filter for row:', {
      rowText: this.row.textContent,
      loanNumber: this.loanNumber
    });
  }

  getLoanNumber() {
    // Log all cells in the row to inspect their content
    const cells = this.row.cells;
    console.log('[radian_filter] All cells in row:', Array.from(cells).map((cell, index) => ({
      index,
      text: cell.textContent.trim(),
      classes: cell.className,
      style: cell.getAttribute('style'),
      html: cell.innerHTML
    })));

    // Try to find the loan number cell by looking for a cell containing only numbers
    let loanNumberCell = null;
    let foundIndex = -1;

    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i];
      const text = cell.textContent.trim();
      // Check if the cell contains only numbers (loan number)
      if (/^\d+$/.test(text)) {
        loanNumberCell = cell;
        foundIndex = i;
        break;
      }
    }

    console.log('[radian_filter] Found loan number cell:', {
      index: foundIndex,
      text: loanNumberCell?.textContent.trim(),
      classes: loanNumberCell?.className,
      style: loanNumberCell?.getAttribute('style')
    });
    
    if (loanNumberCell) {
      const loanNumber = loanNumberCell.textContent.trim();
      console.log('[radian_filter] Extracted loan number:', loanNumber);
      return loanNumber;
    }
    
    console.log('[radian_filter] No loan number cell found');
    return null;
  }

  async filter() {
    if (!this.loanNumber) {
      console.log('[radian_filter] No loan number to check');
      return false;
    }

    console.log('[radian_filter] Checking if loan number is allowed:', this.loanNumber);
    const isAllowed = await isLoanNumberAllowed(this.loanNumber);
    console.log('[radian_filter] Loan number check result:', { loanNumber: this.loanNumber, isAllowed });

    if (!isAllowed) {
      console.log('[radian_filter] Loan number not allowed, hiding row');
      this.hide();
      return true;
    }

    console.log('[radian_filter] Loan number allowed, showing row');
    return false;
  }

  hide() {
    console.log('[radian_filter] Hiding row with loan number:', this.loanNumber);
    this.row.style.display = "none";
  }
}

/**
 * @async
 * @function processTableRows
 * @description Processes all table rows in the search results and hides those containing unauthorized loan numbers
 */
async function processTableRows() {
  // Only process on initial load
  if (initialProcessingDone) {
    console.log('[radian_filter] Skipping processing as initial processing is done');
    return;
  }

  console.log('[radian_filter] Starting to process table rows');

  const tableRows = document.querySelectorAll(".sc-jBIHhB tbody tr");
  console.log('[radian_filter] Found rows:', tableRows.length);

  let restrictedCount = 0;
  let totalRows = tableRows.length;

  // Clear any existing messages first
  const table = document.querySelector('.sc-jBIHhB');
  if (table) {
    // Remove any existing message above the table
    const existingMessage = table.previousElementSibling;
    if (existingMessage && existingMessage.style.backgroundColor === '#f8d7da') {
      existingMessage.remove();
    }
    // Also remove any messages inside the table
    const tbody = table.querySelector('tbody');
    if (tbody) {
      const existingMessages = tbody.querySelectorAll('tr td[colspan="7"]');
      existingMessages.forEach(msg => msg.parentElement.remove());
    }
  }

  // Process all rows
  for (const row of tableRows) {
    if (processedElements.has(row)) {
      console.log('[radian_filter] Row already processed, skipping');
      continue;
    }
    processedElements.add(row);

    console.log('[radian_filter] Processing row:', row.textContent);
    const filter = new TableRowFilter(row);
    const isRestricted = await filter.filter();
    if (isRestricted) {
      restrictedCount++;
      console.log('[radian_filter] Row is restricted, count:', restrictedCount);
    }
  }

  console.log('[radian_filter] Processing complete:', {
    totalRows,
    restrictedCount,
    shouldShowMessage: totalRows === 1 && restrictedCount === 1
  });

  // Show restricted message if there's exactly one result and it's restricted
  if (totalRows === 1 && restrictedCount === 1) {
    console.log('[radian_filter] Showing restricted message');
    const table = document.querySelector('.sc-jBIHhB');
    if (table) {
      // Add the restricted message above the table
      const unallowed = createUnallowedElement();
      table.parentNode.insertBefore(unallowed, table);
    }
  }

  // Mark initial processing as done
  initialProcessingDone = true;
}

// Initialize the script
initialize(); 