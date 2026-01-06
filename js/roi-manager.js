/**
 * ROI Manager Module for IMA Annotate Frontend
 * Handles Region of Interest creation, modification, and management
 */

import { CONFIG } from '../config.js';

/**
 * ROI Manager Class
 * Manages ROI data, state, and operations
 */
export class ROIManager {
    constructor() {
        // ROI state
        this.currentROI = null;
        this.roiEnabled = false;
        this.roiFilteringActive = false;
        
        // Callbacks
        this.onROIChanged = null;
        this.onROIFilteringChanged = null;
        
        console.log('ROIManager initialized');
    }

    /**
     * Create a new ROI from polygon points
     */
    createROI(points, imageId) {
        if (!points || points.length < CONFIG.ROI.MIN_POINTS) {
            console.warn(`ROI requires at least ${CONFIG.ROI.MIN_POINTS} points`);
            return null;
        }

        const roi = {
            id: this.generateROIId(),
            imageId: imageId,
            polygon: [...points], // Copy points array
            name: `ROI_${Date.now()}`,
            active: true,
            createdAt: new Date(),
            modifiedAt: new Date()
        };

        this.currentROI = roi;
        console.log(`Created ROI with ${points.length} points for image ${imageId}`);
        
        // Trigger callback
        if (this.onROIChanged) {
            this.onROIChanged(this.currentROI);
        }

        return roi;
    }

    /**
     * Update existing ROI
     */
    updateROI(roiId, updates) {
        if (!this.currentROI || this.currentROI.id !== roiId) {
            console.warn(`ROI ${roiId} not found`);
            return false;
        }

        // Apply updates
        Object.assign(this.currentROI, updates);
        this.currentROI.modifiedAt = new Date();

        console.log(`Updated ROI ${roiId}`);
        
        // Trigger callback
        if (this.onROIChanged) {
            this.onROIChanged(this.currentROI);
        }

        return true;
    }

    /**
     * Clear current ROI
     */
    clearROI() {
        if (!this.currentROI) {
            console.log('No ROI to clear');
            return false;
        }

        const clearedROI = this.currentROI;
        this.currentROI = null;
        
        console.log(`Cleared ROI ${clearedROI.id}`);
        
        // Trigger callback
        if (this.onROIChanged) {
            this.onROIChanged(null);
        }

        return true;
    }

    /**
     * Get current ROI
     */
    getCurrentROI() {
        return this.currentROI;
    }

    /**
     * Check if ROI is active
     */
    hasActiveROI() {
        return this.currentROI && this.currentROI.active;
    }

    /**
     * Enable/disable ROI filtering
     */
    setROIFiltering(enabled) {
        this.roiFilteringActive = enabled;
        
        console.log(`ROI filtering ${enabled ? 'enabled' : 'disabled'}`);
        
        // Trigger callback
        if (this.onROIFilteringChanged) {
            this.onROIFilteringChanged(this.roiFilteringActive);
        }
    }

    /**
     * Check if ROI filtering is active
     */
    isROIFilteringActive() {
        return this.roiFilteringActive && this.hasActiveROI();
    }

    /**
     * Check if a point is inside the current ROI
     */
    isPointInROI(x, y) {
        if (!this.hasActiveROI()) {
            return true; // No ROI means all points are "inside"
        }

        return this.isPointInPolygon(x, y, this.currentROI.polygon);
    }

    /**
     * Check if a bounding box intersects with the current ROI
     */
    isBoundingBoxInROI(bbox) {
        if (!this.hasActiveROI()) {
            return true; // No ROI means all boxes are "inside"
        }

        // Check if any corner of the bounding box is inside the ROI
        const corners = [
            { x: bbox.x, y: bbox.y },
            { x: bbox.x + bbox.width, y: bbox.y },
            { x: bbox.x + bbox.width, y: bbox.y + bbox.height },
            { x: bbox.x, y: bbox.y + bbox.height }
        ];

        // If any corner is inside, the box intersects
        for (const corner of corners) {
            if (this.isPointInROI(corner.x, corner.y)) {
                return true;
            }
        }

        // Also check if any ROI point is inside the bounding box
        for (const point of this.currentROI.polygon) {
            if (point.x >= bbox.x && point.x <= bbox.x + bbox.width &&
                point.y >= bbox.y && point.y <= bbox.y + bbox.height) {
                return true;
            }
        }

        return false;
    }

    /**
     * Point-in-polygon test using ray casting algorithm
     */
    isPointInPolygon(x, y, polygon) {
        if (!polygon || polygon.length < 3) {
            return false;
        }

        let inside = false;
        
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            const xi = polygon[i].x;
            const yi = polygon[i].y;
            const xj = polygon[j].x;
            const yj = polygon[j].y;
            
            if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
                inside = !inside;
            }
        }
        
        return inside;
    }

    /**
     * Get ROI bounds (bounding rectangle)
     */
    getROIBounds() {
        if (!this.hasActiveROI()) {
            return null;
        }

        const points = this.currentROI.polygon;
        let minX = points[0].x;
        let minY = points[0].y;
        let maxX = points[0].x;
        let maxY = points[0].y;

        for (const point of points) {
            minX = Math.min(minX, point.x);
            minY = Math.min(minY, point.y);
            maxX = Math.max(maxX, point.x);
            maxY = Math.max(maxY, point.y);
        }

        return {
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY
        };
    }

    /**
     * Validate ROI polygon
     */
    validateROI(points) {
        if (!points || !Array.isArray(points)) {
            return { valid: false, error: 'Points must be an array' };
        }

        if (points.length < CONFIG.ROI.MIN_POINTS) {
            return { valid: false, error: `ROI requires at least ${CONFIG.ROI.MIN_POINTS} points` };
        }

        // Check that all points have x and y coordinates
        for (let i = 0; i < points.length; i++) {
            const point = points[i];
            if (typeof point.x !== 'number' || typeof point.y !== 'number') {
                return { valid: false, error: `Point ${i} must have numeric x and y coordinates` };
            }
        }

        // Check for duplicate consecutive points
        for (let i = 0; i < points.length; i++) {
            const current = points[i];
            const next = points[(i + 1) % points.length];
            
            if (Math.abs(current.x - next.x) < 1 && Math.abs(current.y - next.y) < 1) {
                return { valid: false, error: `Consecutive points ${i} and ${(i + 1) % points.length} are too close` };
            }
        }

        return { valid: true };
    }

    /**
     * Generate unique ROI ID
     */
    generateROIId() {
        return 'roi_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Set callback for ROI changes
     */
    setOnROIChanged(callback) {
        this.onROIChanged = callback;
    }

    /**
     * Set callback for ROI filtering changes
     */
    setOnROIFilteringChanged(callback) {
        this.onROIFilteringChanged = callback;
    }

    /**
     * Export ROI data
     */
    exportROI() {
        if (!this.hasActiveROI()) {
            return null;
        }

        return {
            id: this.currentROI.id,
            imageId: this.currentROI.imageId,
            polygon: [...this.currentROI.polygon],
            name: this.currentROI.name,
            active: this.currentROI.active,
            createdAt: this.currentROI.createdAt,
            modifiedAt: this.currentROI.modifiedAt
        };
    }

    /**
     * Import ROI data
     */
    importROI(roiData) {
        if (!roiData || !roiData.polygon) {
            console.warn('Invalid ROI data for import');
            return false;
        }

        const validation = this.validateROI(roiData.polygon);
        if (!validation.valid) {
            console.error('ROI validation failed:', validation.error);
            return false;
        }

        this.currentROI = {
            id: roiData.id || this.generateROIId(),
            imageId: roiData.imageId,
            polygon: [...roiData.polygon],
            name: roiData.name || `ROI_${Date.now()}`,
            active: roiData.active !== false,
            createdAt: roiData.createdAt ? new Date(roiData.createdAt) : new Date(),
            modifiedAt: new Date()
        };

        console.log(`Imported ROI ${this.currentROI.id}`);
        
        // Trigger callback
        if (this.onROIChanged) {
            this.onROIChanged(this.currentROI);
        }

        return true;
    }

    /**
     * Get ROI statistics
     */
    getROIStats() {
        if (!this.hasActiveROI()) {
            return null;
        }

        const bounds = this.getROIBounds();
        const area = this.calculatePolygonArea(this.currentROI.polygon);

        return {
            pointCount: this.currentROI.polygon.length,
            bounds: bounds,
            area: area,
            perimeter: this.calculatePolygonPerimeter(this.currentROI.polygon)
        };
    }

    /**
     * Calculate polygon area using shoelace formula
     */
    calculatePolygonArea(points) {
        if (points.length < 3) return 0;

        let area = 0;
        for (let i = 0; i < points.length; i++) {
            const j = (i + 1) % points.length;
            area += points[i].x * points[j].y;
            area -= points[j].x * points[i].y;
        }
        return Math.abs(area) / 2;
    }

    /**
     * Calculate polygon perimeter
     */
    calculatePolygonPerimeter(points) {
        if (points.length < 2) return 0;

        let perimeter = 0;
        for (let i = 0; i < points.length; i++) {
            const j = (i + 1) % points.length;
            const dx = points[j].x - points[i].x;
            const dy = points[j].y - points[i].y;
            perimeter += Math.sqrt(dx * dx + dy * dy);
        }
        return perimeter;
    }

    /**
     * Cleanup and destroy
     */
    destroy() {
        this.currentROI = null;
        this.roiEnabled = false;
        this.roiFilteringActive = false;
        this.onROIChanged = null;
        this.onROIFilteringChanged = null;
        
        console.log('ROIManager destroyed');
    }
}

// Create a default instance that can be imported
export const roiManager = new ROIManager();

// Make available for debugging
if (typeof window !== 'undefined') {
    window.roiManager = roiManager;
}