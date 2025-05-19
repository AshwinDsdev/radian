// Radian Search JavaScript

document.addEventListener('DOMContentLoaded', function() {
    // Initialize search functionality
    initSearch();
    
    // Initialize date pickers
    initDatePickers();
    
    // Initialize checkboxes
    initCheckboxes();
    
    // Initialize modal dialogs
    initModals();
});

// Search functionality
function initSearch() {
    const searchButton = document.querySelector('.sc-fvNoK button');
    const searchInput = document.querySelector('.sc-suerX');
    
    if (searchButton && searchInput) {
        searchButton.addEventListener('click', function() {
            const searchTerm = searchInput.value.trim();
            if (searchTerm) {
                console.log('Searching for:', searchTerm);
                // In a real application, this would trigger an API call
                // For demo purposes, we'll just log the search term
            } else {
                alert('Please enter a search term');
            }
        });
    }
    
    // Enable search on Enter key
    if (searchInput) {
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                searchButton.click();
            }
        });
    }
}

// Date picker initialization
function initDatePickers() {
    const datePickers = document.querySelectorAll('input[placeholder="MM/DD/YYYY"]');
    
    datePickers.forEach(function(picker) {
        picker.addEventListener('focus', function() {
            // In a real application, this would initialize a date picker
            console.log('Date picker focused:', picker.id);
        });
        
        // Simple date validation
        picker.addEventListener('blur', function() {
            const value = picker.value.trim();
            if (value && !/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
                alert('Please enter a date in MM/DD/YYYY format');
                picker.value = '';
            }
        });
    });
}

// Checkbox initialization
function initCheckboxes() {
    const checkboxes = document.querySelectorAll('input[type="checkbox"]');
    
    checkboxes.forEach(function(checkbox) {
        checkbox.addEventListener('change', function() {
            console.log('Checkbox changed:', checkbox.id, checkbox.checked);
        });
    });
}

// Modal dialog initialization
function initModals() {
    // Security Statement modal
    const securityLinks = document.querySelectorAll('a.sc-ieHmQB');
    const modal = document.querySelector('.sc-jlvdqA');
    const closeButton = modal ? modal.querySelector('button') : null;
    
    if (securityLinks.length && modal && closeButton) {
        securityLinks.forEach(function(link) {
            link.addEventListener('click', function(e) {
                e.preventDefault();
                modal.style.display = 'flex';
            });
        });
        
        closeButton.addEventListener('click', function() {
            modal.style.display = 'none';
        });
        
        // Close modal when clicking outside
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
    }
}

// Table row click handler
document.addEventListener('click', function(e) {
    const target = e.target;
    const row = target.closest('tr');
    
    if (row && !target.closest('a') && !target.closest('svg')) {
        const id = row.querySelector('td:nth-child(2) a');
        if (id) {
            console.log('Row clicked, ID:', id.textContent);
            // In a real application, this would navigate to the detail page
        }
    }
});

// SVG icon functionality
document.addEventListener('click', function(e) {
    const svg = e.target.closest('svg');
    
    if (svg) {
        const title = svg.querySelector('title');
        if (title) {
            console.log('Icon clicked:', title.textContent);
            // In a real application, this would trigger the appropriate action
        }
    }
});