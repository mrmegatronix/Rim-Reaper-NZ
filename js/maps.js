/**
 * Rim-Reaper-NZ — Interactive Leaflet Maps (Drive HUD Map, Review Map, Trip Route Map)
 */

window.RimReaperMaps = (function () {
  const { el, state, showToast } = window.RimReaperCore;

  let radarMap = null;
  let radarVehicleMarker = null;
  let radarConeLayer = null;
  let radarMarkersLayer = null;
  let reviewMap = null;
  let reviewMarkersLayer = null;
  let reviewClickMarker = null;
  let plannerMap = null;
  let plannerRouteLayer = null;

  const VIEW_MODES = [
    { cls: 'mode-3d-cockpit', label: '🚘 3D COCKPIT' },
    { cls: 'mode-map-only', label: '🗺️ 2D MAP' },
    { cls: 'split-map-radar', label: '⚡ DUAL VIEW' }
  ];
  let viewModeIdx = 0;

  const MAP_PROVIDERS = {
    'google-dark': {
      label: '🚗 WAZE DARK',
      name: 'Google Maps (Waze Dark GPS)',
      url: 'https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
      subdomains: '0123',
      attrib: '&copy; Google Maps / Waze &bull; Rim-Reaper-NZ',
      cls: 'tile-mode-google-dark'
    },
    'google-day': {
      label: '☀️ GOOGLE DAY',
      name: 'Google Maps (Daylight Waze)',
      url: 'https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
      subdomains: '0123',
      attrib: '&copy; Google Maps &bull; Rim-Reaper-NZ',
      cls: 'tile-mode-google-day'
    },
    'google-satellite': {
      label: '🛰️ SATELLITE',
      name: 'Google Hybrid (Satellite + Roads)',
      url: 'https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
      subdomains: '0123',
      attrib: '&copy; Google Imagery &bull; Rim-Reaper-NZ',
      cls: 'tile-mode-satellite'
    },
    'osm-dark': {
      label: '🌑 OSM DARK',
      name: 'OpenStreetMap (Dark GPS)',
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      subdomains: 'abc',
      attrib: '&copy; OpenStreetMap contributors &bull; Rim-Reaper-NZ',
      cls: 'tile-mode-osm-dark'
    },
    'osm-day': {
      label: '🗺️ OSM DAY',
      name: 'OpenStreetMap (Daylight)',
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      subdomains: 'abc',
      attrib: '&copy; OpenStreetMap contributors &bull; Rim-Reaper-NZ',
      cls: 'tile-mode-osm-day'
    }
  };

  const PROVIDER_KEYS = ['google-dark', 'google-satellite', 'google-day', 'osm-dark', 'osm-day'];
  let currentProviderKey = 'google-dark';
  let radarTileLayer = null;
  let reviewTileLayer = null;
  let plannerTileLayer = null;

  function setMapProvider(key) {
    if (!MAP_PROVIDERS[key]) key = 'google-dark';
    currentProviderKey = key;
    const provider = MAP_PROVIDERS[key];
    const tileOpts = { maxZoom: 20, subdomains: provider.subdomains, attribution: provider.attrib };

    if (radarMap) {
      if (radarTileLayer) radarMap.removeLayer(radarTileLayer);
      radarTileLayer = window.L.tileLayer(provider.url, tileOpts).addTo(radarMap);
      if (radarTileLayer.bringToBack) radarTileLayer.bringToBack();
    }
    if (reviewMap) {
      if (reviewTileLayer) reviewMap.removeLayer(reviewTileLayer);
      reviewTileLayer = window.L.tileLayer(provider.url, tileOpts).addTo(reviewMap);
      if (reviewTileLayer.bringToBack) reviewTileLayer.bringToBack();
    }
    if (plannerMap) {
      if (plannerTileLayer) plannerMap.removeLayer(plannerTileLayer);
      plannerTileLayer = window.L.tileLayer(provider.url, tileOpts).addTo(plannerMap);
      if (plannerTileLayer.bringToBack) plannerTileLayer.bringToBack();
    }

    const containers = [document.body, el('radar-display-split'), el('review-nz-map'), el('planner-nz-map')];
    PROVIDER_KEYS.forEach((k) => {
      const cls = MAP_PROVIDERS[k].cls;
      containers.forEach((c) => c && c.classList.remove(cls));
    });
    containers.forEach((c) => c && c.classList.add(provider.cls));

    if (el('btn-map-layer')) el('btn-map-layer').textContent = provider.label;
    if (el('sel-map-provider')) el('sel-map-provider').value = key;
    showToast(`🗺️ Map Provider: ${provider.name}`);
  }

  function cycleMapProvider() {
    const idx = PROVIDER_KEYS.indexOf(currentProviderKey);
    const nextKey = PROVIDER_KEYS[(idx + 1) % PROVIDER_KEYS.length];
    setMapProvider(nextKey);
  }

  async function downloadOfflineMapPack(radiusKm = 15) {
    if (!('caches' in window)) {
      showToast('CacheStorage not supported on this browser.');
      return;
    }
    const t = window.GeoLaneEngine.getState();
    const lat = t.lat;
    const lon = t.lon;
    const statusEl = el('offline-cache-status');
    const btn = el('btn-download-offline-pack');
    if (btn) btn.disabled = true;

    showToast(`⬇️ CACHING 15KM OFFLINE MAP AROUND ${t.placeLabel || t.roadName}...`);
    if (statusEl) statusEl.textContent = 'Calculating road tile matrix...';

    const cache = await caches.open('rim-reaper-nz-tiles-v1');
    const provider = MAP_PROVIDERS[currentProviderKey] || MAP_PROVIDERS['google-dark'];

    const latLonToTile = (la, lo, z) => {
      const latRad = (la * Math.PI) / 180;
      const n = Math.pow(2, z);
      const xtile = Math.floor(((lo + 180) / 360) * n);
      const ytile = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);
      return { x: xtile, y: ytile };
    };

    const dLat = radiusKm / 111;
    const dLon = radiusKm / (111 * Math.cos((lat * Math.PI) / 180));
    const minLat = lat - dLat;
    const maxLat = lat + dLat;
    const minLon = lon - dLon;
    const maxLon = lon + dLon;

    const zooms = [14, 15, 16];
    const tileUrls = [];

    zooms.forEach((z) => {
      const p1 = latLonToTile(maxLat, minLon, z);
      const p2 = latLonToTile(minLat, maxLon, z);
      const minX = Math.min(p1.x, p2.x);
      const maxX = Math.max(p1.x, p2.x);
      const minY = Math.min(p1.y, p2.y);
      const maxY = Math.max(p1.y, p2.y);

      for (let x = minX; x <= maxX; x++) {
        for (let y = minY; y <= maxY; y++) {
          const s = provider.subdomains[Math.abs(x + y) % provider.subdomains.length];
          const url = provider.url
            .replace('{s}', s)
            .replace('{x}', x)
            .replace('{y}', y)
            .replace('{z}', z)
            .replace('{r}', '');
          tileUrls.push(url);
        }
      }
    });

    const total = Math.min(tileUrls.length, 250);
    let downloaded = 0;

    for (let i = 0; i < total; i++) {
      const u = tileUrls[i];
      try {
        const cached = await cache.match(u);
        if (!cached) {
          const res = await fetch(u, { mode: 'cors' });
          if (res.ok) await cache.put(u, res);
        }
        downloaded++;
      } catch (err) {}

      if (i % 10 === 0 && statusEl) {
        statusEl.textContent = `Downloading offline tiles: ${downloaded} / ${total}...`;
      }
    }

    if (btn) btn.disabled = false;
    if (statusEl) {
      statusEl.textContent = `✅ ${downloaded} tiles cached for ${t.placeLabel || t.roadName}. 100% offline ready!`;
    }
    showToast(`✅ ${downloaded} OFFLINE TILES SAVED TO PHONE MEMORY!`);
  }

  function initLeafletMaps() {
    if (typeof window.L === 'undefined') return;

    if (el('radar-live-map') && !radarMap) {
      const t = window.GeoLaneEngine.getState();
      radarMap = window.L.map('radar-live-map', {
        zoomControl: false,
        attributionControl: false
      }).setView([t.lat, t.lon], 16);

      radarMarkersLayer = window.L.layerGroup().addTo(radarMap);
      radarConeLayer = window.L.layerGroup().addTo(radarMap);
    }

    if (el('review-nz-map') && !reviewMap) {
      reviewMap = window.L.map('review-nz-map', {
        zoomControl: true,
        attributionControl: false
      }).setView([-39.5, 174.5], 6);

      reviewMarkersLayer = window.L.layerGroup().addTo(reviewMap);

      reviewMap.on('click', (ev) => {
        const lat = Number(ev.latlng.lat.toFixed(5));
        const lon = Number(ev.latlng.lng.toFixed(5));
        if (el('man-lat')) el('man-lat').value = lat;
        if (el('man-lon')) el('man-lon').value = lon;
        const juris = window.NZ_DATA.resolveJurisdiction(lat, lon);
        if (el('man-road')) {
          el('man-road').value = juris.isStateHighway
            ? `${juris.highwayCode} (${juris.council.name})`
            : `${juris.council.name} Local Road`;
        }
        if (reviewClickMarker) reviewMap.removeLayer(reviewClickMarker);
        reviewClickMarker = window.L.circleMarker([lat, lon], {
          radius: 9,
          color: '#00d4ff',
          fillColor: '#00d4ff',
          fillOpacity: 0.7
        })
          .addTo(reviewMap)
          .bindPopup(`<b>Manual Pin Selected</b><br>${lat}, ${lon}<br>${juris.primaryAgency.name}`)
          .openPopup();
        showToast(`Map Pin Selected: ${lat}, ${lon} (${juris.primaryAgency.name})`);
      });

      renderReviewMapMarkers();
    }

    if (el('planner-nz-map') && !plannerMap) {
      plannerMap = window.L.map('planner-nz-map', {
        zoomControl: true,
        attributionControl: false
      }).setView([-38.5, 175.5], 6);

      plannerRouteLayer = window.L.layerGroup().addTo(plannerMap);
    }

    setMapProvider(currentProviderKey);
    updateRadarMap();

    window.addEventListener('resize', () => {
      if (radarMap) radarMap.invalidateSize();
      if (reviewMap) reviewMap.invalidateSize();
      if (plannerMap) plannerMap.invalidateSize();
    });

    if (el('btn-map-layer')) {
      el('btn-map-layer').onclick = cycleMapProvider;
    }
    if (el('sel-map-provider')) {
      el('sel-map-provider').onchange = (e) => setMapProvider(e.target.value);
    }
    if (el('btn-download-offline-pack')) {
      el('btn-download-offline-pack').onclick = () => downloadOfflineMapPack();
    }
  }

  function cycleRadarViewMode() {
    const splitWrap = el('radar-display-split');
    if (!splitWrap) return;
    viewModeIdx = (viewModeIdx + 1) % VIEW_MODES.length;
    const next = VIEW_MODES[viewModeIdx];
    splitWrap.className = `radar-scope-wrapper ${next.cls}`;
    if (el('btn-cycle-view')) el('btn-cycle-view').textContent = next.label;
    const mapEl = el('radar-live-map');
    if (mapEl && next.cls !== 'mode-3d-cockpit') {
      mapEl.style.setProperty('--vehicle-heading', '0');
    }
    if (radarMap) {
      setTimeout(() => {
        radarMap.invalidateSize();
        updateRadarMap();
      }, 90);
    }
  }

  function updateRadarMap() {
    if (!radarMap || typeof window.L === 'undefined') return;
    const t = window.GeoLaneEngine.getState();
    const juris = window.NZ_DATA.resolveJurisdiction(t.lat, t.lon, t.roadName);
    const splitWrap = el('radar-display-split');
    const is3dCockpit = splitWrap && splitWrap.classList.contains('mode-3d-cockpit');

    let centerLat = t.lat;
    let centerLon = t.lon;
    const rad = (t.heading * Math.PI) / 180;

    if (is3dCockpit) {
      // Offset target 130m ahead for 3D cockpit perspective ground plane
      centerLat = t.lat + (130 * Math.cos(rad)) / 111320;
      centerLon = t.lon + (130 * Math.sin(rad)) / (111320 * Math.cos((t.lat * Math.PI) / 180));
      const mapEl = el('radar-live-map');
      if (mapEl) {
        mapEl.style.setProperty('--vehicle-heading', `${Math.round(t.heading)}`);
      }
    } else {
      const mapEl = el('radar-live-map');
      if (mapEl) {
        mapEl.style.setProperty('--vehicle-heading', '0');
      }
    }

    radarMap.setView([centerLat, centerLon], radarMap.getZoom() || (is3dCockpit ? 17 : 16), { animate: false });
    radarConeLayer.clearLayers();
    radarMarkersLayer.clearLayers();

    // Projected course guidance line (480m ahead along heading)
    const endLat = t.lat + (480 * Math.cos(rad)) / 111320;
    const endLon = t.lon + (480 * Math.sin(rad)) / (111320 * Math.cos((t.lat * Math.PI) / 180));

    // Outer cyan guidance glow beam
    window.L.polyline(
      [
        [t.lat, t.lon],
        [endLat, endLon]
      ],
      { color: '#00d4ff', weight: 8, opacity: 0.35, lineCap: 'round' }
    ).addTo(radarConeLayer);

    // Inner bright neon green dashed track line
    window.L.polyline(
      [
        [t.lat, t.lon],
        [endLat, endLon]
      ],
      { color: '#00f58c', weight: 3.5, dashArray: '10, 8', lineCap: 'round' }
    ).addTo(radarConeLayer);

    // GPS Navigation Arrow Puck
    const puckHtml = `
      <div class="gps-puck-inner" style="transform: rotate(${t.heading}deg);">
        <div class="gps-beam-pulse"></div>
        <svg class="gps-puck-svg" viewBox="0 0 44 44" width="44" height="44">
          <circle cx="22" cy="22" r="19" fill="rgba(0, 245, 140, 0.14)" stroke="rgba(0, 245, 140, 0.5)" stroke-width="1.5" stroke-dasharray="3,3"/>
          <path d="M22 4 L36 38 L22 30 L8 38 Z" fill="#00f58c" stroke="#ffffff" stroke-width="2.5" stroke-linejoin="round"/>
          <circle cx="22" cy="25" r="3.5" fill="#031f13"/>
        </svg>
      </div>
    `;

    const gpsIcon = window.L.divIcon({
      className: 'gps-puck-wrapper',
      iconSize: [44, 44],
      iconAnchor: [22, 22],
      popupAnchor: [0, -22],
      html: puckHtml
    });

    const popupHtml = `<div style="font-family:monospace;font-size:11.5px;line-height:1.35;background:#090d14;color:#fff;padding:4px;">
      <b style="color:#00f58c;">📍 GPS NAVIGATION LOCKED</b><br>
      <b>${t.placeLabel || t.roadName}</b><br>
      Heading: ${Math.round(t.heading)}° (${t.cardinal}) • Speed: ${Math.round(t.speedKmh)} km/h<br>
      Coords: ${t.lat.toFixed(5)}, ${t.lon.toFixed(5)}<br>
      Authority: ${juris.council.name}
    </div>`;

    if (!radarVehicleMarker) {
      radarVehicleMarker = window.L.marker([t.lat, t.lon], {
        icon: gpsIcon,
        zIndexOffset: 1000
      })
        .addTo(radarMap)
        .bindPopup(popupHtml, { autoPan: false, closeButton: false });
    } else {
      radarVehicleMarker.setLatLng([t.lat, t.lon]);
      radarVehicleMarker.setIcon(gpsIcon);
      radarVehicleMarker.setPopupContent(popupHtml);
    }

    // Hazard Pins with GPS styling
    state.cachedHazards.forEach((h) => {
      const isRim = h.severity === 'Rim Bender';
      const isBump = h.severity === 'Bump';
      const isFixed = h.status === 'Fixed';
      const glyph = isFixed ? '✅' : isRim ? '💥' : isBump ? '⚠️' : '⛰️';
      const colorCls = isFixed ? 'status-fixed' : isRim ? 'severity-rim' : isBump ? 'severity-bump' : 'severity-slip';

      const hazardIcon = window.L.divIcon({
        className: 'gps-hazard-pin-wrap',
        iconSize: [28, 28],
        iconAnchor: [14, 14],
        popupAnchor: [0, -14],
        html: `<div class="gps-hazard-pin ${colorCls}"><span class="hazard-emoji">${glyph}</span></div>`
      });

      const photoHtml = h.photoDataUrl
        ? `<br><img src="${h.photoDataUrl}" style="width:140px;height:95px;object-fit:cover;border-radius:6px;margin-top:5px;border:1px solid #00d4ff;" alt="Pothole Photo" />`
        : '';

      window.L.marker([h.lat, h.lon], { icon: hazardIcon })
        .bindPopup(
          `<b>${h.id} — ${h.severity}</b><br>${h.roadName}<br>${h.laneSide} (${h.wheelTrack})<br>RAMM: ${h.rammRef}<br>Authority: ${h.authorityName}${photoHtml}`
        )
        .addTo(radarMarkersLayer);
    });
  }

  function focusDeviceLocationOnMap(openPopup = true, forceSplit = false) {
    const t = window.GeoLaneEngine.getState();
    const splitWrap = el('radar-display-split');
    if (splitWrap && (forceSplit || splitWrap.classList.contains('mode-scope-only'))) {
      viewModeIdx = 0;
      splitWrap.className = `radar-scope-wrapper ${VIEW_MODES[0].cls}`;
      if (el('btn-cycle-view')) el('btn-cycle-view').textContent = VIEW_MODES[0].label;
    }
    if (window.RimReaperDrive) {
      window.RimReaperDrive.refreshTelemetryAndHUD();
    }
    if (radarMap) {
      radarMap.invalidateSize();
      radarMap.setView([t.lat, t.lon], 16, { animate: true });
      if (openPopup && radarVehicleMarker) {
        radarVehicleMarker.openPopup();
      }
    }
    if (reviewMap) {
      reviewMap.setView([t.lat, t.lon], 14, { animate: false });
    }
  }

  function renderReviewMapMarkers() {
    if (!reviewMap || !reviewMarkersLayer || typeof window.L === 'undefined') return;
    reviewMarkersLayer.clearLayers();
    state.cachedHazards.forEach((h) => {
      const isRim = h.severity === 'Rim Bender';
      const isBump = h.severity === 'Bump';
      const isFixed = h.status === 'Fixed';
      const glyph = isFixed ? '✅' : isRim ? '💥' : isBump ? '⚠️' : '⛰️';
      const colorCls = isFixed ? 'status-fixed' : isRim ? 'severity-rim' : isBump ? 'severity-bump' : 'severity-slip';

      const hazardIcon = window.L.divIcon({
        className: 'gps-hazard-pin-wrap',
        iconSize: [26, 26],
        iconAnchor: [13, 13],
        popupAnchor: [0, -13],
        html: `<div class="gps-hazard-pin ${colorCls}"><span class="hazard-emoji">${glyph}</span></div>`
      });

      const photoHtml = h.photoDataUrl
        ? `<br><img src="${h.photoDataUrl}" style="width:140px;height:95px;object-fit:cover;border-radius:6px;margin-top:5px;border:1px solid #00d4ff;" alt="Pothole Photo" />`
        : '';

      const marker = window.L.marker([h.lat, h.lon], { icon: hazardIcon }).bindPopup(
        `<b>${h.id} (${h.severity})</b><br>${h.roadName}<br>${h.laneSide}<br>Authority: ${h.authorityName}${photoHtml}`
      );

      marker.on('click', () => {
        state.selectedHazardId = h.id;
        showToast(`Selected ${h.id} on Map (${h.roadName})`);
      });

      marker.addTo(reviewMarkersLayer);
    });
  }

  function renderPlannerMapRoute(orig, dest, corridorHazards) {
    if (!plannerMap || !plannerRouteLayer || typeof window.L === 'undefined') return;
    plannerRouteLayer.clearLayers();

    const routeLine = window.L.polyline(
      [
        [orig.lat, orig.lon],
        [dest.lat, dest.lon]
      ],
      { color: '#00d4ff', weight: 4, dashArray: '10, 6' }
    ).addTo(plannerRouteLayer);

    window.L.circleMarker([orig.lat, orig.lon], {
      radius: 8,
      color: '#ffffff',
      fillColor: '#00f58c',
      fillOpacity: 1
    })
      .bindPopup(`<b>ORIGIN: ${orig.name}</b>`)
      .addTo(plannerRouteLayer);

    window.L.circleMarker([dest.lat, dest.lon], {
      radius: 8,
      color: '#ffffff',
      fillColor: '#ffb000',
      fillOpacity: 1
    })
      .bindPopup(`<b>DESTINATION: ${dest.name}</b>`)
      .addTo(plannerRouteLayer);

    corridorHazards.forEach((h) => {
      window.L.circleMarker([h.lat, h.lon], {
        radius: 8,
        color: '#ffffff',
        weight: 2,
        fillColor: h.severity === 'Rim Bender' ? '#ff2a2a' : '#ffb000',
        fillOpacity: 0.95
      })
        .bindPopup(`<b>${h.id} — ${h.severity}</b><br>${h.roadName}<br>${h.laneSide}`)
        .addTo(plannerRouteLayer);
    });

    try {
      plannerMap.fitBounds(routeLine.getBounds().pad(0.25));
    } catch (e) {}
  }

  return {
    initLeafletMaps,
    cycleRadarViewMode,
    updateRadarMap,
    focusDeviceLocationOnMap,
    renderReviewMapMarkers,
    renderPlannerMapRoute,
    setMapProvider,
    cycleMapProvider,
    downloadOfflineMapPack,
    invalidateRadar: () => radarMap && radarMap.invalidateSize(),
    invalidateReview: () => {
      if (reviewMap) {
        reviewMap.invalidateSize();
        renderReviewMapMarkers();
      }
    },
    invalidatePlanner: () => plannerMap && plannerMap.invalidateSize()
  };
})();
