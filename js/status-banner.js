/**
 * Status Banner Module for IMA Annotate Frontend
 * Handles responsive banner component for error/status messages
 */

import { CONFIG } from '../config.js';

/**
 * StatusBanner class manages the display of status messages, errors, and notifications
 * Provides responsive banner component with different message types and auto-dismiss functionality
 */
export class StatusBanner {
    constructor() {
        this.bannerElement = null;
        this.messageElement = null;
        this.closeButton = null;
        this.currentTimeout = null;
        this.isVisible = false;
        
        this.init();
    }

    /**
     * Initialize the status banner system
     */
    init() {
        // Get banner elements from DOM
        this.bannerElement = document.getElementById('status-banner');
        this.messageElement = document.getElementById('status-message');
        this.closeButton = this.bannerElement?.querySelector('.btn-close');
        
        if (!this.bannerElement || !this.messageElement) {
            console.error('Status banner elements not found in DOM');
            return;
        }

        // Set up event listeners
        this.setupEventListeners();
        
        console.log('Status banner system initialized');
    }

    /**
     * Set up event listeners for banner interactions
     */
    setupEventListeners() {
        // Handle close button click
        if (this.closeButton) {
            this.closeButton.addEventListener('click', () => {
                this.hide();
            });
        }

        // Handle banner click to dismiss (optional)
        this.bannerElement.addEventListener('click', (event) => {
            // Only dismiss if clicking on the banner itself, not child elements
            if (event.target === this.bannerElement) {
                this.hide();
            }
        });

        // Handle escape key to dismiss banner
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && this.isVisible) {
                this.hide();
            }
        });
    }

    /**
     * Show status message with specified type and options
     * @param {string} message - The message to display
     * @param {string} type - Message type: 'success', 'warning', 'danger', 'info'
     * @param {Object} options - Additional options
     */
    show(message, type = 'warning', options = {}) {
        const {
            autoDismiss = true,
            dismissDelay = CONFIG.UI.TOAST_DURATION,
            persistent = false,
            showCloseButton = true
        } = options;

        if (!this.bannerElement || !this.messageElement) {
            console.error('Status banner not initialized');
            return;
        }

        // Clear any existing timeout
        if (this.currentTimeout) {
            clearTimeout(this.currentTimeout);
            this.currentTimeout = null;
        }

        // Set message content
        this.messageElement.textContent = message;

        // Update banner classes for styling
        this.bannerElement.className = `alert alert-${type} alert-dismissible fade show`;
        
        // Show/hide close button based on options
        if (this.closeButton) {
            this.closeButton.style.display = showCloseButton ? 'block' : 'none';
        }

        // Show the banner
        this.bannerElement.classList.remove('d-none');
        this.isVisible = true;

        // Add accessibility attributes
        this.bannerElement.setAttribute('role', 'alert');
        this.bannerElement.setAttribute('aria-live', 'polite');

        // Auto-dismiss if enabled and not persistent
        if (autoDismiss && !persistent) {
            this.currentTimeout = setTimeout(() => {
                this.hide();
            }, dismissDelay);
        }

        // Log the message
        this.logMessage(message, type);

        console.log(`Status banner shown: ${type} - ${message}`);
    }

    /**
     * Hide the status banner
     */
    hide() {
        if (!this.bannerElement) {
            return;
        }

        // Clear any pending timeout
        if (this.currentTimeout) {
            clearTimeout(this.currentTimeout);
            this.currentTimeout = null;
        }

        // Hide the banner with fade effect
        this.bannerElement.classList.add('d-none');
        this.isVisible = false;

        // Remove accessibility attributes
        this.bannerElement.removeAttribute('role');
        this.bannerElement.removeAttribute('aria-live');

        console.log('Status banner hidden');
    }

    /**
     * Show API connectivity warning
     */
    showApiConnectivityWarning() {
        this.show(
            CONFIG.ERROR_MESSAGES.API_UNREACHABLE,
            'warning',
            {
                persistent: true,
                autoDismiss: false
            }
        );
    }

    /**
     * Show invalid API key warning
     */
    showInvalidApiKeyWarning() {
        this.show(
            CONFIG.ERROR_MESSAGES.INVALID_API_KEY,
            'warning',
            {
                persistent: true,
                autoDismiss: false
            }
        );
    }

    /**
     * Show sample mode notification
     */
    showSampleModeNotification() {
        this.show(
            'Running in sample mode with limited functionality. API connection failed.',
            'info',
            {
                persistent: true,
                autoDismiss: false
            }
        );
    }

    /**
     * Show connection restored message
     */
    showConnectionRestored() {
        this.show(
            CONFIG.SUCCESS_MESSAGES.CONNECTION_RESTORED,
            'success',
            {
                autoDismiss: true,
                dismissDelay: 3000
            }
        );
    }

    /**
     * Show network error message
     */
    showNetworkError(details = '') {
        const message = details ? 
            `${CONFIG.ERROR_MESSAGES.NETWORK_ERROR} ${details}` : 
            CONFIG.ERROR_MESSAGES.NETWORK_ERROR;
            
        this.show(
            message,
            'danger',
            {
                autoDismiss: true,
                dismissDelay: 5000
            }
        );
    }

    /**
     * Show image load error
     */
    showImageLoadError(filename = '') {
        const message = filename ? 
            `Failed to load image: ${filename}` : 
            CONFIG.ERROR_MESSAGES.IMAGE_LOAD_FAILED;
            
        this.show(
            message,
            'warning',
            {
                autoDismiss: true,
                dismissDelay: 4000
            }
        );
    }

    /**
     * Show save error message
     */
    showSaveError() {
        this.show(
            CONFIG.ERROR_MESSAGES.SAVE_FAILED,
            'danger',
            {
                autoDismiss: true,
                dismissDelay: 5000
            }
        );
    }

    /**
     * Show export error message
     */
    showExportError() {
        this.show(
            CONFIG.ERROR_MESSAGES.EXPORT_FAILED,
            'danger',
            {
                autoDismiss: true,
                dismissDelay: 5000
            }
        );
    }

    /**
     * Show success message for annotations saved
     */
    showAnnotationsSaved() {
        this.show(
            CONFIG.SUCCESS_MESSAGES.ANNOTATIONS_SAVED,
            'success',
            {
                autoDismiss: true,
                dismissDelay: 2000
            }
        );
    }

    /**
     * Show success message for export complete
     */
    showExportComplete() {
        this.show(
            CONFIG.SUCCESS_MESSAGES.EXPORT_COMPLETE,
            'success',
            {
                autoDismiss: true,
                dismissDelay: 3000
            }
        );
    }

    /**
     * Show custom error message
     */
    showError(message, persistent = false) {
        this.show(
            message,
            'danger',
            {
                persistent: persistent,
                autoDismiss: !persistent,
                dismissDelay: 5000
            }
        );
    }

    /**
     * Show custom warning message
     */
    showWarning(message, persistent = false) {
        this.show(
            message,
            'warning',
            {
                persistent: persistent,
                autoDismiss: !persistent,
                dismissDelay: 4000
            }
        );
    }

    /**
     * Show custom info message
     */
    showInfo(message, autoDismiss = true) {
        this.show(
            message,
            'info',
            {
                autoDismiss: autoDismiss,
                dismissDelay: 3000
            }
        );
    }

    /**
     * Show custom success message
     */
    showSuccess(message, autoDismiss = true) {
        this.show(
            message,
            'success',
            {
                autoDismiss: autoDismiss,
                dismissDelay: 2000
            }
        );
    }

    /**
     * Show mode transition messages
     */
    showModeTransition(fromMode, toMode, message = '') {
        const defaultMessage = `Switched from ${fromMode} mode to ${toMode} mode`;
        const displayMessage = message || defaultMessage;
        
        const type = toMode === 'live' ? 'success' : 'info';
        
        this.show(
            displayMessage,
            type,
            {
                autoDismiss: true,
                dismissDelay: 3000
            }
        );
    }

    /**
     * Show reconnection attempt message
     */
    showReconnectionAttempt() {
        this.show(
            'Attempting to reconnect to API...',
            'info',
            {
                autoDismiss: false,
                persistent: true
            }
        );
    }

    /**
     * Show sync progress message
     */
    showSyncProgress(message = 'Syncing data...') {
        this.show(
            message,
            'info',
            {
                autoDismiss: false,
                persistent: true
            }
        );
    }

    /**
     * Log message to console based on type
     */
    logMessage(message, type) {
        switch (type) {
            case 'danger':
                console.error(`Status Banner Error: ${message}`);
                break;
            case 'warning':
                console.warn(`Status Banner Warning: ${message}`);
                break;
            case 'success':
                console.log(`Status Banner Success: ${message}`);
                break;
            case 'info':
            default:
                console.info(`Status Banner Info: ${message}`);
                break;
        }
    }

    /**
     * Check if banner is currently visible
     */
    isShowing() {
        return this.isVisible;
    }

    /**
     * Get current message text
     */
    getCurrentMessage() {
        return this.messageElement ? this.messageElement.textContent : '';
    }

    /**
     * Update banner responsiveness for different screen sizes
     */
    updateResponsiveness() {
        if (!this.bannerElement) return;

        // Add responsive classes based on screen size
        const isSmallScreen = window.innerWidth < 768;
        
        if (isSmallScreen) {
            this.bannerElement.classList.add('banner-mobile');
        } else {
            this.bannerElement.classList.remove('banner-mobile');
        }
    }

    /**
     * Destroy the status banner and clean up
     */
    destroy() {
        if (this.currentTimeout) {
            clearTimeout(this.currentTimeout);
        }
        
        this.hide();
        
        // Remove event listeners would go here if we stored references
        // For now, the listeners will be cleaned up when the DOM elements are removed
        
        console.log('Status banner destroyed');
    }
}

// Export singleton instance
export const statusBanner = new StatusBanner();