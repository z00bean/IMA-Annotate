/**
 * Annotation Manager Module for IMA Annotate Frontend
 * Handles annotation data model, state management, CRUD operations, and state transitions
 */

import { CONFIG, getClassColor, getStateColor } from '../config.js';
import { apiClient } from './api-client.js';

/**
 * AnnotationManager class handles all annotation-related operations including
 * data management, state transitions, CRUD operations, and filtering
 */
export class AnnotationManager {
    constructor() {
        // Annotation storage - Map keyed by imageId
        this.annotations = new Map();
        
        // Current image context
        this.currentImageId = null;
        
        // State management
        this.selectedAnnotation = null;
        this.annotationHistory = [];
        this.maxHistorySize = 100;
        
        // Session management
        this.sessionId = null;
        
        // Auto-save configuration
        this.autoSaveEnabled = true;
        this.autoSaveDelay = CONFIG.UI.AUTO_SAVE_DELAY || 1000;
        this.autoSaveTimeout = null;
        
        // Event callbacks
        this.onAnnotationsChanged = null;
        this.onAnnotationSelected = null;
        this.onAnnotationStateChanged = null;
        this.onSaveComplete = null;
        this.onSaveError = null;
        
        // Load history from local storage on initialization
        this.loadHistoryFromLocalStorage();
        
        console.log('AnnotationManager initialized');
    }

    /**
     * Load annotations for a specific image
     * @param {string} imageId - The ID of the image to load annotations for
     * @returns {Promise<Object>} - Result object with success status and annotations
     */
    async loadAnnotations(imageId) {
        if (!imageId) {
            console.warn('Cannot load annotations: imageId is required');
            return {
                success: false,
                error: 'Image ID is required',
                annotations: []
            };
        }

        console.log(`Loading annotations for image: ${imageId}`);
        
        try {
            // Check if annotations are already cached
            if (this.annotations.has(imageId)) {
                const cachedAnnotations = this.annotations.get(imageId);
                console.log(`Loaded ${cachedAnnotations.length} cached annotations for image ${imageId}`);
                
                this.currentImageId = imageId;
                this.notifyAnnotationsChanged();
                
                return {
                    success: true,
                    annotations: [...cachedAnnotations], // Return copy to prevent external modification
                    cached: true
                };
            }

            // Load from API client (will handle sample mode fallback)
            const result = await apiClient.getAnnotations(imageId);
            
            if (result.success) {
                // Process and validate annotations
                const processedAnnotations = this.processLoadedAnnotations(result.annotations, imageId);
                
                // Cache the annotations
                this.annotations.set(imageId, processedAnnotations);
                this.currentImageId = imageId;
                
                console.log(`Loaded ${processedAnnotations.length} annotations for image ${imageId}`);
                
                // Notify listeners
                this.notifyAnnotationsChanged();
                
                return {
                    success: true,
                    annotations: [...processedAnnotations],
                    mode: result.mode || 'live'
                };
            } else {
                console.error(`Failed to load annotations for image ${imageId}:`, result.error);
                
                // Initialize empty annotation set for this image
                this.annotations.set(imageId, []);
                this.currentImageId = imageId;
                
                return {
                    success: false,
                    error: result.error || 'Failed to load annotations',
                    annotations: []
                };
            }
            
        } catch (error) {
            console.error(`Error loading annotations for image ${imageId}:`, error);
            
            // Initialize empty annotation set for this image
            this.annotations.set(imageId, []);
            this.currentImageId = imageId;
            
            return {
                success: false,
                error: error.message,
                annotations: []
            };
        }
    }

    /**
     * Process and validate loaded annotations
     * @param {Array} rawAnnotations - Raw annotation data from API
     * @param {string} imageId - Image ID for context
     * @returns {Array} - Processed and validated annotations
     */
    processLoadedAnnotations(rawAnnotations, imageId) {
        if (!Array.isArray(rawAnnotations)) {
            console.warn('Invalid annotations data: expected array');
            return [];
        }

        return rawAnnotations.map(annotation => {
            // Ensure annotation has all required properties
            const processedAnnotation = {
                id: annotation.id || this.generateAnnotationId(),
                imageId: imageId,
                bbox: this.validateBoundingBox(annotation.bbox),
                className: this.validateClassName(annotation.className),
                confidence: this.validateConfidence(annotation.confidence),
                state: this.validateState(annotation.state),
                createdAt: annotation.createdAt ? new Date(annotation.createdAt) : new Date(),
                modifiedAt: annotation.modifiedAt ? new Date(annotation.modifiedAt) : new Date(),
                segmentationMask: annotation.segmentationMask || null,
                selected: false,
                metadata: annotation.metadata || {}
            };

            return processedAnnotation;
        }).filter(annotation => annotation.bbox !== null); // Filter out invalid annotations
    }

    /**
     * Create a new annotation
     * @param {Object} bbox - Bounding box coordinates {x, y, width, height}
     * @param {string} className - Object class name
     * @param {number} confidence - Confidence score (0-1)
     * @param {Object} options - Additional options
     * @returns {Object} - Created annotation object
     */
    createAnnotation(bbox, className, confidence = 1.0, options = {}) {
        if (!this.currentImageId) {
            console.error('Cannot create annotation: no current image set');
            return null;
        }

        // Validate inputs
        const validatedBbox = this.validateBoundingBox(bbox);
        if (!validatedBbox) {
            console.error('Cannot create annotation: invalid bounding box');
            return null;
        }

        const validatedClassName = this.validateClassName(className);
        const validatedConfidence = this.validateConfidence(confidence);

        // Create annotation object
        const annotation = {
            id: options.id || this.generateAnnotationId(),
            imageId: this.currentImageId,
            bbox: validatedBbox,
            className: validatedClassName,
            confidence: validatedConfidence,
            state: options.state || 'Modified', // New annotations start as Modified
            createdAt: new Date(),
            modifiedAt: new Date(),
            segmentationMask: options.segmentationMask || null,
            selected: false,
            metadata: options.metadata || {}
        };

        // Add to current image's annotations
        const imageAnnotations = this.annotations.get(this.currentImageId) || [];
        imageAnnotations.push(annotation);
        this.annotations.set(this.currentImageId, imageAnnotations);

        // Add to history
        this.addToHistory('create', annotation);

        console.log(`Created annotation ${annotation.id} for image ${this.currentImageId}`);

        // Trigger auto-save
        this.scheduleAutoSave();

        // Notify listeners
        this.notifyAnnotationsChanged();

        return { ...annotation }; // Return copy to prevent external modification
    }

    /**
     * Update an existing annotation
     * @param {string} id - Annotation ID
     * @param {Object} changes - Changes to apply
     * @returns {boolean} - Success status
     */
    updateAnnotation(id, changes) {
        if (!id || !changes) {
            console.error('Cannot update annotation: ID and changes are required');
            return false;
        }

        const annotation = this.findAnnotationByIdInternal(id);
        if (!annotation) {
            console.error(`Cannot update annotation: annotation ${id} not found`);
            return false;
        }

        // Store original state for history
        const originalAnnotation = { ...annotation };

        // Apply changes with validation
        if (changes.bbox !== undefined) {
            const validatedBbox = this.validateBoundingBox(changes.bbox);
            if (validatedBbox) {
                annotation.bbox = validatedBbox;
            }
        }

        if (changes.className !== undefined) {
            annotation.className = this.validateClassName(changes.className);
        }

        if (changes.confidence !== undefined) {
            annotation.confidence = this.validateConfidence(changes.confidence);
        }

        if (changes.state !== undefined) {
            const newState = this.validateState(changes.state);
            if (newState !== annotation.state) {
                this.changeAnnotationState(annotation, newState);
            }
        }

        if (changes.segmentationMask !== undefined) {
            annotation.segmentationMask = changes.segmentationMask;
        }

        if (changes.metadata !== undefined) {
            annotation.metadata = { ...annotation.metadata, ...changes.metadata };
        }

        // Update modification timestamp
        annotation.modifiedAt = new Date();

        // If this is a content change (not just state), mark as Modified
        const contentChanged = changes.bbox || changes.className || changes.confidence || changes.segmentationMask;
        if (contentChanged && annotation.state === 'Suggested') {
            annotation.state = 'Modified';
        }

        // Add to history
        this.addToHistory('update', annotation, originalAnnotation);

        console.log(`Updated annotation ${id}`);

        // Trigger auto-save
        this.scheduleAutoSave();

        // Notify listeners
        this.notifyAnnotationsChanged();
        this.notifyAnnotationStateChanged(annotation);

        return true;
    }

    /**
     * Delete an annotation
     * @param {string} id - Annotation ID
     * @returns {boolean} - Success status
     */
    deleteAnnotation(id) {
        if (!id) {
            console.error('Cannot delete annotation: ID is required');
            return false;
        }

        const annotation = this.findAnnotationByIdInternal(id);
        if (!annotation) {
            console.error(`Cannot delete annotation: annotation ${id} not found`);
            return false;
        }

        const imageId = annotation.imageId;
        const imageAnnotations = this.annotations.get(imageId) || [];
        
        // Remove from annotations array
        const filteredAnnotations = imageAnnotations.filter(ann => ann.id !== id);
        this.annotations.set(imageId, filteredAnnotations);

        // Clear selection if deleted annotation was selected
        if (this.selectedAnnotation === id) {
            this.selectedAnnotation = null;
        }

        // Add to history
        this.addToHistory('delete', annotation);

        console.log(`Deleted annotation ${id}`);

        // Trigger auto-save
        this.scheduleAutoSave();

        // Notify listeners
        this.notifyAnnotationsChanged();

        return true;
    }

    /**
     * Change annotation verification state
     * @param {string|Object} annotationOrId - Annotation object or ID
     * @param {string} newState - New verification state
     * @returns {boolean} - Success status
     */
    changeState(annotationOrId, newState) {
        const annotation = typeof annotationOrId === 'string' 
            ? this.findAnnotationByIdInternal(annotationOrId)
            : annotationOrId;

        if (!annotation) {
            console.error('Cannot change state: annotation not found');
            return false;
        }

        return this.changeAnnotationState(annotation, newState);
    }

    /**
     * Internal method to change annotation state with validation
     * @param {Object} annotation - Annotation object
     * @param {string} newState - New verification state
     * @returns {boolean} - Success status
     */
    changeAnnotationState(annotation, newState) {
        const validatedState = this.validateState(newState);
        if (!validatedState) {
            console.error(`Cannot change state: invalid state ${newState}`);
            return false;
        }

        const oldState = annotation.state;
        if (oldState === validatedState) {
            console.log(`Annotation ${annotation.id} already in state ${validatedState}`);
            return true;
        }

        // Validate state transition
        if (!this.isValidStateTransition(oldState, validatedState)) {
            console.warn(`Invalid state transition from ${oldState} to ${validatedState} for annotation ${annotation.id}`);
            // Allow it anyway but log the warning
        }

        // Update state and timestamp
        annotation.state = validatedState;
        annotation.modifiedAt = new Date();

        console.log(`Changed annotation ${annotation.id} state from ${oldState} to ${validatedState}`);

        // Trigger auto-save
        this.scheduleAutoSave();

        // Notify listeners
        this.notifyAnnotationStateChanged(annotation);

        return true;
    }

    /**
     * Get annotations by verification state
     * @param {string} state - Verification state to filter by
     * @param {string} imageId - Optional image ID to filter by (defaults to current image)
     * @returns {Array} - Filtered annotations
     */
    getAnnotationsByState(state, imageId = null) {
        const targetImageId = imageId || this.currentImageId;
        if (!targetImageId) {
            return [];
        }

        const imageAnnotations = this.annotations.get(targetImageId) || [];
        return imageAnnotations.filter(annotation => annotation.state === state);
    }

    /**
     * Get all annotations for current image
     * @returns {Array} - Current image annotations
     */
    getCurrentAnnotations() {
        if (!this.currentImageId) {
            return [];
        }

        return [...(this.annotations.get(this.currentImageId) || [])];
    }

    /**
     * Get annotation counts by state for current image
     * @returns {Object} - Count object with state names as keys
     */
    getAnnotationCounts() {
        const annotations = this.getCurrentAnnotations();
        
        const counts = {
            Suggested: 0,
            Modified: 0,
            Verified: 0,
            Rejected: 0,
            total: annotations.length
        };

        annotations.forEach(annotation => {
            if (counts.hasOwnProperty(annotation.state)) {
                counts[annotation.state]++;
            }
        });

        return counts;
    }

    /**
     * Select an annotation
     * @param {string} annotationId - Annotation ID to select
     * @returns {boolean} - Success status
     */
    selectAnnotation(annotationId) {
        if (!annotationId) {
            this.clearSelection();
            return true;
        }

        const annotation = this.findAnnotationByIdInternal(annotationId);
        if (!annotation) {
            console.error(`Cannot select annotation: annotation ${annotationId} not found`);
            return false;
        }

        // Clear previous selection
        this.clearSelection();

        // Set new selection
        annotation.selected = true;
        this.selectedAnnotation = annotationId;

        console.log(`Selected annotation ${annotationId}`);

        // Notify listeners
        this.notifyAnnotationSelected(annotation);

        return true;
    }

    /**
     * Clear annotation selection
     */
    clearSelection() {
        if (this.selectedAnnotation) {
            const annotation = this.findAnnotationByIdInternal(this.selectedAnnotation);
            if (annotation) {
                annotation.selected = false;
            }
            
            console.log(`Cleared selection of annotation ${this.selectedAnnotation}`);
            this.selectedAnnotation = null;
        }
    }

    /**
     * Get currently selected annotation
     * @returns {Object|null} - Selected annotation or null
     */
    getSelectedAnnotation() {
        if (!this.selectedAnnotation) {
            return null;
        }

        return this.findAnnotationByIdInternal(this.selectedAnnotation);
    }

    /**
     * Export annotations in specified format
     * @param {string} format - Export format (yolo, pascal_voc, coco)
     * @param {string} imageId - Optional image ID (defaults to current image)
     * @param {Object} imageMetadata - Optional image metadata for proper export
     * @returns {Object} - Export result
     */
    exportAnnotations(format = 'yolo', imageId = null, imageMetadata = null) {
        const targetImageId = imageId || this.currentImageId;
        if (!targetImageId) {
            return {
                success: false,
                error: 'No image selected for export'
            };
        }

        const annotations = this.annotations.get(targetImageId) || [];
        
        try {
            let exportData;
            let filename;
            let mimeType = 'application/json';
            
            switch (format.toLowerCase()) {
                case 'yolo':
                    exportData = this.exportToYOLO(annotations, imageMetadata);
                    filename = `annotations_yolo_${targetImageId}_${Date.now()}.txt`;
                    mimeType = 'text/plain';
                    break;
                case 'pascal_voc':
                    exportData = this.exportToPascalVOC(annotations, imageMetadata);
                    filename = `annotations_voc_${targetImageId}_${Date.now()}.xml`;
                    mimeType = 'application/xml';
                    break;
                case 'coco':
                    exportData = this.exportToCOCO(annotations, imageMetadata);
                    filename = `annotations_coco_${targetImageId}_${Date.now()}.json`;
                    mimeType = 'application/json';
                    break;
                case 'json':
                    exportData = this.exportToJSON(annotations, imageMetadata);
                    filename = `annotations_${targetImageId}_${Date.now()}.json`;
                    mimeType = 'application/json';
                    break;
                default:
                    throw new Error(`Unsupported export format: ${format}`);
            }

            console.log(`Exported ${annotations.length} annotations in ${format} format`);

            return {
                success: true,
                format: format,
                data: exportData,
                filename: filename,
                mimeType: mimeType,
                annotationCount: annotations.length,
                imageId: targetImageId
            };

        } catch (error) {
            console.error(`Failed to export annotations in ${format} format:`, error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Export all annotations for all images
     * @param {string} format - Export format
     * @returns {Object} - Export result with all images
     */
    exportAllAnnotations(format = 'json') {
        try {
            const allExports = {};
            let totalAnnotations = 0;

            for (const [imageId, annotations] of this.annotations.entries()) {
                if (annotations.length > 0) {
                    const exportResult = this.exportAnnotations(format, imageId);
                    if (exportResult.success) {
                        allExports[imageId] = exportResult.data;
                        totalAnnotations += annotations.length;
                    }
                }
            }

            const filename = `all_annotations_${format}_${Date.now()}.json`;
            
            return {
                success: true,
                format: format,
                data: allExports,
                filename: filename,
                mimeType: 'application/json',
                annotationCount: totalAnnotations,
                imageCount: Object.keys(allExports).length
            };

        } catch (error) {
            console.error('Failed to export all annotations:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Save annotations to API or local storage
     * @param {boolean} force - Force save even if no changes
     * @returns {Promise<Object>} - Save result
     */
    async saveAnnotations(force = false) {
        if (!this.currentImageId) {
            return {
                success: false,
                error: 'No current image to save annotations for'
            };
        }

        const annotations = this.getCurrentAnnotations();
        
        console.log(`Saving ${annotations.length} annotations for image ${this.currentImageId}`);

        try {
            const savePromises = annotations.map(annotation => 
                apiClient.saveAnnotation(annotation)
            );

            const results = await Promise.allSettled(savePromises);
            
            let successCount = 0;
            let errorCount = 0;
            const errors = [];

            results.forEach((result, index) => {
                if (result.status === 'fulfilled' && result.value.success) {
                    successCount++;
                } else {
                    errorCount++;
                    const error = result.status === 'rejected' 
                        ? result.reason 
                        : result.value.error || 'Unknown error';
                    errors.push(`Annotation ${annotations[index].id}: ${error}`);
                }
            });

            const saveResult = {
                success: errorCount === 0,
                savedCount: successCount,
                errorCount: errorCount,
                errors: errors,
                message: errorCount === 0 
                    ? `Successfully saved ${successCount} annotations`
                    : `Saved ${successCount} annotations, ${errorCount} failed`
            };

            // Always save to local storage as backup
            await this.saveToLocalStorage();

            // Notify listeners
            if (saveResult.success) {
                this.notifySaveComplete(saveResult);
            } else {
                this.notifySaveError(saveResult);
            }

            return saveResult;

        } catch (error) {
            console.error('Failed to save annotations:', error);
            
            // Try to save to local storage as fallback
            try {
                await this.saveToLocalStorage();
                console.log('Saved to local storage as fallback');
            } catch (localError) {
                console.error('Failed to save to local storage:', localError);
            }
            
            const saveResult = {
                success: false,
                error: error.message,
                message: 'Failed to save annotations'
            };

            this.notifySaveError(saveResult);
            return saveResult;
        }
    }

    /**
     * Manual save functionality as backup
     * @returns {Promise<Object>} - Save result
     */
    async manualSave() {
        console.log('Manual save requested');
        
        try {
            // Save to local storage
            const localSaveResult = await this.saveToLocalStorage();
            
            // Also try to save to API
            const apiSaveResult = await this.saveAnnotations(true);
            
            return {
                success: true,
                message: 'Manual save completed',
                localSave: localSaveResult,
                apiSave: apiSaveResult
            };
            
        } catch (error) {
            console.error('Manual save failed:', error);
            return {
                success: false,
                error: error.message,
                message: 'Manual save failed'
            };
        }
    }

    /**
     * Save annotations to local storage
     * @returns {Promise<Object>} - Save result
     */
    async saveToLocalStorage() {
        try {
            const storageData = {
                annotations: {},
                history: this.annotationHistory,
                timestamp: new Date().toISOString(),
                version: '1.0'
            };

            // Convert Map to plain object for storage
            for (const [imageId, annotations] of this.annotations.entries()) {
                storageData.annotations[imageId] = annotations;
            }

            const dataString = JSON.stringify(storageData);
            localStorage.setItem('ima_annotations', dataString);
            
            console.log(`Saved ${Object.keys(storageData.annotations).length} image annotations to local storage`);
            
            return {
                success: true,
                message: 'Saved to local storage',
                imageCount: Object.keys(storageData.annotations).length,
                historyCount: this.annotationHistory.length
            };
            
        } catch (error) {
            console.error('Failed to save to local storage:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Load annotations from local storage
     * @returns {Promise<Object>} - Load result
     */
    async loadFromLocalStorage() {
        try {
            const dataString = localStorage.getItem('ima_annotations');
            if (!dataString) {
                return {
                    success: false,
                    error: 'No data found in local storage'
                };
            }

            const storageData = JSON.parse(dataString);
            
            // Validate data structure
            if (!storageData.annotations || !storageData.history) {
                throw new Error('Invalid data structure in local storage');
            }

            // Clear current data
            this.annotations.clear();
            this.annotationHistory = [];

            // Load annotations
            for (const [imageId, annotations] of Object.entries(storageData.annotations)) {
                this.annotations.set(imageId, annotations);
            }

            // Load history
            this.annotationHistory = storageData.history || [];

            console.log(`Loaded ${Object.keys(storageData.annotations).length} image annotations from local storage`);
            
            return {
                success: true,
                message: 'Loaded from local storage',
                imageCount: Object.keys(storageData.annotations).length,
                historyCount: this.annotationHistory.length,
                timestamp: storageData.timestamp
            };
            
        } catch (error) {
            console.error('Failed to load from local storage:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Clear local storage data
     * @returns {boolean} - Success status
     */
    clearLocalStorage() {
        try {
            localStorage.removeItem('ima_annotations');
            console.log('Cleared local storage data');
            return true;
        } catch (error) {
            console.error('Failed to clear local storage:', error);
            return false;
        }
    }

    /**
     * Schedule auto-save with debouncing
     */
    scheduleAutoSave() {
        if (!this.autoSaveEnabled) {
            return;
        }

        // Clear existing timeout
        if (this.autoSaveTimeout) {
            clearTimeout(this.autoSaveTimeout);
        }

        // Schedule new auto-save
        this.autoSaveTimeout = setTimeout(async () => {
            try {
                await this.saveAnnotations();
                console.log('Auto-save completed');
            } catch (error) {
                console.error('Auto-save failed:', error);
            }
        }, this.autoSaveDelay);
    }

    /**
     * Validation methods
     */
    validateBoundingBox(bbox) {
        if (!bbox || typeof bbox !== 'object') {
            return null;
        }

        const { x, y, width, height } = bbox;
        
        if (typeof x !== 'number' || typeof y !== 'number' || 
            typeof width !== 'number' || typeof height !== 'number') {
            return null;
        }

        if (width <= 0 || height <= 0) {
            return null;
        }

        return {
            x: Math.max(0, x),
            y: Math.max(0, y),
            width: Math.max(CONFIG.DRAWING.MIN_BOX_SIZE, width),
            height: Math.max(CONFIG.DRAWING.MIN_BOX_SIZE, height)
        };
    }

    validateClassName(className) {
        if (!className || typeof className !== 'string') {
            return 'Other';
        }

        // Check if class exists in FHWA classification
        const validClasses = Object.keys(CONFIG.ANNOTATION_COLORS);
        return validClasses.includes(className) ? className : 'Other';
    }

    validateConfidence(confidence) {
        if (typeof confidence !== 'number') {
            return 1.0;
        }

        return Math.max(0, Math.min(1, confidence));
    }

    validateState(state) {
        if (!state || typeof state !== 'string') {
            return 'Suggested';
        }

        const validStates = Object.keys(CONFIG.STATE_COLORS);
        return validStates.includes(state) ? state : 'Suggested';
    }

    /**
     * Check if state transition is valid
     * @param {string} fromState - Current state
     * @param {string} toState - Target state
     * @returns {boolean} - Whether transition is valid
     */
    isValidStateTransition(fromState, toState) {
        // Define valid state transitions
        const validTransitions = {
            'Suggested': ['Modified', 'Verified', 'Rejected'],
            'Modified': ['Verified', 'Rejected', 'Suggested'],
            'Verified': ['Modified', 'Rejected'],
            'Rejected': ['Modified', 'Verified', 'Suggested']
        };

        return validTransitions[fromState]?.includes(toState) || false;
    }

    /**
     * Find annotation by ID (public method)
     * @param {string} id - Annotation ID
     * @returns {Object|null} - Annotation object or null
     */
    findAnnotationById(id) {
        return this.findAnnotationByIdInternal(id);
    }

    /**
     * Utility methods
     */
    generateAnnotationId() {
        return 'ann_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    findAnnotationByIdInternal(id) {
        if (!this.currentImageId) {
            return null;
        }

        const imageAnnotations = this.annotations.get(this.currentImageId) || [];
        return imageAnnotations.find(annotation => annotation.id === id) || null;
    }

    /**
     * History management
     */
    addToHistory(action, annotation, originalAnnotation = null) {
        const historyEntry = {
            id: this.generateHistoryId(),
            timestamp: new Date(),
            action: action,
            annotation: { ...annotation },
            originalAnnotation: originalAnnotation ? { ...originalAnnotation } : null,
            imageId: this.currentImageId,
            sessionId: this.getSessionId()
        };

        this.annotationHistory.push(historyEntry);

        // Limit history size
        if (this.annotationHistory.length > this.maxHistorySize) {
            this.annotationHistory.shift();
        }

        // Save history to local storage periodically
        this.saveHistoryToLocalStorage();
    }

    getHistory(imageId = null, limit = null) {
        let history = [...this.annotationHistory];
        
        // Filter by image ID if specified
        if (imageId) {
            history = history.filter(entry => entry.imageId === imageId);
        }
        
        // Limit results if specified
        if (limit && limit > 0) {
            history = history.slice(-limit);
        }
        
        return history;
    }

    /**
     * Get history statistics
     * @returns {Object} - History statistics
     */
    getHistoryStats() {
        const stats = {
            totalEntries: this.annotationHistory.length,
            actionCounts: {},
            imageStats: {},
            sessionStats: {},
            timeRange: null
        };

        if (this.annotationHistory.length === 0) {
            return stats;
        }

        // Count actions
        this.annotationHistory.forEach(entry => {
            stats.actionCounts[entry.action] = (stats.actionCounts[entry.action] || 0) + 1;
            
            // Count per image
            if (!stats.imageStats[entry.imageId]) {
                stats.imageStats[entry.imageId] = { total: 0, actions: {} };
            }
            stats.imageStats[entry.imageId].total++;
            stats.imageStats[entry.imageId].actions[entry.action] = 
                (stats.imageStats[entry.imageId].actions[entry.action] || 0) + 1;
            
            // Count per session
            if (entry.sessionId) {
                if (!stats.sessionStats[entry.sessionId]) {
                    stats.sessionStats[entry.sessionId] = { total: 0, actions: {} };
                }
                stats.sessionStats[entry.sessionId].total++;
                stats.sessionStats[entry.sessionId].actions[entry.action] = 
                    (stats.sessionStats[entry.sessionId].actions[entry.action] || 0) + 1;
            }
        });

        // Calculate time range
        const timestamps = this.annotationHistory.map(entry => entry.timestamp);
        stats.timeRange = {
            start: new Date(Math.min(...timestamps)),
            end: new Date(Math.max(...timestamps))
        };

        return stats;
    }

    /**
     * Export history to file
     * @param {string} format - Export format (json, csv)
     * @returns {Object} - Export result
     */
    exportHistory(format = 'json') {
        try {
            let exportData;
            let filename;
            let mimeType;

            switch (format.toLowerCase()) {
                case 'json':
                    exportData = JSON.stringify({
                        history: this.annotationHistory,
                        stats: this.getHistoryStats(),
                        exportedAt: new Date().toISOString()
                    }, null, 2);
                    filename = `annotation_history_${Date.now()}.json`;
                    mimeType = 'application/json';
                    break;
                    
                case 'csv':
                    exportData = this.historyToCSV();
                    filename = `annotation_history_${Date.now()}.csv`;
                    mimeType = 'text/csv';
                    break;
                    
                default:
                    throw new Error(`Unsupported history export format: ${format}`);
            }

            return {
                success: true,
                format: format,
                data: exportData,
                filename: filename,
                mimeType: mimeType,
                entryCount: this.annotationHistory.length
            };

        } catch (error) {
            console.error('Failed to export history:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Convert history to CSV format
     * @returns {string} - CSV data
     */
    historyToCSV() {
        const headers = [
            'ID', 'Timestamp', 'Action', 'Image ID', 'Annotation ID', 
            'Class Name', 'Confidence', 'State', 'Session ID'
        ];
        
        const rows = this.annotationHistory.map(entry => [
            entry.id,
            entry.timestamp.toISOString(),
            entry.action,
            entry.imageId,
            entry.annotation.id,
            entry.annotation.className,
            entry.annotation.confidence,
            entry.annotation.state,
            entry.sessionId || ''
        ]);

        return [headers, ...rows]
            .map(row => row.map(cell => `"${cell}"`).join(','))
            .join('\n');
    }

    /**
     * Save history to local storage
     */
    saveHistoryToLocalStorage() {
        try {
            const historyData = {
                history: this.annotationHistory,
                timestamp: new Date().toISOString()
            };
            
            localStorage.setItem('ima_annotation_history', JSON.stringify(historyData));
        } catch (error) {
            console.error('Failed to save history to local storage:', error);
        }
    }

    /**
     * Load history from local storage
     */
    loadHistoryFromLocalStorage() {
        try {
            const dataString = localStorage.getItem('ima_annotation_history');
            if (dataString) {
                const historyData = JSON.parse(dataString);
                this.annotationHistory = historyData.history || [];
                console.log(`Loaded ${this.annotationHistory.length} history entries from local storage`);
            }
        } catch (error) {
            console.error('Failed to load history from local storage:', error);
            this.annotationHistory = [];
        }
    }

    /**
     * Clear history
     * @param {string} imageId - Optional image ID to clear history for specific image
     */
    clearHistory(imageId = null) {
        if (imageId) {
            this.annotationHistory = this.annotationHistory.filter(entry => entry.imageId !== imageId);
            console.log(`Cleared history for image ${imageId}`);
        } else {
            this.annotationHistory = [];
            console.log('Cleared all history');
        }
        
        this.saveHistoryToLocalStorage();
    }

    /**
     * Generate unique history ID
     */
    generateHistoryId() {
        return 'hist_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Get or create session ID
     */
    getSessionId() {
        if (!this.sessionId) {
            this.sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        }
        return this.sessionId;
    }

    /**
     * Export format implementations
     */
    exportToYOLO(annotations, imageMetadata = null) {
        // YOLO format: class_id center_x center_y width height (normalized 0-1)
        const imageWidth = imageMetadata?.width || 1;
        const imageHeight = imageMetadata?.height || 1;
        
        const yoloLines = annotations
            .filter(annotation => annotation.state !== 'Rejected')
            .map(annotation => {
                const classId = this.getClassIdForYOLO(annotation.className);
                const bbox = annotation.bbox;
                
                // Convert to YOLO format (normalized center coordinates)
                const centerX = (bbox.x + bbox.width / 2) / imageWidth;
                const centerY = (bbox.y + bbox.height / 2) / imageHeight;
                const width = bbox.width / imageWidth;
                const height = bbox.height / imageHeight;
                
                return `${classId} ${centerX.toFixed(6)} ${centerY.toFixed(6)} ${width.toFixed(6)} ${height.toFixed(6)}`;
            });
        
        return yoloLines.join('\n');
    }

    exportToPascalVOC(annotations, imageMetadata = null) {
        // Pascal VOC XML format
        const imageWidth = imageMetadata?.width || 1;
        const imageHeight = imageMetadata?.height || 1;
        const imageName = imageMetadata?.filename || 'unknown.jpg';
        
        const validAnnotations = annotations.filter(annotation => annotation.state !== 'Rejected');
        
        const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<annotation>
    <folder>images</folder>
    <filename>${imageName}</filename>
    <path>${imageName}</path>
    <source>
        <database>IMA Annotate</database>
    </source>
    <size>
        <width>${imageWidth}</width>
        <height>${imageHeight}</height>
        <depth>3</depth>
    </size>
    <segmented>0</segmented>
${validAnnotations.map(annotation => `    <object>
        <name>${annotation.className}</name>
        <pose>Unspecified</pose>
        <truncated>0</truncated>
        <difficult>${annotation.state === 'Modified' ? 1 : 0}</difficult>
        <bndbox>
            <xmin>${Math.round(annotation.bbox.x)}</xmin>
            <ymin>${Math.round(annotation.bbox.y)}</ymin>
            <xmax>${Math.round(annotation.bbox.x + annotation.bbox.width)}</xmax>
            <ymax>${Math.round(annotation.bbox.y + annotation.bbox.height)}</ymax>
        </bndbox>
        <confidence>${annotation.confidence}</confidence>
    </object>`).join('\n')}
</annotation>`;
        
        return xmlContent;
    }

    exportToCOCO(annotations, imageMetadata = null) {
        // COCO format structure
        const imageWidth = imageMetadata?.width || 1;
        const imageHeight = imageMetadata?.height || 1;
        const imageId = imageMetadata?.id || 1;
        const imageName = imageMetadata?.filename || 'unknown.jpg';
        
        const validAnnotations = annotations.filter(annotation => annotation.state !== 'Rejected');
        
        const categories = Object.keys(CONFIG.ANNOTATION_COLORS).map((className, index) => ({
            id: index + 1,
            name: className,
            supercategory: 'vehicle'
        }));
        
        const cocoAnnotations = validAnnotations.map((annotation, index) => ({
            id: index + 1,
            image_id: imageId,
            category_id: this.getCategoryIdForCOCO(annotation.className),
            bbox: [
                annotation.bbox.x,
                annotation.bbox.y,
                annotation.bbox.width,
                annotation.bbox.height
            ],
            area: annotation.bbox.width * annotation.bbox.height,
            iscrowd: 0,
            score: annotation.confidence,
            attributes: {
                state: annotation.state,
                created_at: annotation.createdAt,
                modified_at: annotation.modifiedAt
            }
        }));
        
        return {
            info: {
                description: "IMA Annotate Export",
                version: "1.0",
                year: new Date().getFullYear(),
                contributor: "IMA Annotate Frontend",
                date_created: new Date().toISOString()
            },
            licenses: [{
                id: 1,
                name: "Unknown",
                url: ""
            }],
            images: [{
                id: imageId,
                width: imageWidth,
                height: imageHeight,
                file_name: imageName,
                license: 1,
                flickr_url: "",
                coco_url: "",
                date_captured: new Date().toISOString()
            }],
            annotations: cocoAnnotations,
            categories: categories
        };
    }

    exportToJSON(annotations, imageMetadata = null) {
        // Custom JSON format with full annotation data
        return {
            metadata: {
                imageId: this.currentImageId,
                imageMetadata: imageMetadata,
                exportedAt: new Date().toISOString(),
                exportedBy: "IMA Annotate Frontend",
                version: "1.0"
            },
            annotations: annotations.map(annotation => ({
                ...annotation,
                // Convert dates to ISO strings for JSON serialization
                createdAt: annotation.createdAt.toISOString(),
                modifiedAt: annotation.modifiedAt.toISOString()
            })),
            summary: {
                total: annotations.length,
                byState: this.getAnnotationCounts(),
                byClass: this.getAnnotationCountsByClass(annotations)
            }
        };
    }

    /**
     * Get annotation counts by class
     * @param {Array} annotations - Annotations to count
     * @returns {Object} - Count by class
     */
    getAnnotationCountsByClass(annotations) {
        const counts = {};
        annotations.forEach(annotation => {
            counts[annotation.className] = (counts[annotation.className] || 0) + 1;
        });
        return counts;
    }

    getClassIdForYOLO(className) {
        const classes = Object.keys(CONFIG.ANNOTATION_COLORS);
        return classes.indexOf(className);
    }

    getCategoryIdForCOCO(className) {
        const classes = Object.keys(CONFIG.ANNOTATION_COLORS);
        return classes.indexOf(className) + 1; // COCO IDs start from 1
    }

    /**
     * Event notification methods
     */
    notifyAnnotationsChanged() {
        if (this.onAnnotationsChanged) {
            this.onAnnotationsChanged(this.getCurrentAnnotations());
        }
    }

    notifyAnnotationSelected(annotation) {
        if (this.onAnnotationSelected) {
            this.onAnnotationSelected(annotation);
        }
    }

    notifyAnnotationStateChanged(annotation) {
        if (this.onAnnotationStateChanged) {
            this.onAnnotationStateChanged(annotation);
        }
    }

    notifySaveComplete(result) {
        if (this.onSaveComplete) {
            this.onSaveComplete(result);
        }
    }

    notifySaveError(result) {
        if (this.onSaveError) {
            this.onSaveError(result);
        }
    }

    /**
     * Event callback setters
     */
    setOnAnnotationsChanged(callback) {
        this.onAnnotationsChanged = callback;
    }

    setOnAnnotationSelected(callback) {
        this.onAnnotationSelected = callback;
    }

    setOnAnnotationStateChanged(callback) {
        this.onAnnotationStateChanged = callback;
    }

    setOnSaveComplete(callback) {
        this.onSaveComplete = callback;
    }

    setOnSaveError(callback) {
        this.onSaveError = callback;
    }

    /**
     * Configuration methods
     */
    setAutoSaveEnabled(enabled) {
        this.autoSaveEnabled = enabled;
        console.log(`Auto-save ${enabled ? 'enabled' : 'disabled'}`);
    }

    setAutoSaveDelay(delay) {
        this.autoSaveDelay = Math.max(500, delay); // Minimum 500ms delay
        console.log(`Auto-save delay set to ${this.autoSaveDelay}ms`);
    }

    /**
     * Cleanup and destroy
     */
    destroy() {
        // Clear auto-save timeout
        if (this.autoSaveTimeout) {
            clearTimeout(this.autoSaveTimeout);
            this.autoSaveTimeout = null;
        }

        // Clear data
        this.annotations.clear();
        this.annotationHistory = [];
        this.selectedAnnotation = null;
        this.currentImageId = null;

        // Clear callbacks
        this.onAnnotationsChanged = null;
        this.onAnnotationSelected = null;
        this.onAnnotationStateChanged = null;
        this.onSaveComplete = null;
        this.onSaveError = null;

        console.log('AnnotationManager destroyed');
    }
}

// Export singleton instance
export const annotationManager = new AnnotationManager();