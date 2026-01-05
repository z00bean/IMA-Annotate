/**
 * Image Manager Module for IMA Annotate Frontend
 * Handles image loading from sample directory, navigation with bounds checking,
 * image preloading for smooth navigation, and scaling images to fit canvas
 */

import { CONFIG } from '../config.js';
import { apiClient } from './api-client.js';

/**
 * ImageManager class handles all image-related operations including loading,
 * navigation, caching, and scaling for the annotation interface
 */
export class ImageManager {
    constructor() {
        this.images = [];
        this.currentImageIndex = 0;
        this.imageCache = new Map();
        this.preloadCache = new Map();
        this.currentImage = null;
        this.isLoading = false;
        this.preloadQueue = [];
        
        // Canvas reference for scaling calculations
        this.canvas = null;
        this.canvasContainer = null;
        
        // Event callbacks
        this.onImageLoaded = null;
        this.onImageLoadError = null;
        this.onNavigationChange = null;
    }

    /**
     * Initialize the image manager with canvas reference
     * @param {HTMLCanvasElement} canvas - The canvas element for rendering
     * @param {HTMLElement} canvasContainer - The container element for sizing
     */
    init(canvas, canvasContainer) {
        this.canvas = canvas;
        this.canvasContainer = canvasContainer;
        
        console.log('ImageManager initialized');
    }

    /**
     * Load images from API or sample directory
     * @param {boolean} forceReload - Force reload even if images are already loaded
     */
    async loadImages(forceReload = false) {
        if (this.images.length > 0 && !forceReload) {
            console.log('Images already loaded, skipping reload');
            return {
                success: true,
                images: this.images,
                total: this.images.length
            };
        }

        console.log('Loading images...');
        
        try {
            // Get images from API client (will fallback to sample images if API unavailable)
            const result = await apiClient.getImages();
            
            if (result.success) {
                this.images = result.images;
                this.currentImageIndex = 0;
                
                // Clear existing caches
                this.imageCache.clear();
                this.preloadCache.clear();
                
                console.log(`Loaded ${this.images.length} images`);
                
                // Load the first image if available
                if (this.images.length > 0) {
                    await this.loadCurrentImage();
                    this.startPreloading();
                }
                
                // Notify listeners of navigation change
                this.notifyNavigationChange();
                
                return {
                    success: true,
                    images: this.images,
                    total: this.images.length,
                    mode: result.mode || 'live'
                };
            } else {
                throw new Error('Failed to load images from API');
            }
            
        } catch (error) {
            console.error('Failed to load images:', error);
            return {
                success: false,
                error: error.message,
                images: [],
                total: 0
            };
        }
    }

    /**
     * Load a specific image by path or URL
     * @param {string} imagePath - Path to the image file
     * @returns {Promise<HTMLImageElement>} - Promise that resolves to loaded image
     */
    async loadImage(imagePath) {
        return new Promise((resolve, reject) => {
            // Check cache first
            if (this.imageCache.has(imagePath)) {
                console.log(`Image loaded from cache: ${imagePath}`);
                resolve(this.imageCache.get(imagePath));
                return;
            }

            const img = new Image();
            
            img.onload = () => {
                console.log(`Image loaded successfully: ${imagePath} (${img.width}x${img.height})`);
                
                // Cache the loaded image
                this.imageCache.set(imagePath, img);
                
                resolve(img);
            };
            
            img.onerror = (error) => {
                console.error(`Failed to load image: ${imagePath}`, error);
                reject(new Error(`Failed to load image: ${imagePath}`));
            };
            
            // Set crossOrigin for external images if needed
            if (imagePath.startsWith('http')) {
                img.crossOrigin = 'anonymous';
            }
            
            img.src = imagePath;
        });
    }

    /**
     * Load the current image based on currentImageIndex
     */
    async loadCurrentImage() {
        if (this.images.length === 0) {
            console.warn('No images available to load');
            return null;
        }

        if (this.currentImageIndex < 0 || this.currentImageIndex >= this.images.length) {
            console.warn(`Invalid image index: ${this.currentImageIndex}`);
            return null;
        }

        const imageData = this.images[this.currentImageIndex];
        this.isLoading = true;

        try {
            console.log(`Loading current image: ${imageData.path} (index: ${this.currentImageIndex})`);
            
            const img = await this.loadImage(imageData.path);
            this.currentImage = {
                element: img,
                data: imageData,
                scaledDimensions: this.calculateScaledDimensions(img.width, img.height)
            };
            
            this.isLoading = false;
            
            // Notify listeners that image was loaded
            if (this.onImageLoaded) {
                this.onImageLoaded(this.currentImage);
            }
            
            console.log(`Current image loaded: ${imageData.filename}`);
            return this.currentImage;
            
        } catch (error) {
            this.isLoading = false;
            console.error('Failed to load current image:', error);
            
            // Notify listeners of error
            if (this.onImageLoadError) {
                this.onImageLoadError(error, imageData);
            }
            
            throw error;
        }
    }

    /**
     * Navigate to the next image
     * @returns {Promise<Object|null>} - Promise that resolves to the loaded image or null
     */
    async nextImage() {
        if (this.images.length === 0) {
            console.warn('No images available for navigation');
            return null;
        }

        // Check bounds
        if (this.currentImageIndex >= this.images.length - 1) {
            console.log('Already at last image');
            return this.currentImage;
        }

        this.currentImageIndex++;
        console.log(`Navigating to next image (index: ${this.currentImageIndex})`);
        
        try {
            const image = await this.loadCurrentImage();
            this.notifyNavigationChange();
            this.updatePreloadQueue();
            return image;
        } catch (error) {
            // If loading fails, revert to previous index
            this.currentImageIndex--;
            throw error;
        }
    }

    /**
     * Navigate to the previous image
     * @returns {Promise<Object|null>} - Promise that resolves to the loaded image or null
     */
    async previousImage() {
        if (this.images.length === 0) {
            console.warn('No images available for navigation');
            return null;
        }

        // Check bounds
        if (this.currentImageIndex <= 0) {
            console.log('Already at first image');
            return this.currentImage;
        }

        this.currentImageIndex--;
        console.log(`Navigating to previous image (index: ${this.currentImageIndex})`);
        
        try {
            const image = await this.loadCurrentImage();
            this.notifyNavigationChange();
            this.updatePreloadQueue();
            return image;
        } catch (error) {
            // If loading fails, revert to next index
            this.currentImageIndex++;
            throw error;
        }
    }

    /**
     * Navigate to a specific image by index
     * @param {number} index - The index of the image to navigate to
     * @returns {Promise<Object|null>} - Promise that resolves to the loaded image or null
     */
    async goToImage(index) {
        if (this.images.length === 0) {
            console.warn('No images available for navigation');
            return null;
        }

        // Validate index bounds
        if (index < 0 || index >= this.images.length) {
            console.warn(`Invalid image index: ${index}. Valid range: 0-${this.images.length - 1}`);
            return null;
        }

        if (index === this.currentImageIndex) {
            console.log('Already at requested image index');
            return this.currentImage;
        }

        const previousIndex = this.currentImageIndex;
        this.currentImageIndex = index;
        
        console.log(`Navigating to image index: ${index}`);
        
        try {
            const image = await this.loadCurrentImage();
            this.notifyNavigationChange();
            this.updatePreloadQueue();
            return image;
        } catch (error) {
            // If loading fails, revert to previous index
            this.currentImageIndex = previousIndex;
            throw error;
        }
    }

    /**
     * Get the current image object
     * @returns {Object|null} - Current image object with element, data, and scaled dimensions
     */
    getCurrentImage() {
        return this.currentImage;
    }

    /**
     * Get the current image index
     * @returns {number} - Current image index
     */
    getCurrentImageIndex() {
        return this.currentImageIndex;
    }

    /**
     * Get the total number of images
     * @returns {number} - Total image count
     */
    getImageCount() {
        return this.images.length;
    }

    /**
     * Get image data by index
     * @param {number} index - Image index
     * @returns {Object|null} - Image data object or null if invalid index
     */
    getImageData(index) {
        if (index >= 0 && index < this.images.length) {
            return this.images[index];
        }
        return null;
    }

    /**
     * Check if we can navigate to the next image
     * @returns {boolean} - True if next navigation is possible
     */
    canNavigateNext() {
        return this.images.length > 0 && this.currentImageIndex < this.images.length - 1;
    }

    /**
     * Check if we can navigate to the previous image
     * @returns {boolean} - True if previous navigation is possible
     */
    canNavigatePrevious() {
        return this.images.length > 0 && this.currentImageIndex > 0;
    }

    /**
     * Calculate scaled dimensions to fit canvas while preserving aspect ratio
     * @param {number} imageWidth - Original image width
     * @param {number} imageHeight - Original image height
     * @returns {Object} - Scaled dimensions and positioning
     */
    calculateScaledDimensions(imageWidth, imageHeight) {
        if (!this.canvas || !this.canvasContainer) {
            console.warn('Canvas not initialized for scaling calculations');
            return {
                width: imageWidth,
                height: imageHeight,
                x: 0,
                y: 0,
                scale: 1
            };
        }

        // Get available canvas space
        const containerRect = this.canvasContainer.getBoundingClientRect();
        const maxWidth = Math.min(
            containerRect.width - (CONFIG.CANVAS_PADDING * 2), 
            CONFIG.MAX_CANVAS_WIDTH
        );
        const maxHeight = Math.min(
            containerRect.height - (CONFIG.CANVAS_PADDING * 2), 
            CONFIG.MAX_CANVAS_HEIGHT
        );

        // Calculate scale to fit while preserving aspect ratio
        const scaleX = maxWidth / imageWidth;
        const scaleY = maxHeight / imageHeight;
        const scale = Math.min(scaleX, scaleY, 1); // Don't scale up beyond original size

        // Calculate scaled dimensions
        const scaledWidth = imageWidth * scale;
        const scaledHeight = imageHeight * scale;

        // Center the image in the canvas
        const x = (maxWidth - scaledWidth) / 2;
        const y = (maxHeight - scaledHeight) / 2;

        return {
            width: scaledWidth,
            height: scaledHeight,
            x: Math.max(0, x),
            y: Math.max(0, y),
            scale: scale,
            originalWidth: imageWidth,
            originalHeight: imageHeight,
            canvasWidth: maxWidth,
            canvasHeight: maxHeight
        };
    }

    /**
     * Start preloading adjacent images for smooth navigation
     */
    startPreloading() {
        if (this.images.length <= 1) {
            return; // No need to preload if only one or no images
        }

        this.updatePreloadQueue();
    }

    /**
     * Update the preload queue based on current image index
     */
    updatePreloadQueue() {
        this.preloadQueue = [];

        const preloadCount = CONFIG.UI.PRELOAD_IMAGES;
        
        // Add next images to preload queue
        for (let i = 1; i <= preloadCount; i++) {
            const nextIndex = this.currentImageIndex + i;
            if (nextIndex < this.images.length) {
                this.preloadQueue.push(nextIndex);
            }
        }

        // Add previous images to preload queue
        for (let i = 1; i <= preloadCount; i++) {
            const prevIndex = this.currentImageIndex - i;
            if (prevIndex >= 0) {
                this.preloadQueue.push(prevIndex);
            }
        }

        // Start preloading
        this.preloadImages();
    }

    /**
     * Preload images in the queue
     */
    async preloadImages() {
        for (const index of this.preloadQueue) {
            const imageData = this.images[index];
            if (imageData && !this.preloadCache.has(imageData.path)) {
                try {
                    console.log(`Preloading image: ${imageData.path}`);
                    const img = await this.loadImage(imageData.path);
                    this.preloadCache.set(imageData.path, img);
                } catch (error) {
                    console.warn(`Failed to preload image: ${imageData.path}`, error);
                }
            }
        }
    }

    /**
     * Set callback for image loaded events
     * @param {Function} callback - Callback function to call when image is loaded
     */
    setOnImageLoaded(callback) {
        this.onImageLoaded = callback;
    }

    /**
     * Set callback for image load error events
     * @param {Function} callback - Callback function to call when image load fails
     */
    setOnImageLoadError(callback) {
        this.onImageLoadError = callback;
    }

    /**
     * Set callback for navigation change events
     * @param {Function} callback - Callback function to call when navigation changes
     */
    setOnNavigationChange(callback) {
        this.onNavigationChange = callback;
    }

    /**
     * Notify listeners of navigation changes
     */
    notifyNavigationChange() {
        if (this.onNavigationChange) {
            this.onNavigationChange({
                currentIndex: this.currentImageIndex,
                totalImages: this.images.length,
                canNavigateNext: this.canNavigateNext(),
                canNavigatePrevious: this.canNavigatePrevious(),
                currentImage: this.currentImage
            });
        }
    }

    /**
     * Check if currently loading an image
     * @returns {boolean} - True if loading
     */
    isLoadingImage() {
        return this.isLoading;
    }

    /**
     * Clear all caches
     */
    clearCache() {
        this.imageCache.clear();
        this.preloadCache.clear();
        console.log('Image caches cleared');
    }

    /**
     * Get cache statistics
     * @returns {Object} - Cache statistics
     */
    getCacheStats() {
        return {
            mainCacheSize: this.imageCache.size,
            preloadCacheSize: this.preloadCache.size,
            totalCachedImages: this.imageCache.size + this.preloadCache.size,
            preloadQueueLength: this.preloadQueue.length
        };
    }

    /**
     * Destroy the image manager and clean up resources
     */
    destroy() {
        // Clear all caches
        this.clearCache();
        
        // Reset state
        this.images = [];
        this.currentImageIndex = 0;
        this.currentImage = null;
        this.isLoading = false;
        this.preloadQueue = [];
        
        // Clear callbacks
        this.onImageLoaded = null;
        this.onImageLoadError = null;
        this.onNavigationChange = null;
        
        console.log('ImageManager destroyed');
    }
}

// Export singleton instance
export const imageManager = new ImageManager();