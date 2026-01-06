/**
 * Error Logger Module for IMA Annotate Frontend
 * Provides comprehensive error logging and structured error reporting
 */

import { CONFIG } from '../config.js';

/**
 * ErrorLogger class handles comprehensive error logging and reporting
 * Provides structured error reporting for debugging purposes
 */
export class ErrorLogger {
    constructor() {
        this.errorHistory = [];
        this.maxHistorySize = 100;
        this.sessionId = this.generateSessionId();
        this.startTime = new Date().toISOString();
        
        this.init();
    }

    /**
     * Initialize the error logger
     */
    init() {
        // Set up global error handlers
        this.setupGlobalErrorHandlers();
        
        // Log session start
        this.logInfo('Error logger initialized', {
            sessionId: this.sessionId,
            startTime: this.startTime,
            userAgent: navigator.userAgent,
            url: window.location.href
        });
        
        console.log('Error logger initialized with session ID:', this.sessionId);
    }

    /**
     * Set up global error handlers
     */
    setupGlobalErrorHandlers() {
        // Handle uncaught JavaScript errors
        window.addEventListener('error', (event) => {
            this.logError('Uncaught JavaScript Error', {
                message: event.message,
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno,
                stack: event.error?.stack,
                type: 'javascript_error'
            });
        });

        // Handle unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            this.logError('Unhandled Promise Rejection', {
                reason: event.reason,
                stack: event.reason?.stack,
                type: 'promise_rejection'
            });
        });

        // Handle resource loading errors
        window.addEventListener('error', (event) => {
            if (event.target !== window) {
                this.logError('Resource Loading Error', {
                    element: event.target.tagName,
                    source: event.target.src || event.target.href,
                    type: 'resource_error'
                });
            }
        }, true);
    }

    /**
     * Generate unique session ID
     */
    generateSessionId() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Log error with structured data
     * @param {string} message - Error message
     * @param {Object} context - Additional context data
     * @param {Error} error - Error object (optional)
     */
    logError(message, context = {}, error = null) {
        const errorEntry = this.createLogEntry('error', message, context, error);
        
        // Add to history
        this.addToHistory(errorEntry);
        
        // Log to console with styling
        console.error(
            `%c[ERROR] ${message}`,
            'color: #dc3545; font-weight: bold;',
            errorEntry
        );
        
        // Log to external service if configured
        this.sendToExternalService(errorEntry);
        
        return errorEntry;
    }

    /**
     * Log warning with structured data
     * @param {string} message - Warning message
     * @param {Object} context - Additional context data
     */
    logWarning(message, context = {}) {
        const warningEntry = this.createLogEntry('warning', message, context);
        
        // Add to history
        this.addToHistory(warningEntry);
        
        // Log to console with styling
        console.warn(
            `%c[WARNING] ${message}`,
            'color: #ffc107; font-weight: bold;',
            warningEntry
        );
        
        return warningEntry;
    }

    /**
     * Log info with structured data
     * @param {string} message - Info message
     * @param {Object} context - Additional context data
     */
    logInfo(message, context = {}) {
        const infoEntry = this.createLogEntry('info', message, context);
        
        // Add to history
        this.addToHistory(infoEntry);
        
        // Log to console with styling
        console.info(
            `%c[INFO] ${message}`,
            'color: #17a2b8; font-weight: bold;',
            infoEntry
        );
        
        return infoEntry;
    }

    /**
     * Log debug information
     * @param {string} message - Debug message
     * @param {Object} context - Additional context data
     */
    logDebug(message, context = {}) {
        // Only log debug in development or when debug is enabled
        if (!this.isDebugEnabled()) {
            return null;
        }
        
        const debugEntry = this.createLogEntry('debug', message, context);
        
        // Add to history
        this.addToHistory(debugEntry);
        
        // Log to console with styling
        console.debug(
            `%c[DEBUG] ${message}`,
            'color: #6c757d; font-weight: normal;',
            debugEntry
        );
        
        return debugEntry;
    }

    /**
     * Create structured log entry
     */
    createLogEntry(level, message, context = {}, error = null) {
        const entry = {
            id: this.generateLogId(),
            timestamp: new Date().toISOString(),
            sessionId: this.sessionId,
            level: level.toUpperCase(),
            message,
            context: {
                ...context,
                url: window.location.href,
                userAgent: navigator.userAgent,
                timestamp: Date.now()
            }
        };

        // Add error details if provided
        if (error) {
            entry.error = {
                name: error.name,
                message: error.message,
                stack: error.stack,
                cause: error.cause
            };
        }

        // Add browser environment info
        entry.environment = {
            viewport: {
                width: window.innerWidth,
                height: window.innerHeight
            },
            screen: {
                width: screen.width,
                height: screen.height
            },
            connection: navigator.connection ? {
                effectiveType: navigator.connection.effectiveType,
                downlink: navigator.connection.downlink
            } : null
        };

        // Add application state if available
        if (window.imaApp) {
            entry.appState = this.getApplicationState();
        }

        return entry;
    }

    /**
     * Generate unique log entry ID
     */
    generateLogId() {
        return 'log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    }

    /**
     * Add entry to history with size management
     */
    addToHistory(entry) {
        this.errorHistory.push(entry);
        
        // Maintain history size limit
        if (this.errorHistory.length > this.maxHistorySize) {
            this.errorHistory.shift();
        }
    }

    /**
     * Get current application state for logging
     */
    getApplicationState() {
        try {
            const app = window.imaApp;
            if (!app) return null;

            return {
                initialized: app.initialized,
                currentImageIndex: app.state?.currentImageIndex,
                apiConnected: app.state?.apiConnected,
                drawingMode: app.state?.drawingMode,
                loading: app.state?.loading,
                imageCount: app.state?.images?.length || 0
            };
        } catch (error) {
            return { error: 'Failed to get app state' };
        }
    }

    /**
     * Check if debug logging is enabled
     */
    isDebugEnabled() {
        return CONFIG.DEBUG_MODE || 
               localStorage.getItem('ima-debug') === 'true' ||
               window.location.search.includes('debug=true');
    }

    /**
     * Send log entry to external service (placeholder)
     */
    sendToExternalService(entry) {
        // This would send to an external logging service in production
        // For now, we'll just store in localStorage for debugging
        try {
            const key = `ima-error-log-${entry.id}`;
            localStorage.setItem(key, JSON.stringify(entry));
            
            // Clean up old entries (keep last 20)
            this.cleanupLocalStorageLogs();
        } catch (error) {
            console.warn('Failed to store error log in localStorage:', error);
        }
    }

    /**
     * Clean up old log entries from localStorage
     */
    cleanupLocalStorageLogs() {
        try {
            const logKeys = Object.keys(localStorage)
                .filter(key => key.startsWith('ima-error-log-'))
                .sort()
                .reverse();
            
            // Keep only the most recent 20 entries
            const keysToRemove = logKeys.slice(20);
            keysToRemove.forEach(key => localStorage.removeItem(key));
        } catch (error) {
            console.warn('Failed to cleanup localStorage logs:', error);
        }
    }

    /**
     * Get error history
     */
    getErrorHistory(level = null, limit = null) {
        let history = [...this.errorHistory];
        
        // Filter by level if specified
        if (level) {
            history = history.filter(entry => entry.level === level.toUpperCase());
        }
        
        // Limit results if specified
        if (limit) {
            history = history.slice(-limit);
        }
        
        return history;
    }

    /**
     * Get error statistics
     */
    getErrorStats() {
        const stats = {
            total: this.errorHistory.length,
            byLevel: {},
            byType: {},
            recent: {
                last5Minutes: 0,
                last15Minutes: 0,
                lastHour: 0
            }
        };

        const now = Date.now();
        const fiveMinutesAgo = now - (5 * 60 * 1000);
        const fifteenMinutesAgo = now - (15 * 60 * 1000);
        const oneHourAgo = now - (60 * 60 * 1000);

        this.errorHistory.forEach(entry => {
            // Count by level
            stats.byLevel[entry.level] = (stats.byLevel[entry.level] || 0) + 1;
            
            // Count by type
            const type = entry.context?.type || 'unknown';
            stats.byType[type] = (stats.byType[type] || 0) + 1;
            
            // Count recent errors
            const entryTime = new Date(entry.timestamp).getTime();
            if (entryTime > fiveMinutesAgo) stats.recent.last5Minutes++;
            if (entryTime > fifteenMinutesAgo) stats.recent.last15Minutes++;
            if (entryTime > oneHourAgo) stats.recent.lastHour++;
        });

        return stats;
    }

    /**
     * Export error logs for debugging
     */
    exportLogs(format = 'json') {
        const exportData = {
            sessionId: this.sessionId,
            startTime: this.startTime,
            exportTime: new Date().toISOString(),
            stats: this.getErrorStats(),
            logs: this.errorHistory
        };

        if (format === 'json') {
            return JSON.stringify(exportData, null, 2);
        } else if (format === 'csv') {
            return this.convertToCSV(exportData.logs);
        }
        
        return exportData;
    }

    /**
     * Convert logs to CSV format
     */
    convertToCSV(logs) {
        if (logs.length === 0) return '';
        
        const headers = ['timestamp', 'level', 'message', 'type', 'url'];
        const rows = logs.map(log => [
            log.timestamp,
            log.level,
            log.message.replace(/"/g, '""'), // Escape quotes
            log.context?.type || '',
            log.context?.url || ''
        ]);
        
        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(field => `"${field}"`).join(','))
        ].join('\n');
        
        return csvContent;
    }

    /**
     * Clear error history
     */
    clearHistory() {
        const clearedCount = this.errorHistory.length;
        this.errorHistory = [];
        
        // Clear localStorage logs
        const logKeys = Object.keys(localStorage)
            .filter(key => key.startsWith('ima-error-log-'));
        logKeys.forEach(key => localStorage.removeItem(key));
        
        this.logInfo('Error history cleared', { clearedCount });
        
        return clearedCount;
    }

    /**
     * Log API errors with specific context
     */
    logApiError(operation, error, requestData = null) {
        return this.logError(`API Error: ${operation}`, {
            type: 'api_error',
            operation,
            requestData,
            statusCode: error.status,
            statusText: error.statusText,
            responseData: error.response
        }, error);
    }

    /**
     * Log canvas/rendering errors
     */
    logCanvasError(operation, error, canvasContext = null) {
        return this.logError(`Canvas Error: ${operation}`, {
            type: 'canvas_error',
            operation,
            canvasContext: canvasContext ? {
                width: canvasContext.canvas.width,
                height: canvasContext.canvas.height
            } : null
        }, error);
    }

    /**
     * Log image loading errors
     */
    logImageError(filename, error, imageData = null) {
        return this.logError(`Image Loading Error: ${filename}`, {
            type: 'image_error',
            filename,
            imageData,
            naturalWidth: error.target?.naturalWidth,
            naturalHeight: error.target?.naturalHeight
        }, error);
    }

    /**
     * Log annotation errors
     */
    logAnnotationError(operation, annotationId, error, annotationData = null) {
        return this.logError(`Annotation Error: ${operation}`, {
            type: 'annotation_error',
            operation,
            annotationId,
            annotationData
        }, error);
    }

    /**
     * Log user interaction errors
     */
    logUserInteractionError(interaction, error, eventData = null) {
        return this.logError(`User Interaction Error: ${interaction}`, {
            type: 'interaction_error',
            interaction,
            eventData
        }, error);
    }

    /**
     * Destroy the error logger and clean up
     */
    destroy() {
        // Log session end
        this.logInfo('Error logger session ended', {
            sessionDuration: Date.now() - new Date(this.startTime).getTime(),
            totalErrors: this.errorHistory.length
        });
        
        // Remove global event listeners
        // Note: In a real implementation, we'd store references to the handlers
        // and remove them here. For simplicity, we'll leave them as they don't
        // cause memory leaks in this single-page application context.
        
        console.log('Error logger destroyed');
    }
}

// Export singleton instance
export const errorLogger = new ErrorLogger();