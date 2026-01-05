# IMA Annotate  
**Interactive Model-Assisted Annotation for Transportation Vision**

IMA Annotate is an internal, research-focused **human-verified annotation tool** for safety-critical transportation vision datasets. It combines **Grounding DINO (Swin-T)** for class-aware detection and **SAM v2** for high-quality segmentation, with a strict **human-in-the-loop verification workflow**.



IMA Annotate was built to **accelerate annotation while preserving trust, auditability, and human control**.

## System Architecture

**Browser-based UI**  
↓  
**FastAPI Backend**  
↓  
**PyTorch Models (Grounding DINO + SAM v2)**  
↓  
**Filesystem / Local Storage**

---

### Compute Setup
- Model inference runs on a **GPU server equipped with NVIDIA RTX 4090**
- No model fine-tuning is required for normal operation

---

## Core Pipeline

### 1. Detection — Grounding DINO (Swin-T)

- Assigns **object class** and **bounding box**
- Uses transportation-specific text prompts
- Produces confidence-scored detections

### 2. Human-in-the-Loop Verification

Annotators:
- Confirm or correct assigned classes
- Reject false positives
- Add **missed detections** (e.g., distant pedestrians, small vehicles)
- Flag partial visibility or occlusion

Human verification is **mandatory** before export.

### 3. Segmentation — SAM v2

- Produces pixel-accurate masks
- Triggered by:
  - Verified DINO bounding boxes
  - Manual user selection
- Masks can be interactively adjusted

---

## Optional Model Adaptation

Although not required, IMA Annotate supports:
- Adjusting or refining Grounding DINO outputs
- Using a **custom detection model trained on a small, verified dataset**

This is useful for:
- Site-specific layouts
- Unique camera viewpoints
- Challenging lighting or weather conditions

---

## Missed Detection Handling

Annotators explicitly check for:
- Distant persons
- Small or partially occluded vehicles
- Objects missed by automated detection

Missed objects can be added manually and segmented with SAM v2.

---

## Region of Interest (ROI)

IMA Annotate supports **ROI selection**, particularly useful for:

- Traffic Monitoring Counts (TMC)
- Entry / egress counting
- Intersection-level analytics

Only objects intersecting the ROI can be:
- Counted
- Exported
- Used for downstream analysis

---

## Annotation States

Each object progresses through explicit states:

| State      | Meaning                          |
|------------|----------------------------------|
| Suggested  | Model-generated (DINO)           |
| Modified   | Human-edited                     |
| Verified   | Human-approved                   |
| Rejected   | False positive                   |

Only **Verified** objects are exportable.

---

## Vehicle & Object Class Mapping (FHWA / ITE-Aligned)

The following class table was prepared as part of a **vehicle classification and micromobility ITE project**.  
It is currently used in:
- ASSETS

| Annotated Label | FHWA Class | FHWA Class Name                         | Classification Domain | Definition / Notes |
|-----------------|------------|-----------------------------------------|-----------------------|--------------------|
| Motorcycle      | Class 1    | Motorcycles                             | FHWA Motor Vehicle    | Two- or three-wheeled motor vehicles |
| Car             | Class 2    | Passenger Cars                          | FHWA Motor Vehicle    | 2-axle, 4-tire passenger vehicles (sedans, hatchbacks) |
| Van             | Class 2    | Passenger Cars                          | FHWA Motor Vehicle    | 2-axle, 4-tire vans and minivans |
| Pickup truck    | Class 2    | Passenger Cars                          | FHWA Motor Vehicle    | 2-axle, 4-tire pickups and SUVs |
| Bus             | Class 4    | Buses                                   | FHWA Motor Vehicle    | Transit, shuttle, or coach buses (2 or more axles) |
| Medium truck    | Class 5–6  | Single-Unit Trucks                      | FHWA Motor Vehicle    | Single-unit trucks with 2 or 3+ axles (e.g., box trucks, garbage trucks, cement mixers) |
| Semi (tractor)  | Class 7–13 | Combination Trucks                      | FHWA Motor Vehicle    | Tractor unit of multi-axle tractor–trailer combinations |
| Truck trailer   | Class 7–13 | Combination Trucks (Trailer Component) | FHWA Motor Vehicle    | Trailer unit of a tractor–trailer (not a standalone FHWA class) |
| Car trailer     | Class 7–13 | Combination Vehicles (Trailer Component) | FHWA Motor Vehicle    | Trailer towed by a car or pickup (e.g., boat, utility trailer) |
| Bicycle         | —          | —                                       | Micromobility / VRU   | Human-powered or electric bicycles (non-FHWA) |
| Scooter         | —          | —                                       | Micromobility / VRU   | Stand-up scooters, including e-scooters (non-FHWA) |
| Wheelchair      | —          | —                                       | Mobility Device       | Manual or powered mobility assist device |
| Person          | —          | —                                       | Pedestrian / VRU      | Human traveling on foot |
| Dog             | —          | —                                       | Animal                | Non-human animal in roadway or right-of-way |
| Other           | —          | —                                       | Miscellaneous Object  | Unclassified objects (e.g., shopping carts, debris) |


- **Roadway sign annotation work** ongoing
- 

## Output Format

Annotations are exported in a **model-agnostic structure**, supporting both **segmentation** and **bounding-box–based detection** workflows.

```
dataset/
├── images/
├── bounding_boxes/
│   ├── yolo/
│   └── voc_cvat/
└── seg_mask/
    ├── yolo/
    └── voc_cvat/
```



### Segmentation
- Pixel-wise masks are stored in the `masks/` directory
- Each mask corresponds to a verified object instance
- Suitable for:
  - Instance segmentation
  - SAM fine-tuning
  - Semantic segmentation pipelines

### Bounding Boxes
Bounding box annotations are exported in standard formats:

- **YOLO format** (`.txt`)
- **Pascal VOC XML format** (`.xml`)


---

## Deployment

- Local-first
- No cloud dependency
- Simple filesystem storage
- Suitable for sensitive or restricted datasets

---



## Funding Acknowledgement

This work was **partly funded by the ASSETS project**.

---


## Project Status

- **Hosted locally**
- **Currently for internal use by lab members**
- **No public access at this time**

If resources and future projects allow, we would love to make IMA Annotate public in the future.

---


## Future Directions

Potential future work includes:
- Public release (subject to funding and resources)
- Multi-user audit trails
- Standards-aware labeling (FHWA / MUTCD references)
- Deeper integration with edge-collected datasets

---





