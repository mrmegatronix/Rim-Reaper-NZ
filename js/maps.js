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
    { cls: 'split-map-radar', label: '⚡ 3D SPLIT' },
    { cls: 'mode-map-only', label: '🗺️ MAP' },
    { cls: 'mode-scope-only', label: '🛣️ 3D LANE' }
  ];
  let viewModeIdx = 0;

  function initLeafletMaps() {
    if (typeof window.L === 'undefined') return;

    const osmUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    const osmAttrib = '&copy; OpenStreetMap contributors &bull; Rim-Reaper-NZ';

    if (el('radar-live-map') && !radarMap) {
      const t = window.GeoLaneEngine.getState();
      radarMap = window.L.map('radar-live-map', {
        zoomControl: false,
        attributionControl: false
      }).setView([t.lat, t.lon], 16);

      window.L.tileLayer(osmUrl, { maxZoom: 19, attribution: osmAttrib }).addTo(radarMap);
      radarMarkersLayer = window.L.layerGroup().addTo(radarMap);
      radarConeLayer = window.L.layerGroup().addTo(radarMap);
      updateRadarMap();
    }

    if (el('review-nz-map') && !reviewMap) {
      reviewMap = window.L.map('review-nz-map', {
        zoomControl: true,
        attributionControl: false
      }).setView([-39.5, 174.5], 6);

      window.L.tileLayer(osmUrl, { maxZoom: 19, attribution: osmAttrib }).addTo(reviewMap);
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

      window.L.tileLayer(osmUrl, { maxZoom: 19, attribution: osmAttrib }).addTo(plannerMap);
      plannerRouteLayer = window.L.layerGroup().addTo(plannerMap);
    }

    window.addEventListener('resize', () => {
      if (radarMap) radarMap.invalidateSize();
      if (reviewMap) reviewMap.invalidateSize();
      if (plannerMap) plannerMap.invalidateSize();
    });
  }

  function cycleRadarViewMode() {
    const splitWrap = el('radar-display-split');
    if (!splitWrap) return;
    viewModeIdx = (viewModeIdx + 1) % VIEW_MODES.length;
    const next = VIEW_MODES[viewModeIdx];
    splitWrap.className = `radar-scope-wrapper ${next.cls}`;
    if (el('btn-cycle-view')) el('btn-cycle-view').textContent = next.label;
    if (radarMap) setTimeout(() => radarMap.invalidateSize(), 90);
  }

  function updateRadarMap() {
    if (!radarMap || typeof window.L === 'undefined') return;
    const t = window.GeoLaneEngine.getState();
    const juris = window.NZ_DATA.resolveJurisdiction(t.lat, t.lon, t.roadName);

    radarMap.setView([t.lat, t.lon], radarMap.getZoom() || 16, { animate: false });
    radarConeLayer.clearLayers();
    radarMarkersLayer.clearLayers();

    const rad = (t.heading * Math.PI) / 180;
    const endLat = t.lat + (450 * Math.cos(rad)) / 111320;
    const endLon = t.lon + (450 * Math.sin(rad)) / (111320 * Math.cos((t.lat * Math.PI) / 180));

    window.L.polyline(
      [
        [t.lat, t.lon],
        [endLat, endLon]
      ],
      { color: '#00f58c', weight: 4, dashArray: '8, 6' }
    ).addTo(radarConeLayer);

    const popupHtml = `<div style="font-family:monospace;font-size:11.5px;line-height:1.35;">
      <b style="color:#00a85a;">📍 YOUR DEVICE LOCATION</b><br>
      <b>${t.placeLabel || t.roadName}</b><br>
      Coords: ${t.lat.toFixed(5)}, ${t.lon.toFixed(5)}<br>
      Authority: ${juris.council.name}
    </div>`;

    if (!radarVehicleMarker) {
      radarVehicleMarker = window.L.circleMarker([t.lat, t.lon], {
        radius: 10,
        color: '#ffffff',
        weight: 3,
        fillColor: '#00f58c',
        fillOpacity: 1
      })
        .addTo(radarMap)
        .bindPopup(popupHtml, { autoPan: false, closeButton: false });
    } else {
      radarVehicleMarker.setLatLng([t.lat, t.lon]);
      radarVehicleMarker.setPopupContent(popupHtml);
    }

    state.cachedHazards.forEach((h) => {
      const color =
        h.status === 'Fixed'
          ? '#00f58c'
          : h.severity === 'Rim Bender'
          ? '#ff2a2a'
          : h.severity === 'Bump'
          ? '#ffb000'
          : '#00d4ff';

      const photoHtml = h.photoDataUrl
        ? `<br><img src="${h.photoDataUrl}" style="width:140px;height:95px;object-fit:cover;border-radius:6px;margin-top:5px;border:1px solid #00d4ff;" alt="Pothole Photo" />`
        : '';

      window.L.circleMarker([h.lat, h.lon], {
        radius: h.severity === 'Rim Bender' ? 8 : 6,
        color: '#ffffff',
        weight: 1.5,
        fillColor: color,
        fillOpacity: 0.9
      })
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
      splitWrap.className = 'radar-scope-wrapper split-map-radar';
      if (el('btn-cycle-view')) el('btn-cycle-view').textContent = '⚡ 3D SPLIT';
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
      const color =
        h.status === 'Fixed'
          ? '#00f58c'
          : h.severity === 'Rim Bender'
          ? '#ff2a2a'
          : h.severity === 'Bump'
          ? '#ffb000'
          : '#00d4ff';

      const photoHtml = h.photoDataUrl
        ? `<br><img src="${h.photoDataUrl}" style="width:140px;height:95px;object-fit:cover;border-radius:6px;margin-top:5px;border:1px solid #00d4ff;" alt="Pothole Photo" />`
        : '';

      const marker = window.L.circleMarker([h.lat, h.lon], {
        radius: 7,
        color: '#ffffff',
        weight: 1.5,
        fillColor: color,
        fillOpacity: 0.9
      }).bindPopup(
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
