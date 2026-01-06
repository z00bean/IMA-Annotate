/**
 * Canvas Renderer Module for IMA Annotate Frontend
 * Handles HTML5 canvas rendering, image display, and coordinate transformations
 */

import { CONFIG, getClassColor, getStateColor } from '../config.js';

// We'll get roiManager reference from the global scope or pass it in
let roiManagerRef = null;

/**
 * CanvasRenderer Class
 * Responsible for rendering images, annotations, and interactive elements on HTML5 canvas
 */
export class CanvasRenderer {
    constructor(canvas, container) {
        this.canvas = canvas;
        this.container = container;
        this.ctx = canvas.getContext('2d');
        
        // Rendering state
        this.currentImage = null;
        this.scaledDimensions = null;
        this.annotations = [];
        this.selectedAnnotation = null;
        this.roi = null;
        
        // ROI manager reference (will be set externally)
        this.roiManager = null;
        
        // Canvas properties
        this.devicePixelRatio = window.devicePixelRatio || 1;
        
        // Initialize canvas settings
        this.initializeCanvas();
        
        console.log('CanvasRenderer initialized');
    }

    /**
     * Initialize canvas with proper settings
     */
    initializeCanvas() {
        // Set canvas context properties for crisp rendering
        this.ctx.imageSmoothingEnabled = true;
        this.ctx.imageSmoothingQuality = 'high';
        
        // Set default styles
        this.ctx.lineJoin = 'round';
        this.ctx.lineCap = 'round';
        
        // Handle high DPI displays
        this.setupHighDPICanvas();
        
        console.log('Canvas initialized with high DPI support');
    }

    /**
     * Set up canvas for high DPI displays
     */
    setupHighDPICanvas() {
        const rect = this.canvas.getBoundingClientRect();
        
        // Set the internal size to the display size * device pixel ratio
        this.canvas.width = rect.width * this.devicePixelRatio;
        this.canvas.height = rect.height * this.devicePixelRatio;
        
        // Scale the canvas back down using CSS
        this.canvas.style.width = rect.width + 'px';
        this.canvas.style.height = rect.height + 'px';
        
        // Scale the drawing context so everything draws at the correct size
        this.ctx.scale(this.devicePixelRatio, this.devicePixelRatio);
    }

    /**
     * Resize canvas to fit container while maintaining responsive behavior
     */
    resizeCanvas() {
        if (!this.container) return;

        const containerRect = this.container.getBoundingClientRect();
        const maxWidth = Math.min(
            containerRect.width - (CONFIG.CANVAS_PADDING * 2), 
            CONFIG.MAX_CANVAS_WIDTH
        );
        const maxHeight = Math.min(
            containerRect.height - (CONFIG.CANVAS_PADDING * 2), 
            CONFIG.MAX_CANVAS_HEIGHT
        );
        
        // Ensure minimum dimensions
        const canvasWidth = Math.max(maxWidth, CONFIG.MIN_CANVAS_WIDTH);
        const canvasHeight = Math.max(maxHeight, CONFIG.MIN_CANVAS_HEIGHT);
        
        // Update canvas size
        this.canvas.width = canvasWidth;
        this.canvas.height = canvasHeight;
        
        // Re-setup high DPI if needed
        this.setupHighDPICanvas();
        
        // Recalculate scaled dimensions if image is loaded
        if (this.currentImage) {
            this.scaledDimensions = this.calculateScaledDimensions(
                this.currentImage.naturalWidth,
                this.currentImage.naturalHeight
            );
        }
        
        // Trigger redraw
        this.redraw();
        
        console.log(`Canvas resized to ${canvasWidth}x${canvasHeight}`);
    }

    /**
     * Calculate scaled dimensions for image to fit canvas while preserving aspect ratio
     */
    calculateScaledDimensions(imageWidth, imageHeight) {
        if (!imageWidth || !imageHeight) {
            return null;
        }

        const canvasWidth = this.canvas.width / this.devicePixelRatio;
        const canvasHeight = this.canvas.height / this.devicePixelRatio;
        
        // Calculate scaling factor to fit image in canvas
        const scaleX = canvasWidth / imageWidth;
        const scaleY = canvasHeight / imageHeight;
        const scale = Math.min(scaleX, scaleY);
        
        // Calculate scaled dimensions
        const scaledWidth = imageWidth * scale;
        const scaledHeight = imageHeight * scale;
        
        // Calculate centering offset
        const offsetX = (canvasWidth - scaledWidth) / 2;
        const offsetY = (canvasHeight - scaledHeight) / 2;
        
        return {
            scale: scale,
            width: scaledWidth,
            height: scaledHeight,
            x: offsetX,
            y: offsetY,
            canvasWidth: canvasWidth,
            canvasHeight: canvasHeight,
            originalWidth: imageWidth,
            originalHeight: imageHeight
        };
    }

    /**
     * Draw image on canvas with proper scaling and positioning
     */
    drawImage(image) {
        if (!image || !this.ctx) {
            console.warn('Cannot draw image: missing image or context');
            return false;
        }

        try {
            // Store current image reference
            this.currentImage = image;
            
            // Calculate scaled dimensions
            this.scaledDimensions = this.calculateScaledDimensions(
                image.naturalWidth,
                image.naturalHeight
            );
            
            if (!this.scaledDimensions) {
                console.warn('Cannot calculate scaled dimensions for image');
                return false;
            }
            
            // Clear canvas before drawing
            this.clearCanvas();
            
            // Draw image with calculated scaling and positioning
            this.ctx.drawImage(
                image,
                this.scaledDimensions.x,
                this.scaledDimensions.y,
                this.scaledDimensions.width,
                this.scaledDimensions.height
            );
            
            console.log(`Image drawn at ${this.scaledDimensions.x},${this.scaledDimensions.y} with size ${this.scaledDimensions.width}x${this.scaledDimensions.height}`);
            return true;
            
        } catch (error) {
            console.error('Error drawing image:', error);
            return false;
        }
    }

    /**
     * Clear the entire canvas
     */
    clearCanvas() {
        if (!this.ctx) return;
        
        const canvasWidth = this.canvas.width / this.devicePixelRatio;
        const canvasHeight = this.canvas.height / this.devicePixelRatio;
        
        this.ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    }

    /**
     * Redraw the entire canvas (image + annotations + overlays)
     */
    redraw() {
        // Clear canvas
        this.clearCanvas();
        
        // Draw current image if available
        if (this.currentImage) {
            this.drawImage(this.currentImage);
        }
        
        // Draw annotations if available
        if (this.annotations && this.annotations.length > 0) {
            this.drawAnnotations(this.annotations);
        }
        
        // Draw ROI if available (will be implemented in future tasks)
        if (this.roi) {
            this.drawROI(this.roi);
        }
    }

    /**
     * Convert screen coordinates to canvas coordinates
     */
    getCanvasCoordinates(screenX, screenY) {
        if (!this.canvas) {
            return { x: 0, y: 0 };
        }

        const rect = this.canvas.getBoundingClientRect();
        const canvasX = screenX - rect.left;
        const canvasY = screenY - rect.top;
        
        return {
            x: canvasX,
            y: canvasY
        };
    }

    /**
     * Convert canvas coordinates to screen coordinates
     */
    getScreenCoordinates(canvasX, canvasY) {
        if (!this.canvas) {
            return { x: 0, y: 0 };
        }

        const rect = this.canvas.getBoundingClientRect();
        const screenX = canvasX + rect.left;
        const screenY = canvasY + rect.top;
        
        return {
            x: screenX,
            y: screenY
        };
    }

    /**
     * Convert canvas coordinates to image coordinates
     */
    canvasToImageCoordinates(canvasX, canvasY) {
        if (!this.scaledDimensions) {
            return { x: 0, y: 0 };
        }

        // Adjust for image offset and scaling
        const imageX = (canvasX - this.scaledDimensions.x) / this.scaledDimensions.scale;
        const imageY = (canvasY - this.scaledDimensions.y) / this.scaledDimensions.scale;
        
        // Clamp to image boundaries
        const clampedX = Math.max(0, Math.min(imageX, this.scaledDimensions.originalWidth));
        const clampedY = Math.max(0, Math.min(imageY, this.scaledDimensions.originalHeight));
        
        return {
            x: clampedX,
            y: clampedY
        };
    }

    /**
     * Convert image coordinates to canvas coordinates
     */
    imageToCanvasCoordinates(imageX, imageY) {
        if (!this.scaledDimensions) {
            return { x: 0, y: 0 };
        }

        const canvasX = (imageX * this.scaledDimensions.scale) + this.scaledDimensions.x;
        const canvasY = (imageY * this.scaledDimensions.scale) + this.scaledDimensions.y;
        
        return {
            x: canvasX,
            y: canvasY
        };
    }

    /**
     * Check if a point is within the image bounds
     */
    isPointInImage(canvasX, canvasY) {
        if (!this.scaledDimensions) {
            return false;
        }

        return (
            canvasX >= this.scaledDimensions.x &&
            canvasX <= this.scaledDimensions.x + this.scaledDimensions.width &&
            canvasY >= this.scaledDimensions.y &&
            canvasY <= this.scaledDimensions.y + this.scaledDimensions.height
        );
    }

    /**
     * Get current image dimensions and scaling information
     */
    getImageInfo() {
        if (!this.currentImage || !this.scaledDimensions) {
            return null;
        }

        return {
            originalWidth: this.scaledDimensions.originalWidth,
            originalHeight: this.scaledDimensions.originalHeight,
            scaledWidth: this.scaledDimensions.width,
            scaledHeight: this.scaledDimensions.height,
            scale: this.scaledDimensions.scale,
            offsetX: this.scaledDimensions.x,
            offsetY: this.scaledDimensions.y
        };
    }

    /**
     * Set annotations for rendering
     */
    setAnnotations(annotations) {
        this.annotations = annotations || [];
        
        // Ensure each annotation has required properties
        this.annotations.forEach(annotation => {
            if (!annotation.state) {
                annotation.state = 'Suggested';
            }
            if (!annotation.selected) {
                annotation.selected = false;
            }
            if (!annotation.id) {
                annotation.id = this.generateAnnotationId();
            }
        });
        
        console.log(`Set ${this.annotations.length} annotations for rendering`);
        
        // Trigger redraw if we have a current image
        if (this.currentImage) {
            this.redraw();
        }
    }

    /**
     * Add a single annotation
     */
    addAnnotation(annotation) {
        if (!annotation) {
            return;
        }

        // Ensure annotation has required properties
        if (!annotation.state) {
            annotation.state = 'Suggested';
        }
        if (!annotation.selected) {
            annotation.selected = false;
        }
        if (!annotation.id) {
            annotation.id = this.generateAnnotationId();
        }
        if (!annotation.createdAt) {
            annotation.createdAt = new Date();
        }

        this.annotations = this.annotations || [];
        this.annotations.push(annotation);
        
        console.log(`Added annotation ${annotation.id}`);
        
        // Trigger redraw
        if (this.currentImage) {
            this.redraw();
        }
    }

    /**
     * Remove annotation by ID
     */
    removeAnnotation(annotationId) {
        if (!this.annotations || !annotationId) {
            return false;
        }

        const initialLength = this.annotations.length;
        this.annotations = this.annotations.filter(annotation => annotation.id !== annotationId);
        
        const removed = this.annotations.length < initialLength;
        
        if (removed) {
            console.log(`Removed annotation ${annotationId}`);
            
            // Clear selection if removed annotation was selected
            if (this.selectedAnnotation === annotationId) {
                this.selectedAnnotation = null;
            }
            
            // Trigger redraw
            if (this.currentImage) {
                this.redraw();
            }
        }

        return removed;
    }

    /**
     * Generate unique annotation ID
     */
    generateAnnotationId() {
        return 'annotation_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Draw all annotations on the canvas with ROI filtering support
     */
    drawAnnotations(annotations) {
        if (!annotations || annotations.length === 0) {
            return;
        }

        console.log(`Drawing ${annotations.length} annotations`);

        // Check ROI filtering state
        const isROIFilteringActive = this.roiManager ? this.roiManager.isROIFilteringActive() : false;
        
        annotations.forEach(annotation => {
            // Check if annotation should be drawn based on ROI filtering
            let isInROI = true;
            
            if (isROIFilteringActive && this.roiManager) {
                isInROI = this.roiManager.isBoundingBoxInROI(annotation.bbox);
            }
            
            this.drawAnnotation(annotation, { isInROI, isROIFilteringActive });
        });
    }

    /**
     * Draw a single annotation (bounding box, label, and segmentation mask if available)
     */
    drawAnnotation(annotation, roiInfo = {}) {
        if (!annotation || !this.scaledDimensions) {
            return;
        }

        // Extract ROI information
        const { isInROI = true, isROIFilteringActive = false } = roiInfo;

        // Draw segmentation mask first (if available) so it appears behind bounding box
        if (annotation.segmentationMask) {
            this.drawSegmentationMask(annotation, roiInfo);
        }

        // Draw bounding box
        this.drawBoundingBox(annotation, roiInfo);

        // Draw class label and confidence score
        this.drawAnnotationLabel(annotation, roiInfo);
    }

    /**
     * Draw bounding box with state-specific styling and ROI filtering support
     */
    drawBoundingBox(annotation, roiInfo = {}) {
        if (!annotation.bbox || !this.scaledDimensions) {
            return;
        }

        const { bbox, className, state } = annotation;
        const { isInROI = true, isROIFilteringActive = false } = roiInfo;
        
        // Convert image coordinates to canvas coordinates
        const topLeft = this.imageToCanvasCoordinates(bbox.x, bbox.y);
        const bottomRight = this.imageToCanvasCoordinates(
            bbox.x + bbox.width, 
            bbox.y + bbox.height
        );
        
        const canvasWidth = bottomRight.x - topLeft.x;
        const canvasHeight = bottomRight.y - topLeft.y;

        // Get colors based on class and state
        const classColor = getClassColor(className);
        const stateColor = getStateColor(state);
        
        // Modify colors based on ROI filtering
        let strokeColor = stateColor;
        let fillColor = classColor;
        let opacity = 1.0;
        
        if (isROIFilteringActive) {
            if (isInROI) {
                // Annotations inside ROI: normal or enhanced visibility
                opacity = 1.0;
            } else {
                // Annotations outside ROI: reduced visibility
                opacity = 0.3;
                strokeColor = this.adjustColorOpacity(stateColor, 0.3);
                fillColor = this.adjustColorOpacity(classColor, 0.3);
            }
        }

        // Save current context state
        this.ctx.save();

        // Set line style based on verification state and ROI
        this.ctx.strokeStyle = strokeColor;
        this.ctx.lineWidth = this.getLineWidthForState(state);
        this.ctx.globalAlpha = opacity;
        
        // Set dash pattern for different states
        const dashPattern = this.getDashPatternForState(state);
        
        // Modify dash pattern for ROI filtering
        if (isROIFilteringActive && !isInROI) {
            // Use longer dashes for annotations outside ROI
            this.ctx.setLineDash([10, 10]);
        } else {
            this.ctx.setLineDash(dashPattern);
        }

        // Draw bounding box rectangle
        this.ctx.strokeRect(topLeft.x, topLeft.y, canvasWidth, canvasHeight);

        // Add subtle fill for better visibility (optional)
        if (annotation.selected || state === 'Modified') {
            this.ctx.fillStyle = fillColor + '20'; // 20 = ~12% opacity
            this.ctx.fillRect(topLeft.x, topLeft.y, canvasWidth, canvasHeight);
        }

        // Draw ROI indicator for annotations inside ROI when filtering is active
        if (isROIFilteringActive && isInROI) {
            this.drawROIIndicator(topLeft.x, topLeft.y, canvasWidth, canvasHeight);
        }

        // Draw selection handles if annotation is selected
        if (annotation.selected) {
            this.drawSelectionHandles(topLeft.x, topLeft.y, canvasWidth, canvasHeight);
        }

        // Restore context state
        this.ctx.restore();
    }

    /**
     * Draw segmentation mask overlay with ROI filtering support
     */
    drawSegmentationMask(annotation, roiInfo = {}) {
        if (!annotation.segmentationMask || !this.scaledDimensions) {
            return;
        }

        const { className } = annotation;
        const { isInROI = true, isROIFilteringActive = false } = roiInfo;
        const classColor = getClassColor(className);
        
        // Calculate opacity based on ROI filtering
        let opacity = 0.25; // Default 25% opacity
        if (isROIFilteringActive && !isInROI) {
            opacity = 0.1; // Reduced opacity for annotations outside ROI
        }
        
        // Save current context state
        this.ctx.save();

        try {
            // Set fill style with transparency
            this.ctx.fillStyle = classColor + Math.floor(opacity * 255).toString(16).padStart(2, '0');
            
            // Convert mask coordinates to canvas coordinates and draw
            const mask = annotation.segmentationMask;
            
            if (Array.isArray(mask) && mask.length > 0) {
                // Handle polygon-style mask (array of points)
                this.ctx.beginPath();
                
                mask.forEach((point, index) => {
                    const canvasPoint = this.imageToCanvasCoordinates(point.x, point.y);
                    
                    if (index === 0) {
                        this.ctx.moveTo(canvasPoint.x, canvasPoint.y);
                    } else {
                        this.ctx.lineTo(canvasPoint.x, canvasPoint.y);
                    }
                });
                
                this.ctx.closePath();
                this.ctx.fill();
                
                // Also draw outline with adjusted opacity
                this.ctx.strokeStyle = classColor;
                this.ctx.globalAlpha = isROIFilteringActive && !isInROI ? 0.3 : 1.0;
                this.ctx.lineWidth = 1;
                this.ctx.setLineDash([]);
                this.ctx.stroke();
            }
            
        } catch (error) {
            console.warn('Error drawing segmentation mask:', error);
        }

        // Restore context state
        this.ctx.restore();
    }

    /**
     * Draw class label and confidence score with ROI filtering support
     */
    drawAnnotationLabel(annotation, roiInfo = {}) {
        if (!annotation.bbox || !this.scaledDimensions) {
            return;
        }

        const { bbox, className, confidence, state } = annotation;
        const { isInROI = true, isROIFilteringActive = false } = roiInfo;
        
        // Convert image coordinates to canvas coordinates
        const topLeft = this.imageToCanvasCoordinates(bbox.x, bbox.y);
        
        // Prepare label text
        const labelText = confidence !== undefined 
            ? `${className} (${(confidence * 100).toFixed(0)}%)`
            : className;
        
        // Save current context state
        this.ctx.save();

        // Set font and measure text
        const fontSize = Math.max(12, Math.min(16, this.scaledDimensions.scale * 14));
        this.ctx.font = `${fontSize}px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`;
        const textMetrics = this.ctx.measureText(labelText);
        const textWidth = textMetrics.width;
        const textHeight = fontSize;

        // Calculate label position (above bounding box, or below if not enough space)
        const padding = 4;
        const labelWidth = textWidth + (padding * 2);
        const labelHeight = textHeight + (padding * 2);
        
        let labelX = topLeft.x;
        let labelY = topLeft.y - labelHeight;
        
        // Adjust if label would go off-screen
        if (labelY < 0) {
            labelY = topLeft.y + labelHeight;
        }
        if (labelX + labelWidth > this.canvas.width / this.devicePixelRatio) {
            labelX = (this.canvas.width / this.devicePixelRatio) - labelWidth;
        }
        if (labelX < 0) {
            labelX = 0;
        }

        // Get colors
        const classColor = getClassColor(className);
        const stateColor = getStateColor(state);

        // Adjust colors and opacity based on ROI filtering
        let backgroundOpacity = 1.0;
        let textOpacity = 1.0;
        
        if (isROIFilteringActive && !isInROI) {
            backgroundOpacity = 0.3;
            textOpacity = 0.6;
        }

        // Draw label background
        this.ctx.globalAlpha = backgroundOpacity;
        this.ctx.fillStyle = stateColor;
        this.ctx.fillRect(labelX, labelY, labelWidth, labelHeight);

        // Draw label border
        this.ctx.strokeStyle = classColor;
        this.ctx.lineWidth = 1;
        this.ctx.setLineDash([]);
        this.ctx.strokeRect(labelX, labelY, labelWidth, labelHeight);

        // Draw label text
        this.ctx.globalAlpha = textOpacity;
        this.ctx.fillStyle = this.getContrastColor(stateColor);
        this.ctx.textAlign = 'left';
        this.ctx.textBaseline = 'top';
        this.ctx.fillText(labelText, labelX + padding, labelY + padding);

        // Restore context state
        this.ctx.restore();
    }

    /**
     * Draw selection handles around a bounding box
     */
    drawSelectionHandles(x, y, width, height) {
        const handleSize = CONFIG.DRAWING.HANDLE_SIZE;
        const halfHandle = handleSize / 2;

        // Save current context state
        this.ctx.save();

        // Set handle style
        this.ctx.fillStyle = '#ffffff';
        this.ctx.strokeStyle = '#007bff';
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([]);

        // Define handle positions (corners and midpoints)
        const handles = [
            { x: x - halfHandle, y: y - halfHandle }, // Top-left
            { x: x + width/2 - halfHandle, y: y - halfHandle }, // Top-center
            { x: x + width - halfHandle, y: y - halfHandle }, // Top-right
            { x: x + width - halfHandle, y: y + height/2 - halfHandle }, // Right-center
            { x: x + width - halfHandle, y: y + height - halfHandle }, // Bottom-right
            { x: x + width/2 - halfHandle, y: y + height - halfHandle }, // Bottom-center
            { x: x - halfHandle, y: y + height - halfHandle }, // Bottom-left
            { x: x - halfHandle, y: y + height/2 - halfHandle } // Left-center
        ];

        // Draw each handle
        handles.forEach(handle => {
            this.ctx.fillRect(handle.x, handle.y, handleSize, handleSize);
            this.ctx.strokeRect(handle.x, handle.y, handleSize, handleSize);
        });

        // Restore context state
        this.ctx.restore();
    }

    /**
     * Get line width based on verification state
     */
    getLineWidthForState(state) {
        switch (state) {
            case 'Suggested':
                return 2;
            case 'Modified':
                return 3;
            case 'Verified':
                return 2;
            case 'Rejected':
                return 2;
            default:
                return 2;
        }
    }

    /**
     * Get dash pattern based on verification state
     */
    getDashPatternForState(state) {
        switch (state) {
            case 'Suggested':
                return [5, 5]; // Dashed
            case 'Modified':
                return []; // Solid
            case 'Verified':
                return []; // Solid
            case 'Rejected':
                return [10, 5]; // Long dashes
            default:
                return [5, 5]; // Dashed
        }
    }

    /**
     * Draw ROI indicator for annotations inside ROI
     */
    drawROIIndicator(x, y, width, height) {
        // Save current context state
        this.ctx.save();

        // Draw a small ROI indicator in the top-right corner
        const indicatorSize = 8;
        const indicatorX = x + width - indicatorSize - 2;
        const indicatorY = y + 2;

        // Draw indicator background
        this.ctx.fillStyle = CONFIG.ROI.STROKE_COLOR;
        this.ctx.fillRect(indicatorX, indicatorY, indicatorSize, indicatorSize);

        // Draw indicator border
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 1;
        this.ctx.setLineDash([]);
        this.ctx.strokeRect(indicatorX, indicatorY, indicatorSize, indicatorSize);

        // Draw checkmark or dot inside
        this.ctx.fillStyle = '#ffffff';
        this.ctx.beginPath();
        this.ctx.arc(indicatorX + indicatorSize/2, indicatorY + indicatorSize/2, 2, 0, 2 * Math.PI);
        this.ctx.fill();

        // Restore context state
        this.ctx.restore();
    }

    /**
     * Adjust color opacity for ROI filtering
     */
    adjustColorOpacity(color, opacity) {
        // Convert hex color to rgba with specified opacity
        if (color.startsWith('#')) {
            const hex = color.slice(1);
            const r = parseInt(hex.substr(0, 2), 16);
            const g = parseInt(hex.substr(2, 2), 16);
            const b = parseInt(hex.substr(4, 2), 16);
            return `rgba(${r}, ${g}, ${b}, ${opacity})`;
        }
        return color; // Return original if not hex
    }

    /**
     * Get contrasting text color for background
     */
    getContrastColor(backgroundColor) {
        // Simple contrast calculation - convert hex to RGB and determine if light or dark
        const hex = backgroundColor.replace('#', '');
        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);
        
        // Calculate luminance
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        
        return luminance > 0.5 ? '#000000' : '#ffffff';
    }

    /**
     * Set ROI manager reference
     */
    setROIManager(roiManager) {
        this.roiManager = roiManager;
        console.log('ROI manager reference set in canvas renderer');
    }

    /**
     * Set ROI for rendering
     */
    setROI(roi) {
        this.roi = roi;
        console.log('ROI set for rendering:', roi ? `${roi.polygon.length} points` : 'null');
        
        // Trigger redraw if we have a current image
        if (this.currentImage) {
            this.redraw();
        }
    }

    /**
     * Draw ROI (Region of Interest)
     */
    drawROI(roi) {
        if (!roi || !roi.polygon || roi.polygon.length < 3) {
            return;
        }

        console.log(`Drawing ROI with ${roi.polygon.length} points`);

        // Save current context state
        this.ctx.save();

        try {
            // Convert ROI points to canvas coordinates
            const canvasPoints = roi.polygon.map(point => 
                this.imageToCanvasCoordinates(point.x, point.y)
            );

            // Draw filled polygon
            this.ctx.beginPath();
            this.ctx.moveTo(canvasPoints[0].x, canvasPoints[0].y);
            
            for (let i = 1; i < canvasPoints.length; i++) {
                this.ctx.lineTo(canvasPoints[i].x, canvasPoints[i].y);
            }
            
            this.ctx.closePath();

            // Fill with semi-transparent color
            this.ctx.fillStyle = CONFIG.ROI.FILL_COLOR + Math.floor(CONFIG.ROI.FILL_OPACITY * 255).toString(16).padStart(2, '0');
            this.ctx.fill();

            // Draw outline
            this.ctx.strokeStyle = CONFIG.ROI.STROKE_COLOR;
            this.ctx.lineWidth = CONFIG.ROI.LINE_WIDTH;
            this.ctx.setLineDash([]);
            this.ctx.stroke();

            // Draw points
            this.ctx.fillStyle = CONFIG.ROI.STROKE_COLOR;
            canvasPoints.forEach((point, index) => {
                this.ctx.beginPath();
                this.ctx.arc(point.x, point.y, CONFIG.ROI.POINT_RADIUS, 0, 2 * Math.PI);
                this.ctx.fill();
                
                // Draw point index for debugging (optional)
                if (CONFIG.DEBUG && CONFIG.DEBUG.SHOW_ROI_INDICES) {
                    this.ctx.fillStyle = '#ffffff';
                    this.ctx.font = '12px Arial';
                    this.ctx.textAlign = 'center';
                    this.ctx.textBaseline = 'middle';
                    this.ctx.fillText(index.toString(), point.x, point.y);
                    this.ctx.fillStyle = CONFIG.ROI.STROKE_COLOR;
                }
            });

        } catch (error) {
            console.warn('Error drawing ROI:', error);
        }

        // Restore context state
        this.ctx.restore();
    }

    /**
     * Highlight a specific annotation by ID
     */
    highlightAnnotation(annotationId) {
        if (!annotationId || !this.annotations) {
            return;
        }

        // Clear previous selections
        this.annotations.forEach(annotation => {
            annotation.selected = false;
        });

        // Find and select the target annotation
        const targetAnnotation = this.annotations.find(annotation => annotation.id === annotationId);
        
        if (targetAnnotation) {
            targetAnnotation.selected = true;
            this.selectedAnnotation = annotationId;
            
            // Redraw to show selection
            this.redraw();
            
            console.log(`Highlighted annotation ${annotationId}`);
        } else {
            console.warn(`Annotation ${annotationId} not found for highlighting`);
        }
    }

    /**
     * Clear annotation selection
     */
    clearSelection() {
        if (this.annotations) {
            this.annotations.forEach(annotation => {
                annotation.selected = false;
            });
        }
        
        this.selectedAnnotation = null;
        this.redraw();
        
        console.log('Annotation selection cleared');
    }

    /**
     * Get annotation at specific canvas coordinates
     */
    getAnnotationAtPoint(canvasX, canvasY) {
        if (!this.annotations || !this.scaledDimensions) {
            return null;
        }

        // Check annotations in reverse order (top to bottom in rendering)
        for (let i = this.annotations.length - 1; i >= 0; i--) {
            const annotation = this.annotations[i];
            
            if (this.isPointInAnnotation(canvasX, canvasY, annotation)) {
                return annotation;
            }
        }

        return null;
    }

    /**
     * Check if a point is within an annotation's bounding box
     */
    isPointInAnnotation(canvasX, canvasY, annotation) {
        if (!annotation.bbox || !this.scaledDimensions) {
            return false;
        }

        const { bbox } = annotation;
        
        // Convert image coordinates to canvas coordinates
        const topLeft = this.imageToCanvasCoordinates(bbox.x, bbox.y);
        const bottomRight = this.imageToCanvasCoordinates(
            bbox.x + bbox.width, 
            bbox.y + bbox.height
        );

        return (
            canvasX >= topLeft.x &&
            canvasX <= bottomRight.x &&
            canvasY >= topLeft.y &&
            canvasY <= bottomRight.y
        );
    }

    /**
     * Get annotations filtered by verification state
     */
    getAnnotationsByState(state) {
        if (!this.annotations) {
            return [];
        }

        return this.annotations.filter(annotation => annotation.state === state);
    }

    /**
     * Update annotation state and redraw
     */
    updateAnnotationState(annotationId, newState) {
        if (!this.annotations) {
            return false;
        }

        const annotation = this.annotations.find(ann => ann.id === annotationId);
        
        if (annotation) {
            annotation.state = newState;
            annotation.modifiedAt = new Date();
            
            // Redraw to show state change
            this.redraw();
            
            console.log(`Updated annotation ${annotationId} state to ${newState}`);
            return true;
        }

        return false;
    }

    /**
     * Get canvas context for external drawing operations
     */
    getContext() {
        return this.ctx;
    }

    /**
     * Get canvas element
     */
    getCanvas() {
        return this.canvas;
    }

    /**
     * Get current scaled dimensions
     */
    getScaledDimensions() {
        return this.scaledDimensions;
    }

    /**
     * Cleanup resources
     */
    destroy() {
        this.currentImage = null;
        this.scaledDimensions = null;
        this.annotations = [];
        this.selectedAnnotation = null;
        this.roi = null;
        
        console.log('CanvasRenderer destroyed');
    }
}

/**
 * Create a default instance that can be imported
 */
export let canvasRenderer = null;

// Function to initialize the default instance
export function initializeCanvasRenderer() {
    const canvas = document.getElementById('annotation-canvas');
    const container = document.querySelector('.canvas-container');
    
    if (canvas && container) {
        canvasRenderer = new CanvasRenderer(canvas, container);
        
        // Make available for debugging
        if (typeof window !== 'undefined') {
            window.canvasRenderer = canvasRenderer;
        }
        
        return canvasRenderer;
    }
    
    return null;
}