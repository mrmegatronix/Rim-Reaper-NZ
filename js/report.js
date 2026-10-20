/**
 * Rim-Reaper-NZ — Mode 4 Council / NZTA / Claim / OIA Generator, League Table & Exporters
 */

window.RimReaperReport = (function () {
  const { el, state, showToast, downloadTextFile } = window.RimReaperCore;

  function getSelectedHazard() {
    return state.cachedHazards.find((h) => h.id === state.selectedHazardId) || state.cachedHazards[0];
  }

  function renderCouncilPreview(mode = 'email') {
    const h = getSelectedHazard();
    const box = el('council-export-preview');
    if (!box || !h) return;

    document.querySelectorAll('.btn-doc-mode').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-mode') === mode);
    });

    const mapsLink = `https://www.google.com/maps?q=${h.lat},${h.lon}`;
    const reportedDate = new Date(h.timestamp).toLocaleString('en-NZ');

    if (mode === 'email') {
      box.textContent = [
        `TO: ${h.authorityEmail}`,
        `CC: ${h.councillorEmail} (${h.wardName} Elected Ward Councillor)`,
        `SUBJECT: [URGENT ROAD DEFECT] ${h.severity} ${h.hazardType} — ${h.roadName} (${h.rammRef})`,
        `--------------------------------------------------------------------------------`,
        `Kia ora ${h.authorityName} Roading & Maintenance Team (${h.contractor}),`,
        ``,
        `Please log an urgent road surface maintenance defect captured by Rim-Reaper-NZ:`,
        ``,
        `• Hazard ID:          ${h.id}`,
        `• Hazard Category:    ${h.hazardType} (${h.severity})`,
        `• Road / Corridor:    ${h.roadName} (${h.roadType})`,
        `• RAMM Reference:     ${h.rammRef}`,
        `• NZ Left-Lane Side:  ${h.laneSide} — ${h.wheelTrack}`,
        `• Travel Bearing:     ${h.heading}° (${h.cardinal})`,
        `• WGS84 Coordinates:  ${h.lat.toFixed(6)}, ${h.lon.toFixed(6)} (±${h.accuracyM}m)`,
        `• Google Maps Pin:    ${mapsLink}`,
        `• Estimated Size:     ${h.diameterCm}cm diameter × ${h.depthCm}cm depth`,
        `• Impact G-Force:     ${h.gForce} G (${h.confirmations} independent driver confirmations, ${h.confidenceScore}% confidence)`,
        `• Wet-Weather Risk:   ${h.wetWeatherRisk ? 'YES — Water-filled / invisible crater hazard' : 'No'}`,
        `• First Logged:       ${reportedDate}`,
        `• Target SLA Window:  ${h.slaHours} Hours`,
        ``,
        `Notes: ${h.notes}`,
        ``,
        `Please confirm the CRM / RAMM Service Request ticket number once assigned.`
      ].join('\n');
    } else if (mode === 'claim') {
      box.textContent = [
        `================================================================================`,
        `NEW ZEALAND PUBLIC LIABILITY TYRE & RIM DAMAGE CLAIM DOSSIER`,
        `================================================================================`,
        `RESPONDENT AUTHORITY: ${h.authorityName} (${h.authorityEmail})`,
        `MAINTENANCE CONTRACTOR: ${h.contractor}`,
        `WARD JURISDICTION: ${h.wardName}`,
        ``,
        `1. PRIOR KNOWLEDGE & SLA BREACH EVIDENCE`,
        `   • Defect Reference:       ${h.id} (${h.rammRef})`,
        `   • First Logged in DB:     ${reportedDate}`,
        `   • Independent Reports:    ${h.confirmations} driver confirmations (${h.confidenceScore}% confidence)`,
        `   • Authority SLA Target:   ${h.slaHours} hours`,
        `   • Current Status:         ${h.status}`,
        ``,
        `2. EXACT LOCATION & NZ LEFT-HAND LANE TELEMETRY`,
        `   • Road Corridor:          ${h.roadName}`,
        `   • Carriageway & Track:    ${h.laneSide} | ${h.wheelTrack}`,
        `   • WGS84 Coordinates:      ${h.lat.toFixed(6)}, ${h.lon.toFixed(6)}`,
        `   • Dimensions & Peak G:    ${h.diameterCm}cm × ${h.depthCm}cm | Peak ${h.gForce}G vertical impulse`,
        `   • Map Verification:       ${mapsLink}`,
        ``,
        `3. ATTACHMENTS CHECKLIST FOR CLAIMANT`,
        `   [x] Rim-Reaper-NZ Timestamped Telemetry & Prior-Notice Log`,
        `   [x] Synchronized Dashcam .SRT Clip Bookmark`,
        `   [ ] Tyre / Alloy Wheel Repair or Replacement Tax Invoice (GST Incl.)`,
        `   [ ] Reference-Scale Photograph of Pothole & Damaged Rim/Sidewall`
      ].join('\n');
    } else if (mode === 'oia') {
      const actName = h.isStateHighway
        ? 'Official Information Act 1982 (OIA)'
        : 'Local Government Official Information and Meetings Act 1987 (LGOIMA)';
      box.textContent = [
        `TO: ${h.isStateHighway ? window.NZ_DATA.NZTA_AGENCY.oiaEmail : h.authorityEmail}`,
        `SUBJECT: Formal Request under the ${actName} — Road Maintenance & Inspection Records for ${h.roadName} (${h.rammRef})`,
        `--------------------------------------------------------------------------------`,
        `Tēnā koe,`,
        ``,
        `Pursuant to the ${actName}, I request the following official information regarding the road corridor at ${h.roadName} (RAMM Reference: ${h.rammRef}, Coordinates: ${h.lat.toFixed(5)}, ${h.lon.toFixed(5)}):`,
        ``,
        `1. All routine and reactive road inspection logs covering ${h.roadName} (${h.rammRef}) over the past 12 months.`,
        `2. The total number of public complaints, Snap Send Solve / Antenno reports, and contractor defect notices logged for this 1km segment over the past 12 months.`,
        `3. Details of all temporary cold-mix patches versus permanent hot-mix/structural repairs completed by ${h.contractor} at this location, including dates and contractual SLA compliance.`,
        `4. The total number and value of vehicle damage claims received for this road corridor in the past 24 months.`,
        ``,
        `Under section 15 of the Act, I look forward to your response within 20 working days.`
      ].join('\n');
    } else if (mode === 'snap') {
      box.textContent = [
        `[SNAP SEND SOLVE / ANTENNO QUICK PASTE BUNDLE]`,
        `Defect: ${h.severity} ${h.hazardType} (${h.diameterCm}cm x ${h.depthCm}cm)`,
        `Location: ${h.roadName} (${h.rammRef})`,
        `NZ Lane Side: ${h.laneSide} — ${h.wheelTrack}`,
        `GPS: ${h.lat.toFixed(6)}, ${h.lon.toFixed(6)} (${mapsLink})`,
        `Authority: ${h.authorityName} | Confirmations: ${h.confirmations}x`
      ].join('\n');
    }
  }

  function renderLeagueTable() {
    const tbody = el('league-table-body');
    if (!tbody) return;

    const byAuth = {};
    state.cachedHazards.forEach((h) => {
      const key = h.authorityName || 'Waka Kotahi NZTA';
      if (!byAuth[key]) {
        byAuth[key] = { name: key, open: 0, fixed: 0, rimBenders: 0, slaBreaches: 0, contractor: h.contractor };
      }
      if (h.status === 'Fixed') {
        byAuth[key].fixed++;
      } else {
        byAuth[key].open++;
        if (h.severity === 'Rim Bender') byAuth[key].rimBenders++;
        if (h.exportedAt && (Date.now() - h.exportedAt) / (1000 * 60 * 60) > (h.slaHours || 48)) {
          byAuth[key].slaBreaches++;
        }
      }
    });

    const rows = Object.values(byAuth).sort((a, b) => b.open - a.open);
    tbody.innerHTML = rows
      .map(
        (r, i) => `<tr>
        <td style="font-family:var(--font-mono);font-weight:800;">#${i + 1}</td>
        <td>${r.name}</td>
        <td>${r.contractor}</td>
        <td style="color:var(--accent-red);font-weight:800;">${r.open}</td>
        <td style="color:var(--accent-amber);font-weight:800;">${r.rimBenders}</td>
        <td style="color:var(--accent-green);font-weight:800;">${r.fixed}</td>
        <td>${r.slaBreaches > 0 ? `🚨 ${r.slaBreaches} Overdue` : '✅ On Target'}</td>
      </tr>`
      )
      .join('');
  }

  async function shareOrCopyReport() {
    const h = getSelectedHazard();
    const txt = el('council-export-preview') ? el('council-export-preview').textContent : '';
    if (navigator.share && h) {
      try {
        await navigator.share({
          title: `[RIM-REAPER-NZ] ${h.severity} ${h.hazardType} — ${h.roadName}`,
          text: txt,
          url: `https://www.google.com/maps?q=${h.lat},${h.lon}`
        });
        showToast('Shared Report via Mobile Share Sheet');
        return;
      } catch (e) {}
    }
    if (navigator.clipboard) navigator.clipboard.writeText(txt);
    showToast('Copied Report Dossier to Clipboard');
  }

  async function sendMailtoCouncil() {
    const h = getSelectedHazard();
    if (!h) return;
    await window.RimReaperDB.updateHazard(h.id, { status: 'Exported', exportedAt: Date.now() });
    state.cachedHazards = await window.RimReaperDB.getAllHazards();
    renderCouncilPreview('email');
    renderLeagueTable();
    const subj = encodeURIComponent(`[ROAD DEFECT] ${h.severity} ${h.hazardType} — ${h.roadName} (${h.rammRef})`);
    const body = encodeURIComponent(el('council-export-preview').textContent);
    window.open(`mailto:${h.authorityEmail}?cc=${h.councillorEmail}&subject=${subj}&body=${body}`, '_self');
  }

  function exportCsv() {
    const headers = [
      'ID',
      'Severity',
      'HazardType',
      'RoadName',
      'RAMM_Ref',
      'Authority',
      'Ward',
      'NZ_LeftLane',
      'WheelTrack',
      'HeadingDeg',
      'Latitude',
      'Longitude',
      'DiameterCm',
      'DepthCm',
      'GForce',
      'Confirmations',
      'ConfidencePct',
      'Status'
    ];
    const rows = state.cachedHazards.map((h) =>
      [
        h.id,
        `"${h.severity}"`,
        `"${h.hazardType}"`,
        `"${h.roadName}"`,
        `"${h.rammRef}"`,
        `"${h.authorityName}"`,
        `"${h.wardName}"`,
        `"${h.laneSide}"`,
        `"${h.wheelTrack}"`,
        h.heading,
        h.lat,
        h.lon,
        h.diameterCm,
        h.depthCm,
        h.gForce,
        h.confirmations,
        h.confidenceScore,
        `"${h.status}"`
      ].join(',')
    );
    downloadTextFile('Rim-Reaper-NZ-Council-NZTA-Batch.csv', [headers.join(','), ...rows].join('\n'), 'text/csv');
    showToast('Downloaded Bulk Council / NZTA CSV');
  }

  function exportGeoJson() {
    const geojson = {
      type: 'FeatureCollection',
      name: 'Rim-Reaper-NZ-Hazards',
      features: state.cachedHazards.map((h) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [h.lon, h.lat] },
        properties: h
      }))
    };
    downloadTextFile('Rim-Reaper-NZ-GIS.geojson', JSON.stringify(geojson, null, 2), 'application/geo+json');
    showToast('Downloaded GIS GeoJSON Bundle');
  }

  async function exportBackupDb() {
    const bundle = await window.RimReaperDB.exportBackupBundle();
    downloadTextFile('Rim-Reaper-NZ-Backup.pothole.json', JSON.stringify(bundle, null, 2), 'application/json');
    showToast('Downloaded Encrypted Offline Database Backup');
  }

  return {
    getSelectedHazard,
    renderCouncilPreview,
    renderLeagueTable,
    shareOrCopyReport,
    sendMailtoCouncil,
    exportCsv,
    exportGeoJson,
    exportBackupDb
  };
})();
