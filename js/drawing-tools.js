/**
 * Drawing Tools Module for IMA Annotate Frontend
 * Handles interactive drawing, annotation creation, and manipulation
 */

import { CONFIG, getClassColor, getStateColor } from '../config.js';
import { annotationManager } from './annotation-manager.js';
import { roiManager } from './roi-manager.js';

/**
 * DrawingTools Class
 * Manages interactive drawing operations including bounding box creation,
 * annotation selection, resizing, moving, and deletion
 */
export class DrawingTools {
    constructor(canvas, canvasRenderer) {
        this.canvas = canvas;
        this.canvasRenderer = canvasRenderer;
        
        // Drawing state
        this.isDrawing = false;
        this.isResizing = false;
        this.isMoving = false;
        this.drawingMode = false;
        this.roiMode = false;
        
        // Current operation state
        this.startPoint = null;
        this.currentPoint = null;
        this.selectedAnnotation = null;
        this.resizeHandle = null;
        this.moveOffset = null;
        
        // Drawing preview
        this.previewBox = null;
        
        // ROI drawing state
        this.roiPoints = [];
        this.isDrawingROI = false;
        
        // Event handlers (bound to preserve 'this' context)
        this.handleMouseDown = this.handleMouseDown.bind(this);
        this.handleMouseMove = this.handleMouseMove.bind(this);
        this.handleMouseUp = this.handleMouseUp.bind(this);
        this.handleTouchStart = this.handleTouchStart.bind(this);
        this.handleTouchMove = this.handleTouchMove.bind(this);
        this.handleTouchEnd = this.handleTouchEnd.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);
        
        // Initialize event listeners
        this.setupEventListeners();
        
        console.log('DrawingTools initialized');
    }

    /**
     * Set up event listeners for mouse and touch interactions
     */
    setupEventListeners() {
        // Mouse events
        this.canvas.addEventListener('mousedown', this.handleMouseDown);
        this.canvas.addEventListener('mousemove', this.handleMouseMove);
        this.canvas.addEventListener('mouseup', this.handleMouseUp);
        this.canvas.addEventListener('mouseleave', this.handleMouseUp); // Treat as mouse up
        this.canvas.addEventListener('dblclick', this.handleDoubleClick.bind(this));
        this.canvas.addEventListener('contextmenu', this.handleContextMenu.bind(this));
        
        // Touch events for mobile support
        this.canvas.addEventListener('touchstart', this.handleTouchStart, { passive: false });
        this.canvas.addEventListener('touchmove', this.handleTouchMove, { passive: false });
        this.canvas.addEventListener('touchend', this.handleTouchEnd, { passive: false });
        
        // Keyboard events for deletion
        document.addEventListener('keydown', this.handleKeyDown);
        
        console.log('Drawing tools event listeners set up');
    }

    /**
     * Enable drawing mode
     */
    enableDrawMode() {
        this.drawingMode = true;
        this.canvas.style.cursor = 'crosshair';
        console.log('Drawing mode enabled');
    }

    /**
     * Disable drawing mode
     */
    disableDrawMode() {
        this.drawingMode = false;
        this.canvas.style.cursor = 'default';
        
        // Cancel any ongoing operations
        this.cancelCurrentOperation();
        
        console.log('Drawing mode disabled');
    }

    /**
     * Enable ROI drawing mode
     */
    enableROIMode() {
        this.roiMode = true;
        this.drawingMode = false;
        this.canvas.style.cursor = 'crosshair';
        
        // Cancel any ongoing operations
        this.cancelCurrentOperation();
        
        console.log('ROI drawing mode enabled');
    }

    /**
     * Disable ROI drawing mode
     */
    disableROIMode() {
        this.roiMode = false;
        this.canvas.style.cursor = 'default';
        
        // Cancel any ongoing ROI drawing
        this.cancelROIDrawing();
        
        console.log('ROI drawing mode disabled');
    }

    /**
     * Handle mouse down events
     */
    handleMouseDown(event) {
        event.preventDefault();
        
        const canvasCoords = this.canvasRenderer.getCanvasCoordinates(event.clientX, event.clientY);
        
        // Check if point is within image bounds
        if (!this.canvasRenderer.isPointInImage(canvasCoords.x, canvasCoords.y)) {
            return;
        }
        
        if (this.drawingMode) {
            this.startDrawing(canvasCoords.x, canvasCoords.y);
        } else if (this.roiMode) {
            this.handleROIClick(canvasCoords.x, canvasCoords.y);
        } else {
            this.handleSelectionInteraction(canvasCoords.x, canvasCoords.y);
        }
    }

    /**
     * Handle mouse move events
     */
    handleMouseMove(event) {
        event.preventDefault();
        
        const canvasCoords = this.canvasRenderer.getCanvasCoordinates(event.clientX, event.clientY);
        
        if (this.isDrawing) {
            this.updateDrawing(canvasCoords.x, canvasCoords.y);
        } else if (this.isDrawingROI) {
            this.updateROIPreview(canvasCoords.x, canvasCoords.y);
        } else if (this.isResizing) {
            this.updateResize(canvasCoords.x, canvasCoords.y);
        } else if (this.isMoving) {
            this.updateMove(canvasCoords.x, canvasCoords.y);
        } else {
            this.updateCursor(canvasCoords.x, canvasCoords.y);
        }
    }

    /**
     * Handle mouse up events
     */
    handleMouseUp(event) {
        if (this.isDrawing) {
            this.finishDrawing();
        } else if (this.isResizing) {
            this.finishResize();
        } else if (this.isMoving) {
            this.finishMove();
        }
    }

    /**
     * Handle touch start events
     */
    handleTouchStart(event) {
        event.preventDefault();
        
        if (event.touches.length === 1) {
            const touch = event.touches[0];
            const mouseEvent = new MouseEvent('mousedown', {
                clientX: touch.clientX,
                clientY: touch.clientY
            });
            this.handleMouseDown(mouseEvent);
        }
    }

    /**
     * Handle touch move events
     */
    handleTouchMove(event) {
        event.preventDefault();
        
        if (event.touches.length === 1) {
            const touch = event.touches[0];
            const mouseEvent = new MouseEvent('mousemove', {
                clientX: touch.clientX,
                clientY: touch.clientY
            });
            this.handleMouseMove(mouseEvent);
        }
    }

    /**
     * Handle touch end events
     */
    handleTouchEnd(event) {
        event.preventDefault();
        
        const mouseEvent = new MouseEvent('mouseup', {});
        this.handleMouseUp(mouseEvent);
    }

    /**
     * Handle double click events for annotation editing
     */
    handleDoubleClick(event) {
        event.preventDefault();
        
        const canvasCoords = this.canvasRenderer.getCanvasCoordinates(event.clientX, event.clientY);
        const annotation = this.canvasRenderer.getAnnotationAtPoint(canvasCoords.x, canvasCoords.y);
        
        if (annotation) {
            this.showClassAssignmentUI(annotation.id);
        }
    }

    /**
     * Handle context menu (right-click) events
     */
    handleContextMenu(event) {
        event.preventDefault();
        
        const canvasCoords = this.canvasRenderer.getCanvasCoordinates(event.clientX, event.clientY);
        const annotation = this.canvasRenderer.getAnnotationAtPoint(canvasCoords.x, canvasCoords.y);
        
        if (annotation) {
            this.showContextMenu(event.clientX, event.clientY, annotation);
        } else {
            this.hideContextMenu();
        }
    }

    /**
     * Show context menu for annotation
     */
    showContextMenu(x, y, annotation) {
        // Remove existing context menu
        this.hideContextMenu();
        
        const contextMenuHTML = `
            <div id="annotation-context-menu" class="context-menu" style="position: fixed; left: ${x}px; top: ${y}px; z-index: 1050;">
                <div class="dropdown-menu show">
                    <h6 class="dropdown-header">${annotation.className} (${annotation.state})</h6>
                    <button class="dropdown-item" type="button" data-action="edit">
                        <i class="bi bi-pencil"></i> Edit Annotation
                    </button>
                    <div class="dropdown-divider"></div>
                    <h6 class="dropdown-header">Change State</h6>
                    <button class="dropdown-item" type="button" data-action="verify">
                        <i class="bi bi-check-circle"></i> Verify
                    </button>
                    <button class="dropdown-item" type="button" data-action="reject">
                        <i class="bi bi-x-circle"></i> Reject
                    </button>
                    <div class="dropdown-divider"></div>
                    <button class="dropdown-item text-danger" type="button" data-action="delete">
                        <i class="bi bi-trash"></i> Delete
                    </button>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', contextMenuHTML);
        
        const contextMenu = document.getElementById('annotation-context-menu');
        
        // Add event listeners
        contextMenu.addEventListener('click', (e) => {
            const action = e.target.closest('[data-action]')?.dataset.action;
            
            switch (action) {
                case 'edit':
                    this.showClassAssignmentUI(annotation.id);
                    break;
                case 'verify':
                    this.setAnnotationState(annotation.id, 'Verified');
                    break;
                case 'reject':
                    this.setAnnotationState(annotation.id, 'Rejected');
                    break;
                case 'delete':
                    if (confirm('Are you sure you want to delete this annotation?')) {
                        annotationManager.deleteAnnotation(annotation.id);
                    }
                    break;
            }
            
            this.hideContextMenu();
        });
        
        // Hide context menu when clicking elsewhere
        document.addEventListener('click', this.hideContextMenu.bind(this), { once: true });
    }

    /**
     * Hide context menu
     */
    hideContextMenu() {
        const contextMenu = document.getElementById('annotation-context-menu');
        if (contextMenu) {
            contextMenu.remove();
        }
    }
    handleKeyDown(event) {
        // Only handle keys when canvas has focus or annotation is selected
        if (document.activeElement !== this.canvas && !this.selectedAnnotation) {
            return;
        }
        
        switch (event.code) {
            case CONFIG.KEYBOARD_SHORTCUTS.DELETE:
                event.preventDefault();
                this.deleteSelectedAnnotation();
                break;
                
            case CONFIG.KEYBOARD_SHORTCUTS.ESCAPE:
                event.preventDefault();
                this.cancelCurrentOperation();
                break;
                
            // Quick state change shortcuts
            case 'KeyV':
                if (event.ctrlKey && this.selectedAnnotation) {
                    event.preventDefault();
                    this.setAnnotationState(this.selectedAnnotation.id, 'Verified');
                }
                break;
                
            case 'KeyR':
                if (event.ctrlKey && this.selectedAnnotation) {
                    event.preventDefault();
                    this.setAnnotationState(this.selectedAnnotation.id, 'Rejected');
                }
                break;
                
            case 'KeyM':
                if (event.ctrlKey && this.selectedAnnotation) {
                    event.preventDefault();
                    this.setAnnotationState(this.selectedAnnotation.id, 'Modified');
                }
                break;
                
            case 'KeyE':
                if (event.ctrlKey && this.selectedAnnotation) {
                    event.preventDefault();
                    this.showClassAssignmentUI(this.selectedAnnotation.id);
                }
                break;
                
            case CONFIG.KEYBOARD_SHORTCUTS.ROI_MODE:
                event.preventDefault();
                if (this.roiMode) {
                    this.disableROIMode();
                } else {
                    this.enableROIMode();
                }
                break;
        }
    }

    /**
     * Start drawing a new bounding box
     */
    startDrawing(x, y) {
        if (!this.drawingMode) return;
        
        this.isDrawing = true;
        this.startPoint = { x, y };
        this.currentPoint = { x, y };
        
        // Create preview box
        this.previewBox = {
            x: Math.min(this.startPoint.x, this.currentPoint.x),
            y: Math.min(this.startPoint.y, this.currentPoint.y),
            width: Math.abs(this.currentPoint.x - this.startPoint.x),
            height: Math.abs(this.currentPoint.y - this.startPoint.y)
        };
        
        console.log(`Started drawing at (${x.toFixed(1)}, ${y.toFixed(1)})`);
    }

    /**
     * Update drawing preview
     */
    updateDrawing(x, y) {
        if (!this.isDrawing || !this.startPoint) return;
        
        this.currentPoint = { x, y };
        
        // Update preview box
        this.previewBox = {
            x: Math.min(this.startPoint.x, this.currentPoint.x),
            y: Math.min(this.startPoint.y, this.currentPoint.y),
            width: Math.abs(this.currentPoint.x - this.startPoint.x),
            height: Math.abs(this.currentPoint.y - this.startPoint.y)
        };
        
        // Redraw canvas with preview
        this.redrawWithPreview();
    }

    /**
     * Finish drawing and create annotation
     */
    finishDrawing() {
        if (!this.isDrawing || !this.startPoint || !this.currentPoint) {
            this.cancelCurrentOperation();
            return;
        }
        
        // Calculate final bounding box in canvas coordinates
        const canvasBox = {
            x: Math.min(this.startPoint.x, this.currentPoint.x),
            y: Math.min(this.startPoint.y, this.currentPoint.y),
            width: Math.abs(this.currentPoint.x - this.startPoint.x),
            height: Math.abs(this.currentPoint.y - this.startPoint.y)
        };
        
        // Check minimum size
        if (canvasBox.width < CONFIG.DRAWING.MIN_BOX_SIZE || 
            canvasBox.height < CONFIG.DRAWING.MIN_BOX_SIZE) {
            console.log('Bounding box too small, canceling');
            this.cancelCurrentOperation();
            return;
        }
        
        // Convert to image coordinates
        const topLeft = this.canvasRenderer.canvasToImageCoordinates(canvasBox.x, canvasBox.y);
        const bottomRight = this.canvasRenderer.canvasToImageCoordinates(
            canvasBox.x + canvasBox.width, 
            canvasBox.y + canvasBox.height
        );
        
        const imageBox = {
            x: Math.round(topLeft.x),
            y: Math.round(topLeft.y),
            width: Math.round(bottomRight.x - topLeft.x),
            height: Math.round(bottomRight.y - topLeft.y)
        };
        
        // Get default class (will be changeable via UI)
        const defaultClass = this.getSelectedClass();
        
        // Create annotation through annotation manager
        const annotation = annotationManager.createAnnotation(
            imageBox,
            defaultClass,
            1.0, // Full confidence for user-created annotations
            { state: 'Modified' } // User-created annotations start as Modified
        );
        
        if (annotation) {
            console.log(`Created annotation: ${annotation.className} at (${imageBox.x}, ${imageBox.y}) size ${imageBox.width}x${imageBox.height}`);
            
            // Select the newly created annotation
            annotationManager.selectAnnotation(annotation.id);
        } else {
            console.error('Failed to create annotation');
        }
        
        // Clean up drawing state
        this.cancelCurrentOperation();
    }

    /**
     * Handle ROI click events for polygon drawing
     */
    handleROIClick(x, y) {
        if (!this.roiMode) return;

        // Convert to image coordinates
        const imageCoords = this.canvasRenderer.canvasToImageCoordinates(x, y);
        
        if (!this.isDrawingROI) {
            // Start new ROI
            this.startROIDrawing(imageCoords);
        } else {
            // Add point to current ROI
            this.addROIPoint(imageCoords);
        }
    }

    /**
     * Start drawing a new ROI
     */
    startROIDrawing(imageCoords) {
        this.isDrawingROI = true;
        this.roiPoints = [{ x: imageCoords.x, y: imageCoords.y }];
        
        console.log(`Started ROI drawing at (${imageCoords.x.toFixed(1)}, ${imageCoords.y.toFixed(1)})`);
        
        // Redraw with preview
        this.redrawWithROIPreview();
    }

    /**
     * Add a point to the current ROI
     */
    addROIPoint(imageCoords) {
        if (!this.isDrawingROI) return;

        // Check if clicking near the first point to close the polygon
        const firstPoint = this.roiPoints[0];
        const distance = Math.sqrt(
            Math.pow(imageCoords.x - firstPoint.x, 2) + 
            Math.pow(imageCoords.y - firstPoint.y, 2)
        );

        if (this.roiPoints.length >= CONFIG.ROI.MIN_POINTS && distance < CONFIG.ROI.SELECTION_TOLERANCE) {
            // Close the polygon
            this.finishROIDrawing();
        } else {
            // Add new point
            this.roiPoints.push({ x: imageCoords.x, y: imageCoords.y });
            console.log(`Added ROI point ${this.roiPoints.length}: (${imageCoords.x.toFixed(1)}, ${imageCoords.y.toFixed(1)})`);
            
            // Redraw with preview
            this.redrawWithROIPreview();
        }
    }

    /**
     * Update ROI preview during mouse movement
     */
    updateROIPreview(x, y) {
        if (!this.isDrawingROI) return;

        // Store current mouse position for preview
        const imageCoords = this.canvasRenderer.canvasToImageCoordinates(x, y);
        this.currentROIPoint = imageCoords;
        
        // Redraw with preview
        this.redrawWithROIPreview();
    }

    /**
     * Finish ROI drawing and create the ROI
     */
    finishROIDrawing() {
        if (!this.isDrawingROI || this.roiPoints.length < CONFIG.ROI.MIN_POINTS) {
            console.log('Cannot finish ROI: insufficient points');
            this.cancelROIDrawing();
            return;
        }

        // Get current image ID (assuming we have access to it)
        const imageInfo = this.canvasRenderer.getImageInfo();
        const imageId = imageInfo ? 'current_image' : 'unknown'; // This should be improved to get actual image ID

        // Create ROI through ROI manager
        const roi = roiManager.createROI(this.roiPoints, imageId);
        
        if (roi) {
            console.log(`Created ROI with ${this.roiPoints.length} points`);
            
            // Set ROI in canvas renderer
            this.canvasRenderer.setROI(roi);
        } else {
            console.error('Failed to create ROI');
        }

        // Clean up ROI drawing state
        this.cancelROIDrawing();
    }

    /**
     * Cancel ROI drawing
     */
    cancelROIDrawing() {
        this.isDrawingROI = false;
        this.roiPoints = [];
        this.currentROIPoint = null;
        
        // Redraw canvas to remove preview
        this.canvasRenderer.redraw();
        
        console.log('ROI drawing canceled');
    }

    /**
     * Clear current ROI
     */
    clearROI() {
        const success = roiManager.clearROI();
        
        if (success) {
            // Clear ROI from canvas renderer
            this.canvasRenderer.setROI(null);
            console.log('ROI cleared');
        }
        
        return success;
    }

    /**
     * Handle selection and manipulation interactions
     */
    handleSelectionInteraction(x, y) {
        // Check if clicking on an existing annotation
        const annotation = this.canvasRenderer.getAnnotationAtPoint(x, y);
        
        if (annotation) {
            // Check if clicking on a resize handle
            const handle = this.getResizeHandleAtPoint(x, y, annotation);
            
            if (handle) {
                this.startResize(annotation, handle);
            } else {
                // Check if annotation is already selected (for moving)
                if (this.selectedAnnotation && this.selectedAnnotation.id === annotation.id) {
                    this.startMove(annotation, x, y);
                } else {
                    // Select the annotation
                    this.selectAnnotation(annotation);
                }
            }
        } else {
            // Clear selection
            this.clearSelection();
        }
    }

    /**
     * Select an annotation
     */
    selectAnnotation(annotation) {
        this.selectedAnnotation = annotation;
        annotationManager.selectAnnotation(annotation.id);
        console.log(`Selected annotation: ${annotation.id} (${annotation.className})`);
    }

    /**
     * Clear annotation selection
     */
    clearSelection() {
        this.selectedAnnotation = null;
        annotationManager.clearSelection();
        console.log('Selection cleared');
    }

    /**
     * Start resizing an annotation
     */
    startResize(annotation, handle) {
        this.isResizing = true;
        this.selectedAnnotation = annotation;
        this.resizeHandle = handle;
        
        // Select the annotation
        annotationManager.selectAnnotation(annotation.id);
        
        console.log(`Started resizing annotation ${annotation.id} with handle ${handle}`);
    }

    /**
     * Update resize operation
     */
    updateResize(x, y) {
        if (!this.isResizing || !this.selectedAnnotation || !this.resizeHandle) return;
        
        // Convert current annotation bounds to canvas coordinates
        const annotation = this.selectedAnnotation;
        const topLeft = this.canvasRenderer.imageToCanvasCoordinates(
            annotation.bbox.x, 
            annotation.bbox.y
        );
        const bottomRight = this.canvasRenderer.imageToCanvasCoordinates(
            annotation.bbox.x + annotation.bbox.width,
            annotation.bbox.y + annotation.bbox.height
        );
        
        // Calculate new bounds based on resize handle
        let newBounds = this.calculateResizedBounds(
            { x: topLeft.x, y: topLeft.y, width: bottomRight.x - topLeft.x, height: bottomRight.y - topLeft.y },
            this.resizeHandle,
            x,
            y
        );
        
        // Ensure minimum size
        if (newBounds.width < CONFIG.DRAWING.MIN_BOX_SIZE) {
            newBounds.width = CONFIG.DRAWING.MIN_BOX_SIZE;
        }
        if (newBounds.height < CONFIG.DRAWING.MIN_BOX_SIZE) {
            newBounds.height = CONFIG.DRAWING.MIN_BOX_SIZE;
        }
        
        // Convert back to image coordinates
        const newTopLeft = this.canvasRenderer.canvasToImageCoordinates(newBounds.x, newBounds.y);
        const newBottomRight = this.canvasRenderer.canvasToImageCoordinates(
            newBounds.x + newBounds.width,
            newBounds.y + newBounds.height
        );
        
        const newImageBounds = {
            x: Math.round(newTopLeft.x),
            y: Math.round(newTopLeft.y),
            width: Math.round(newBottomRight.x - newTopLeft.x),
            height: Math.round(newBottomRight.y - newTopLeft.y)
        };
        
        // Update annotation through annotation manager
        annotationManager.updateAnnotation(annotation.id, {
            bbox: newImageBounds
        });
    }

    /**
     * Finish resize operation
     */
    finishResize() {
        if (!this.isResizing) return;
        
        console.log(`Finished resizing annotation ${this.selectedAnnotation?.id}`);
        
        this.isResizing = false;
        this.resizeHandle = null;
    }

    /**
     * Start moving an annotation
     */
    startMove(annotation, x, y) {
        this.isMoving = true;
        this.selectedAnnotation = annotation;
        
        // Calculate offset from annotation top-left to click point
        const topLeft = this.canvasRenderer.imageToCanvasCoordinates(
            annotation.bbox.x,
            annotation.bbox.y
        );
        
        this.moveOffset = {
            x: x - topLeft.x,
            y: y - topLeft.y
        };
        
        console.log(`Started moving annotation ${annotation.id}`);
    }

    /**
     * Update move operation
     */
    updateMove(x, y) {
        if (!this.isMoving || !this.selectedAnnotation || !this.moveOffset) return;
        
        // Calculate new position
        const newCanvasX = x - this.moveOffset.x;
        const newCanvasY = y - this.moveOffset.y;
        
        // Convert to image coordinates
        const newImagePos = this.canvasRenderer.canvasToImageCoordinates(newCanvasX, newCanvasY);
        
        // Ensure annotation stays within image bounds
        const imageInfo = this.canvasRenderer.getImageInfo();
        if (!imageInfo) return;
        
        const clampedX = Math.max(0, Math.min(newImagePos.x, imageInfo.originalWidth - this.selectedAnnotation.bbox.width));
        const clampedY = Math.max(0, Math.min(newImagePos.y, imageInfo.originalHeight - this.selectedAnnotation.bbox.height));
        
        // Update annotation through annotation manager
        annotationManager.updateAnnotation(this.selectedAnnotation.id, {
            bbox: {
                x: Math.round(clampedX),
                y: Math.round(clampedY),
                width: this.selectedAnnotation.bbox.width,
                height: this.selectedAnnotation.bbox.height
            }
        });
    }

    /**
     * Finish move operation
     */
    finishMove() {
        if (!this.isMoving) return;
        
        console.log(`Finished moving annotation ${this.selectedAnnotation?.id}`);
        
        this.isMoving = false;
        this.moveOffset = null;
    }

    /**
     * Delete the currently selected annotation
     */
    deleteSelectedAnnotation() {
        if (!this.selectedAnnotation) {
            console.log('No annotation selected for deletion');
            return;
        }
        
        const annotationId = this.selectedAnnotation.id;
        const success = annotationManager.deleteAnnotation(annotationId);
        
        if (success) {
            console.log(`Deleted annotation ${annotationId}`);
            this.selectedAnnotation = null;
        } else {
            console.error(`Failed to delete annotation ${annotationId}`);
        }
    }

    /**
     * Cancel current operation and clean up state
     */
    cancelCurrentOperation() {
        this.isDrawing = false;
        this.isResizing = false;
        this.isMoving = false;
        
        this.startPoint = null;
        this.currentPoint = null;
        this.previewBox = null;
        this.resizeHandle = null;
        this.moveOffset = null;
        
        // Also cancel ROI drawing if active
        if (this.isDrawingROI) {
            this.cancelROIDrawing();
        }
        
        // Redraw canvas to remove preview
        this.canvasRenderer.redraw();
        
        console.log('Current operation canceled');
    }

    /**
     * Update cursor based on current position and mode
     */
    updateCursor(x, y) {
        if (this.drawingMode) {
            this.canvas.style.cursor = 'crosshair';
            return;
        }
        
        if (this.roiMode) {
            this.canvas.style.cursor = 'crosshair';
            return;
        }
        
        // Check if over an annotation
        const annotation = this.canvasRenderer.getAnnotationAtPoint(x, y);
        
        if (annotation) {
            // Check if over a resize handle
            const handle = this.getResizeHandleAtPoint(x, y, annotation);
            
            if (handle) {
                this.canvas.style.cursor = this.getResizeCursor(handle);
            } else if (this.selectedAnnotation && this.selectedAnnotation.id === annotation.id) {
                this.canvas.style.cursor = 'move';
            } else {
                this.canvas.style.cursor = 'pointer';
            }
        } else {
            this.canvas.style.cursor = 'default';
        }
    }

    /**
     * Get resize handle at specific point for an annotation
     */
    getResizeHandleAtPoint(x, y, annotation) {
        if (!annotation || !annotation.bbox) return null;
        
        // Convert annotation bounds to canvas coordinates
        const topLeft = this.canvasRenderer.imageToCanvasCoordinates(
            annotation.bbox.x,
            annotation.bbox.y
        );
        const bottomRight = this.canvasRenderer.imageToCanvasCoordinates(
            annotation.bbox.x + annotation.bbox.width,
            annotation.bbox.y + annotation.bbox.height
        );
        
        const handleSize = CONFIG.DRAWING.HANDLE_SIZE;
        const tolerance = CONFIG.DRAWING.SELECTION_TOLERANCE;
        
        // Define handle positions
        const handles = {
            'nw': { x: topLeft.x, y: topLeft.y },
            'n': { x: (topLeft.x + bottomRight.x) / 2, y: topLeft.y },
            'ne': { x: bottomRight.x, y: topLeft.y },
            'e': { x: bottomRight.x, y: (topLeft.y + bottomRight.y) / 2 },
            'se': { x: bottomRight.x, y: bottomRight.y },
            's': { x: (topLeft.x + bottomRight.x) / 2, y: bottomRight.y },
            'sw': { x: topLeft.x, y: bottomRight.y },
            'w': { x: topLeft.x, y: (topLeft.y + bottomRight.y) / 2 }
        };
        
        // Check each handle
        for (const [handleName, handlePos] of Object.entries(handles)) {
            const distance = Math.sqrt(
                Math.pow(x - handlePos.x, 2) + Math.pow(y - handlePos.y, 2)
            );
            
            if (distance <= handleSize / 2 + tolerance) {
                return handleName;
            }
        }
        
        return null;
    }

    /**
     * Calculate new bounds during resize operation
     */
    calculateResizedBounds(currentBounds, handle, mouseX, mouseY) {
        let newBounds = { ...currentBounds };
        
        switch (handle) {
            case 'nw':
                newBounds.width += newBounds.x - mouseX;
                newBounds.height += newBounds.y - mouseY;
                newBounds.x = mouseX;
                newBounds.y = mouseY;
                break;
            case 'n':
                newBounds.height += newBounds.y - mouseY;
                newBounds.y = mouseY;
                break;
            case 'ne':
                newBounds.width = mouseX - newBounds.x;
                newBounds.height += newBounds.y - mouseY;
                newBounds.y = mouseY;
                break;
            case 'e':
                newBounds.width = mouseX - newBounds.x;
                break;
            case 'se':
                newBounds.width = mouseX - newBounds.x;
                newBounds.height = mouseY - newBounds.y;
                break;
            case 's':
                newBounds.height = mouseY - newBounds.y;
                break;
            case 'sw':
                newBounds.width += newBounds.x - mouseX;
                newBounds.height = mouseY - newBounds.y;
                newBounds.x = mouseX;
                break;
            case 'w':
                newBounds.width += newBounds.x - mouseX;
                newBounds.x = mouseX;
                break;
        }
        
        return newBounds;
    }

    /**
     * Get appropriate cursor for resize handle
     */
    getResizeCursor(handle) {
        const cursors = {
            'nw': 'nw-resize',
            'n': 'n-resize',
            'ne': 'ne-resize',
            'e': 'e-resize',
            'se': 'se-resize',
            's': 's-resize',
            'sw': 'sw-resize',
            'w': 'w-resize'
        };
        
        return cursors[handle] || 'default';
    }

    /**
     * Get currently selected class from UI
     */
    getSelectedClass() {
        const classSelector = document.getElementById('class-selector');
        return classSelector ? classSelector.value : 'Other';
    }

    /**
     * Set class for selected annotation
     */
    setAnnotationClass(annotationId, className) {
        if (!this.validateClassName(className)) {
            console.error(`Invalid class name: ${className}`);
            return false;
        }

        const success = annotationManager.updateAnnotation(annotationId, {
            className: className
        });

        if (success) {
            console.log(`Updated annotation ${annotationId} class to ${className}`);
        }

        return success;
    }

    /**
     * Change annotation verification state
     */
    setAnnotationState(annotationId, state) {
        if (!this.validateStateName(state)) {
            console.error(`Invalid state: ${state}`);
            return false;
        }

        const success = annotationManager.changeState(annotationId, state);

        if (success) {
            console.log(`Updated annotation ${annotationId} state to ${state}`);
        }

        return success;
    }

    /**
     * Validate class name against FHWA list
     */
    validateClassName(className) {
        if (!className || typeof className !== 'string') {
            return false;
        }

        const validClasses = Object.keys(CONFIG.ANNOTATION_COLORS);
        return validClasses.includes(className);
    }

    /**
     * Validate state name
     */
    validateStateName(state) {
        if (!state || typeof state !== 'string') {
            return false;
        }

        const validStates = Object.keys(CONFIG.STATE_COLORS);
        return validStates.includes(state);
    }

    /**
     * Show class assignment UI for selected annotation
     */
    showClassAssignmentUI(annotationId) {
        const annotation = annotationManager.findAnnotationById(annotationId);
        if (!annotation) {
            console.error(`Annotation ${annotationId} not found`);
            return;
        }

        // Create or show class assignment modal
        this.createClassAssignmentModal(annotation);
    }

    /**
     * Create class assignment modal
     */
    createClassAssignmentModal(annotation) {
        // Remove existing modal if present
        const existingModal = document.getElementById('class-assignment-modal');
        if (existingModal) {
            existingModal.remove();
        }

        // Create modal HTML
        const modalHTML = `
            <div class="modal fade" id="class-assignment-modal" tabindex="-1" aria-labelledby="classAssignmentModalLabel" aria-hidden="true">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="classAssignmentModalLabel">Edit Annotation</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <div class="mb-3">
                                <label for="modal-class-selector" class="form-label">Object Class</label>
                                <select id="modal-class-selector" class="form-select">
                                    ${this.generateClassOptions(annotation.className)}
                                </select>
                            </div>
                            <div class="mb-3">
                                <label for="modal-state-selector" class="form-label">Verification State</label>
                                <select id="modal-state-selector" class="form-select">
                                    ${this.generateStateOptions(annotation.state)}
                                </select>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Confidence</label>
                                <div class="form-text">${(annotation.confidence * 100).toFixed(1)}%</div>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Bounding Box</label>
                                <div class="form-text">
                                    Position: (${annotation.bbox.x}, ${annotation.bbox.y})<br>
                                    Size: ${annotation.bbox.width} × ${annotation.bbox.height}
                                </div>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-danger" id="delete-annotation-btn">Delete</button>
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                            <button type="button" class="btn btn-primary" id="save-annotation-btn">Save Changes</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Add modal to document
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // Get modal element and show it
        const modal = document.getElementById('class-assignment-modal');
        const bootstrapModal = new bootstrap.Modal(modal);

        // Set up event listeners
        const saveBtn = modal.querySelector('#save-annotation-btn');
        const deleteBtn = modal.querySelector('#delete-annotation-btn');
        const classSelector = modal.querySelector('#modal-class-selector');
        const stateSelector = modal.querySelector('#modal-state-selector');

        saveBtn.addEventListener('click', () => {
            const newClass = classSelector.value;
            const newState = stateSelector.value;

            // Update annotation
            const updates = {};
            if (newClass !== annotation.className) {
                updates.className = newClass;
            }
            if (newState !== annotation.state) {
                updates.state = newState;
            }

            if (Object.keys(updates).length > 0) {
                const success = annotationManager.updateAnnotation(annotation.id, updates);
                if (success) {
                    console.log(`Updated annotation ${annotation.id}:`, updates);
                } else {
                    console.error(`Failed to update annotation ${annotation.id}`);
                }
            }

            bootstrapModal.hide();
        });

        deleteBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to delete this annotation?')) {
                const success = annotationManager.deleteAnnotation(annotation.id);
                if (success) {
                    console.log(`Deleted annotation ${annotation.id}`);
                } else {
                    console.error(`Failed to delete annotation ${annotation.id}`);
                }
                bootstrapModal.hide();
            }
        });

        // Clean up modal when hidden
        modal.addEventListener('hidden.bs.modal', () => {
            modal.remove();
        });

        // Show the modal
        bootstrapModal.show();
    }

    /**
     * Generate class options HTML
     */
    generateClassOptions(selectedClass) {
        const classes = Object.keys(CONFIG.ANNOTATION_COLORS);
        return classes.map(className => 
            `<option value="${className}" ${className === selectedClass ? 'selected' : ''}>${className}</option>`
        ).join('');
    }

    /**
     * Generate state options HTML
     */
    generateStateOptions(selectedState) {
        const states = Object.keys(CONFIG.STATE_COLORS);
        return states.map(state => 
            `<option value="${state}" ${state === selectedState ? 'selected' : ''}>${state}</option>`
        ).join('');
    }

    /**
     * Redraw canvas with drawing preview
     */
    redrawWithPreview() {
        // Redraw the base canvas
        this.canvasRenderer.redraw();
        
        // Draw preview box if drawing
        if (this.previewBox && this.isDrawing) {
            const ctx = this.canvasRenderer.getContext();
            
            ctx.save();
            ctx.strokeStyle = getStateColor('Modified');
            ctx.lineWidth = CONFIG.DRAWING.LINE_WIDTH;
            ctx.setLineDash([5, 5]);
            
            ctx.strokeRect(
                this.previewBox.x,
                this.previewBox.y,
                this.previewBox.width,
                this.previewBox.height
            );
            
            ctx.restore();
        }
    }

    /**
     * Redraw canvas with ROI preview
     */
    redrawWithROIPreview() {
        // Redraw the base canvas
        this.canvasRenderer.redraw();
        
        // Draw ROI preview if drawing
        if (this.isDrawingROI && this.roiPoints.length > 0) {
            const ctx = this.canvasRenderer.getContext();
            
            ctx.save();
            
            // Convert points to canvas coordinates
            const canvasPoints = this.roiPoints.map(point => 
                this.canvasRenderer.imageToCanvasCoordinates(point.x, point.y)
            );
            
            // Draw lines between points
            ctx.strokeStyle = CONFIG.ROI.STROKE_COLOR;
            ctx.lineWidth = CONFIG.ROI.LINE_WIDTH;
            ctx.setLineDash([5, 5]);
            
            if (canvasPoints.length > 1) {
                ctx.beginPath();
                ctx.moveTo(canvasPoints[0].x, canvasPoints[0].y);
                
                for (let i = 1; i < canvasPoints.length; i++) {
                    ctx.lineTo(canvasPoints[i].x, canvasPoints[i].y);
                }
                
                ctx.stroke();
            }
            
            // Draw line to current mouse position if available
            if (this.currentROIPoint && canvasPoints.length > 0) {
                const currentCanvas = this.canvasRenderer.imageToCanvasCoordinates(
                    this.currentROIPoint.x, 
                    this.currentROIPoint.y
                );
                
                ctx.beginPath();
                ctx.moveTo(canvasPoints[canvasPoints.length - 1].x, canvasPoints[canvasPoints.length - 1].y);
                ctx.lineTo(currentCanvas.x, currentCanvas.y);
                ctx.stroke();
                
                // Draw line to first point if we have enough points (to show potential closure)
                if (canvasPoints.length >= CONFIG.ROI.MIN_POINTS) {
                    ctx.setLineDash([2, 2]);
                    ctx.strokeStyle = CONFIG.ROI.STROKE_COLOR + '80'; // Semi-transparent
                    ctx.beginPath();
                    ctx.moveTo(currentCanvas.x, currentCanvas.y);
                    ctx.lineTo(canvasPoints[0].x, canvasPoints[0].y);
                    ctx.stroke();
                }
            }
            
            // Draw points
            ctx.fillStyle = CONFIG.ROI.STROKE_COLOR;
            ctx.setLineDash([]);
            canvasPoints.forEach((point, index) => {
                ctx.beginPath();
                ctx.arc(point.x, point.y, CONFIG.ROI.POINT_RADIUS, 0, 2 * Math.PI);
                ctx.fill();
                
                // Highlight first point if we have enough points for closure
                if (index === 0 && canvasPoints.length >= CONFIG.ROI.MIN_POINTS) {
                    ctx.strokeStyle = '#ffffff';
                    ctx.lineWidth = 2;
                    ctx.stroke();
                    ctx.strokeStyle = CONFIG.ROI.STROKE_COLOR;
                }
            });
            
            ctx.restore();
        }
    }

    /**
     * Enable resize mode for specific annotation
     */
    enableResizeMode(annotationId) {
        const annotation = annotationManager.findAnnotationById(annotationId);
        if (annotation) {
            this.selectedAnnotation = annotation;
            annotationManager.selectAnnotation(annotationId);
            console.log(`Resize mode enabled for annotation ${annotationId}`);
        }
    }

    /**
     * Enable move mode for specific annotation
     */
    enableMoveMode(annotationId) {
        const annotation = annotationManager.findAnnotationById(annotationId);
        if (annotation) {
            this.selectedAnnotation = annotation;
            annotationManager.selectAnnotation(annotationId);
            console.log(`Move mode enabled for annotation ${annotationId}`);
        }
    }

    /**
     * Handle mouse events (public interface)
     */
    handleMouseEvents() {
        // This method serves as a public interface indicator
        // Actual event handling is set up in setupEventListeners()
        console.log('Mouse event handling is active');
    }

    /**
     * Handle touch events (public interface)
     */
    handleTouchEvents() {
        // This method serves as a public interface indicator
        // Actual event handling is set up in setupEventListeners()
        console.log('Touch event handling is active');
    }

    /**
     * Get current drawing state
     */
    getDrawingState() {
        return {
            drawingMode: this.drawingMode,
            roiMode: this.roiMode,
            isDrawing: this.isDrawing,
            isDrawingROI: this.isDrawingROI,
            isResizing: this.isResizing,
            isMoving: this.isMoving,
            selectedAnnotation: this.selectedAnnotation?.id || null,
            roiPointCount: this.roiPoints.length
        };
    }

    /**
     * Cleanup and destroy
     */
    destroy() {
        // Remove event listeners
        this.canvas.removeEventListener('mousedown', this.handleMouseDown);
        this.canvas.removeEventListener('mousemove', this.handleMouseMove);
        this.canvas.removeEventListener('mouseup', this.handleMouseUp);
        this.canvas.removeEventListener('mouseleave', this.handleMouseUp);
        this.canvas.removeEventListener('dblclick', this.handleDoubleClick);
        this.canvas.removeEventListener('contextmenu', this.handleContextMenu);
        
        this.canvas.removeEventListener('touchstart', this.handleTouchStart);
        this.canvas.removeEventListener('touchmove', this.handleTouchMove);
        this.canvas.removeEventListener('touchend', this.handleTouchEnd);
        
        document.removeEventListener('keydown', this.handleKeyDown);
        
        // Hide context menu if open
        this.hideContextMenu();
        
        // Clear state
        this.cancelCurrentOperation();
        this.selectedAnnotation = null;
        
        console.log('DrawingTools destroyed');
    }
}

// Create a default instance that can be imported
export let drawingTools = null;

// Function to initialize the default instance
export function initializeDrawingTools(canvas, canvasRenderer) {
    if (canvas && canvasRenderer) {
        drawingTools = new DrawingTools(canvas, canvasRenderer);
        
        // Make available for debugging
        if (typeof window !== 'undefined') {
            window.drawingTools = drawingTools;
        }
        
        return drawingTools;
    }
    
    return null;
}