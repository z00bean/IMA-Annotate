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
     * @returns {Object} - Export result
     */
    exportAnnotations(format = 'yolo', imageId = null) {
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
            
            switch (format.toLowerCase()) {
                case 'yolo':
                    exportData = this.exportToYOLO(annotations);
                    break;
                case 'pascal_voc':
                    exportData = this.exportToPascalVOC(annotations);
                    break;
                case 'coco':
                    exportData = this.exportToCOCO(annotations);
                    break;
                default:
                    throw new Error(`Unsupported export format: ${format}`);
            }

            console.log(`Exported ${annotations.length} annotations in ${format} format`);

            return {
                success: true,
                format: format,
                data: exportData,
                annotationCount: annotations.length
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

            // Notify listeners
            if (saveResult.success) {
                this.notifySaveComplete(saveResult);
            } else {
                this.notifySaveError(saveResult);
            }

            return saveResult;

        } catch (error) {
            console.error('Failed to save annotations:', error);
            
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
            timestamp: new Date(),
            action: action,
            annotation: { ...annotation },
            originalAnnotation: originalAnnotation ? { ...originalAnnotation } : null,
            imageId: this.currentImageId
        };

        this.annotationHistory.push(historyEntry);

        // Limit history size
        if (this.annotationHistory.length > this.maxHistorySize) {
            this.annotationHistory.shift();
        }
    }

    getHistory() {
        return [...this.annotationHistory];
    }

    /**
     * Export format implementations
     */
    exportToYOLO(annotations) {
        // YOLO format: class_id center_x center_y width height (normalized)
        return annotations.map(annotation => {
            const classId = this.getClassIdForYOLO(annotation.className);
            // Note: This assumes image dimensions are available - would need to be passed in
            // For now, return raw format that can be normalized later
            return {
                class_id: classId,
                bbox: annotation.bbox,
                confidence: annotation.confidence
            };
        });
    }

    exportToPascalVOC(annotations) {
        // Pascal VOC XML format structure
        return {
            annotations: annotations.map(annotation => ({
                name: annotation.className,
                bndbox: {
                    xmin: annotation.bbox.x,
                    ymin: annotation.bbox.y,
                    xmax: annotation.bbox.x + annotation.bbox.width,
                    ymax: annotation.bbox.y + annotation.bbox.height
                },
                confidence: annotation.confidence,
                difficult: annotation.state === 'Rejected' ? 1 : 0
            }))
        };
    }

    exportToCOCO(annotations) {
        // COCO format structure
        return {
            annotations: annotations.map((annotation, index) => ({
                id: index + 1,
                image_id: 1, // Would need actual image ID
                category_id: this.getCategoryIdForCOCO(annotation.className),
                bbox: [
                    annotation.bbox.x,
                    annotation.bbox.y,
                    annotation.bbox.width,
                    annotation.bbox.height
                ],
                area: annotation.bbox.width * annotation.bbox.height,
                iscrowd: 0,
                score: annotation.confidence
            }))
        };
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