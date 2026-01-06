/**
 * Loading Manager Module for IMA Annotate Frontend
 * Handles loading indicators, success feedback, and error placeholders
 */

import { CONFIG } from '../config.js';

/**
 * LoadingManager class manages loading states, success feedback, and error handling
 * Provides comprehensive visual feedback for async operations
 */
export class LoadingManager {
    constructor() {
        this.activeLoaders = new Map();
        this.loadingOverlays = new Map();
        this.successIndicators = [];
        this.init();
    }

    /**
     * Initialize the loading manager
     */
    init() {
        // Create success indicator container if it doesn't exist
        this.createSuccessContainer();
        
        console.log('Loading manager initialized');
    }

    /**
     * Create container for success indicators
     */
    createSuccessContainer() {
        if (!document.getElementById('success-container')) {
            const container = document.createElement('div');
            container.id = 'success-container';
            container.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 1050;
                pointer-events: none;
            `;
            document.body.appendChild(container);
        }
    }

    /**
     * Show loading indicator for a specific operation
     * @param {string} operationId - Unique identifier for the operation
     * @param {Object} options - Loading options
     */
    showLoading(operationId, options = {}) {
        const {
            message = 'Loading...',
            container = null,
            overlay = false,
            size = 'default', // 'sm', 'default', 'lg'
            position = 'center' // 'center', 'inline'
        } = options;

        // Remove existing loader for this operation
        this.hideLoading(operationId);

        let loaderElement;

        if (overlay && container) {
            // Create overlay loader
            loaderElement = this.createOverlayLoader(message, size);
            container.style.position = 'relative';
            container.appendChild(loaderElement);
            this.loadingOverlays.set(operationId, { element: loaderElement, container });
        } else if (container) {
            // Create inline loader
            loaderElement = this.createInlineLoader(message, size);
            container.appendChild(loaderElement);
        } else {
            // Use global loading indicator
            const globalLoader = document.getElementById('loading-indicator');
            if (globalLoader) {
                const messageElement = globalLoader.querySelector('.loading-text') || 
                                     globalLoader.querySelector('p');
                if (messageElement) {
                    messageElement.textContent = message;
                }
                globalLoader.classList.remove('d-none');
                loaderElement = globalLoader;
            }
        }

        if (loaderElement) {
            this.activeLoaders.set(operationId, {
                element: loaderElement,
                container,
                overlay,
                timestamp: Date.now()
            });

            console.log(`Loading indicator shown for operation: ${operationId}`);
        }

        return loaderElement;
    }

    /**
     * Hide loading indicator for a specific operation
     * @param {string} operationId - Unique identifier for the operation
     */
    hideLoading(operationId) {
        const loader = this.activeLoaders.get(operationId);
        const overlay = this.loadingOverlays.get(operationId);

        if (loader) {
            if (loader.element.id === 'loading-indicator') {
                // Global loader
                loader.element.classList.add('d-none');
            } else {
                // Custom loader
                loader.element.remove();
            }
            this.activeLoaders.delete(operationId);
        }

        if (overlay) {
            overlay.element.remove();
            this.loadingOverlays.delete(operationId);
        }

        console.log(`Loading indicator hidden for operation: ${operationId}`);
    }

    /**
     * Create overlay loader element
     */
    createOverlayLoader(message, size) {
        const overlay = document.createElement('div');
        overlay.className = 'loading-overlay';
        
        const content = document.createElement('div');
        content.style.textAlign = 'center';
        
        const spinner = document.createElement('div');
        spinner.className = `loading-spinner ${size}`;
        
        const text = document.createElement('div');
        text.className = 'loading-text';
        text.textContent = message;
        
        content.appendChild(spinner);
        content.appendChild(text);
        overlay.appendChild(content);
        
        return overlay;
    }

    /**
     * Create inline loader element
     */
    createInlineLoader(message, size) {
        const container = document.createElement('div');
        container.style.cssText = 'text-align: center; padding: 1rem;';
        
        const spinner = document.createElement('div');
        spinner.className = `loading-spinner ${size}`;
        spinner.style.margin = '0 auto';
        
        const text = document.createElement('div');
        text.className = 'loading-text';
        text.textContent = message;
        
        container.appendChild(spinner);
        container.appendChild(text);
        
        return container;
    }

    /**
     * Show success feedback
     * @param {string} message - Success message
     * @param {Object} options - Success options
     */
    showSuccess(message, options = {}) {
        const {
            duration = 3000,
            type = 'success', // 'success', 'info', 'warning', 'error'
            icon = null,
            persistent = false
        } = options;

        const indicator = this.createSuccessIndicator(message, type, icon);
        const container = document.getElementById('success-container');
        
        if (container) {
            container.appendChild(indicator);
            this.successIndicators.push(indicator);

            // Auto-remove if not persistent
            if (!persistent) {
                setTimeout(() => {
                    this.removeSuccessIndicator(indicator);
                }, duration);
            }

            // Add click to dismiss
            indicator.addEventListener('click', () => {
                this.removeSuccessIndicator(indicator);
            });

            console.log(`Success indicator shown: ${message}`);
        }

        return indicator;
    }

    /**
     * Create success indicator element
     */
    createSuccessIndicator(message, type, icon) {
        const indicator = document.createElement('div');
        indicator.className = `success-indicator ${type}`;
        indicator.style.pointerEvents = 'auto';
        indicator.style.cursor = 'pointer';
        indicator.style.marginBottom = '0.5rem';

        if (icon) {
            const iconElement = document.createElement('i');
            iconElement.className = icon;
            indicator.appendChild(iconElement);
        } else {
            // Default icons based on type
            const defaultIcons = {
                success: '✓',
                error: '✗',
                warning: '⚠',
                info: 'ℹ'
            };
            const iconText = document.createElement('span');
            iconText.textContent = defaultIcons[type] || '•';
            iconText.style.fontWeight = 'bold';
            indicator.appendChild(iconText);
        }

        const messageElement = document.createElement('span');
        messageElement.textContent = message;
        indicator.appendChild(messageElement);

        return indicator;
    }

    /**
     * Remove success indicator with animation
     */
    removeSuccessIndicator(indicator) {
        if (indicator && indicator.parentNode) {
            indicator.classList.add('fade-out');
            setTimeout(() => {
                if (indicator.parentNode) {
                    indicator.parentNode.removeChild(indicator);
                }
                const index = this.successIndicators.indexOf(indicator);
                if (index > -1) {
                    this.successIndicators.splice(index, 1);
                }
            }, 300);
        }
    }

    /**
     * Show image loading placeholder
     * @param {HTMLElement} container - Container element
     * @param {Object} options - Placeholder options
     */
    showImagePlaceholder(container, options = {}) {
        const {
            message = 'Loading image...',
            error = false,
            icon = null,
            subtext = null
        } = options;

        // Clear container
        container.innerHTML = '';

        const placeholder = document.createElement('div');
        placeholder.className = `image-placeholder ${error ? 'error' : ''}`;

        // Icon
        const iconElement = document.createElement('div');
        iconElement.className = 'image-placeholder-icon';
        if (icon) {
            iconElement.innerHTML = icon;
        } else if (error) {
            iconElement.innerHTML = '⚠';
        } else {
            iconElement.innerHTML = '🖼';
        }
        placeholder.appendChild(iconElement);

        // Main message
        const messageElement = document.createElement('div');
        messageElement.className = 'image-placeholder-text';
        messageElement.textContent = message;
        placeholder.appendChild(messageElement);

        // Subtext
        if (subtext) {
            const subtextElement = document.createElement('div');
            subtextElement.className = 'image-placeholder-subtext';
            subtextElement.textContent = subtext;
            placeholder.appendChild(subtextElement);
        }

        // Add loading spinner if not error
        if (!error) {
            const spinner = document.createElement('div');
            spinner.className = 'loading-spinner';
            spinner.style.margin = '1rem auto 0';
            placeholder.appendChild(spinner);
        }

        container.appendChild(placeholder);
        return placeholder;
    }

    /**
     * Show image error placeholder
     * @param {HTMLElement} container - Container element
     * @param {string} filename - Failed image filename
     * @param {string} error - Error message
     */
    showImageError(container, filename = '', error = '') {
        const message = filename ? `Failed to load: ${filename}` : 'Failed to load image';
        const subtext = error || 'The image could not be loaded. Please try again or skip to the next image.';

        return this.showImagePlaceholder(container, {
            message,
            subtext,
            error: true,
            icon: '❌'
        });
    }

    /**
     * Set button loading state
     * @param {HTMLElement} button - Button element
     * @param {boolean} loading - Loading state
     * @param {string} originalText - Original button text (optional)
     */
    setButtonLoading(button, loading, originalText = null) {
        if (!button) return;

        if (loading) {
            // Store original text if not provided
            if (!originalText) {
                originalText = button.textContent;
                button.dataset.originalText = originalText;
            }
            
            button.classList.add('loading');
            button.disabled = true;
        } else {
            button.classList.remove('loading');
            button.disabled = false;
            
            // Restore original text
            if (button.dataset.originalText) {
                button.textContent = button.dataset.originalText;
                delete button.dataset.originalText;
            } else if (originalText) {
                button.textContent = originalText;
            }
        }
    }

    /**
     * Show progress indicator
     * @param {HTMLElement} container - Container element
     * @param {number} progress - Progress percentage (0-100)
     * @param {Object} options - Progress options
     */
    showProgress(container, progress, options = {}) {
        const {
            message = 'Processing...',
            animated = true,
            striped = true
        } = options;

        let progressContainer = container.querySelector('.progress-container');
        
        if (!progressContainer) {
            progressContainer = document.createElement('div');
            progressContainer.className = 'progress-container';
            
            const messageElement = document.createElement('div');
            messageElement.className = 'progress-message';
            messageElement.textContent = message;
            progressContainer.appendChild(messageElement);
            
            const progressWrapper = document.createElement('div');
            progressWrapper.className = 'progress';
            progressWrapper.style.height = '0.5rem';
            
            const progressBar = document.createElement('div');
            progressBar.className = `progress-bar ${animated ? 'progress-bar-animated' : ''} ${striped ? 'progress-bar-striped' : ''}`;
            progressBar.setAttribute('role', 'progressbar');
            progressBar.style.backgroundColor = '#007bff';
            
            progressWrapper.appendChild(progressBar);
            progressContainer.appendChild(progressWrapper);
            container.appendChild(progressContainer);
        }

        // Update progress
        const progressBar = progressContainer.querySelector('.progress-bar');
        const messageElement = progressContainer.querySelector('.progress-message');
        
        if (progressBar) {
            progressBar.style.width = `${Math.max(0, Math.min(100, progress))}%`;
            progressBar.setAttribute('aria-valuenow', progress);
        }
        
        if (messageElement) {
            messageElement.textContent = message;
        }

        return progressContainer;
    }

    /**
     * Hide progress indicator
     * @param {HTMLElement} container - Container element
     */
    hideProgress(container) {
        const progressContainer = container.querySelector('.progress-container');
        if (progressContainer) {
            progressContainer.remove();
        }
    }

    /**
     * Clear all loading indicators
     */
    clearAllLoading() {
        // Clear active loaders
        for (const [operationId, loader] of this.activeLoaders) {
            this.hideLoading(operationId);
        }

        // Clear success indicators
        this.successIndicators.forEach(indicator => {
            this.removeSuccessIndicator(indicator);
        });

        console.log('All loading indicators cleared');
    }

    /**
     * Get active loading operations
     */
    getActiveOperations() {
        return Array.from(this.activeLoaders.keys());
    }

    /**
     * Check if any loading operations are active
     */
    hasActiveLoading() {
        return this.activeLoaders.size > 0;
    }

    /**
     * Show operation feedback (combines loading and success)
     * @param {string} operationId - Operation identifier
     * @param {Promise} operation - Promise to track
     * @param {Object} options - Feedback options
     */
    async trackOperation(operationId, operation, options = {}) {
        const {
            loadingMessage = 'Processing...',
            successMessage = 'Operation completed successfully',
            errorMessage = 'Operation failed',
            container = null,
            showSuccess = true,
            showError = true
        } = options;

        try {
            // Show loading
            this.showLoading(operationId, {
                message: loadingMessage,
                container,
                overlay: !!container
            });

            // Wait for operation
            const result = await operation;

            // Hide loading
            this.hideLoading(operationId);

            // Show success feedback
            if (showSuccess) {
                this.showSuccess(successMessage, { type: 'success' });
            }

            return result;

        } catch (error) {
            // Hide loading
            this.hideLoading(operationId);

            // Show error feedback
            if (showError) {
                const message = error.message || errorMessage;
                this.showSuccess(message, { type: 'error', duration: 5000 });
            }

            throw error;
        }
    }

    /**
     * Destroy the loading manager and clean up
     */
    destroy() {
        this.clearAllLoading();
        
        const container = document.getElementById('success-container');
        if (container) {
            container.remove();
        }
        
        console.log('Loading manager destroyed');
    }
}

// Export singleton instance
export const loadingManager = new LoadingManager();