document.addEventListener('DOMContentLoaded', function () {
    // Helper function to toggle a class on an element
    function toggleClass(element, className) {
        if (element) {
            element.classList.toggle(className);
        }
    }

    // Helper function to add a class to an element
    function addClass(element, className) {
        if (element && !element.classList.contains(className)) {
            element.classList.add(className);
        }
    }

    // Helper function to remove a class from an element
    function removeClass(element, className) {
        if (element && element.classList.contains(className)) {
            element.classList.remove(className);
        }
    }

    // 1. Profile Dropdown Toggle
    const profileContainer = document.querySelector('.sc-gVALFP'); // Original: kAYHMn
    const profileButton = document.querySelector('.sc-jgqiaS'); // Original: gxMGeg
    const profileDropdown = document.querySelector('.sc-dRWtrI'); // Original: eyTfHN

    if (profileButton && profileDropdown) {
        profileButton.addEventListener('click', function (event) {
            event.preventDefault();
            toggleClass(profileContainer, 'active'); // Use 'active' class to show/hide
        });

        // Optional: Close dropdown if clicked outside
        document.addEventListener('click', function (event) {
            if (profileContainer && !profileContainer.contains(event.target)) {
                removeClass(profileContainer, 'active');
            }
        });
    }

    // 2. Sidenav Toggle
    const sidenavToggleBtn = document.querySelector('.sc-kBWpzf'); // Original: jfFUJD (chevron container)
    const sidenav = document.querySelector('.sidenav');

    if (sidenavToggleBtn && sidenav) {
        sidenavToggleBtn.addEventListener('click', function () {
            toggleClass(sidenav, 'collapsed');
        });
    }

    // 3. Sidenav Accordion (Dropdowns within Sidenav)
    const sidenavDropdownBtns = document.querySelectorAll('.sidenav .sc-iGMcjw > .sc-kIsWfj'); // Original: dtDFZN > djsgz (button part)

    sidenavDropdownBtns.forEach(button => {
        button.addEventListener('click', function (event) {
            event.preventDefault();
            const parentLi = this.closest('.sc-iGMcjw'); // Original: dtDFZN
            if (parentLi) {
                toggleClass(parentLi, 'open');

                // Optional: Close other open dropdowns
                // sidenavDropdownBtns.forEach(otherButton => {
                //     const otherParentLi = otherButton.closest('.sc-iGMcjw');
                //     if (otherParentLi !== parentLi && otherParentLi.classList.contains('open')) {
                //         removeClass(otherParentLi, 'open');
                //     }
                // });
            }
        });
    });


    // 4. Modal Functionality (Security Statement, Legal Agreement, Contact Us)
    // This assumes there's one generic modal structure that gets populated or multiple modals
    // For simplicity, this example targets the "Security Statement" modal specifically.
    // You'll need to adapt if there are multiple distinct modals.

    const securityStatementLink = document.querySelector('a.sc-ieHmQB[href*="#"][data-class=""]'); // A bit fragile selector, better to add IDs
    const modal = document.querySelector('.mio-modal'); // Original: sc-jlvdqA fESObR
    const modalCloseButton = document.querySelector('.mio-modal .sc-dOUtaJ'); // Original: fyZudU (button inside modal)
    const modalDialogCloseIcon = document.querySelector('.mio-modal .sc-cEjDvn'); // Original: gOcFlF (X icon in modal header)

    function openModal() {
        if (modal) addClass(modal, 'active');
    }

    function closeModal() {
        if (modal) removeClass(modal, 'active');
    }

    if (securityStatementLink && modal) {
        // Attempt to find the "Security Statement" link more reliably.
        // This might need adjustment based on the actual unique identifiers for these links.
        const footerLinks = document.querySelectorAll('.sc-dIPoqc .sc-ieHmQB');
        footerLinks.forEach(link => {
            // This is a guess. Ideally, these links would have unique IDs or data attributes.
            if (link.textContent.trim().toLowerCase() === 'security statement') {
                link.addEventListener('click', function (event) {
                    event.preventDefault();
                    // Here you might also fetch/populate content for this specific modal if it's dynamic
                    openModal();
                });
            }
            // Add similar listeners for "Legal Agreement" and "Contact Us" if they use the same modal structure
            // or have their own modal elements.
        });
    }

    if (modalCloseButton) {
        modalCloseButton.addEventListener('click', closeModal);
    }
    if (modalDialogCloseIcon) {
        modalDialogCloseIcon.addEventListener('click', closeModal);
    }

    // Close modal if backdrop is clicked
    if (modal) {
        modal.addEventListener('click', function (event) {
            if (event.target === modal) { // Clicked on the backdrop itself
                closeModal();
            }
        });
    }

    // 5. Search icon click (placeholder - actual search needs backend)
    const searchIcon = document.querySelector('.sc-cAvGjs svg');
    const searchInput = document.querySelector('.sc-suerX');
    if (searchIcon && searchInput) {
        searchIcon.addEventListener('click', function() {
            const searchTerm = searchInput.value;
            if (searchTerm.trim() !== "") {
                console.log('Search initiated for:', searchTerm);
                // alert('Search for: ' + searchTerm); // Replace with actual search logic
            } else {
                searchInput.focus();
            }
        });
        searchInput.addEventListener('keypress', function(event) {
            if (event.key === 'Enter') {
                const searchTerm = searchInput.value;
                 if (searchTerm.trim() !== "") {
                    console.log('Search initiated for:', searchTerm);
                    // alert('Search for: ' + searchTerm); // Replace with actual search logic
                }
            }
        });
    }

    // 6. Handle iframe height - adjust based on content or a fixed aspect ratio
    // This is a very basic example. Robust iframe resizing is complex.
    const contentIframe = document.getElementById('contentBlock-iframe');
    function resizeIframe() {
        if (contentIframe) {
            // Option 1: Set to a fixed large height (as in original)
            // contentIframe.style.height = '1055px'; // Or a dynamic calculation

            // Option 2: Attempt to set height based on its content (requires same-origin or postMessage)
            // This usually doesn't work well for cross-origin iframes without cooperation from the iframe content.
            // try {
            //    const body = contentIframe.contentWindow.document.body;
            //    const html = contentIframe.contentWindow.document.documentElement;
            //    const height = Math.max(body.scrollHeight, body.offsetHeight, html.clientHeight, html.scrollHeight, html.offsetHeight);
            //    contentIframe.style.height = height + 'px';
            // } catch (e) {
            //    console.warn("Could not resize iframe due to cross-origin restrictions or content not loaded.", e);
            //    contentIframe.style.height = '80vh'; // Fallback height
            // }

            // For now, let's ensure it has a min-height via CSS and can scroll.
            // The CSS already sets min-height: 70vh and overflow: auto for .contentmenu
        }
    }
    if (contentIframe) {
        contentIframe.addEventListener('load', resizeIframe);
        resizeIframe(); // Initial call
    }

    // Remove placeholder hrefs to prevent page jumps
    document.querySelectorAll('a[href="#"], a[href*="javascript:void(0)"], a[href*="TO_FEEDBACK_INQUIRY=Y"]').forEach(link => {
        // Check if it's not part of a specific functionality we want to keep (e.g., modal triggers)
        const isModalTrigger = link.closest('.sc-dIPoqc') && (link.textContent.includes('Security Statement') || link.textContent.includes('Legal Agreement') || link.textContent.includes('Contact Us'));
        if (!isModalTrigger) {
            link.addEventListener('click', function(event) {
                event.preventDefault();
                console.log('Prevented default action for link:', link.textContent.trim() || 'icon link');
            });
        }
    });

    console.log('Radian custom scripts loaded.');
});