# Implementation Plan: IMA Annotate Frontend

## Overview

This implementation plan creates a modular, browser-based annotation interface for transportation vision datasets using vanilla HTML, CSS, and JavaScript. The approach emphasizes incremental development with manual testing and browser-based validation. Each task builds upon previous components to create a cohesive annotation system that will attempt to connect to dummy API endpoints and automatically fall back to sample mode.

## Tasks

- [x] 1. Set up project structure and configuration
  - Create HTML structure with Bootstrap 5 CDN integration
  - Set up modular JavaScript architecture with ES6 modules
  - Create config.js with dummy API endpoints and styling configuration
  - Initialize basic CSS for canvas and layout
  - _Requirements: 2.1, 7.2, 7.3_

- [ ] 2. Implement API client with connectivity testing
  - [x] 2.1 Create APIClient class with connection testing
    - Implement connectivity test on initialization (will fail with dummy endpoints)
    - Handle API key validation and authentication
    - Provide automatic fallback to sample mode when API fails
    - _Requirements: 2.2, 2.3, 2.4, 2.5_

  - [x] 2.2 Implement status banner system
    - Create responsive banner component for error/status messages
    - Handle API connectivity warnings and sample mode notifications
    - _Requirements: 8.1, 8.5_

- [x] 3. Create image management system
  - [x] 3.1 Implement ImageManager class
    - Handle image loading from sample directory (img folder)
    - Implement navigation with bounds checking
    - Add image preloading for smooth navigation
    - Scale images to fit canvas while preserving aspect ratio
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 10.1, 10.2_

  - [x] 3.2 Add navigation controls and keyboard shortcuts
    - Create next/previous buttons with state management
    - Implement keyboard shortcuts for navigation
    - Handle edge cases at sequence boundaries
    - _Requirements: 7.5_

- [x] 4. Checkpoint - Ensure basic image viewing works
  - Test image loading and navigation in browser, ask the user if questions arise.

- [x] 5. Implement canvas rendering system
  - [x] 5.1 Create CanvasRenderer class
    - Set up HTML5 canvas with responsive sizing
    - Implement image rendering with proper scaling
    - Add coordinate transformation utilities
    - Handle canvas clearing and redrawing
    - _Requirements: 1.4, 7.1_

  - [x] 5.2 Implement annotation visualization
    - Render bounding boxes with state-specific colors
    - Display class labels and confidence scores
    - Support segmentation mask overlays
    - Handle multiple object classes with FHWA color coding
    - _Requirements: 3.2, 3.3, 3.4, 3.5, 3.6_

- [ ] 6. Create annotation management system
  - [ ] 6.1 Implement AnnotationManager class
    - Create annotation data model and state management
    - Handle CRUD operations for annotations
    - Implement state transitions (Suggested → Modified → Verified/Rejected)
    - Add annotation counting and filtering
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [ ] 6.2 Integrate with API client for data persistence
    - Connect annotation loading to API client
    - Generate mock annotations for sample images
    - Implement local storage for annotation persistence in sample mode
    - _Requirements: 3.1, 9.1, 9.3_

- [ ] 7. Implement interactive drawing tools
  - [ ] 7.1 Create DrawingTools class
    - Handle mouse and touch events for drawing
    - Implement click-and-drag bounding box creation
    - Add resize handles for existing annotations
    - Support annotation moving and deletion
    - _Requirements: 4.1, 4.2, 4.3, 4.5_

  - [ ] 7.2 Add class assignment and state modification
    - Create UI for assigning object classes to new annotations
    - Implement state change on annotation modification
    - Validate class assignments against FHWA list
    - _Requirements: 4.4, 4.6_

- [ ] 8. Checkpoint - Ensure annotation editing works
  - Test drawing tools and annotation manipulation in browser, ask the user if questions arise.

- [ ] 9. Implement Region of Interest (ROI) functionality
  - [ ] 9.1 Create ROI drawing and management tools
    - Add polygon drawing tools for ROI definition
    - Implement ROI modification and clearing
    - Create ROI enable/disable toggle
    - _Requirements: 6.1, 6.3, 6.5_

  - [ ] 9.2 Implement ROI-based annotation filtering
    - Add geometric intersection detection
    - Filter and highlight annotations based on ROI
    - Provide visual distinction for inside/outside ROI
    - _Requirements: 6.2, 6.4_

- [ ] 10. Add data export and persistence features
  - [ ] 10.1 Implement export functionality
    - Create export to standard formats (YOLO, Pascal VOC)
    - Add manual save functionality as backup
    - Implement annotation history tracking using local storage
    - _Requirements: 9.2, 9.4, 9.5_

- [ ] 11. Implement sample mode and fallback functionality
  - [ ] 11.1 Create sample data integration
    - Load sample images from img folder
    - Generate realistic mock annotations for demonstration
    - Ensure all annotation functionality works in sample mode
    - _Requirements: 10.1, 10.3, 10.4_

  - [ ] 11.2 Implement smooth mode transitions
    - Handle transitions between sample and live API modes
    - Maintain state consistency during mode switches
    - Update UI indicators for current mode
    - _Requirements: 10.5, 10.6_

- [ ] 12. Add comprehensive error handling and user feedback
  - [ ] 12.1 Implement loading indicators and success feedback
    - Add loading spinners for async operations
    - Provide visual confirmation for successful operations
    - Handle image loading failures with placeholders
    - _Requirements: 8.2, 8.3, 8.4_

  - [ ] 12.2 Add comprehensive error logging
    - Log all errors to browser console for debugging
    - Implement structured error reporting
    - _Requirements: 8.6_

- [ ] 13. Final integration and polish
  - [ ] 13.1 Wire all components together
    - Initialize all modules in proper sequence
    - Set up event handling between components
    - Ensure proper cleanup and memory management
    - _Requirements: All requirements integration_

  - [ ] 13.2 Add final UI polish and accessibility
    - Ensure professional appearance for research use
    - Add ARIA labels and keyboard navigation support
    - Optimize performance for large image sets
    - _Requirements: 7.4_

- [ ] 14. Final checkpoint - Complete system validation
  - Test complete annotation workflow in browser, ask the user if questions arise.

## Notes

- Each task references specific requirements for traceability
- Testing will be performed manually in the browser using developer console
- Checkpoints ensure incremental validation and provide opportunities for user feedback
- The implementation emphasizes modular architecture for maintainability
- API will use dummy endpoints that fail, automatically triggering sample mode
- All functionality will work with sample images from the img folder