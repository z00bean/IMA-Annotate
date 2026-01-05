/**
 * API Client Module for IMA Annotate Frontend
 * Handles all backend communication with automatic fallback to sample mode
 */

import { CONFIG, getApiEndpoint } from '../config.js';

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
    }

    /**
     * Test API connectivity on initialization
     * Will fail with dummy endpoints and trigger sample mode
     */
    async testConnection() {
        console.log('Testing API connectivity...');
        
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
            
            // Fallback to sample mode
            this.sampleMode = true;
            return this.getSampleImages();
        }
    }

    /**
     * Get annotations for a specific image
     */
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
        // Generate mock annotations for demonstration
        const mockAnnotations = [
            {
                id: `${imageId}-ann-1`,
                imageId: imageId,
                bbox: { x: 100, y: 150, width: 200, height: 120 },
                className: 'Car',
                confidence: 0.95,
                state: 'Suggested',
                createdAt: new Date().toISOString(),
                modifiedAt: new Date().toISOString()
            },
            {
                id: `${imageId}-ann-2`,
                imageId: imageId,
                bbox: { x: 350, y: 200, width: 150, height: 100 },
                className: 'Person',
                confidence: 0.87,
                state: 'Suggested',
                createdAt: new Date().toISOString(),
                modifiedAt: new Date().toISOString()
            }
        ];

        return {
            success: true,
            annotations: mockAnnotations,
            mode: 'sample'
        };
    }

    saveSampleAnnotation(annotation) {
        try {
            // Save to local storage
            const key = `ima-annotations-${annotation.imageId}`;
            const existing = JSON.parse(localStorage.getItem(key) || '[]');
            
            // Add or update annotation
            const index = existing.findIndex(ann => ann.id === annotation.id);
            if (index >= 0) {
                existing[index] = { ...annotation, modifiedAt: new Date().toISOString() };
            } else {
                annotation.id = annotation.id || `local-${Date.now()}`;
                annotation.createdAt = new Date().toISOString();
                annotation.modifiedAt = new Date().toISOString();
                existing.push(annotation);
            }
            
            localStorage.setItem(key, JSON.stringify(existing));
            
            return {
                success: true,
                annotation: annotation,
                message: 'Annotation saved to local storage (sample mode)',
                mode: 'sample'
            };
            
        } catch (error) {
            console.error('Failed to save annotation to local storage:', error);
            return {
                success: false,
                message: 'Failed to save annotation: ' + error.message
            };
        }
    }

    deleteSampleAnnotation(annotationId) {
        try {
            // Find and remove from local storage
            const keys = Object.keys(localStorage).filter(key => key.startsWith('ima-annotations-'));
            
            for (const key of keys) {
                const annotations = JSON.parse(localStorage.getItem(key) || '[]');
                const filtered = annotations.filter(ann => ann.id !== annotationId);
                
                if (filtered.length !== annotations.length) {
                    localStorage.setItem(key, JSON.stringify(filtered));
                    return {
                        success: true,
                        message: 'Annotation deleted from local storage (sample mode)',
                        mode: 'sample'
                    };
                }
            }
            
            return {
                success: false,
                message: 'Annotation not found'
            };
            
        } catch (error) {
            console.error('Failed to delete annotation from local storage:', error);
            return {
                success: false,
                message: 'Failed to delete annotation: ' + error.message
            };
        }
    }

    /**
     * Get current connection status
     */
    getConnectionStatus() {
        return {
            connected: this.isConnected,
            sampleMode: this.sampleMode,
            apiKey: this.apiKey ? 'configured' : 'missing',
            baseUrl: this.baseUrl
        };
    }

    /**
     * Attempt to reconnect to API
     */
    async reconnect() {
        console.log('Attempting to reconnect to API...');
        const result = await this.testConnection();
        
        if (result.success) {
            this.sampleMode = false;
        }
        
        return result;
    }
}

// Export singleton instance
export const apiClient = new APIClient();