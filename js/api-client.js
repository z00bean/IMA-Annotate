/**
 * API Client Module for IMA Annotate Frontend
 * Handles all backend communication with automatic fallback to sample mode
 */

import { CONFIG, getApiEndpoint } from '../config.js';
import { errorLogger } from './error-logger.js';

/**
 * APIClient class handles all communication with the backend API
 * Includes connectivity testing, authentication, and automatic fallback to sample mode
 */
export class APIClient {
    constructor() {
        this.isConnected = false;
        this.apiKey = CONFIG.API_KEY;
        this.baseUrl = CONFIG.API_BASE_URL;
        this.sampleMode = false;
        this.retryCount = 0;
        this.maxRetries = 3;
        this.retryDelay = 1000; // 1 second
        this.lastConnectionAttempt = null;
    }

    /**
     * Test API connectivity on initialization
     * Will fail with dummy endpoints and trigger sample mode
     */
    async testConnection() {
        console.log('Testing API connectivity...');
        this.lastConnectionAttempt = new Date().toISOString();
        
        try {
            const response = await this.makeRequest('GET', getApiEndpoint('TEST_CONNECTION'), null, {
                timeout: 5000 // 5 second timeout for connection test
            });
            
            if (response.ok) {
                this.isConnected = true;
                this.sampleMode = false;
                console.log('API connection successful');
                return {
                    success: true,
                    message: 'API connection established',
                    mode: 'live'
                };
            } else {
                throw new Error(`API returned status ${response.status}`);
            }
            
        } catch (error) {
            console.warn('API connection failed:', error.message);
            errorLogger.logApiError('testConnection', error, {
                baseUrl: this.baseUrl,
                hasApiKey: !!this.apiKey
            });
            this.isConnected = false;
            this.sampleMode = true;
            
            return {
                success: false,
                message: CONFIG.ERROR_MESSAGES.API_UNREACHABLE,
                mode: 'sample',
                error: error.message
            };
        }
    }

    /**
     * Validate API key with the backend
     */
    async validateApiKey() {
        if (!this.apiKey || this.apiKey.trim() === '' || this.apiKey === 'dummy-api-key-12345') {
            return {
                valid: false,
                message: CONFIG.ERROR_MESSAGES.INVALID_API_KEY
            };
        }

        if (this.sampleMode) {
            return {
                valid: false,
                message: 'API key validation skipped in sample mode'
            };
        }

        try {
            const response = await this.makeRequest('GET', getApiEndpoint('TEST_CONNECTION'), null, {
                requireAuth: true
            });
            
            if (response.ok) {
                return {
                    valid: true,
                    message: 'API key is valid'
                };
            } else if (response.status === 401 || response.status === 403) {
                return {
                    valid: false,
                    message: CONFIG.ERROR_MESSAGES.INVALID_API_KEY
                };
            } else {
                throw new Error(`Unexpected response status: ${response.status}`);
            }
            
        } catch (error) {
            console.error('API key validation failed:', error);
            errorLogger.logApiError('validateApiKey', error, {
                hasApiKey: !!this.apiKey,
                apiKeyLength: this.apiKey?.length
            });
            return {
                valid: false,
                message: 'Failed to validate API key: ' + error.message
            };
        }
    }

    /**
     * Get list of images from API or return sample images
     */
    async getImages(page = 1, limit = 50) {
        if (this.sampleMode) {
            return this.getSampleImages();
        }

        try {
            const url = `${getApiEndpoint('GET_IMAGES')}?page=${page}&limit=${limit}`;
            const response = await this.makeRequest('GET', url, null, { requireAuth: true });
            
            if (response.ok) {
                const data = await response.json();
                return {
                    success: true,
                    images: data.images || [],
                    total: data.total || 0,
                    page: data.page || 1
                };
            } else {
                throw new Error(`Failed to fetch images: ${response.status}`);
            }
            
        } catch (error) {
            console.error('Failed to get images from API:', error);
            errorLogger.logApiError('getImages', error, { page, limit });
            
            // Fallback to sample mode
            this.sampleMode = true;
            return this.getSampleImages();
        }
    }

    async getAnnotations(imageId) {
        if (this.sampleMode) {
            return this.getSampleAnnotations(imageId);
        }

        try {
            const url = `${getApiEndpoint('GET_ANNOTATIONS')}/${imageId}`;
            const response = await this.makeRequest('GET', url, null, { requireAuth: true });
            
            if (response.ok) {
                const data = await response.json();
                return {
                    success: true,
                    annotations: data.annotations || []
                };
            } else {
                throw new Error(`Failed to fetch annotations: ${response.status}`);
            }
            
        } catch (error) {
            console.error('Failed to get annotations from API:', error);
            errorLogger.logApiError('getAnnotations', error, { imageId });
            
            // Fallback to sample annotations
            return this.getSampleAnnotations(imageId);
        }
    }

    /**
     * Save annotation to API or local storage in sample mode
     */
    async saveAnnotation(annotation) {
        if (this.sampleMode) {
            return this.saveSampleAnnotation(annotation);
        }

        try {
            const response = await this.makeRequest('POST', getApiEndpoint('SAVE_ANNOTATION'), annotation, {
                requireAuth: true
            });
            
            if (response.ok) {
                const data = await response.json();
                return {
                    success: true,
                    annotation: data.annotation,
                    message: CONFIG.SUCCESS_MESSAGES.ANNOTATIONS_SAVED
                };
            } else {
                throw new Error(`Failed to save annotation: ${response.status}`);
            }
            
        } catch (error) {
            console.error('Failed to save annotation to API:', error);
            errorLogger.logApiError('saveAnnotation', error, { 
                annotationId: annotation.id,
                imageId: annotation.imageId 
            });
            
            // Fallback to local storage
            return this.saveSampleAnnotation(annotation);
        }
    }

    /**
     * Delete annotation from API or local storage in sample mode
     */
    async deleteAnnotation(annotationId) {
        if (this.sampleMode) {
            return this.deleteSampleAnnotation(annotationId);
        }

        try {
            const url = `${getApiEndpoint('DELETE_ANNOTATION')}/${annotationId}`;
            const response = await this.makeRequest('DELETE', url, null, { requireAuth: true });
            
            if (response.ok) {
                return {
                    success: true,
                    message: 'Annotation deleted successfully'
                };
            } else {
                throw new Error(`Failed to delete annotation: ${response.status}`);
            }
            
        } catch (error) {
            console.error('Failed to delete annotation from API:', error);
            errorLogger.logApiError('deleteAnnotation', error, { annotationId });
            
            // Fallback to local storage
            return this.deleteSampleAnnotation(annotationId);
        }
    }

    /**
     * Make HTTP request with proper headers and error handling
     */
    async makeRequest(method, url, data = null, options = {}) {
        const {
            timeout = 10000,
            requireAuth = false,
            retryOnFailure = false
        } = options;

        const headers = {
            'Content-Type': 'application/json'
        };

        // Add authentication header if required and API key is available
        if (requireAuth && this.apiKey) {
            headers['Authorization'] = `Bearer ${this.apiKey}`;
        }

        const requestOptions = {
            method,
            headers,
            signal: AbortSignal.timeout(timeout)
        };

        if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
            requestOptions.body = JSON.stringify(data);
        }

        try {
            const response = await fetch(url, requestOptions);
            
            // Reset retry count on successful request
            this.retryCount = 0;
            
            return response;
            
        } catch (error) {
            if (retryOnFailure && this.retryCount < this.maxRetries) {
                this.retryCount++;
                console.log(`Request failed, retrying (${this.retryCount}/${this.maxRetries})...`);
                
                // Wait before retrying
                await new Promise(resolve => setTimeout(resolve, this.retryDelay * this.retryCount));
                
                return this.makeRequest(method, url, data, options);
            }
            
            throw error;
        }
    }

    /**
     * Sample mode methods - provide mock data when API is unavailable
     */
    getSampleImages() {
        const sampleImages = CONFIG.SAMPLE_IMAGES.map((path, index) => ({
            id: `sample-${index + 1}`,
            filename: path.split('/').pop(),
            path: path,
            width: 1920, // Mock dimensions
            height: 1080,
            metadata: {
                captureDate: new Date().toISOString(),
                location: 'Sample Location',
                camera: 'Sample Camera'
            }
        }));

        return {
            success: true,
            images: sampleImages,
            total: sampleImages.length,
            page: 1,
            mode: 'sample'
        };
    }

    getSampleAnnotations(imageId) {
        // First check if we have saved annotations in local storage
        const savedAnnotations = this.loadAnnotationsFromLocalStorage(imageId);
        if (savedAnnotations.length > 0) {
            return {
                success: true,
                annotations: savedAnnotations,
                mode: 'sample'
            };
        }

        // Generate realistic mock annotations based on image ID for demonstration
        const mockAnnotations = this.generateRealisticMockAnnotations(imageId);

        // Save mock annotations to local storage for persistence
        this.saveAnnotationsToLocalStorage(imageId, mockAnnotations);

        return {
            success: true,
            annotations: mockAnnotations,
            mode: 'sample'
        };
    }

    /**
     * Generate realistic mock annotations for different sample images
     * @param {string} imageId - The image ID to generate annotations for
     * @returns {Array} Array of mock annotation objects
     */
    generateRealisticMockAnnotations(imageId) {
        const baseTime = new Date().toISOString();
        const availableClasses = Object.keys(CONFIG.ANNOTATION_COLORS);
        const states = ['Suggested', 'Verified', 'Modified'];
        
        // Different annotation patterns based on image ID
        let annotations = [];
        
        if (imageId === 'sample-1') {
            // Transportation scene with multiple vehicles
            annotations = [
                {
                    id: `${imageId}-ann-1`,
                    imageId: imageId,
                    bbox: { x: 120, y: 180, width: 240, height: 140 },
                    className: 'Car',
                    confidence: 0.94,
                    state: 'Suggested',
                    createdAt: baseTime,
                    modifiedAt: baseTime,
                    segmentationMask: null,
                    metadata: { source: 'GroundingDINO', model_version: '1.5' }
                },
                {
                    id: `${imageId}-ann-2`,
                    imageId: imageId,
                    bbox: { x: 400, y: 160, width: 280, height: 180 },
                    className: 'Truck',
                    confidence: 0.89,
                    state: 'Verified',
                    createdAt: baseTime,
                    modifiedAt: baseTime,
                    segmentationMask: null,
                    metadata: { source: 'GroundingDINO', model_version: '1.5' }
                },
                {
                    id: `${imageId}-ann-3`,
                    imageId: imageId,
                    bbox: { x: 720, y: 200, width: 160, height: 120 },
                    className: 'Car',
                    confidence: 0.91,
                    state: 'Modified',
                    createdAt: baseTime,
                    modifiedAt: baseTime,
                    segmentationMask: null,
                    metadata: { source: 'GroundingDINO', model_version: '1.5', modified_by: 'user' }
                },
                {
                    id: `${imageId}-ann-4`,
                    imageId: imageId,
                    bbox: { x: 580, y: 280, width: 80, height: 160 },
                    className: 'Person',
                    confidence: 0.76,
                    state: 'Suggested',
                    createdAt: baseTime,
                    modifiedAt: baseTime,
                    segmentationMask: null,
                    metadata: { source: 'GroundingDINO', model_version: '1.5' }
                }
            ];
        } else if (imageId === 'sample-2') {
            // Urban intersection scene
            annotations = [
                {
                    id: `${imageId}-ann-1`,
                    imageId: imageId,
                    bbox: { x: 200, y: 220, width: 180, height: 120 },
                    className: 'Bus',
                    confidence: 0.96,
                    state: 'Verified',
                    createdAt: baseTime,
                    modifiedAt: baseTime,
                    segmentationMask: null,
                    metadata: { source: 'GroundingDINO', model_version: '1.5' }
                },
                {
                    id: `${imageId}-ann-2`,
                    imageId: imageId,
                    bbox: { x: 450, y: 300, width: 60, height: 140 },
                    className: 'Person',
                    confidence: 0.82,
                    state: 'Suggested',
                    createdAt: baseTime,
                    modifiedAt: baseTime,
                    segmentationMask: null,
                    metadata: { source: 'GroundingDINO', model_version: '1.5' }
                },
                {
                    id: `${imageId}-ann-3`,
                    imageId: imageId,
                    bbox: { x: 520, y: 320, width: 70, height: 120 },
                    className: 'Person',
                    confidence: 0.78,
                    state: 'Modified',
                    createdAt: baseTime,
                    modifiedAt: baseTime,
                    segmentationMask: null,
                    metadata: { source: 'GroundingDINO', model_version: '1.5', modified_by: 'user' }
                },
                {
                    id: `${imageId}-ann-4`,
                    imageId: imageId,
                    bbox: { x: 680, y: 280, width: 120, height: 80 },
                    className: 'Motorcycle',
                    confidence: 0.85,
                    state: 'Suggested',
                    createdAt: baseTime,
                    modifiedAt: baseTime,
                    segmentationMask: null,
                    metadata: { source: 'GroundingDINO', model_version: '1.5' }
                },
                {
                    id: `${imageId}-ann-5`,
                    imageId: imageId,
                    bbox: { x: 100, y: 350, width: 90, height: 90 },
                    className: 'Bicycle',
                    confidence: 0.73,
                    state: 'Rejected',
                    createdAt: baseTime,
                    modifiedAt: baseTime,
                    segmentationMask: null,
                    metadata: { source: 'GroundingDINO', model_version: '1.5', rejected_reason: 'false_positive' }
                }
            ];
        } else if (imageId === 'sample-3') {
            // Highway scene with mixed traffic
            annotations = [
                {
                    id: `${imageId}-ann-1`,
                    imageId: imageId,
                    bbox: { x: 150, y: 200, width: 220, height: 130 },
                    className: 'Truck',
                    confidence: 0.93,
                    state: 'Verified',
                    createdAt: baseTime,
                    modifiedAt: baseTime,
                    segmentationMask: null,
                    metadata: { source: 'GroundingDINO', model_version: '1.5' }
                },
                {
                    id: `${imageId}-ann-2`,
                    imageId: imageId,
                    bbox: { x: 420, y: 240, width: 160, height: 100 },
                    className: 'Car',
                    confidence: 0.88,
                    state: 'Suggested',
                    createdAt: baseTime,
                    modifiedAt: baseTime,
                    segmentationMask: null,
                    metadata: { source: 'GroundingDINO', model_version: '1.5' }
                },
                {
                    id: `${imageId}-ann-3`,
                    imageId: imageId,
                    bbox: { x: 620, y: 220, width: 180, height: 110 },
                    className: 'Car',
                    confidence: 0.90,
                    state: 'Modified',
                    createdAt: baseTime,
                    modifiedAt: baseTime,
                    segmentationMask: null,
                    metadata: { source: 'GroundingDINO', model_version: '1.5', modified_by: 'user' }
                }
            ];
        } else {
            // Default annotations for any other image IDs
            annotations = [
                {
                    id: `${imageId}-ann-1`,
                    imageId: imageId,
                    bbox: { x: 100, y: 150, width: 200, height: 120 },
                    className: 'Car',
                    confidence: 0.95,
                    state: 'Suggested',
                    createdAt: baseTime,
                    modifiedAt: baseTime,
                    segmentationMask: null,
                    metadata: { source: 'GroundingDINO', model_version: '1.5' }
                },
                {
                    id: `${imageId}-ann-2`,
                    imageId: imageId,
                    bbox: { x: 350, y: 200, width: 150, height: 100 },
                    className: 'Person',
                    confidence: 0.87,
                    state: 'Suggested',
                    createdAt: baseTime,
                    modifiedAt: baseTime,
                    segmentationMask: null,
                    metadata: { source: 'GroundingDINO', model_version: '1.5' }
                }
            ];
        }

        return annotations;
    }

    saveSampleAnnotation(annotation) {
        try {
            const imageId = annotation.imageId;
            
            // Validate annotation data
            if (!annotation.bbox || !annotation.className) {
                throw new Error('Invalid annotation data: missing bbox or className');
            }
            
            // Load existing annotations
            const existing = this.loadAnnotationsFromLocalStorage(imageId);
            
            // Add or update annotation
            const index = existing.findIndex(ann => ann.id === annotation.id);
            if (index >= 0) {
                // Update existing annotation
                existing[index] = { 
                    ...annotation, 
                    modifiedAt: new Date().toISOString(),
                    state: annotation.state || 'Modified' // Mark as modified if state not specified
                };
                console.log(`Updated annotation ${annotation.id} in sample mode`);
            } else {
                // Add new annotation
                annotation.id = annotation.id || `sample-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                annotation.createdAt = annotation.createdAt || new Date().toISOString();
                annotation.modifiedAt = new Date().toISOString();
                annotation.state = annotation.state || 'Modified'; // New annotations are marked as modified
                annotation.confidence = annotation.confidence || 1.0; // User-created annotations have full confidence
                annotation.metadata = annotation.metadata || { source: 'user', created_in_sample_mode: true };
                existing.push(annotation);
                console.log(`Added new annotation ${annotation.id} in sample mode`);
            }
            
            // Save back to local storage
            this.saveAnnotationsToLocalStorage(imageId, existing);
            
            return {
                success: true,
                annotation: annotation,
                message: 'Annotation saved to local storage (sample mode)',
                mode: 'sample'
            };
            
        } catch (error) {
            console.error('Failed to save annotation to local storage:', error);
            errorLogger.logError('Sample annotation save failed', {
                type: 'storage_error',
                operation: 'save_sample_annotation',
                annotationId: annotation.id,
                imageId: annotation.imageId
            }, error);
            return {
                success: false,
                message: 'Failed to save annotation: ' + error.message,
                error: error.message
            };
        }
    }

    deleteSampleAnnotation(annotationId) {
        try {
            // Find and remove from local storage
            const keys = Object.keys(localStorage).filter(key => key.startsWith('ima-annotations-'));
            let found = false;
            
            for (const key of keys) {
                const imageId = key.replace('ima-annotations-', '');
                const annotations = this.loadAnnotationsFromLocalStorage(imageId);
                const filtered = annotations.filter(ann => ann.id !== annotationId);
                
                if (filtered.length !== annotations.length) {
                    this.saveAnnotationsToLocalStorage(imageId, filtered);
                    found = true;
                    console.log(`Deleted annotation ${annotationId} from sample mode`);
                    break;
                }
            }
            
            if (found) {
                return {
                    success: true,
                    message: 'Annotation deleted from local storage (sample mode)',
                    mode: 'sample'
                };
            } else {
                return {
                    success: false,
                    message: 'Annotation not found',
                    error: 'Annotation not found'
                };
            }
            
        } catch (error) {
            console.error('Failed to delete annotation from local storage:', error);
            errorLogger.logError('Sample annotation delete failed', {
                type: 'storage_error',
                operation: 'delete_sample_annotation',
                annotationId
            }, error);
            return {
                success: false,
                message: 'Failed to delete annotation: ' + error.message,
                error: error.message
            };
        }
    }

    /**
     * Get current connection status and mode information
     */
    getConnectionStatus() {
        return {
            connected: this.isConnected,
            sampleMode: this.sampleMode,
            apiKey: this.apiKey ? 'configured' : 'missing',
            baseUrl: this.baseUrl,
            mode: this.sampleMode ? 'sample' : 'live'
        };
    }

    /**
     * Check if currently in sample mode
     */
    isSampleMode() {
        return this.sampleMode;
    }

    /**
     * Force switch to sample mode (for testing or fallback)
     */
    forceSampleMode() {
        console.log('Forcing sample mode activation');
        this.sampleMode = true;
        this.isConnected = false;
        return {
            success: true,
            message: 'Sample mode activated',
            mode: 'sample'
        };
    }

    /**
     * Get sample mode capabilities and status
     */
    getSampleModeInfo() {
        return {
            active: this.sampleMode,
            sampleImages: CONFIG.SAMPLE_IMAGES,
            availableClasses: Object.keys(CONFIG.ANNOTATION_COLORS),
            availableStates: Object.keys(CONFIG.STATE_COLORS),
            localStorageSupported: this.isLocalStorageAvailable(),
            persistenceEnabled: true
        };
    }

    /**
     * Check if local storage is available for sample mode persistence
     */
    isLocalStorageAvailable() {
        try {
            const test = '__localStorage_test__';
            localStorage.setItem(test, test);
            localStorage.removeItem(test);
            return true;
        } catch (e) {
            console.warn('Local storage not available for sample mode persistence');
            return false;
        }
    }

    /**
     * Attempt to reconnect to API and transition from sample to live mode
     */
    async reconnect() {
        console.log('Attempting to reconnect to API...');
        
        const previousMode = this.sampleMode;
        const result = await this.testConnection();
        
        if (result.success && previousMode) {
            // Successfully transitioned from sample to live mode
            console.log('Successfully transitioned from sample to live mode');
            return {
                success: true,
                message: 'Successfully connected to API - switched to live mode',
                mode: 'live',
                previousMode: 'sample',
                transitioned: true
            };
        } else if (result.success) {
            // Was already in live mode
            return {
                success: true,
                message: 'API connection confirmed',
                mode: 'live',
                previousMode: 'live',
                transitioned: false
            };
        } else {
            // Failed to connect, staying in sample mode
            return {
                success: false,
                message: result.message,
                mode: 'sample',
                previousMode: previousMode ? 'sample' : 'live',
                transitioned: false
            };
        }
    }

    /**
     * Transition to sample mode (for testing or when API fails)
     */
    transitionToSampleMode(reason = 'manual') {
        const previousMode = this.sampleMode ? 'sample' : 'live';
        
        console.log(`Transitioning to sample mode (reason: ${reason})`);
        this.sampleMode = true;
        this.isConnected = false;
        
        return {
            success: true,
            message: `Switched to sample mode (${reason})`,
            mode: 'sample',
            previousMode: previousMode,
            transitioned: previousMode !== 'sample',
            reason: reason
        };
    }

    /**
     * Get mode transition capabilities and status
     */
    getModeTransitionInfo() {
        return {
            currentMode: this.sampleMode ? 'sample' : 'live',
            canTransitionToLive: !this.isConnected && this.apiKey && this.apiKey !== 'dummy-api-key-12345',
            canTransitionToSample: true,
            apiConfigured: this.apiKey && this.apiKey.trim().length > 0,
            connectionStatus: this.isConnected ? 'connected' : 'disconnected',
            lastConnectionAttempt: this.lastConnectionAttempt || null
        };
    }

    /**
     * Sync data between modes (if transitioning from sample to live)
     */
    async syncSampleDataToLive() {
        if (!this.isConnected || this.sampleMode) {
            return {
                success: false,
                message: 'Cannot sync to live mode - not connected to API',
                error: 'Not connected'
            };
        }

        try {
            const sampleData = this.getAllSampleData();
            
            if (!sampleData.success) {
                return {
                    success: false,
                    message: 'Failed to retrieve sample data for sync',
                    error: sampleData.error
                };
            }

            let syncedCount = 0;
            let errorCount = 0;
            const errors = [];

            // Sync annotations for each image
            for (const [imageId, annotations] of Object.entries(sampleData.data)) {
                for (const annotation of annotations) {
                    // Only sync user-created or modified annotations
                    if (annotation.state === 'Modified' || annotation.metadata?.created_in_sample_mode) {
                        try {
                            const result = await this.saveAnnotation(annotation);
                            if (result.success) {
                                syncedCount++;
                            } else {
                                errorCount++;
                                errors.push(`Failed to sync annotation ${annotation.id}: ${result.message}`);
                            }
                        } catch (error) {
                            errorCount++;
                            errors.push(`Error syncing annotation ${annotation.id}: ${error.message}`);
                        }
                    }
                }
            }

            return {
                success: errorCount === 0,
                message: `Synced ${syncedCount} annotations to live mode${errorCount > 0 ? ` (${errorCount} errors)` : ''}`,
                syncedCount: syncedCount,
                errorCount: errorCount,
                errors: errors
            };

        } catch (error) {
            console.error('Failed to sync sample data to live mode:', error);
            errorLogger.logError('Sample data sync failed', {
                type: 'sync_error',
                operation: 'sync_sample_to_live'
            }, error);
            return {
                success: false,
                message: 'Failed to sync sample data: ' + error.message,
                error: error.message
            };
        }
    }

    /**
     * Local storage helper methods for sample mode persistence
     */
    loadAnnotationsFromLocalStorage(imageId) {
        try {
            const key = `ima-annotations-${imageId}`;
            const stored = localStorage.getItem(key);
            return stored ? JSON.parse(stored) : [];
        } catch (error) {
            console.error('Failed to load annotations from local storage:', error);
            errorLogger.logError('Local storage load failed', {
                type: 'storage_error',
                operation: 'load_annotations',
                imageId
            }, error);
            return [];
        }
    }

    saveAnnotationsToLocalStorage(imageId, annotations) {
        try {
            const key = `ima-annotations-${imageId}`;
            localStorage.setItem(key, JSON.stringify(annotations));
            console.log(`Saved ${annotations.length} annotations to local storage for image ${imageId}`);
        } catch (error) {
            console.error('Failed to save annotations to local storage:', error);
            errorLogger.logError('Local storage save failed', {
                type: 'storage_error',
                operation: 'save_annotations',
                imageId,
                annotationCount: annotations.length
            }, error);
        }
    }

    clearAnnotationsFromLocalStorage(imageId) {
        try {
            const key = `ima-annotations-${imageId}`;
            localStorage.removeItem(key);
            console.log(`Cleared annotations from local storage for image ${imageId}`);
        } catch (error) {
            console.error('Failed to clear annotations from local storage:', error);
            errorLogger.logError('Local storage clear failed', {
                type: 'storage_error',
                operation: 'clear_annotations',
                imageId
            }, error);
        }
    }

    /**
     * Clear all sample mode data from local storage
     */
    clearAllSampleData() {
        try {
            const keys = Object.keys(localStorage).filter(key => key.startsWith('ima-annotations-'));
            let clearedCount = 0;
            
            for (const key of keys) {
                localStorage.removeItem(key);
                clearedCount++;
            }
            
            console.log(`Cleared ${clearedCount} annotation sets from local storage`);
            return {
                success: true,
                message: `Cleared ${clearedCount} annotation sets from sample mode storage`,
                clearedCount: clearedCount
            };
        } catch (error) {
            console.error('Failed to clear sample data:', error);
            errorLogger.logError('Sample data clear failed', {
                type: 'storage_error',
                operation: 'clear_all_sample_data'
            }, error);
            return {
                success: false,
                message: 'Failed to clear sample data: ' + error.message,
                error: error.message
            };
        }
    }

    /**
     * Get all sample mode data for export or backup
     */
    getAllSampleData() {
        try {
            const keys = Object.keys(localStorage).filter(key => key.startsWith('ima-annotations-'));
            const sampleData = {};
            
            for (const key of keys) {
                const imageId = key.replace('ima-annotations-', '');
                sampleData[imageId] = this.loadAnnotationsFromLocalStorage(imageId);
            }
            
            return {
                success: true,
                data: sampleData,
                imageCount: Object.keys(sampleData).length,
                totalAnnotations: Object.values(sampleData).reduce((sum, annotations) => sum + annotations.length, 0)
            };
        } catch (error) {
            console.error('Failed to get sample data:', error);
            errorLogger.logError('Sample data retrieval failed', {
                type: 'storage_error',
                operation: 'get_all_sample_data'
            }, error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Reset sample mode to initial state with fresh mock data
     */
    resetSampleMode() {
        try {
            // Clear existing sample data
            this.clearAllSampleData();
            
            // Regenerate mock annotations for all sample images
            const sampleImages = CONFIG.SAMPLE_IMAGES.map((path, index) => `sample-${index + 1}`);
            let totalGenerated = 0;
            
            for (const imageId of sampleImages) {
                const mockAnnotations = this.generateRealisticMockAnnotations(imageId);
                this.saveAnnotationsToLocalStorage(imageId, mockAnnotations);
                totalGenerated += mockAnnotations.length;
            }
            
            console.log(`Reset sample mode with ${totalGenerated} fresh annotations`);
            return {
                success: true,
                message: `Sample mode reset with ${totalGenerated} fresh annotations`,
                generatedAnnotations: totalGenerated,
                imageCount: sampleImages.length
            };
        } catch (error) {
            console.error('Failed to reset sample mode:', error);
            errorLogger.logError('Sample mode reset failed', {
                type: 'storage_error',
                operation: 'reset_sample_mode'
            }, error);
            return {
                success: false,
                message: 'Failed to reset sample mode: ' + error.message,
                error: error.message
            };
        }
    }
}

// Export singleton instance
export const apiClient = new APIClient();