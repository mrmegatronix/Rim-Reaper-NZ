/**
 * Rim-Reaper-NZ — Geolocation, Reaction-Time Lookback, NZ Left-Hand Lane Engine & Corridor Scanner
 */

window.GeoLaneEngine = (function () {
  const VEHICLE_PROFILES = {
    Car: { name: 'Standard Passenger Car', gThreshold: 2.2, lookbackSec: 1.75 },
    '4WD/Ute': { name: '4WD / Dual-Cab Ute', gThreshold: 2.6, lookbackSec: 1.75 },
    'Motorcycle/EV': { name: 'Motorcycle / Low-Profile EV', gThreshold: 1.7, lookbackSec: 1.5 },
    'Heavy Truck': { name: 'Heavy Freight Truck / Campervan', gThreshold: 2.9, lookbackSec: 2.0 }
  };

  let currentProfile = 'Car';
  let gravelSuppression = false;
  let holidayPreset = false;
  let watchId = null;
  let simTimer = null;

  // Default telemetry state (starts near SH1 Dome Valley so approaching hazards can be tested immediately)
  const state = {
    lat: -36.3695,
    lon: 174.6195,
    speedKmh: 0,
    heading: 345,
    cardinal: 'NNW',
    altitudeM: 142,
    accuracyM: 4.1,
    gForceZ: 1.0,
    wheelTrack: 'Left Wheel Track (Verge Side)',
    roadName: 'SH1 Dome Valley (Northbound)',
    speedLimitKmh: 100,
    isMoving: false,
    isSimulating: false
  };

  const recentLogTimestamps = new Map(); // id -> timestamp for 5-minute grace period

  function toRad(deg) {
    return (deg * Math.PI) / 180;
  }

  function toDeg(rad) {
    return (rad * 180) / Math.PI;
  }

  function computeBearing(lat1, lon1, lat2, lon2) {
    const φ1 = toRad(lat1);
    const φ2 = toRad(lat2);
    const Δλ = toRad(lon2 - lon1);
    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
    const θ = Math.atan2(y, x);
    return (toDeg(θ) + 360) % 360;
  }

  function headingToCardinal(deg) {
    const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    return dirs[Math.round(((deg % 360) / 22.5)) % 16];
  }

  function angleDiff(a, b) {
    return Math.abs(((a - b + 540) % 360) - 180);
  }

  /**
   * Reaction-Time Lookback Backtracking + NZ Keep-Left Lateral Vector Offset
   * Offsets logged GPS coordinate backward along travel heading by (speed * lookbackSec)
   * and shifts 1.8m left of road centerline for New Zealand Left-Hand Lane accuracy.
   */
  function computeBacktrackedLeftLanePosition(lat, lon, speedKmh, headingDeg) {
    const profile = VEHICLE_PROFILES[currentProfile] || VEHICLE_PROFILES.Car;
    const speedMs = Math.max(0, speedKmh / 3.6);
    const backtrackMeters = speedMs * profile.lookbackSec;

    // Reverse heading for backtrack
    const reverseRad = toRad((headingDeg + 180) % 360);
    // Left-hand lane lateral offset (-90 deg from forward heading in NZ)
    const leftLateralRad = toRad((headingDeg + 270) % 360);
    const leftOffsetMeters = 1.85;

    const metersPerDegLat = 111320;
    const metersPerDegLon = 111320 * Math.cos(toRad(lat));

    const dLatBack = (backtrackMeters * Math.cos(reverseRad)) / metersPerDegLat;
    const dLonBack = (backtrackMeters * Math.sin(reverseRad)) / metersPerDegLon;

    const dLatLeft = (leftOffsetMeters * Math.cos(leftLateralRad)) / metersPerDegLat;
    const dLonLeft = (leftOffsetMeters * Math.sin(leftLateralRad)) / metersPerDegLon;

    return {
      lat: Number((lat + dLatBack + dLatLeft).toFixed(6)),
      lon: Number((lon + dLonBack + dLonLeft).toFixed(6)),
      backtrackMeters: Number(backtrackMeters.toFixed(1)),
      laneSide: `${headingToCardinal(headingDeg)}-Bound Left-Hand Lane (LHL)`
    };
  }

  /**
   * Scan ahead for approaching potholes in the driver's NZ Left-Hand Lane
   * - Filters out opposite-direction potholes (heading difference > 45°)
   * - Enforces 5-minute grace period after logging
   * - Groups 3+ potholes within 50m into a "Swiss Cheese Corridor" alert
   */
  function scanApproachingHazards(hazards) {
    const now = Date.now();
    const gracePeriodMs = 5 * 60 * 1000;
    const matches = [];

    for (const h of hazards) {
      if (h.status === 'Fixed' || h.status === 'Archived (90d Stale)') continue;

      // 5-minute grace period check
      const recentLogged = recentLogTimestamps.get(h.id);
      if (recentLogged && now - recentLogged < gracePeriodMs) continue;
      if (now - h.timestamp < gracePeriodMs && h.confirmations <= 1) continue;

      const distM = window.NZ_DATA.haversineMeters(state.lat, state.lon, h.lat, h.lon);
      if (distM > 1200) continue;

      // Directional & Divided Carriageway Filter: Must be within ±45° of recorded hazard lane heading
      const headingDelta = angleDiff(state.heading, Number(h.heading || 0));
      if (headingDelta > 45) continue;

      // Ensure the hazard is ahead of the vehicle (bearing to hazard within ±75° of travel heading)
      const bearingToHazard = computeBearing(state.lat, state.lon, h.lat, h.lon);
      const aheadDelta = angleDiff(state.heading, bearingToHazard);
      if (aheadDelta > 80 && distM > 25) continue;

      matches.push(Object.assign({}, h, { distanceM: Math.round(distM), bearingToHazard }));
    }

    matches.sort((a, b) => a.distanceM - b.distanceM);

    // Check for Swiss-Cheese Pothole Cluster (3+ potholes within 50m of nearest hazard)
    let isCluster = false;
    let clusterCount = 0;
    if (matches.length >= 3) {
      const lead = matches[0];
      const nearby = matches.filter(
        (m) => window.NZ_DATA.haversineMeters(lead.lat, lead.lon, m.lat, m.lon) <= 55
      );
      if (nearby.length >= 3) {
        isCluster = true;
        clusterCount = nearby.length;
      }
    }

    return {
      nearest: matches[0] || null,
      approachingList: matches,
      isCluster,
      clusterCount
    };
  }

  /**
   * Scan a Trip Route Corridor between two NZ towns/coordinates (250m corridor buffer along segment)
   */
  function scanTripCorridor(origin, destination, allHazards) {
    const totalDistKm = Number(
      (window.NZ_DATA.haversineMeters(origin.lat, origin.lon, destination.lat, destination.lon) / 1000).toFixed(1)
    );
    const routeBearing = computeBearing(origin.lat, origin.lon, destination.lat, destination.lon);

    // Point-to-segment distance check across 40 interpolated corridor steps
    const corridorHazards = [];
    for (const h of allHazards) {
      if (h.status === 'Fixed') continue;
      let minCorridorDistM = Infinity;
      const steps = 40;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const pLat = origin.lat + (destination.lat - origin.lat) * t;
        const pLon = origin.lon + (destination.lon - origin.lon) * t;
        const d = window.NZ_DATA.haversineMeters(pLat, pLon, h.lat, h.lon);
        if (d < minCorridorDistM) minCorridorDistM = d;
      }
      // Include hazards within 18km of straight-line corridor for winding NZ State Highways
      if (minCorridorDistM <= 18000) {
        corridorHazards.push(Object.assign({}, h, { corridorOffsetM: Math.round(minCorridorDistM) }));
      }
    }

    const rimBenders = corridorHazards.filter((h) => h.severity === 'Rim Bender').length;
    const slips = corridorHazards.filter((h) => h.hazardType && h.hazardType.includes('Slip')).length;
    const wetHazards = corridorHazards.filter((h) => h.wetWeatherRisk).length;

    return {
      origin,
      destination,
      totalDistKm,
      routeBearing: Math.round(routeBearing),
      cardinal: headingToCardinal(routeBearing),
      corridorHazards,
      rimBenders,
      slips,
      wetHazards
    };
  }

  let wakeLockSentinel = null;
  let telemetryCallback = null;
  let autoBumpCallback = null;
  let motionListenersAttached = false;

  async function acquireWakeLock() {
    if ('wakeLock' in navigator) {
      try {
        wakeLockSentinel = await navigator.wakeLock.request('screen');
        state.wakeLockActive = true;
      } catch (e) {
        state.wakeLockActive = false;
      }
    }
  }

  function attachMotionAndCompassListeners() {
    if (motionListenersAttached) return;
    motionListenersAttached = true;

    if (typeof window.DeviceMotionEvent !== 'undefined') {
      window.addEventListener('devicemotion', (event) => {
        const acc = event.accelerationIncludingGravity;
        if (!acc) return;
        const totalG = Math.sqrt((acc.x || 0) ** 2 + (acc.y || 0) ** 2 + (acc.z || 0) ** 2) / 9.81;
        state.gForceZ = Number(totalG.toFixed(2));

        if (Math.abs(acc.x || 0) > 2.2) {
          state.wheelTrack = (acc.x || 0) < 0 ? 'Left Wheel Track (Verge Side)' : 'Right Wheel Track (Centerline Side)';
        }

        const profile = VEHICLE_PROFILES[currentProfile] || VEHICLE_PROFILES.Car;
        const threshold = holidayPreset ? profile.gThreshold * 0.85 : profile.gThreshold;

        if (!gravelSuppression && state.speedKmh >= 15 && totalG >= threshold) {
          if (typeof autoBumpCallback === 'function') {
            autoBumpCallback(state.gForceZ, state.wheelTrack);
          }
        }
      });
    }

    if (typeof window.DeviceOrientationEvent !== 'undefined') {
      window.addEventListener('deviceorientation', (event) => {
        if (state.isSimulating) return;
        let compass = null;
        if (typeof event.webkitCompassHeading === 'number') {
          compass = event.webkitCompassHeading;
        } else if (typeof event.alpha === 'number') {
          compass = (360 - event.alpha) % 360;
        }
        if (compass !== null && !isNaN(compass) && state.speedKmh < 8) {
          state.heading = Math.round(compass);
          state.cardinal = headingToCardinal(state.heading);
          if (typeof telemetryCallback === 'function') telemetryCallback(state);
        }
      });
    }
  }

  /**
   * Explicitly request iOS/Android Accelerometer, Gyroscope, Compass & Screen Wake Lock permissions
   * Must be invoked inside a user tap handler (e.g. Splash Screen Power-On or Locate Me button)
   */
  async function requestMobileHardwarePermissions() {
    await acquireWakeLock();
    try {
      if (
        typeof window.DeviceMotionEvent !== 'undefined' &&
        typeof window.DeviceMotionEvent.requestPermission === 'function'
      ) {
        await window.DeviceMotionEvent.requestPermission();
      }
    } catch (e) {}

    try {
      if (
        typeof window.DeviceOrientationEvent !== 'undefined' &&
        typeof window.DeviceOrientationEvent.requestPermission === 'function'
      ) {
        await window.DeviceOrientationEvent.requestPermission();
      }
    } catch (e) {}

    attachMotionAndCompassListeners();
  }

  function applyGpsPosition(pos) {
    const prevLat = state.lat;
    const prevLon = state.lon;
    state.lat = Number(pos.coords.latitude.toFixed(6));
    state.lon = Number(pos.coords.longitude.toFixed(6));
    state.accuracyM = Number((pos.coords.accuracy || 4.5).toFixed(1));
    state.altitudeM = pos.coords.altitude ? Math.round(pos.coords.altitude) : state.altitudeM;
    state.hasRealGps = true;

    const gpsSpeedKmh = pos.coords.speed !== null && !isNaN(pos.coords.speed) ? pos.coords.speed * 3.6 : 0;
    state.speedKmh = Math.round(gpsSpeedKmh);
    state.isMoving = state.speedKmh > 10;

    if (pos.coords.heading !== null && !isNaN(pos.coords.heading) && pos.coords.heading >= 0) {
      state.heading = Math.round(pos.coords.heading);
    } else if (window.NZ_DATA.haversineMeters(prevLat, prevLon, state.lat, state.lon) > 3) {
      state.heading = Math.round(computeBearing(prevLat, prevLon, state.lat, state.lon));
    }
    state.cardinal = headingToCardinal(state.heading);

    const juris = window.NZ_DATA.resolveJurisdiction(state.lat, state.lon);
    state.roadName = juris.isStateHighway
      ? `${juris.highwayCode} (${juris.council.name})`
      : `${juris.council.name} Road Corridor`;

    if (typeof telemetryCallback === 'function') telemetryCallback(state);
  }

  function startSensors(onTelemetryChange, onAutoBumpDetected) {
    telemetryCallback = onTelemetryChange;
    autoBumpCallback = onAutoBumpDetected;
    attachMotionAndCompassListeners();

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        acquireWakeLock();
      }
    });

    if ('geolocation' in navigator) {
      try {
        if (watchId !== null) navigator.geolocation.clearWatch(watchId);
        watchId = navigator.geolocation.watchPosition(
          (pos) => {
            if (state.isSimulating) return;
            applyGpsPosition(pos);
          },
          () => {},
          { enableHighAccuracy: true, maximumAge: 1000, timeout: 7000 }
        );
      } catch (e) {}
    }
  }

  /**
   * 1-Tap Real Phone GPS Lock ("📍 MY GPS")
   */
  function locateMeNow(callback) {
    requestMobileHardwarePermissions();
    if (!('geolocation' in navigator)) {
      if (callback) callback({ ok: false, httpsRequired: false, message: 'Geolocation not supported on this device' });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (simTimer) {
          clearInterval(simTimer);
          simTimer = null;
          state.isSimulating = false;
        }
        applyGpsPosition(pos);
        if (callback) callback({ ok: true, state });
      },
      (err) => {
        const httpsBlocked = !window.isSecureContext || err.code === 1;
        if (callback) {
          callback({
            ok: false,
            httpsRequired: !window.isSecureContext,
            message: !window.isSecureContext
              ? 'Mobile browsers require HTTPS for live phone GPS. Tap HTTPS link or use SIM DRIVE.'
              : `GPS Permission / Signal: ${err.message || 'Unavailable'}`
          });
        }
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 8000 }
    );
  }

  /**
   * Built-In NZ Highway Telemetry Simulator so users can test approaching alerts,
   * 10 km/h safety lock-out, and pass-by verification immediately.
   */
  function toggleDriveSimulation(corridorKey = 'SH1-DOME', onTick) {
    if (simTimer) {
      clearInterval(simTimer);
      simTimer = null;
      state.isSimulating = false;
      state.speedKmh = 0;
      state.isMoving = false;
      if (typeof onTick === 'function') onTick(state);
      return false;
    }

    const presets = {
      'SH1-DOME': { lat: -36.3702, lon: 174.6190, heading: 345, speed: 94, roadName: 'SH1 Dome Valley (Northbound)', limit: 100 },
      'SH1-DESERT': { lat: -39.2895, lon: 175.7388, heading: 185, speed: 98, roadName: 'SH1 Desert Road (Southbound)', limit: 100 },
      'SH73-OTIRA': { lat: -42.9050, lon: 171.5665, heading: 280, speed: 78, roadName: 'SH73 Otira Viaduct (Westbound)', limit: 80 },
      'SH2-REMUTAKA': { lat: -41.1172, lon: 175.2235, heading: 60, speed: 65, roadName: 'SH2 Remutaka Hill (Eastbound)', limit: 80 }
    };

    const chosen = presets[corridorKey] || presets['SH1-DOME'];
    state.lat = chosen.lat;
    state.lon = chosen.lon;
    state.heading = chosen.heading;
    state.cardinal = headingToCardinal(chosen.heading);
    state.speedKmh = chosen.speed;
    state.speedLimitKmh = chosen.limit;
    state.roadName = chosen.roadName;
    state.isMoving = true;
    state.isSimulating = true;

    simTimer = setInterval(() => {
      const stepMeters = (state.speedKmh / 3.6) * 0.5; // 500ms tick
      const rad = toRad(state.heading);
      state.lat = Number((state.lat + (stepMeters * Math.cos(rad)) / 111320).toFixed(6));
      state.lon = Number((state.lon + (stepMeters * Math.sin(rad)) / (111320 * Math.cos(toRad(state.lat)))).toFixed(6));
      state.gForceZ = Number((1.0 + Math.random() * 0.35).toFixed(2));
      window.RimReaperDB.incrementStat('kmScanned', Number((stepMeters / 1000).toFixed(4)));
      if (typeof onTick === 'function') onTick(state);
    }, 500);

    if (typeof onTick === 'function') onTick(state);
    return true;
  }

  function setManualTelemetry(patch, onTick) {
    Object.assign(state, patch);
    state.cardinal = headingToCardinal(state.heading);
    state.isMoving = state.speedKmh > 10;
    if (typeof onTick === 'function') onTick(state);
    window.RimReaperDB.broadcast('telemetry_override', state);
  }

  function markGracePeriod(id) {
    recentLogTimestamps.set(id, Date.now());
  }

  return {
    VEHICLE_PROFILES,
    getState: () => state,
    setProfile: (p) => {
      if (VEHICLE_PROFILES[p]) currentProfile = p;
      return currentProfile;
    },
    getProfile: () => currentProfile,
    setGravelSuppression: (val) => {
      gravelSuppression = Boolean(val);
      return gravelSuppression;
    },
    isGravelSuppressed: () => gravelSuppression,
    setHolidayPreset: (val) => {
      holidayPreset = Boolean(val);
      return holidayPreset;
    },
    isHolidayPreset: () => holidayPreset,
    computeBearing,
    headingToCardinal,
    computeBacktrackedLeftLanePosition,
    scanApproachingHazards,
    scanTripCorridor,
    startSensors,
    requestMobileHardwarePermissions,
    locateMeNow,
    toggleDriveSimulation,
    setManualTelemetry,
    markGracePeriod
  };
})();
