/**
 * MT-Engine - Navigation Dropdown Component
 * Handles logo navigation dropdown on mobile/tablet viewports
 */

(function() {
    'use strict';

    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    function init() {
        const trigger = document.getElementById('logoDropdownTrigger');
        const menu = document.getElementById('logoDropdownMenu');

        if (!trigger || !menu) {
            return; // Elements not found, exit gracefully
        }

        let isOpen = false;

        // Toggle dropdown on trigger click
        trigger.addEventListener('click', function(e) {
            e.stopPropagation();
            toggleDropdown();
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', function(e) {
            if (isOpen && !menu.contains(e.target)) {
                closeDropdown();
            }
        });

        // Close dropdown on Escape key
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && isOpen) {
                closeDropdown();
                trigger.focus(); // Return focus to trigger
            }
        });

        // Close dropdown when clicking menu items (navigation)
        const menuItems = menu.querySelectorAll('.logo-dropdown-item');
        menuItems.forEach(function(item) {
            item.addEventListener('click', function() {
                closeDropdown();
            });
        });

        function toggleDropdown() {
            if (isOpen) {
                closeDropdown();
            } else {
                openDropdown();
            }
        }

        function openDropdown() {
            isOpen = true;
            menu.setAttribute('aria-hidden', 'false');
            trigger.setAttribute('aria-expanded', 'true');
        }

        function closeDropdown() {
            isOpen = false;
            menu.setAttribute('aria-hidden', 'true');
            trigger.setAttribute('aria-expanded', 'false');
        }
    }
})();
