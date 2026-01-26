/**
 * Confirmation Modal Component
 * Nothing OS style modal for user confirmations
 */

/**
 * Show confirmation modal
 * @param {Object} options - Modal options
 * @param {string} options.title - Modal title
 * @param {string} options.message - Optional message
 * @param {Array<string>} options.items - List of items (torrent names)
 * @param {string} options.confirmText - Confirm button text (default: "确认")
 * @param {string} options.cancelText - Cancel button text (default: "取消")
 * @param {boolean} options.isDanger - Use danger styling (default: false)
 * @param {boolean} options.showWarning - Show warning message (default: false)
 * @param {string} options.warningText - Warning text
 * @param {boolean} options.showCheckbox - Show checkbox option (default: false)
 * @param {string} options.checkboxLabel - Checkbox label
 * @param {boolean} options.checkboxDefault - Checkbox default checked (default: true)
 * @returns {Promise<Object|null>} Resolves with {confirmed: true, checkboxValue: bool} or null if cancelled
 */
function showConfirmModal(options) {
    return new Promise((resolve) => {
        const {
            title,
            message,
            items = [],
            confirmText = '确认',
            cancelText = '取消',
            isDanger = false,
            showWarning = false,
            warningText = '',
            showCheckbox = false,
            checkboxLabel = '',
            checkboxDefault = true
        } = options;

        // Create modal HTML
        const backdrop = document.createElement('div');
        backdrop.className = 'modal-backdrop';

        const dialog = document.createElement('div');
        dialog.className = 'modal-dialog';

        // Header
        const header = document.createElement('div');
        header.className = 'modal-header';
        const titleEl = document.createElement('h3');
        titleEl.className = `modal-title${isDanger ? ' warning' : ''}`;
        titleEl.textContent = title;
        header.appendChild(titleEl);

        // Body
        const body = document.createElement('div');
        body.className = 'modal-body';

        // Message
        if (message) {
            const messageEl = document.createElement('p');
            messageEl.className = 'modal-message';
            messageEl.textContent = message;
            body.appendChild(messageEl);
        }

        // Items list
        if (items.length > 0) {
            const countText = document.createElement('p');
            countText.textContent = `即将操作 ${items.length} 个种子：`;
            body.appendChild(countText);

            const list = document.createElement('ul');
            list.className = 'modal-torrent-list';
            items.slice(0, 10).forEach(item => {
                const li = document.createElement('li');
                li.textContent = item;
                list.appendChild(li);
            });
            if (items.length > 10) {
                const li = document.createElement('li');
                li.textContent = `... 及其他 ${items.length - 10} 个`;
                li.style.fontStyle = 'italic';
                list.appendChild(li);
            }
            body.appendChild(list);
        }

        // Checkbox
        let checkboxInput = null;
        if (showCheckbox) {
            const checkboxDiv = document.createElement('div');
            checkboxDiv.className = 'modal-checkbox';

            checkboxInput = document.createElement('input');
            checkboxInput.type = 'checkbox';
            checkboxInput.id = 'modal-checkbox';
            checkboxInput.checked = checkboxDefault;

            const checkboxLabelEl = document.createElement('label');
            checkboxLabelEl.htmlFor = 'modal-checkbox';
            checkboxLabelEl.textContent = checkboxLabel;

            checkboxDiv.appendChild(checkboxInput);
            checkboxDiv.appendChild(checkboxLabelEl);
            body.appendChild(checkboxDiv);
        }

        // Warning
        if (showWarning) {
            const warning = document.createElement('div');
            warning.className = 'modal-warning';
            warning.textContent = warningText;
            body.appendChild(warning);
        }

        // Footer
        const footer = document.createElement('div');
        footer.className = 'modal-footer';

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'modal-btn';
        cancelBtn.textContent = cancelText;

        const confirmBtn = document.createElement('button');
        confirmBtn.className = `modal-btn${isDanger ? ' danger' : ''}`;
        confirmBtn.textContent = confirmText;

        footer.appendChild(cancelBtn);
        footer.appendChild(confirmBtn);

        // Assemble
        dialog.appendChild(header);
        dialog.appendChild(body);
        dialog.appendChild(footer);
        backdrop.appendChild(dialog);

        // Event handlers
        const cleanup = () => {
            backdrop.remove();
        };

        cancelBtn.addEventListener('click', () => {
            cleanup();
            resolve(null);
        });

        confirmBtn.addEventListener('click', () => {
            cleanup();
            const result = {
                confirmed: true
            };
            if (showCheckbox && checkboxInput) {
                result.checkboxValue = checkboxInput.checked;
            }
            resolve(result);
        });

        // Close on backdrop click
        backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop) {
                cleanup();
                resolve(null);
            }
        });

        // Escape key
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                cleanup();
                resolve(null);
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);

        // Show modal
        document.body.appendChild(backdrop);
    });
}

// Export
window.showConfirmModal = showConfirmModal;
