/**
 * Main Application Controller for IMA Annotate Frontend
 * Initializes and coordinates all modules using ES6 module architecture
 */

import { CONFIG, validateConfig, isApiKeyConfigured } from '../config.js';
import { apiClient } from './api-client.js';
import { statusBanner } from './status-banner.js';
import { loadingManager } from './loading-manager.js';
import { errorLogger } from './error-logger.js';
import { imageManager } from './image-manager.js';
import { initializeCanvasRenderer } from './canvas-renderer.js';
import { annotationManager } from './annotation-manager.js';
import { initializeDrawingTools } from './drawing-tools.js';
import { roiManager } from './roi-manager.js';

/**
 * Main Application Class
 * Orchestrates the initialization and coordination of all modules
 */
class App {
    constructor() {
        this.initialized = false;
        this.modules = {};
        this.state = {
            currentImageIndex: 0,
            images: [],
            annotations: new Map(),
            selectedAnnotation: null,
            drawingMode: false,
            apiConnected: false,
            loading: false,
            roi: null
        };
    }

    /**
     * Initialize the application
     */
    async init() {
        try {
            console.log('Initializing IMA Annotate Frontend...');
            
            // Validate configuration
            const configValidation = validateConfig();
            if (!configValidation.isValid) {
                console.error('Configuration validation failed:', configValidation.errors);
                errorLogger.logError('Configuration validation failed', {
                    type: 'config_error',
                    errors: configValidation.errors
                });
                statusBanner.showError('Configuration errors detected. Check console for details.');
                return;
            }

            // Initialize DOM elements
            this.initializeDOMElements();
            
            // Set up event listeners
            this.setupEventListeners();
            
            // Initialize canvas
            this.initializeCanvas();
            
            // Show loading indicator
            loadingManager.showLoading('app-init', {
                message: 'Initializing application...',
                container: null
            });
            
            // Test API connectivity
            await this.initializeApiConnection();
            
            // Load initial data (will be implemented in future tasks)
            await this.loadInitialData();
            
            // Hide loading indicator
            loadingManager.hideLoading('app-init');
            
            this.initialized = true;
            console.log('Application initialized successfully');
            
        } catch (error) {
            console.error('Failed to initialize application:', error);
            errorLogger.logError('Application initialization failed', {
                type: 'initialization_error',
                configValidation: validateConfig()
            }, error);
            loadingManager.hideLoading('app-init');
            statusBanner.showError('Failed to initialize application. Check console for details.');
        }
    }

    /**
     * Initialize DOM element references
     */
    initializeDOMElements() {
        // Canvas elements
        this.canvas = document.getElementById('annotation-canvas');
        this.canvasContainer = document.querySelector('.canvas-container');
        
        // Navigation elements
        this.prevBtn = document.getElementById('prev-btn');
        this.nextBtn = document.getElementById('next-btn');
        this.imageCounter = document.getElementById('image-counter');
        
        // Tool buttons
        this.drawBtn = document.getElementById('draw-btn');
        this.selectBtn = document.getElementById('select-btn');
        this.roiBtn = document.getElementById('roi-btn');
        
        // Action buttons
        this.saveBtn = document.getElementById('save-btn');
        this.exportBtn = document.getElementById('export-btn');
        
        // Status elements
        this.statusBanner = document.getElementById('status-banner');
        this.statusMessage = document.getElementById('status-message');
        this.loadingIndicator = document.getElementById('loading-indicator');
        
        // Annotation summary elements
        this.suggestedCount = document.getElementById('suggested-count');
        this.verifiedCount = document.getElementById('verified-count');
        this.modifiedCount = document.getElementById('modified-count');
        this.rejectedCount = document.getElementById('rejected-count');
        
        // Class selector
        this.classSelector = document.getElementById('class-selector');
        
        // ROI controls
        this.roiToggle = document.getElementById('roi-toggle');
        this.clearRoiBtn = document.getElementById('clear-roi-btn');
        
        console.log('DOM elements initialized');
    }

    /**
     * Set up event listeners for UI interactions
     */
    setupEventListeners() {
        // Navigation events
        this.prevBtn?.addEventListener('click', () => this.previousImage());
        this.nextBtn?.addEventListener('click', () => this.nextImage());
        
        // Tool selection events
        this.drawBtn?.addEventListener('click', () => this.setDrawingMode(true));
        this.selectBtn?.addEventListener('click', () => this.setDrawingMode(false));
        this.roiBtn?.addEventListener('click', () => this.toggleROIMode());
        
        // Action events
        this.saveBtn?.addEventListener('click', () => this.saveAnnotations());
        this.exportBtn?.addEventListener('click', () => this.exportAnnotations());
        
        // Add manual save button if it exists
        const manualSaveBtn = document.getElementById('manual-save-btn');
        if (manualSaveBtn) {
            manualSaveBtn.addEventListener('click', () => this.manualSave());
        }
        
        // Add reconnect button if it exists
        const reconnectBtn = document.getElementById('reconnect-btn');
        if (reconnectBtn) {
            reconnectBtn.addEventListener('click', () => this.attemptReconnection());
        }
        
        // Add sync sample data button if it exists
        const syncBtn = document.getElementById('sync-sample-data-btn');
        if (syncBtn) {
            syncBtn.addEventListener('click', () => this.syncSampleDataToLive());
        }
        
        // ROI events
        this.roiToggle?.addEventListener('change', () => this.toggleROIFiltering());
        this.clearRoiBtn?.addEventListener('click', () => this.clearROI());
        
        // Class selector events
        this.classSelector?.addEventListener('change', () => this.onClassSelectorChange());
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (event) => this.handleKeyboardShortcuts(event));
        
        // Window resize events
        window.addEventListener('resize', () => this.handleWindowResize());
        
        console.log('Event listeners set up');
    }

    /**
     * Initialize canvas with proper sizing
     */
    initializeCanvas() {
        if (!this.canvas) {
            console.error('Canvas element not found');
            return;
        }

        // Initialize canvas renderer
        this.canvasRenderer = initializeCanvasRenderer();
        
        if (!this.canvasRenderer) {
            console.error('Failed to initialize canvas renderer');
            return;
        }
        
        // Set ROI manager reference in canvas renderer
        this.canvasRenderer.setROIManager(roiManager);
        
        // Initialize drawing tools
        this.drawingTools = initializeDrawingTools(this.canvas, this.canvasRenderer);
        
        if (!this.drawingTools) {
            console.error('Failed to initialize drawing tools');
            return;
        }
        
        // Set up image manager callbacks
        imageManager.setOnImageLoaded((image) => this.onImageLoaded(image));
        imageManager.setOnImageLoadError((error, imageData) => this.onImageLoadError(error, imageData));
        imageManager.setOnNavigationChange((navInfo) => this.onNavigationChange(navInfo));
        
        // Set up annotation manager callbacks
        annotationManager.setOnAnnotationsChanged((annotations) => this.onAnnotationsChanged(annotations));
        annotationManager.setOnAnnotationSelected((annotation) => this.onAnnotationSelected(annotation));
        annotationManager.setOnAnnotationStateChanged((annotation) => this.onAnnotationStateChanged(annotation));
        annotationManager.setOnSaveComplete((result) => this.onSaveComplete(result));
        annotationManager.setOnSaveError((result) => this.onSaveError(result));
        
        // Set up ROI manager callbacks
        roiManager.setOnROIChanged((roi) => this.onROIChanged(roi));
        roiManager.setOnROIFilteringChanged((active) => this.onROIFilteringChanged(active));
        
        console.log('Canvas initialized with CanvasRenderer and DrawingTools');
    }

    /**
     * Resize canvas to fit container while maintaining aspect ratio
     */
    resizeCanvas() {
        if (this.canvasRenderer) {
            this.canvasRenderer.resizeCanvas();
        }
    }

    /**
     * Load initial data (placeholder for future implementation)
     */
    async loadInitialData() {
        console.log('Loading initial data...');
        
        try {
            // Load images using image manager
            const result = await imageManager.loadImages();
            
            if (result.success) {
                console.log(`Loaded ${result.total} images in ${result.mode || 'live'} mode`);
                
                // Update UI with loaded data
                this.updateImageCounter(
                    result.total > 0 ? 1 : 0, 
                    result.total
                );
                this.updateNavigationButtons();
                this.updateAnnotationCounts();
                
                // Show sample mode notification if applicable
                if (result.mode === 'sample') {
                    statusBanner.showSampleModeNotification();
                }
                
            } else {
                console.error('Failed to load images:', result.error);
                statusBanner.showError('Failed to load images. Check console for details.');
                
                // Update UI to show no images
                this.updateImageCounter(0, 0);
                this.updateNavigationButtons();
            }
            
        } catch (error) {
            console.error('Error loading initial data:', error);
            statusBanner.showError('Error loading initial data. Check console for details.');
            
            // Update UI to show no images
            this.updateImageCounter(0, 0);
            this.updateNavigationButtons();
        }
        
        console.log('Initial data loading completed');
    }

    /**
     * Initialize API connection and test connectivity
     */
    async initializeApiConnection() {
        console.log('Testing API connectivity...');
        
        try {
            // Check if API key is configured
            if (!isApiKeyConfigured()) {
                console.warn('API key not configured');
                statusBanner.showWarning(CONFIG.ERROR_MESSAGES.INVALID_API_KEY);
                this.state.apiConnected = false;
                this.updateModeIndicators('sample', 'API key not configured');
                return;
            }

            // Test API connection (will fail with dummy endpoints)
            const result = await apiClient.testConnection();
            
            if (result.success) {
                console.log('API connection successful');
                this.state.apiConnected = true;
                statusBanner.hide();
                this.updateModeIndicators('live', 'Connected to API');
            } else {
                console.warn('API connection failed - falling back to sample mode');
                this.state.apiConnected = false;
                statusBanner.showSampleModeNotification();
                this.updateModeIndicators('sample', result.message);
            }
            
        } catch (error) {
            console.error('API connection test failed:', error);
            this.state.apiConnected = false;
            statusBanner.showWarning(CONFIG.ERROR_MESSAGES.API_UNREACHABLE);
            this.updateModeIndicators('sample', 'Connection failed');
        }
    }

    /**
     * Update UI indicators for current mode
     */
    updateModeIndicators(mode, message = '') {
        // Update mode indicator in UI if it exists
        const modeIndicator = document.getElementById('mode-indicator');
        if (modeIndicator) {
            modeIndicator.textContent = mode === 'sample' ? 'Sample Mode' : 'Live Mode';
            modeIndicator.className = `badge ${mode === 'sample' ? 'bg-warning' : 'bg-success'}`;
            modeIndicator.title = message;
        }

        // Update connection status indicator
        const connectionStatus = document.getElementById('connection-status');
        if (connectionStatus) {
            connectionStatus.textContent = mode === 'sample' ? 'Offline' : 'Online';
            connectionStatus.className = `badge ${mode === 'sample' ? 'bg-secondary' : 'bg-primary'}`;
        }

        // Update any mode-specific UI elements
        this.updateModeSpecificUI(mode);
        
        console.log(`Mode indicators updated: ${mode} - ${message}`);
    }

    /**
     * Update UI elements that are specific to the current mode
     */
    updateModeSpecificUI(mode) {
        // Show/hide mode-specific buttons or features
        const reconnectBtn = document.getElementById('reconnect-btn');
        if (reconnectBtn) {
            reconnectBtn.style.display = mode === 'sample' ? 'inline-block' : 'none';
        }

        const syncBtn = document.getElementById('sync-sample-data-btn');
        if (syncBtn) {
            syncBtn.style.display = mode === 'sample' ? 'inline-block' : 'none';
        }

        // Update export options based on mode
        const exportOptions = document.querySelectorAll('.export-option');
        exportOptions.forEach(option => {
            if (option.dataset.requiresApi === 'true') {
                option.disabled = mode === 'sample';
                option.title = mode === 'sample' ? 'Not available in sample mode' : '';
            }
        });
    }

    /**
     * Attempt to reconnect to API and transition modes
     */
    async attemptReconnection() {
        console.log('Attempting to reconnect to API...');
        
        try {
            const result = await loadingManager.trackOperation(
                'reconnect-api',
                apiClient.reconnect(),
                {
                    loadingMessage: 'Attempting to reconnect to API...',
                    successMessage: 'Successfully reconnected to API',
                    errorMessage: 'Reconnection failed',
                    showSuccess: false // We'll handle success message manually
                }
            );
            
            if (result.success && result.transitioned) {
                // Successfully transitioned from sample to live mode
                loadingManager.showSuccess(result.message, { type: 'success' });
                this.state.apiConnected = true;
                this.updateModeIndicators('live', 'Reconnected successfully');
                
                // Optionally offer to sync sample data
                if (result.previousMode === 'sample') {
                    this.offerSampleDataSync();
                }
                
                // Reload current image data from API
                await this.reloadCurrentImageData();
                
            } else if (result.success) {
                // Was already connected
                loadingManager.showSuccess(result.message, { type: 'info' });
                this.updateModeIndicators('live', 'Already connected');
            } else {
                // Failed to reconnect
                this.state.apiConnected = false;
                this.updateModeIndicators('sample', 'Reconnection failed');
            }
            
        } catch (error) {
            console.error('Reconnection attempt failed:', error);
            errorLogger.logError('API reconnection failed', {
                type: 'api_error',
                operation: 'reconnect'
            }, error);
            this.state.apiConnected = false;
            this.updateModeIndicators('sample', 'Reconnection error');
        }
    }

    /**
     * Offer to sync sample data to live mode
     */
    offerSampleDataSync() {
        const modalHtml = `
            <div class="modal fade" id="syncModal" tabindex="-1" aria-labelledby="syncModalLabel" aria-hidden="true">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="syncModalLabel">Sync Sample Data</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <p>You've successfully connected to the API. Would you like to sync your sample mode annotations to the live system?</p>
                            <div class="alert alert-info">
                                <small>Only modified and user-created annotations will be synced. Original suggested annotations will remain in sample mode only.</small>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Skip</button>
                            <button type="button" class="btn btn-primary" id="confirmSync">Sync Data</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Remove existing modal if present
        const existingModal = document.getElementById('syncModal');
        if (existingModal) {
            existingModal.remove();
        }

        // Add modal to DOM
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('syncModal'));
        modal.show();

        // Handle sync confirmation
        document.getElementById('confirmSync').addEventListener('click', () => {
            modal.hide();
            this.syncSampleDataToLive();
        });
    }

    /**
     * Sync sample data to live mode
     */
    async syncSampleDataToLive() {
        try {
            const result = await loadingManager.trackOperation(
                'sync-sample-data',
                apiClient.syncSampleDataToLive(),
                {
                    loadingMessage: 'Syncing sample data to live mode...',
                    successMessage: 'Sample data synced successfully',
                    errorMessage: 'Failed to sync sample data'
                }
            );
            
            if (result.success) {
                console.log(`Sync completed: ${result.syncedCount} annotations synced`);
                
                // Reload current image data to show synced annotations
                await this.reloadCurrentImageData();
            } else {
                console.error('Sync failed:', result.errors);
            }
            
        } catch (error) {
            console.error('Error syncing sample data:', error);
            errorLogger.logError('Sample data sync failed', {
                type: 'sync_error',
                operation: 'sync_sample_data'
            }, error);
        }
    }

    /**
     * Reload current image data (useful after mode transitions)
     */
    async reloadCurrentImageData() {
        try {
            const currentImage = imageManager.getCurrentImage();
            if (currentImage) {
                console.log('Reloading current image data after mode transition');
                await this.loadAnnotationsForCurrentImage(currentImage.data.id);
            }
        } catch (error) {
            console.error('Failed to reload current image data:', error);
        }
    }

    /**
     * Navigation methods - now implemented with ImageManager
     */
    async previousImage() {
        if (imageManager.isLoadingImage()) {
            console.log('Image loading in progress, ignoring navigation request');
            return;
        }

        console.log('Previous image requested');
        
        try {
            const result = await loadingManager.trackOperation(
                'navigate-previous',
                imageManager.previousImage(),
                {
                    loadingMessage: 'Loading previous image...',
                    successMessage: 'Previous image loaded',
                    errorMessage: 'Failed to load previous image',
                    showSuccess: false // Don't show success toast for navigation
                }
            );
            
            if (result) {
                console.log('Successfully navigated to previous image');
            } else {
                console.log('Already at first image or no images available');
            }
            
        } catch (error) {
            console.error('Failed to navigate to previous image:', error);
            errorLogger.logError('Navigation to previous image failed', {
                type: 'navigation_error',
                direction: 'previous',
                currentIndex: imageManager.getCurrentImageIndex()
            }, error);
            statusBanner.showError('Failed to load previous image');
        }
    }

    async nextImage() {
        if (imageManager.isLoadingImage()) {
            console.log('Image loading in progress, ignoring navigation request');
            return;
        }

        console.log('Next image requested');
        
        try {
            const result = await loadingManager.trackOperation(
                'navigate-next',
                imageManager.nextImage(),
                {
                    loadingMessage: 'Loading next image...',
                    successMessage: 'Next image loaded',
                    errorMessage: 'Failed to load next image',
                    showSuccess: false // Don't show success toast for navigation
                }
            );
            
            if (result) {
                console.log('Successfully navigated to next image');
            } else {
                console.log('Already at last image or no images available');
            }
            
        } catch (error) {
            console.error('Failed to navigate to next image:', error);
            errorLogger.logError('Navigation to next image failed', {
                type: 'navigation_error',
                direction: 'next',
                currentIndex: imageManager.getCurrentImageIndex()
            }, error);
            statusBanner.showError('Failed to load next image');
        }
    }

    /**
     * Navigate to a specific image by index
     */
    async goToImage(index) {
        if (imageManager.isLoadingImage()) {
            console.log('Image loading in progress, ignoring navigation request');
            return;
        }

        console.log(`Navigate to image index ${index} requested`);
        
        try {
            const result = await loadingManager.trackOperation(
                'navigate-to-image',
                imageManager.goToImage(index),
                {
                    loadingMessage: `Loading image ${index + 1}...`,
                    successMessage: `Image ${index + 1} loaded`,
                    errorMessage: `Failed to load image ${index + 1}`,
                    showSuccess: false
                }
            );
            
            if (result) {
                console.log(`Successfully navigated to image index ${index}`);
            } else {
                console.log(`Failed to navigate to image index ${index}`);
            }
            
        } catch (error) {
            console.error(`Failed to navigate to image index ${index}:`, error);
            errorLogger.logError('Navigation to specific image failed', {
                type: 'navigation_error',
                direction: 'goto',
                targetIndex: index,
                currentIndex: imageManager.getCurrentImageIndex()
            }, error);
            statusBanner.showError(`Failed to load image ${index + 1}`);
        }
    }

    /**
     * Image Manager Callback Methods
     */
    onImageLoaded(image) {
        console.log(`Image loaded: ${image.data.filename}`);
        
        // Use canvas renderer to draw the image
        const success = this.canvasRenderer.drawImage(image.element);
        
        if (success) {
            console.log('Image rendered successfully');
            
            // Load annotations for this image
            this.loadAnnotationsForCurrentImage(image.data.id);
        } else {
            console.warn('Failed to render image');
        }
        
        // Update UI state
        this.state.currentImageIndex = imageManager.getCurrentImageIndex();
    }

    /**
     * Load annotations for the current image
     */
    async loadAnnotationsForCurrentImage(imageId) {
        try {
            console.log(`Loading annotations for image: ${imageId}`);
            
            const result = await annotationManager.loadAnnotations(imageId);
            
            if (result.success) {
                console.log(`Loaded ${result.annotations.length} annotations`);
                
                // Set annotations in canvas renderer
                this.canvasRenderer.setAnnotations(result.annotations);
                
                // Update annotation counts
                this.updateAnnotationCounts();
                
                // Show sample mode notification if applicable
                if (result.mode === 'sample') {
                    console.log('Annotations loaded in sample mode');
                }
                
            } else {
                console.error('Failed to load annotations:', result.error);
                
                // Clear annotations and show empty state
                this.canvasRenderer.setAnnotations([]);
                this.updateAnnotationCounts();
            }
            
        } catch (error) {
            console.error('Error loading annotations:', error);
            
            // Clear annotations and show empty state
            this.canvasRenderer.setAnnotations([]);
            this.updateAnnotationCounts();
        }
    }

    onImageLoadError(error, imageData) {
        console.error(`Failed to load image: ${imageData?.filename || 'unknown'}`, error);
        
        // Log the error with detailed context
        errorLogger.logImageError(
            imageData?.filename || 'unknown',
            error,
            imageData
        );
        
        // Show image error placeholder in canvas container
        const canvasContainer = document.querySelector('.canvas-container');
        if (canvasContainer) {
            loadingManager.showImageError(
                canvasContainer, 
                imageData?.filename, 
                error.message || 'Image could not be loaded'
            );
        }
        
        // Show status banner
        statusBanner.showImageLoadError(imageData?.filename);
        
        // Try to skip to next image if available
        if (imageManager.canNavigateNext()) {
            console.log('Attempting to skip to next image after load error');
            setTimeout(() => this.nextImage(), 2000); // Wait 2 seconds before auto-skip
        }
    }

    onNavigationChange(navInfo) {
        console.log(`Navigation changed: ${navInfo.currentIndex + 1}/${navInfo.totalImages}`);
        
        // Update UI elements
        this.updateImageCounter(
            navInfo.currentIndex + 1, 
            navInfo.totalImages
        );
        this.updateNavigationButtons(navInfo);
        
        // Update application state
        this.state.currentImageIndex = navInfo.currentIndex;
    }

    setDrawingMode(enabled) {
        this.state.drawingMode = enabled;
        
        // Update drawing tools
        if (this.drawingTools) {
            if (enabled) {
                this.drawingTools.enableDrawMode();
            } else {
                this.drawingTools.disableDrawMode();
            }
        }
        
        // Update button states
        if (enabled) {
            this.drawBtn?.classList.add('active');
            this.selectBtn?.classList.remove('active');
            this.roiBtn?.classList.remove('active');
        } else {
            this.drawBtn?.classList.remove('active');
            this.selectBtn?.classList.add('active');
            this.roiBtn?.classList.remove('active');
        }
        
        console.log(`Drawing mode ${enabled ? 'enabled' : 'disabled'}`);
    }

    /**
     * Handle class selector change
     */
    onClassSelectorChange() {
        if (!this.classSelector) return;
        
        const selectedClass = this.classSelector.value;
        
        // If there's a selected annotation, update its class
        const selectedAnnotation = annotationManager.getSelectedAnnotation();
        if (selectedAnnotation) {
            const success = annotationManager.updateAnnotation(selectedAnnotation.id, {
                className: selectedClass
            });
            
            if (success) {
                console.log(`Updated annotation ${selectedAnnotation.id} class to ${selectedClass}`);
            } else {
                console.error(`Failed to update annotation ${selectedAnnotation.id} class`);
                // Revert selector to original value
                this.classSelector.value = selectedAnnotation.className;
            }
        }
    }

    /**
     * Update class selector to match selected annotation
     */
    updateClassSelector(annotation) {
        if (this.classSelector && annotation) {
            this.classSelector.value = annotation.className;
        }
    }
    toggleROIMode() {
        if (this.drawingTools) {
            if (this.drawingTools.roiMode) {
                this.drawingTools.disableROIMode();
                this.roiBtn?.classList.remove('active');
            } else {
                // Disable other modes first
                this.setDrawingMode(false);
                this.drawingTools.enableROIMode();
                this.roiBtn?.classList.add('active');
            }
        }
        console.log('ROI mode toggled');
    }

    toggleROIFiltering() {
        const isEnabled = this.roiToggle?.checked || false;
        roiManager.setROIFiltering(isEnabled);
        console.log(`ROI filtering ${isEnabled ? 'enabled' : 'disabled'}`);
    }

    clearROI() {
        if (this.drawingTools) {
            const success = this.drawingTools.clearROI();
            if (success) {
                // Update UI state
                this.roiToggle.checked = false;
                roiManager.setROIFiltering(false);
            }
        }
        console.log('Clear ROI requested');
    }

    /**
     * Save and export methods - now implemented with AnnotationManager
     */
    async saveAnnotations() {
        console.log('Save annotations requested');
        
        try {
            const result = await loadingManager.trackOperation(
                'save-annotations',
                annotationManager.saveAnnotations(),
                {
                    loadingMessage: 'Saving annotations...',
                    successMessage: 'Annotations saved successfully',
                    errorMessage: 'Failed to save annotations'
                }
            );
            
            if (result.success) {
                console.log(`Successfully saved ${result.savedCount} annotations`);
            } else {
                console.error('Failed to save annotations:', result.errors);
            }
            
        } catch (error) {
            console.error('Error saving annotations:', error);
            errorLogger.logError('Annotation save operation failed', {
                type: 'save_error',
                operation: 'save_annotations'
            }, error);
        }
    }

    exportAnnotations() {
        console.log('Export annotations requested');
        
        // Show export options modal or use default format
        this.showExportDialog();
    }

    /**
     * Show export dialog with format options
     */
    showExportDialog() {
        // Create a simple modal for export options
        const modalHtml = `
            <div class="modal fade" id="exportModal" tabindex="-1" aria-labelledby="exportModalLabel" aria-hidden="true">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="exportModalLabel">Export Annotations</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <div class="mb-3">
                                <label for="exportFormat" class="form-label">Export Format</label>
                                <select class="form-select" id="exportFormat">
                                    <option value="json">JSON (Full Data)</option>
                                    <option value="yolo">YOLO Format</option>
                                    <option value="pascal_voc">Pascal VOC XML</option>
                                    <option value="coco">COCO JSON</option>
                                </select>
                            </div>
                            <div class="mb-3">
                                <label for="exportScope" class="form-label">Export Scope</label>
                                <select class="form-select" id="exportScope">
                                    <option value="current">Current Image Only</option>
                                    <option value="all">All Images</option>
                                </select>
                            </div>
                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" id="includeHistory">
                                <label class="form-check-label" for="includeHistory">
                                    Include annotation history
                                </label>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                            <button type="button" class="btn btn-primary" id="confirmExport">Export</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Remove existing modal if present
        const existingModal = document.getElementById('exportModal');
        if (existingModal) {
            existingModal.remove();
        }

        // Add modal to DOM
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('exportModal'));
        modal.show();

        // Handle export confirmation
        document.getElementById('confirmExport').addEventListener('click', () => {
            const format = document.getElementById('exportFormat').value;
            const scope = document.getElementById('exportScope').value;
            const includeHistory = document.getElementById('includeHistory').checked;
            
            modal.hide();
            this.performExport(format, scope, includeHistory);
        });
    }

    /**
     * Perform the actual export
     */
    async performExport(format, scope, includeHistory) {
        try {
            const result = await loadingManager.trackOperation(
                'export-annotations',
                this.doExport(format, scope, includeHistory),
                {
                    loadingMessage: 'Exporting annotations...',
                    successMessage: 'Export completed successfully',
                    errorMessage: 'Export failed'
                }
            );
            
            if (result.success) {
                // Create and download file
                let dataToDownload = result.data;
                
                // For text formats, convert to string
                if (typeof dataToDownload === 'object' && result.mimeType !== 'application/json') {
                    if (result.mimeType === 'application/xml') {
                        dataToDownload = result.data;
                    } else {
                        dataToDownload = JSON.stringify(result.data, null, 2);
                    }
                } else if (typeof dataToDownload === 'object') {
                    dataToDownload = JSON.stringify(result.data, null, 2);
                }
                
                // Include history if requested
                if (includeHistory && format === 'json') {
                    const historyResult = annotationManager.exportHistory('json');
                    if (historyResult.success) {
                        const combinedData = {
                            annotations: JSON.parse(dataToDownload),
                            history: JSON.parse(historyResult.data)
                        };
                        dataToDownload = JSON.stringify(combinedData, null, 2);
                    }
                }
                
                const dataBlob = new Blob([dataToDownload], { type: result.mimeType });
                
                const link = document.createElement('a');
                link.href = URL.createObjectURL(dataBlob);
                link.download = result.filename;
                link.click();
                
                // Clean up
                URL.revokeObjectURL(link.href);
                
                const message = scope === 'all' 
                    ? `Exported ${result.imageCount || 1} images with ${result.annotationCount} annotations`
                    : `Exported ${result.annotationCount} annotations`;
                    
                loadingManager.showSuccess(message, { type: 'success' });
                console.log(`Export completed: ${result.filename}`);
            } else {
                console.error('Failed to export annotations:', result.error);
            }
            
        } catch (error) {
            console.error('Error exporting annotations:', error);
            errorLogger.logError('Annotation export operation failed', {
                type: 'export_error',
                format,
                scope,
                includeHistory
            }, error);
        }
    }

    /**
     * Perform the actual export operation
     */
    async doExport(format, scope, includeHistory) {
        let result;
        
        if (scope === 'all') {
            result = annotationManager.exportAllAnnotations(format);
        } else {
            // Get current image metadata for proper export
            const currentImage = imageManager.getCurrentImage();
            const imageMetadata = currentImage ? {
                id: currentImage.data.id,
                filename: currentImage.data.filename,
                width: currentImage.element.naturalWidth,
                height: currentImage.element.naturalHeight
            } : null;
            
            result = annotationManager.exportAnnotations(format, null, imageMetadata);
        }
        
        return result;
    }

    /**
     * Manual save functionality
     */
    async manualSave() {
        console.log('Manual save requested');
        
        try {
            const result = await loadingManager.trackOperation(
                'manual-save',
                annotationManager.manualSave(),
                {
                    loadingMessage: 'Performing manual save...',
                    successMessage: 'Manual save completed',
                    errorMessage: 'Manual save failed'
                }
            );
            
            if (result.success) {
                console.log('Manual save completed:', result);
            } else {
                console.error('Manual save failed:', result.error);
            }
            
        } catch (error) {
            console.error('Error during manual save:', error);
            errorLogger.logError('Manual save operation failed', {
                type: 'save_error',
                operation: 'manual_save'
            }, error);
        }
    }

    /**
     * Handle keyboard shortcuts with enhanced navigation support
     */
    handleKeyboardShortcuts(event) {
        // Prevent shortcuts when typing in input fields
        if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA' || event.target.tagName === 'SELECT') {
            return;
        }

        // Prevent shortcuts when loading
        if (imageManager.isLoadingImage()) {
            return;
        }

        switch (event.code) {
            case CONFIG.KEYBOARD_SHORTCUTS.NEXT_IMAGE:
                event.preventDefault();
                this.nextImage();
                break;
                
            case CONFIG.KEYBOARD_SHORTCUTS.PREV_IMAGE:
                event.preventDefault();
                this.previousImage();
                break;
                
            case CONFIG.KEYBOARD_SHORTCUTS.SAVE:
                if (event.ctrlKey || event.metaKey) {
                    event.preventDefault();
                    if (event.shiftKey) {
                        // Ctrl+Shift+S for manual save
                        this.manualSave();
                    } else {
                        // Ctrl+S for regular save
                        this.saveAnnotations();
                    }
                }
                break;
                
            case CONFIG.KEYBOARD_SHORTCUTS.DRAW_MODE:
                event.preventDefault();
                this.setDrawingMode(true);
                break;
                
            case CONFIG.KEYBOARD_SHORTCUTS.SELECT_MODE:
                event.preventDefault();
                this.setDrawingMode(false);
                break;
                
            case CONFIG.KEYBOARD_SHORTCUTS.ESCAPE:
                event.preventDefault();
                this.setDrawingMode(false);
                // Also hide any status banners
                statusBanner.hide();
                break;
                
            // Additional navigation shortcuts
            case 'Home':
                event.preventDefault();
                this.goToImage(0);
                break;
                
            case 'End':
                event.preventDefault();
                const lastIndex = imageManager.getImageCount() - 1;
                if (lastIndex >= 0) {
                    this.goToImage(lastIndex);
                }
                break;
                
            // Number keys for quick navigation (1-9)
            case 'Digit1':
            case 'Digit2':
            case 'Digit3':
            case 'Digit4':
            case 'Digit5':
            case 'Digit6':
            case 'Digit7':
            case 'Digit8':
            case 'Digit9':
                if (event.ctrlKey || event.metaKey) {
                    event.preventDefault();
                    const digit = parseInt(event.code.replace('Digit', ''));
                    const targetIndex = digit - 1;
                    if (targetIndex < imageManager.getImageCount()) {
                        this.goToImage(targetIndex);
                    }
                }
                break;
        }
    }

    /**
     * Handle canvas click events for annotation selection
     */
    handleCanvasClick(event) {
        // Drawing tools now handle all canvas interactions
        // This method is kept for compatibility but drawing tools handle the actual logic
        console.log('Canvas click handled by drawing tools');
    }

    /**
     * Handle window resize events
     */
    handleWindowResize() {
        // Debounce resize events
        clearTimeout(this.resizeTimeout);
        this.resizeTimeout = setTimeout(() => {
            if (this.canvasRenderer) {
                this.canvasRenderer.resizeCanvas();
            }
        }, 250);
    }

    /**
     * UI Update Methods
     */
    updateImageCounter(current, total) {
        if (this.imageCounter) {
            this.imageCounter.textContent = `${current} / ${total}`;
        }
    }

    updateNavigationButtons(navInfo = null) {
        // Use provided navigation info or get from image manager
        const canPrev = navInfo ? navInfo.canNavigatePrevious : imageManager.canNavigatePrevious();
        const canNext = navInfo ? navInfo.canNavigateNext : imageManager.canNavigateNext();
        
        if (this.prevBtn) {
            this.prevBtn.disabled = !canPrev;
            this.prevBtn.classList.toggle('disabled', !canPrev);
        }
        if (this.nextBtn) {
            this.nextBtn.disabled = !canNext;
            this.nextBtn.classList.toggle('disabled', !canNext);
        }
        
        console.log(`Navigation buttons updated: prev=${canPrev}, next=${canNext}`);
    }

    updateAnnotationCounts() {
        // Get counts from annotation manager
        const counts = annotationManager.getAnnotationCounts();

        // Update count displays
        if (this.suggestedCount) this.suggestedCount.textContent = counts.Suggested;
        if (this.verifiedCount) this.verifiedCount.textContent = counts.Verified;
        if (this.modifiedCount) this.modifiedCount.textContent = counts.Modified;
        if (this.rejectedCount) this.rejectedCount.textContent = counts.Rejected;
        
        console.log('Annotation counts updated:', counts);
    }

    /**
     * Annotation Manager Callback Methods
     */
    onAnnotationsChanged(annotations) {
        console.log(`Annotations changed: ${annotations.length} annotations`);
        
        // Update canvas renderer with new annotations
        if (this.canvasRenderer) {
            this.canvasRenderer.setAnnotations(annotations);
        }
        
        // Update annotation counts
        this.updateAnnotationCounts();
    }

    onAnnotationSelected(annotation) {
        console.log(`Annotation selected: ${annotation.id} (${annotation.className})`);
        
        // Highlight annotation in canvas renderer
        if (this.canvasRenderer) {
            this.canvasRenderer.highlightAnnotation(annotation.id);
        }
        
        // Update class selector to match selected annotation
        this.updateClassSelector(annotation);
        
        // Update UI to show selected annotation details
        // This could be expanded to show annotation properties in a sidebar
    }

    onAnnotationStateChanged(annotation) {
        console.log(`Annotation state changed: ${annotation.id} -> ${annotation.state}`);
        
        // Update annotation counts to reflect state change
        this.updateAnnotationCounts();
        
        // Trigger canvas redraw to show state color changes
        if (this.canvasRenderer) {
            this.canvasRenderer.redraw();
        }
    }

    onSaveComplete(result) {
        console.log(`Save completed: ${result.savedCount} annotations saved`);
        loadingManager.showSuccess(result.message, { type: 'success' });
    }

    onSaveError(result) {
        console.error(`Save failed: ${result.errorCount} errors`, result.errors);
        loadingManager.showSuccess(result.message, { type: 'error', duration: 5000 });
    }

    /**
     * ROI Manager Callback Methods
     */
    onROIChanged(roi) {
        console.log('ROI changed:', roi ? `${roi.polygon.length} points` : 'cleared');
        
        // Update canvas renderer with new ROI
        if (this.canvasRenderer) {
            this.canvasRenderer.setROI(roi);
        }
        
        // Update UI state
        if (roi) {
            // Enable ROI toggle if ROI is created
            if (this.roiToggle) {
                this.roiToggle.disabled = false;
            }
        } else {
            // Disable ROI toggle if no ROI
            if (this.roiToggle) {
                this.roiToggle.checked = false;
                this.roiToggle.disabled = true;
            }
            roiManager.setROIFiltering(false);
        }
    }

    onROIFilteringChanged(active) {
        console.log(`ROI filtering ${active ? 'activated' : 'deactivated'}`);
        
        // Update annotation display based on ROI filtering
        if (this.canvasRenderer) {
            // Trigger redraw to apply ROI filtering visual effects
            this.canvasRenderer.redraw();
        }
        
        // Update annotation counts if filtering affects visibility
        this.updateAnnotationCounts();
    }

    /**
     * Status and Loading Methods (Legacy - now using LoadingManager)
     */
    showStatusBanner(message, type = 'warning') {
        statusBanner.show(message, type);
        console.log(`Status: ${type} - ${message}`);
    }

    hideStatusBanner() {
        statusBanner.hide();
    }

    showLoadingIndicator() {
        // Legacy method - now using LoadingManager
        loadingManager.showLoading('legacy', { message: 'Loading...' });
    }

    hideLoadingIndicator() {
        // Legacy method - now using LoadingManager
        loadingManager.hideLoading('legacy');
    }
}

/**
 * Initialize application when DOM is loaded
 */
document.addEventListener('DOMContentLoaded', async () => {
    const app = new App();
    await app.init();
    
    // Make app instance globally available for debugging
    window.imaApp = app;
    
    // Make error logger globally available for debugging
    window.imaErrorLogger = errorLogger;
    
    // Add debug utilities to window
    window.imaDebug = {
        // Get error statistics
        getErrorStats: () => errorLogger.getErrorStats(),
        
        // Get error history
        getErrors: (level = null, limit = 10) => errorLogger.getErrorHistory(level, limit),
        
        // Export error logs
        exportLogs: (format = 'json') => {
            const logs = errorLogger.exportLogs(format);
            console.log('Error logs exported:', logs);
            return logs;
        },
        
        // Clear error history
        clearErrors: () => errorLogger.clearHistory(),
        
        // Enable/disable debug mode
        setDebugMode: (enabled) => {
            localStorage.setItem('ima-debug', enabled ? 'true' : 'false');
            console.log(`Debug mode ${enabled ? 'enabled' : 'disabled'}. Reload page to take effect.`);
        },
        
        // Get current debug status
        isDebugEnabled: () => errorLogger.isDebugEnabled(),
        
        // Log test error for debugging
        testError: (message = 'Test error') => {
            errorLogger.logError(message, { type: 'test_error', source: 'debug_console' });
        },
        
        // Get application state
        getAppState: () => {
            if (window.imaApp) {
                return {
                    initialized: window.imaApp.initialized,
                    state: window.imaApp.state,
                    modules: Object.keys(window.imaApp.modules || {})
                };
            }
            return null;
        },
        
        // Show help
        help: () => {
            console.log(`
IMA Annotate Frontend Debug Console
===================================

Available commands:
- imaDebug.getErrorStats()          Get error statistics
- imaDebug.getErrors(level, limit)  Get error history (level: 'ERROR', 'WARNING', 'INFO', 'DEBUG')
- imaDebug.exportLogs(format)       Export logs ('json' or 'csv')
- imaDebug.clearErrors()            Clear error history
- imaDebug.setDebugMode(enabled)    Enable/disable debug logging
- imaDebug.isDebugEnabled()         Check if debug mode is enabled
- imaDebug.testError(message)       Log a test error
- imaDebug.getAppState()            Get current application state
- imaDebug.help()                   Show this help

Global objects:
- window.imaApp                     Main application instance
- window.imaErrorLogger             Error logger instance

Examples:
- imaDebug.getErrors('ERROR', 5)    Get last 5 errors
- imaDebug.setDebugMode(true)       Enable debug logging
- imaDebug.exportLogs('json')       Export logs as JSON
            `);
        }
    };
    
    // Log successful initialization
    errorLogger.logInfo('Application initialized successfully', {
        type: 'initialization',
        modules: ['app', 'errorLogger', 'loadingManager']
    });
    
    // Show debug help if debug mode is enabled
    if (errorLogger.isDebugEnabled()) {
        console.log('%cIMA Annotate Frontend - Debug Mode Enabled', 'color: #17a2b8; font-weight: bold; font-size: 14px;');
        console.log('Type imaDebug.help() for available debug commands');
    }
});

/**
 * Handle unhandled errors (now handled by ErrorLogger)
 * These are kept for compatibility but ErrorLogger handles the actual logging
 */
window.addEventListener('error', (event) => {
    // ErrorLogger already handles this, but we can add app-specific context
    if (window.imaApp) {
        errorLogger.logError('Unhandled application error', {
            type: 'unhandled_error',
            appInitialized: window.imaApp.initialized,
            currentState: window.imaApp.state
        });
    }
});

window.addEventListener('unhandledrejection', (event) => {
    // ErrorLogger already handles this, but we can add app-specific context
    if (window.imaApp) {
        errorLogger.logError('Unhandled promise rejection in application', {
            type: 'unhandled_rejection',
            appInitialized: window.imaApp.initialized,
            currentState: window.imaApp.state
        });
    }
});