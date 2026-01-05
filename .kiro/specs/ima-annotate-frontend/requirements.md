# Requirements Document

## Introduction

IMA Annotate Frontend is a browser-based user interface for the Interactive Model-Assisted Annotation tool for transportation vision datasets. The frontend provides an intuitive interface for annotators to review, verify, and edit AI-generated annotations (from Grounding DINO and SAM v2 models) while maintaining strict human-in-the-loop verification workflows.

## Glossary

- **Frontend**: The browser-based user interface component
- **Backend_API**: The FastAPI server that provides images and annotations
- **Annotation**: Object detection bounding box or segmentation mask with class label
- **Canvas**: The drawing area where images and annotations are displayed
- **Verification_State**: The current status of an annotation (Suggested, Modified, Verified, Rejected)
- **ROI**: Region of Interest for focused annotation work
- **Navigation_Controls**: UI elements for moving between images (next/previous buttons)
- **Drawing_Tools**: Interactive tools for creating and editing annotations

## Requirements

### Requirement 1: Image Display and Navigation

**User Story:** As an annotator, I want to view transportation images with navigation controls, so that I can systematically review and annotate the dataset.

#### Acceptance Criteria

1. WHEN the application loads, THE Frontend SHALL display the first available image in a canvas area
2. WHEN a user clicks the next button, THE Frontend SHALL load and display the subsequent image
3. WHEN a user clicks the previous button, THE Frontend SHALL load and display the preceding image
4. WHEN displaying an image, THE Frontend SHALL scale it appropriately to fit the canvas while maintaining aspect ratio
5. WHEN no more images are available in the forward direction, THE Frontend SHALL disable the next button
6. WHEN no more images are available in the backward direction, THE Frontend SHALL disable the previous button

### Requirement 2: API Configuration and Connectivity

**User Story:** As a system administrator, I want to configure API endpoints and credentials, so that the frontend can communicate with the backend services.

#### Acceptance Criteria

1. THE Frontend SHALL load configuration from a config.js file containing API_BASE_URL and API_KEY
2. WHEN the application starts, THE Frontend SHALL test connectivity to the Backend_API
3. IF the API_KEY is not set or invalid, THEN THE Frontend SHALL display a warning banner at the top of the interface
4. IF the Backend_API is unreachable, THEN THE Frontend SHALL display a connection error message
5. WHEN API connectivity is restored, THE Frontend SHALL automatically hide error messages and enable functionality

### Requirement 3: Annotation Display and Visualization

**User Story:** As an annotator, I want to see AI-generated annotations overlaid on images, so that I can review and verify the model predictions.

#### Acceptance Criteria

1. WHEN an image is loaded, THE Frontend SHALL request annotations from the Backend_API
2. WHEN annotations are received, THE Frontend SHALL display bounding boxes as colored rectangles over the image
3. WHEN annotations include segmentation masks, THE Frontend SHALL display them as semi-transparent colored overlays
4. WHEN displaying annotations, THE Frontend SHALL show class labels and confidence scores
5. WHEN annotations have different verification states, THE Frontend SHALL use distinct visual styling for each state
6. THE Frontend SHALL support displaying multiple object classes with different colors according to the FHWA classification system

### Requirement 4: Interactive Drawing and Editing Tools

**User Story:** As an annotator, I want drawing tools to create and modify annotations, so that I can add missed detections and correct model errors.

#### Acceptance Criteria

1. THE Frontend SHALL provide a drawing tool for creating new bounding boxes by click-and-drag
2. THE Frontend SHALL provide tools for resizing existing bounding boxes by dragging corner handles
3. THE Frontend SHALL provide tools for moving existing annotations by dragging
4. WHEN creating new annotations, THE Frontend SHALL allow users to assign object classes from the predefined list
5. THE Frontend SHALL provide tools for deleting annotations
6. WHEN annotations are modified, THE Frontend SHALL update their verification state to "Modified"

### Requirement 5: Annotation State Management

**User Story:** As an annotator, I want to manage annotation verification states, so that I can track which objects have been reviewed and approved.

#### Acceptance Criteria

1. THE Frontend SHALL display the current verification state for each annotation (Suggested, Modified, Verified, Rejected)
2. WHEN a user clicks on an annotation, THE Frontend SHALL provide options to change its verification state
3. WHEN a user verifies an annotation, THE Frontend SHALL update its state to "Verified"
4. WHEN a user rejects an annotation, THE Frontend SHALL update its state to "Rejected" and optionally hide it
5. THE Frontend SHALL provide a summary count of annotations by verification state

### Requirement 6: Region of Interest (ROI) Support

**User Story:** As an annotator, I want to define regions of interest, so that I can focus annotation work on specific areas of the image.

#### Acceptance Criteria

1. THE Frontend SHALL provide tools for drawing ROI boundaries on images
2. WHEN an ROI is defined, THE Frontend SHALL highlight only annotations that intersect with the ROI
3. THE Frontend SHALL provide options to enable/disable ROI filtering
4. WHEN ROI filtering is active, THE Frontend SHALL visually distinguish between annotations inside and outside the ROI
5. THE Frontend SHALL allow users to modify or clear existing ROI definitions

### Requirement 7: Responsive User Interface

**User Story:** As an annotator, I want a clean and responsive interface, so that I can work efficiently on different screen sizes and devices.

#### Acceptance Criteria

1. THE Frontend SHALL use a responsive layout that adapts to different screen sizes
2. THE Frontend SHALL provide a toolbar with clearly labeled buttons for all major functions
3. THE Frontend SHALL use Bootstrap or similar framework for consistent styling
4. WHEN the interface loads, THE Frontend SHALL display a professional appearance suitable for research use
5. THE Frontend SHALL provide keyboard shortcuts for common actions (next/previous image, save, etc.)

### Requirement 8: Error Handling and User Feedback

**User Story:** As an annotator, I want clear feedback about system status and errors, so that I can understand what's happening and take appropriate action.

#### Acceptance Criteria

1. WHEN API requests fail, THE Frontend SHALL display specific error messages in a top banner
2. WHEN loading images or annotations, THE Frontend SHALL show loading indicators
3. WHEN operations complete successfully, THE Frontend SHALL provide visual confirmation
4. IF image loading fails, THEN THE Frontend SHALL display a placeholder with error information
5. WHEN API fails, THE Frontend SHALL display a warning banner mentioning that additional features might not be available since additional JavaScript wasn't downloaded
6. THE Frontend SHALL log errors to the browser console for debugging purposes

### Requirement 9: Data Persistence and Export

**User Story:** As an annotator, I want my annotation changes to be saved, so that my work is preserved and can be exported for model training.

#### Acceptance Criteria

1. WHEN annotations are modified, THE Frontend SHALL automatically save changes to the Backend_API
2. THE Frontend SHALL provide manual save functionality as a backup option
3. WHEN saving fails, THE Frontend SHALL retry the operation and notify the user of any persistent failures
4. THE Frontend SHALL provide export functionality for annotations in standard formats
5. THE Frontend SHALL maintain annotation history for audit purposes

### Requirement 10: Sample Data Integration

**User Story:** As a developer, I want the frontend to work with sample images, so that I can test and demonstrate the system without requiring a full backend setup.

#### Acceptance Criteria

1. THE Frontend SHALL use sample images from the img folder (im-sc1.jpg, img-sc2.jpg, img-sc3.jpg) for testing
2. WHEN the Backend_API is unavailable, THE Frontend SHALL automatically fall back to displaying sample images from the img folder
3. WHEN using sample images, THE Frontend SHALL allow manual bounding box annotation functionality
4. THE Frontend SHALL generate mock annotations for sample images to demonstrate functionality
5. WHEN using sample data, THE Frontend SHALL clearly indicate this mode to users in the warning banner
6. THE Frontend SHALL provide smooth transitions between sample mode and live API mode