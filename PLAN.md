# Rim-Reaper-NZ — Master Implementation Plan

## 1. System Architecture & "Out-of-the-Box" Offline Strategy
*   **Stack:** Zero-dependency Vanilla HTML5/CSS3/JS Progressive Web App (PWA) with a local bundle architecture and Service Worker (`sw.js`) for 100% offline execution.
*   **Storage Engine:** `IndexedDB` (`nz_pothole_db`) storing logged potholes, trip breadcrumb traces, offline council boundary polygons, driver statistics, and queued council export payloads.
*   **Pre-Bundled NZ Dataset:** Embedded GeoJSON bounding polygons for all 67 New Zealand Territorial Authorities (TAs), Ward boundaries, Auckland Transport (AT), and Waka Kotahi NZTA State Highway corridors (`SH1`–`SH99`) so jurisdiction and councillor resolution work offline immediately on first launch.
*   **Map Tile Caching:** Raster/vector tile caching via Service Worker for OpenStreetMap / LINZ (Toitū Te Whenua) basemaps with an offline vector grid fallback when uncached rural areas are traversed.
*   **Peer-to-Peer Offline Sync (QR / Local File Drop):** Share newly logged potholes device-to-device in remote areas without cell reception (e.g., East Cape, West Coast, Fiordland) via animated QR codes or Web Share `.pothole` bundles.
*   **Encrypted Backup & Restore:** Export and import the complete `IndexedDB` database as an encrypted local file so switching devices never loses historical logs.
*   **Waka Kotahi TREIS Live Overlay (When Online):** Automatically sync with the NZTA Traffic and Road Event Information System (TREIS) API when connectivity returns to cross-reference active roadworks, temporary speed limits (`30 km/h` gravel/reseal zones), and slips.

---

## 2. Radar Detector Startup Sequence (Boot-Up Audio & Visuals)
*   **Visual Self-Test:** Segment-display / OLED matrix sweep lighting up all band indicators (`X`, `K`, `Ka`, `LASER`, `POTHOLE`, `SLIP`, `GPS`, `NZTA`), voltage/status readout, and blinking colon digital clock (`HH:MM:SS`).
*   **Web Audio API Synthesizer (Zero External Audio Files Required):**
    *   `0.0s - 0.3s`: Power-on dual-tone chirp (`880Hz` → `1760Hz` square/sawtooth blend).
    *   `0.3s - 1.2s`: Classic radar detector band sweep — sequential pitch-stepped brap/beep tones (`X-Band: 1050Hz`, `K-Band: 1480Hz`, `Ka-Band: 2200Hz`, `Laser: 3100Hz` fast pulse).
    *   `1.2s - 1.8s`: Bilingual English / Te Reo Māori speech synthesis (`window.speechSynthesis`) or formant chime announcing `"System Ready. GPS Active. Scanning New Zealand Roads."`
*   **Auto-Start From Car Bluetooth or CarPlay:** Launch the boot sequence and enter Driving Mode automatically when the device connects to vehicle Bluetooth or CarPlay / Android Auto.

---

## 3. Motion, Heading & NZ Left-Hand Lane / Road-Side Detection
*   **Movement Detection:** Continuous fusion of `navigator.geolocation.watchPosition` (`speed`, `heading`, `accuracy`) and `DeviceMotionEvent` accelerometer variance to distinguish stationary vs. moving states (`> 2.8 m/s` / `10 km/h` auto-triggers Driving Mode).
*   **Travel Vector & Bearing Calculation:** When hardware compass heading is unavailable, bearing $\theta$ is computed dynamically from sequential GPS fixes $(lat_1, lon_1) \to (lat_2, lon_2)$ using forward azimuth trigonometry.
*   **Reaction-Time Lookback Backtracking:** Automatically offset logged GPS coordinates backward along the travel vector by 1.5–2.0 seconds of current speed so potholes tapped after passing them are pinned at the exact point of impact.
*   **NZ Left-Side-of-Road Determination:**
    *   **Keep-Left Vector Offset:** New Zealand traffic drives on the **left**. Each logged pothole records the vehicle's instantaneous travel bearing (`0°–360°`) and tags the hazard to the **Left-Hand Lane (`LHL`)** of that cardinal/intercardinal heading.
    *   **Cross-Track Lateral Offset:** Uses high-frequency GPS + lateral accelerometer impulse upon tap/bump to classify whether the pothole is on the **Left Wheel Track (Verge/Shoulder side)**, **Center Lane**, or **Right Wheel Track (Centerline side)** of the current lane.
    *   **Directional & Divided-Carriageway Filtering:** Approaching alerts only trigger when the driver's current heading is within $\pm 45^\circ$ of the pothole's recorded lane heading, and explicitly ignore potholes on the opposite carriageway of divided roads (e.g., Auckland/Wellington motorways and Waikato Expressway).
*   **Gravel / Unsealed Road Auto-Suppression:** Detect unsealed metal/gravel roads from road surface metadata or continuous high-frequency vibration to automatically pause false-positive bump detection.

---

## 4. Mode 1: Driving / Radar Mode (Minimal HUD & Safety Controls)
*   **UI Layout & Optional Driving Dashboard:** High-contrast dark OLED/LED radar interface optimized for peripheral vision with zero text wrapping, blinking clock colons, current speed (`km/h`), road speed limit, compass heading, altitude, current road/SH badge, and GPS accuracy indicator.
*   **Night-Vision Red / Amber HUD Dimmer:** Automatically switch the radar display to a low-glare deep red or classic Valentine-One / Escort amber monochrome palette based on sunset times or ambient light sensors.
*   **Safety & Driving Lock-Outs:**
    *   **Lock-Out While Moving:** Block complex menus, text typing, and review screens above `10 km/h` so only the oversized tap-to-log target and radar alerts remain active.
    *   **Passenger Co-Pilot Mode:** Allow a passenger confirmation prompt to unlock full logging controls (photo capture, severity, lane position, road type) while the vehicle is moving.
*   **Geiger-Counter Proximity Tones & Audio Management:**
    *   **Detection Zone (`500m – 300m`, scaled up to `800m` at `100–110 km/h`):** Slow warning beep (`1 beep / 1.5s` at `2400Hz`) + Amber HUD bar (`LEVEL 1`).
    *   **Approach Zone (`300m – 100m`):** Accelerating pulse rate proportional to closing distance and vehicle speed (`2–5 beeps/sec` at `2600Hz`) + Orange HUD bar (`LEVEL 2–4`).
    *   **Impact / Immediate Zone (`< 100m`):** Rapid continuous radar "brap" alarm (`10 beeps/sec` at `2900Hz`) + Red flashing `POTHOLE AHEAD` distance countdown and lane side indicator.
    *   **Auto-Mute & Speed-Sensitive Scaling:** Suppress radar proximity tones below `15 km/h` (intersections, driveways, heavy traffic) and dynamically scale alert lead-time by speed zone.
    *   **Grace Period After Logging:** Suppress alerts for any pothole logged within the last 5 minutes so drivers are not immediately re-warned about a hazard they just reported.
    *   **Pothole Cluster / "Swiss Cheese" Corridor Mode:** Merge 3 or more potholes within a 50-meter stretch into a single `"Degraded Surface Zone"` alert to prevent continuous audio fatigue on badly damaged rural roads.
    *   **Audio Ducking & Haptic-Only Mode:** Briefly duck background media volume during radar tones, or switch to vibration-only alerts for motorcyclists and podcast listeners.
*   **Hands-Free & Instant Hazard Logging:**
    *   **Giant Full-Width Tap Zone:** Single tap logs backtracked GPS coordinates, travel bearing, left-lane vector, timestamp, and speed.
    *   **Bluetooth Media Button & Voice Trigger:** Log potholes hands-free via steering-wheel media buttons (`MediaSession API`) or offline wake-words (`"Log Pothole"`, `"Big Pothole"`).
    *   **Vehicle Profile Calibration:** Switch between `Car`, `4WD/Ute`, `Motorcycle/EV`, and `Heavy Truck/Campervan` profiles to calibrate Z-axis G-force bump sensitivity and wheel-track warnings.
    *   **Still-There / Fixed One-Tap Pass-By Verification:** Display an oversized `STILL THERE` / `FIXED` confirmation prompt on the HUD for 4 seconds immediately after passing a logged pothole.
    *   **Battery Saver Mode:** Reduce GPS polling frequency and dim the HUD on long rural stretches with no logged potholes within 5 km.

---

## 5. Data Quality, Classification & NZ-Specific Hazard Categories
*   **Duplicate Merging (`8m` Radius):** Automatically combine repeated logs within 8 meters on the same heading into a single hazard record and increment its confirmation counter.
*   **Confidence Score Engine:** Calculate a composite reliability score (`0–100%`) per pothole based on confirmation count, GPS accuracy at capture, accelerometer bump intensity, and report age.
*   **GPS Accuracy Filter:** Flag or reject automatic logs where horizontal GPS accuracy is worse than `20m` (e.g., tunnels, gorges, dense bush).
*   **Stale Record Auto-Expiry:** Automatically archive unconfirmed potholes after 90 days so the active radar database remains free of stale hazards.
*   **Heavy Rain & Flood-Risk Multiplier:** Flag potholes logged during wet weather or situated in low-lying gullies as high-priority `"Water-Filled / Invisible Hazard"` alerts.
*   **NZ Road Type & Hazard Tagging:**
    *   **Road Classifications:** Tag records as `State Highway`, `Local Sealed Road`, `Unsealed Gravel Road`, `Bridge Deck`, `One-Lane Bridge`, or `Cattle Stop`.
    *   **Cycleway & Shoulder Hazards:** Dedicated category for road shoulders and NZ cycle trails (e.g., *Te Ara Ahi*, *Remutaka Cycle Trail*).
    *   **Slip, Washout & Dropout Category:** Log slips, washouts, and edge dropouts using the same radar workflow.
    *   **Holiday Road Toll Preset:** Heightened-sensitivity warning preset for long weekends and Christmas holiday periods along high-volume corridors (`SH1`, `SH2`, `SH6`).

---

## 6. Mode 2: Review, Manual Input, Photo Sizing & Trip Planner
*   **Pothole Review & Manual Entry:**
    *   Interactive map and sortable table of all logged hazards with status badges (`Unreported`, `Exported`, `Fixed`, `Verified`), confidence scores, and council SLA timers.
    *   **Photo Size Estimation:** Estimate pothole diameter and depth from attached photos using a known reference scale overlay (shoe, NZ coin, or standard road marking width).
    *   **Before/After Photo Comparison:** Side-by-side image slider once a pothole is marked `Fixed` to verify repair quality.
*   **Trip Planner & Route Hazard Scanner:**
    *   Select Origin & Destination using the pre-loaded NZ towns/cities gazetteer or custom coordinates.
    *   Corridor buffer scan (`250m` buffer around route polyline or State Highway segment) calculating total potholes, slips, severity breakdown, and high-density `"Swiss Cheese"` danger zones before departure.
*   **Dashcam Clip Timestamp Bookmarking:** Export a synchronized `.SRT` subtitle overlay or timestamp log (`HH:MM:SS`) per trip so drivers can quickly extract matching dashcam footage.
*   **Driver Statistics & Accessibility:**
    *   Track total kilometres scanned, potholes logged, and repairs confirmed.
    *   Support Te Reo Māori / English toggle, large-text mode, colour-blind-safe palettes (amber/cyan/magenta options), and screen-reader labels in Review Mode.

---

## 7. New Zealand Local Council, NZTA Export & Advocacy Suite
*   **Automatic Jurisdiction & RAMM Linear Referencing:**
    *   **State Highways (`SH1`–`SH99`):** Routed to **Waka Kotahi NZ Transport Agency (NZTA)**.
    *   **Local Roads & Wards:** Point-in-polygon lookup resolves the exact **Territorial Authority** (all 67 councils + Auckland Transport) and local **Council Ward / Elected Councillor**.
    *   **RAMM Linear Referencing (`RS/RP`):** Convert WGS84 coordinates into NZ's standard Road Assessment and Maintenance Management Route Station and Route Position (`RS/RP`) displacement values used by Fulton Hogan, Downer, and Higgins road crews.
*   **Export Formats & Public Accountability Tools:**
    *   **Pre-Formatted Council & Councillor Email (`mailto:` / EML):** Structured report with WGS84/NZGD2000 coordinates, RAMM `RS/RP` reference, Google Maps link, travel direction (*Northbound Left Lane*), severity, and optional CC to the local Ward Councillor.
    *   **CSV / GeoJSON Batch Export:** One-click download grouped by Council/NZTA for bulk import into council GIS/RAMM portals.
    *   **Snap Send Solve / Antenno Clipboard Package:** One-click copyable text + photo bundle for NZ council reporting apps.
    *   **Tyre & Rim Damage Claim Dossier Generator:** Export a formal NZTA / Council Public Liability claim package containing historical logs proving when the pothole was first recorded versus when vehicle damage occurred, paired with dashcam timestamps.
    *   **Council SLA Countdown & Escalation Tracker:** Track days elapsed since export and highlight overdue hazards exceeding standard NZ maintenance response targets (e.g., 48 hours for high-severity State Highway defects).
    *   **Council League Table & Monthly Summary Report:** Rank councils by open pothole count and average repair speed, exportable as a shareable summary card/PDF.
    *   **Official Information Act (OIA / LGOIMA) Request Generator:** Pre-fill a formal LGOIMA / OIA request asking a council or NZTA for maintenance inspection and repair records for a specific road corridor.

---

## 8. Proposed File Structure (`/run/media/zeus/6TB-1/__GITHUB NUC/Rim-Reaper-NZ`)
*   `index.html` — Core application shell, HUD radar display, co-pilot toggle, review/planner views, advocacy modals, and bilingual UI containers.
*   `css/styles.css` — High-contrast radar HUD theme, Night-Vision Red/Amber dimmer, colour-blind-safe tokens, blinking colon clock, and 1080p/mobile responsive layouts.
*   `js/audio-radar.js` — Web Audio API synthesizer for boot sequence sweeps, Geiger-counter proximity alerts, audio ducking, haptic fallback, and voice/media-button triggers.
*   `js/geo-lane.js` — GPS watcher, reaction-time lookback interpolation, accelerometer vehicle-profile fusion, Haversine/bearing engine, divided-road filter, and NZ left-hand lane vector calculator.
*   `js/nz-councils.js` — Embedded NZ 67 Territorial Authorities, Ward boundaries, Waka Kotahi State Highway geofence dataset, RAMM `RS/RP` converter, and council contact directory.
*   `js/db.js` — IndexedDB wrapper for offline pothole CRUD, `8m` deduplication, confidence scoring, 90-day expiry, photo blobs, encrypted backup, and QR peer-to-peer sync.
*   `js/app.js` — Mode controller (`10 km/h` safety lock-out), Trip Planner corridor scanner, `.SRT` dashcam exporter, Council Export generator, Damage Claim Dossier, OIA template builder, and Council League Table.
*   `sw.js` & `manifest.json` — Offline Service Worker and PWA manifest for standalone "out-of-the-box" operation.
