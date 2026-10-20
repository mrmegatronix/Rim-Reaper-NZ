/**
 * Rim-Reaper-NZ — Mode 2 (Log & Photo Sizing) + Mode 3 (Trip Corridor Scanner & Dashcam .SRT)
 */

window.RimReaperLog = (function () {
  const { el, state, showToast, showView, downloadTextFile } = window.RimReaperCore;

  function renderReviewTable() {
    const tbody = el('review-table-body');
    if (!tbody) return;
    const filterVal = el('review-filter-select') ? el('review-filter-select').value : 'ALL';

    const filtered = state.cachedHazards.filter((h) => {
      if (filterVal === 'SH') return h.isStateHighway;
      if (filterVal === 'LOCAL') return !h.isStateHighway;
      if (filterVal === 'RIM') return h.severity === 'Rim Bender';
      if (filterVal === 'UNREPORTED') return h.status === 'Unreported';
      return true;
    });

    tbody.innerHTML = filtered
      .map((h) => {
        const sevClass =
          h.severity === 'Rim Bender' ? 'sev-rim' : h.severity === 'Bump' ? 'sev-bump' : 'sev-ding';
        const slaElapsedHrs = h.exportedAt ? Math.round((Date.now() - h.exportedAt) / (1000 * 60 * 60)) : 0;
        const slaTarget = h.slaHours || 48;
        const slaLabel =
          h.status === 'Fixed'
            ? '✅ REPAIRED'
            : h.exportedAt
            ? slaElapsedHrs > slaTarget
              ? `🚨 BREACH (+${slaElapsedHrs - slaTarget}h)`
              : `${slaElapsedHrs}h / ${slaTarget}h`
            : 'Not Sent';

        return `<tr data-id="${h.id}">
          <td style="font-family:var(--font-mono);font-weight:700;">${h.id}</td>
          <td><span class="status-pill ${sevClass}">${h.severity}</span></td>
          <td>${h.roadName}</td>
          <td>${h.laneSide} • ${h.wheelTrack.replace(/ \(.*\)/, '')}</td>
          <td style="font-family:var(--font-mono);">${h.rammRef}</td>
          <td>${h.authorityName}</td>
          <td>${slaLabel}</td>
          <td>
            <button class="btn btn-export-row" data-id="${h.id}">Export</button>
            <button class="btn btn-fix-row" data-id="${h.id}">${h.status === 'Fixed' ? 'Reopen' : 'Fix'}</button>
          </td>
        </tr>`;
      })
      .join('');

    tbody.querySelectorAll('.btn-export-row').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        state.selectedHazardId = btn.getAttribute('data-id');
        showView(3, true);
      });
    });

    tbody.querySelectorAll('.btn-fix-row').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        const target = state.cachedHazards.find((x) => x.id === id);
        if (!target) return;
        const nextStatus = target.status === 'Fixed' ? 'Unreported' : 'Fixed';
        await window.RimReaperDB.updateHazard(id, {
          status: nextStatus,
          fixedAt: nextStatus === 'Fixed' ? Date.now() : null
        });
        state.cachedHazards = await window.RimReaperDB.getAllHazards();
        renderReviewTable();
        if (window.RimReaperDrive) window.RimReaperDrive.refreshTelemetryAndHUD();
      });
    });

    if (window.RimReaperMaps) window.RimReaperMaps.renderReviewMapMarkers();
  }

  function populateTownSelects() {
    const origSel = el('trip-origin-select');
    const destSel = el('trip-dest-select');
    if (!origSel || !destSel) return;

    const opts = window.NZ_DATA.TOWNS.map(
      (t, idx) => `<option value="${idx}">${t.name} (${t.region})</option>`
    ).join('');
    origSel.innerHTML = opts;
    destSel.innerHTML = opts;
    origSel.value = '3'; // Whangārei
    destSel.value = '5'; // Auckland CBD
  }

  function runCorridorScan() {
    const origSel = el('trip-origin-select');
    const destSel = el('trip-dest-select');
    if (!origSel || !destSel) return;

    const orig = window.NZ_DATA.TOWNS[Number(origSel.value) || 0];
    const dest = window.NZ_DATA.TOWNS[Number(destSel.value) || 5];
    const report = window.GeoLaneEngine.scanTripCorridor(orig, dest, state.cachedHazards);

    if (el('trip-summary-dist')) el('trip-summary-dist').textContent = `${report.totalDistKm} km (${report.cardinal})`;
    if (el('trip-summary-total')) el('trip-summary-total').textContent = `${report.corridorHazards.length} Hazards`;
    if (el('trip-summary-rim')) el('trip-summary-rim').textContent = `${report.rimBenders} Rim Benders`;
    if (el('trip-summary-slips')) el('trip-summary-slips').textContent = `${report.slips} Slips / Dropouts`;

    const tbody = el('trip-corridor-tbody');
    if (tbody) {
      tbody.innerHTML = report.corridorHazards
        .map((h) => {
          const sevClass =
            h.severity === 'Rim Bender' ? 'sev-rim' : h.severity === 'Bump' ? 'sev-bump' : 'sev-ding';
          return `<tr>
            <td style="font-family:var(--font-mono);">${h.id}</td>
            <td><span class="status-pill ${sevClass}">${h.severity}</span></td>
            <td>${h.hazardType}</td>
            <td>${h.roadName}</td>
            <td>${h.laneSide}</td>
            <td style="font-family:var(--font-mono);">${h.rammRef}</td>
            <td>${h.wetWeatherRisk ? '🌧️ Wet Risk' : 'Standard'}</td>
          </tr>`;
        })
        .join('');
    }

    if (window.RimReaperMaps) window.RimReaperMaps.renderPlannerMapRoute(orig, dest, report.corridorHazards);
  }

  async function downloadDashcamSRT() {
    const stats = await window.RimReaperDB.getStats();
    const bookmarks =
      stats.dashcamBookmarks && stats.dashcamBookmarks.length > 0
        ? stats.dashcamBookmarks
        : state.cachedHazards.slice(0, 8).map((h) => ({
            id: h.id,
            isoTime: new Date(h.timestamp).toISOString(),
            roadName: h.roadName,
            lat: h.lat,
            lon: h.lon,
            severity: h.severity,
            rammRef: h.rammRef
          }));

    const srtContent = bookmarks
      .map((b, idx) => {
        const secStart = idx * 5;
        const secEnd = secStart + 4;
        const fmt = (s) => `00:00:${String(s).padStart(2, '0')},000`;
        return `${idx + 1}\n${fmt(secStart)} --> ${fmt(secEnd)}\n[RIM-REAPER-NZ] ${b.id} | ${b.severity} | ${b.roadName} | ${b.rammRef} | (${b.lat}, ${b.lon}) | ${b.isoTime}\n`;
      })
      .join('\n');

    downloadTextFile('Rim-Reaper-NZ-Dashcam-Overlay.srt', srtContent, 'text/plain');
    showToast('Exported Dashcam .SRT Subtitle Overlay');
  }

  function compressCameraImage(file) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const maxDim = 640;
          let w = img.width;
          let h = img.height;
          if (w > h && w > maxDim) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else if (h > maxDim) {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
          canvas.width = w;
          canvas.height = h;
          const c = canvas.getContext('2d');
          c.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.78));
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  async function saveManualEntry() {
    const roadName = el('man-road').value || 'NZ Local Road';
    const lat = parseFloat(el('man-lat').value) || -36.8509;
    const lon = parseFloat(el('man-lon').value) || 174.7645;
    const heading = parseFloat(el('man-heading').value) || 0;
    const severity = el('man-severity').value || 'Rim Bender';
    const hazardType = el('man-type').value || 'Pothole';
    const diameterCm = parseFloat(el('man-diam').value) || 50;
    const depthCm = parseFloat(el('man-depth').value) || 11;
    const notes = el('man-notes').value || 'Manual review entry.';

    const res = await window.RimReaperDB.logHazard({
      lat,
      lon,
      heading,
      cardinal: window.GeoLaneEngine.headingToCardinal(heading),
      laneSide: `${window.GeoLaneEngine.headingToCardinal(heading)}-Bound Left-Hand Lane (LHL)`,
      wheelTrack: 'Left Wheel Track (Verge Side)',
      severity,
      hazardType,
      roadType: /\bSH\s*\d+/i.test(roadName) ? 'State Highway' : 'Local Sealed Road',
      roadName,
      diameterCm,
      depthCm,
      gForce: 2.5,
      accuracyM: 3.5,
      photoDataUrl: state.pendingPhotoDataUrl || null,
      manualOverride: true,
      notes
    });
    state.pendingPhotoDataUrl = null;
    if (el('review-photo-box')) el('review-photo-box').style.display = 'none';
    state.cachedHazards = await window.RimReaperDB.getAllHazards();
    state.selectedHazardId = res.record.id;
    renderReviewTable();
    if (window.RimReaperDrive) window.RimReaperDrive.refreshTelemetryAndHUD();
    showToast(`Saved Hazard ${res.record.id} (${res.record.authorityName})`);
  }

  function estimateReferenceScale() {
    const refMm = parseFloat(el('scale-ref-type').value) || 100;
    const ratio = parseFloat(el('scale-multiplier').value) || 5.5;
    const estDiamCm = Math.round((refMm * ratio) / 10);
    const estDepthCm = Math.max(4, Math.round(estDiamCm * 0.22));
    if (el('man-diam')) el('man-diam').value = estDiamCm;
    if (el('man-depth')) el('man-depth').value = estDepthCm;
    showToast(`Photo Scale Estimate: ${estDiamCm}cm diameter × ${estDepthCm}cm depth`);
  }

  return {
    renderReviewTable,
    populateTownSelects,
    runCorridorScan,
    downloadDashcamSRT,
    compressCameraImage,
    saveManualEntry,
    estimateReferenceScale
  };
})();
