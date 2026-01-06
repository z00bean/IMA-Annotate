/**
 * Configuration file for IMA Annotate Frontend
 * Contains API endpoints, styling configuration, and application settings
 */

export const CONFIG = {
    // API Configuration (Dummy endpoints that will fail to trigger sample mode)
    API_BASE_URL: "http://dummy-api-endpoint.example.com/api", // Dummy URL that will fail
    API_KEY: "dummy-api-key-12345", // Dummy API key
    
    // Canvas Configuration
    CANVAS_PADDING: 10,
    MAX_CANVAS_WIDTH: 1600,
    MAX_CANVAS_HEIGHT: 1200,
    MIN_CANVAS_WIDTH: 600,
    MIN_CANVAS_HEIGHT: 400,
    
    // Sample Images for Testing/Demo
    SAMPLE_IMAGES: [
        "img/im-sc1.jpg",
        "img/img-sc2.jpg", 
        "img/img-sc3.jpg"
    ],
    
    // FHWA Object Class Colors
    ANNOTATION_COLORS: {
        "Car": "#FF6B6B",           // Red
        "Truck": "#4ECDC4",         // Teal
        "Bus": "#45B7D1",           // Blue
        "Motorcycle": "#96CEB4",    // Light Green
        "Bicycle": "#FFEAA7",       // Yellow
        "Person": "#DDA0DD",        // Plum
        "Other": "#98D8C8"          // Mint
    },
    
    // Verification State Colors
    STATE_COLORS: {
        "Suggested": "#FFA500",     // Orange
        "Modified": "#FFD700",      // Gold
        "Verified": "#32CD32",      // Lime Green
        "Rejected": "#FF6347"       // Tomato
    },
    
    // Drawing Configuration
    DRAWING: {
        LINE_WIDTH: 2,
        HANDLE_SIZE: 8,
        MIN_BOX_SIZE: 10,
        SELECTION_TOLERANCE: 5
    },
    
    // ROI Configuration
    ROI: {
        LINE_WIDTH: 3,
        FILL_OPACITY: 0.2,
        STROKE_COLOR: "#FF4500",    // Orange Red
        FILL_COLOR: "#FF4500",      // Orange Red
        POINT_RADIUS: 6,
        MIN_POINTS: 3,
        SELECTION_TOLERANCE: 8
    },
    
    // UI Configuration
    UI: {
        ANIMATION_DURATION: 300,
        TOAST_DURATION: 3000,
        AUTO_SAVE_DELAY: 1000,
        PRELOAD_IMAGES: 2
    },
    
    // Debug Configuration
    DEBUG_MODE: false, // Set to true to enable debug logging
    
    // Export Formats
    EXPORT_FORMATS: {
        YOLO: "yolo",
        PASCAL_VOC: "pascal_voc",
        COCO: "coco"
    },
    
    // Keyboard Shortcuts
    KEYBOARD_SHORTCUTS: {
        NEXT_IMAGE: "ArrowRight",
        PREV_IMAGE: "ArrowLeft",
        SAVE: "KeyS",
        DRAW_MODE: "KeyD",
        SELECT_MODE: "KeyV",
        ROI_MODE: "KeyR",
        DELETE: "Delete",
        ESCAPE: "Escape"
    },
    
    // API Endpoints
    ENDPOINTS: {
        TEST_CONNECTION: "/health",
        GET_IMAGES: "/images",
        GET_ANNOTATIONS: "/annotations",
        SAVE_ANNOTATION: "/annotations",
        DELETE_ANNOTATION: "/annotations",
        EXPORT_ANNOTATIONS: "/export"
    },
    
    // Error Messages
    ERROR_MESSAGES: {
        API_UNREACHABLE: "Backend API is unreachable. Using sample mode with limited functionality.",
        INVALID_API_KEY: "Invalid API key. Please check your configuration.",
        IMAGE_LOAD_FAILED: "Failed to load image. Skipping to next image.",
        SAVE_FAILED: "Failed to save annotations. Changes may be lost.",
        EXPORT_FAILED: "Failed to export annotations. Please try again.",
        NETWORK_ERROR: "Network error occurred. Please check your connection."
    },
    
    // Success Messages
    SUCCESS_MESSAGES: {
        ANNOTATIONS_SAVED: "Annotations saved successfully",
        EXPORT_COMPLETE: "Annotations exported successfully",
        CONNECTION_RESTORED: "API connection restored"
    }
};

// Validation function to check if configuration is valid
export function validateConfig() {
    const errors = [];
    
    if (!CONFIG.API_BASE_URL) {
        errors.push("API_BASE_URL is required");
    }
    
    if (!CONFIG.SAMPLE_IMAGES || CONFIG.SAMPLE_IMAGES.length === 0) {
        errors.push("At least one sample image is required");
    }
    
    if (!CONFIG.ANNOTATION_COLORS || Object.keys(CONFIG.ANNOTATION_COLORS).length === 0) {
        errors.push("Annotation colors configuration is required");
    }
    
    if (!CONFIG.STATE_COLORS || Object.keys(CONFIG.STATE_COLORS).length === 0) {
        errors.push("State colors configuration is required");
    }
    
    return {
        isValid: errors.length === 0,
        errors: errors
    };
}

// Helper function to get color for annotation class
export function getClassColor(className) {
    return CONFIG.ANNOTATION_COLORS[className] || CONFIG.ANNOTATION_COLORS["Other"];
}

// Helper function to get color for verification state
export function getStateColor(state) {
    return CONFIG.STATE_COLORS[state] || CONFIG.STATE_COLORS["Suggested"];
}

// Helper function to check if API key is configured
export function isApiKeyConfigured() {
    return CONFIG.API_KEY && CONFIG.API_KEY.trim().length > 0;
}

// Helper function to get full API endpoint URL
export function getApiEndpoint(endpoint) {
    return CONFIG.API_BASE_URL + CONFIG.ENDPOINTS[endpoint];
}