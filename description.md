# Rim Reaper NZ — Project Description

> **New Zealand Offline-First Pothole Road Scanner, Left-Lane Vector Tracker, Trip Corridor Analyzer & 67 Council / Waka Kotahi NZTA Advocacy Suite**

---

## Overview
**Rim Reaper NZ** is a zero-dependency, offline-first Progressive Web App (PWA) engineered for New Zealand roads. Built for both 1080p in-vehicle displays and `100dvh` mobile cockpit mounts, it combines a synthesized Pothole Road Scanner HUD, real-time GPS + accelerometer hazard detection, New Zealand Left-Hand Lane (`LHL`) vector mathematics, and an automated reporting/advocacy suite covering all **67 Territorial Authorities**, **Auckland Transport (AT)**, and **Waka Kotahi NZ Transport Agency (NZTA)** State Highways (`SH1`–`SH99`).

---

## Key Capabilities

### 1. Logo Boot-Up Splash & Pothole Scanner Self-Test (`js/audio-radar.js`)
* **Interactive Splash Screen:** Displays the custom Rim Reaper NZ crest with one-tap audio/sensor unlock (`POWER ON ROAD SCANNER`) and instant bypass option.
* **Synthesized Web Audio Self-Test:** Zero external audio assets required; generates dual-tone power-on chirps, multi-stage surface/seismic/laser/GPS sweep tones, and bilingual English / Te Reo Māori voice synthesis.
* **Immediate Auto-Location on Boot:** Automatically acquires device coordinates via hardware GPS (`navigator.geolocation`) with Network/IP geolocation fallback and OpenStreetMap Nominatim reverse geocoding to center the map and display the street/suburb name immediately after boot.

### 2. NZ Left-Hand Lane (`LHL`) & Motion Engine (`js/geo-lane.js`)
* **1.75-Second Reaction-Time Lookback:** Backtracks logged GPS coordinates along the vehicle's reverse azimuth based on instantaneous speed so potholes tapped after impact are pinned at the exact strike point.
* **Keep-Left Lateral Classification:** Records travel bearing (`0°–360°`) and classifies hazards into `Left Wheel Track (Verge)`, `Center Lane Track`, or `Right Wheel Track (Centerline)`.
* **Directional & Divided-Carriageway Filtering:** Triggers approaching alerts only when the vehicle's heading is within `±45°` of the hazard's recorded lane vector, ignoring opposite-carriageway reports on divided highways.
* **Swiss-Cheese Corridor Clustering:** Automatically merges 3+ potholes within a `50m` stretch into a single `"SWISS CHEESE ZONE"` alert to prevent alarm fatigue.
* **Z-Axis Accelerometer Auto-Bump Detection:** Calibrated across 4 vehicle profiles (`Car`, `4WD / Ute`, `Moto / EV`, `Heavy Truck`) with unsealed gravel road vibration suppression.

### 3. Mode 1 — Pothole Scanner HUD (`index.html`)
* **High-Contrast Cockpit Display:** Features a live Leaflet dark-matter tactical map, 360° vector radar scope, 5-level proximity pulse bar, blinking-colon digital clock (`HH:MM:SS`), live speed (`km/h`), compass heading, road/SH badge, and GPS accuracy readout.
* **Mobile Hardware Integration:** Supports iOS/Android `DeviceMotionEvent` & `DeviceOrientationEvent` permission handshakes, Screen Wake Lock (`navigator.wakeLock`), rear-camera photo capture (`capture="environment"`), and native mobile Share Sheet export.
* **Safety Lock-Out (`>10 km/h`):** Locks complex navigation tabs while driving so only the oversized one-tap hazard logger, voice trigger, and 4-second `STILL THERE` / `FIXED` pass-by verification bar remain active (overrideable via Passenger Co-Pilot Mode).
* **Visual Themes:** Instant switching between `Standard OLED`, `Night-Vision Red`, `Classic Amber`, and `Color-Blind Safe Cyan`.

### 4. Mode 2 — Hazard Review, Photo Sizing & SLA Tracker
* **Interactive Hazard Registry:** Filterable by road type, severity, and repair status (`Unreported`, `Exported`, `Fixed`, `Verified`) with composite confidence scores (`0–100%`) and `8m` duplicate merging.
* **Reference Object Photo Scale Estimator:** Computes pothole diameter (`mm`) and estimated depth (`mm`) using a known scale reference (`NZ $2 Coin (26.5mm)`, `NZ White Edge Line (100mm)`, or `Work Boot (300mm)`).
* **Manual Coordinate & Camera Entry:** Supports manual lat/lng logging with photo attachment for post-trip reporting.

### 5. Mode 3 — Trip Corridor Scanner & Dashcam `.SRT` Exporter
* **39-Town NZ Gazetteer Corridor Scanner:** Performs a `250m` corridor buffer scan between any two NZ towns/cities, calculating route distance, total hazards, critical rim-breakers, slips/washouts, and Swiss-Cheese cluster zones prior to departure.
* **Dashcam `.SRT` Subtitle Generator:** Exports synchronized SubRip (`.SRT`) subtitle files containing timestamped GPS coordinates, RAMM references, lane tracks, and severities for direct overlay onto dashcam video footage.

### 6. Mode 4 — 67 NZ Councils + Waka Kotahi NZTA Advocacy Suite (`js/nz-councils.js`)
* **Offline Jurisdiction & RAMM `RS/RP` Resolution:** Automatically assigns every pothole to Waka Kotahi NZTA (for State Highways) or the exact local Territorial Authority and Ward Councillor, complete with calculated RAMM Route Station / Route Position (`RS/RP`) displacement references.
* **One-Click Accountability Tools:**
  * **Pre-Formatted Council & Councillor `mailto:` Report**
  * **Public Liability Tyre & Rim Damage Claim Dossier (`.TXT`)**
  * **Official Information Act (`OIA` / `LGOIMA`) Maintenance Records Request**
  * **Snap Send Solve / Antenno Clipboard Bundle**
  * **Bulk GIS `.GeoJSON` & `.CSV` Exports**
  * **Encrypted `.JSON` Database Backup, Restore & Peer-to-Peer Share**
  * **Live Council League Table** ranking authorities by open defects, overdue SLA breaches, and confirmation counts.

### 7. Companion Displays & Keyboard Shortcuts
* **Contractor Ops & SLA Admin (`admin.html` — `A` key):** Live dispatch metrics, SLA breach queue, contractor work-order export, demo seed/reset controls, and full searchable 67 Council + NZTA directory.
* **Passenger Co-Pilot Remote (`remote.html` — `R` key):** Dedicated oversized 1-tap logging pad (`Severe Rim-Breaker`, `Medium Pothole`, `Minor Surface`, `Slip / Dropout`) and live telemetry simulator synced across tabs via `BroadcastChannel('rim_reaper_sync')`.
* **Slideshow & HUD Keyboard Controls:**
  * `ArrowLeft` / `ArrowRight`: Cycle HUD modes (`prevSlide()` / `nextSlide()`)
  * `ArrowUp`: Reset to Mode 1 (`Pothole Scanner HUD`)
  * `ArrowDown`: Advance to next module
  * `Space`: Pause / Resume scanner sweep
  * `1`–`9`: Set auto-cycle slide duration (`10s`–`90s`)
  * `0`: Toggle Lock / Unlock display freeze
  * `A` / `R`: Open Admin (`admin.html`) or Remote (`remote.html`)

---

## Project Architecture
| File | Role |
| :--- | :--- |
| `index.html` | Main PWA shell, boot splash screen, Mode 1–4 views, and HUD controls |
| `admin.html` | Contractor Ops Dispatch, SLA Breach Queue & 67 Council Directory |
| `remote.html` | Passenger Co-Pilot Instant Logger & Telemetry Injector |
| `css/styles.css` | 1080p & `100dvh` responsive styling, HUD themes, and animations |
| `js/audio-radar.js` | Web Audio API synthesizer, Geiger proximity alerts & bilingual TTS |
| `js/geo-lane.js` | GPS/IP locator, 1.75s lookback, `LHL` vector math & bump detector |
| `js/nz-councils.js` | 67 NZ Councils dataset, 39 NZ towns gazetteer & RAMM `RS/RP` engine |
| `js/db.js` | `IndexedDB` (`nz_pothole_db`) storage, `8m` deduplication & seeded data |
| `js/app.js` | Application state, Leaflet map sync, Trip Scanner & Advocacy generators |
| `manifest.json` / `sw.js` | PWA manifest and offline Service Worker cache |

---

## Active Project Links
* **Live Display:** https://mrmegatronix.github.io/Rim-Reaper-NZ/
* **Admin Panel:** https://mrmegatronix.github.io/Rim-Reaper-NZ/admin.html
* **Remote Control:** https://mrmegatronix.github.io/Rim-Reaper-NZ/remote.html
* **Local Server:** http://localhost:8092/
* **Repository:** https://github.com/mrmegatronix/Rim-Reaper-NZ
