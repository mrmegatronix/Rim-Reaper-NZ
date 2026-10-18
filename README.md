# Rim-Reaper-NZ

> **New Zealand Offline-First Pothole Radar Detector, Left-Lane Vector Tracker, Trip Corridor Scanner & 67 Council / Waka Kotahi NZTA Export Suite**

## Core Features
* **Radar Detector Startup Sequence (`js/audio-radar.js`)**: Zero-dependency Web Audio API band sweep (`X`, `K`, `Ka`, `LASER`, `POTHOLE`, `SLIP`, `GPS`, `NZTA`), segment matrix self-test, and bilingual English / Te Reo Māori voice synthesis.
* **NZ Left-Hand Lane & Directional Engine (`js/geo-lane.js`)**:
  * **1.75s Reaction-Time Lookback**: Automatically backtracks GPS coordinates along the vehicle's travel vector so potholes tapped after impact are pinned accurately.
  * **Keep-Left Lateral Vector (`LHL`)**: Tags hazards to New Zealand's Left-Hand Lane (`Left Wheel Track`, `Center Track`, `Right Wheel Track`) and filters out opposite-carriageway hazards (`±45°` cone + divided motorway filter).
  * **Swiss-Cheese Cluster Detection**: Automatically merges 3+ potholes within 50m into a single corridor alert.
* **Mode 1 — Driving / Radar HUD (`index.html`)**: 1080p high-contrast OLED radar scope, Geiger-counter proximity bar, `>10 km/h` safety lock-out with Co-Pilot unlock, Night-Vision Red & Valentine-1 Amber themes, and 4-second `STILL THERE` / `FIXED` pass-by verification prompt.
* **Mode 2 — Review, Sizing & SLA Tracker**: Interactive log table, Reference Object Photo Scale Estimator (NZ $2 Coin, 100mm White Edge Line, Work Boot), and manual coordinate entry.
* **Mode 3 — Trip Corridor Scanner & Dashcam `.SRT` Exporter**: Scans route corridors between 39 NZ towns/cities and exports synchronized `.SRT` dashcam subtitle overlays.
* **Mode 4 — All 67 NZ Councils + Waka Kotahi NZTA Advocacy Suite (`js/nz-councils.js`)**:
  * Automatic point-in-polygon / nearest centroid resolution for all 67 Territorial Authorities, Auckland Transport, and `SH1`–`SH99` RAMM Route Station (`RS/RP`) references.
  * One-click Council & Ward Councillor `mailto:` generator, Public Liability Tyre & Rim Damage Claim Dossier, Official Information Act (`OIA` / `LGOIMA`) request generator, Snap Send Solve bundle, CSV/GeoJSON export, and Council League Table.
* **Companion Panels**:
  * `admin.html` (`A` key): Contractor Ops Dispatch, SLA Breach Queue & 67 Council Directory.
  * `remote.html` (`R` key): Passenger Co-Pilot Instant Logger & Live Telemetry Injector.
