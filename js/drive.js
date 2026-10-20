/**
 * Rim-Reaper-NZ — Mode 1 Drive HUD, Boot Sequence, 1-Tap Logger, Geiger Bar & 3D NZ Lane Canvas
 */

window.RimReaperDrive = (function () {
  const { el, state, showToast, showView, toggleSettingsSheet } = window.RimReaperCore;

  let splashCountdownInterval = null;

  function dismissSplashIntoSplitMap() {
    if (splashCountdownInterval) {
      clearInterval(splashCountdownInterval);
      splashCountdownInterval = null;
    }
    if (window.AudioRadar && window.AudioRadar.clearBootTimers) {
      window.AudioRadar.clearBootTimers();
    }
    const splashEl = el('boot-splash-screen');
    if (splashEl) splashEl.classList.add('hidden-splash');

    setTimeout(() => {
      if (window.RimReaperMaps) window.RimReaperMaps.focusDeviceLocationOnMap(true, true);
      const t = window.GeoLaneEngine.getState();
      showToast(`📍 3D SPLIT MAP ACTIVE: ${t.placeLabel || t.roadName} (${t.lat.toFixed(4)}, ${t.lon.toFixed(4)})`);
    }, 120);
  }

  function runBootSequence(reopenSplash = false) {
    toggleSettingsSheet(false);
    window.GeoLaneEngine.requestMobileHardwarePermissions();
    window.GeoLaneEngine.locateMeNow((res) => {
      if (res && res.ok && window.RimReaperMaps) {
        window.RimReaperMaps.focusDeviceLocationOnMap(true, true);
      }
      if (res && res.httpsRequired && el('btn-https-switch')) {
        el('btn-https-switch').style.display = 'inline-flex';
      }
    });

    const splashEl = el('boot-splash-screen');
    if (reopenSplash && splashEl) {
      splashEl.classList.remove('hidden-splash');
    }

    // 15-Second Automatic Boot Countdown & Progress Bar
    const totalSec = 15;
    let remainingSec = totalSec;
    if (splashCountdownInterval) clearInterval(splashCountdownInterval);

    const updateCountdownUI = () => {
      if (el('splash-countdown-text')) {
        el('splash-countdown-text').textContent = `OPENING 3D SPLIT MAP IN ${remainingSec}s...`;
      }
      if (el('splash-progress-fill')) {
        const pct = Math.min(100, Math.round(((totalSec - remainingSec) / totalSec) * 100));
        el('splash-progress-fill').style.width = `${pct}%`;
      }
    };
    updateCountdownUI();

    splashCountdownInterval = setInterval(() => {
      remainingSec = Math.max(0, remainingSec - 1);
      updateCountdownUI();
      if (remainingSec <= 0) {
        clearInterval(splashCountdownInterval);
        splashCountdownInterval = null;
      }
    }, 1000);

    const channelIds = ['CRATER', 'BUMP', 'RUT', 'SLIP', 'BRIDGE', 'WET', 'GPS', 'NZTA'];
    channelIds.forEach((ch) => {
      const topNode = el(`band-${ch}`);
      const splashSeg = el(`splash-seg-${ch}`);
      if (topNode) topNode.classList.add('active-band');
      if (splashSeg) splashSeg.className = 'splash-led-seg lit-sweep';
    });

    window.AudioRadar.playBootSequence((activeChannel, statusLabel) => {
      if (el('splash-status-text') && statusLabel) {
        el('splash-status-text').textContent = statusLabel;
      }

      channelIds.forEach((ch, idx) => {
        const topNode = el(`band-${ch}`);
        const splashSeg = el(`splash-seg-${ch}`);
        const activeIdx = channelIds.indexOf(activeChannel);

        if (topNode) {
          topNode.classList.remove('active-band', 'active-danger');
          if (ch === activeChannel) topNode.classList.add('active-danger');
        }
        if (splashSeg) {
          splashSeg.className = 'splash-led-seg';
          if (ch === activeChannel) {
            splashSeg.classList.add('lit-danger');
          } else if (activeIdx > idx || activeChannel === 'READY' || activeChannel === 'COMPLETE') {
            splashSeg.classList.add('lit-ok');
          }
        }
      });

      if (activeChannel === 'READY') {
        const gpsNode = el('band-GPS');
        const nztaNode = el('band-NZTA');
        const craterNode = el('band-CRATER');
        if (gpsNode) gpsNode.classList.add('active-ok');
        if (nztaNode) nztaNode.classList.add('active-ok');
        if (craterNode) craterNode.classList.add('active-danger');
        if (el('splash-progress-fill')) el('splash-progress-fill').style.width = '100%';
      }

      if (activeChannel === 'COMPLETE') {
        dismissSplashIntoSplitMap();
      }
    });
  }

  async function handleQuickLog(
    severity = 'Rim Bender',
    sourceLabel = '1-Tap HUD',
    hazardTypeOverride = null,
    photoDataUrlOverride = null
  ) {
    const t = window.GeoLaneEngine.getState();
    const backtracked = window.GeoLaneEngine.computeBacktrackedLeftLanePosition(
      t.lat,
      t.lon,
      t.speedKmh,
      t.heading
    );

    const hazardType = hazardTypeOverride || (el('quick-hazard-type') ? el('quick-hazard-type').value : 'Pothole');
    const roadType = el('quick-road-type') ? el('quick-road-type').value : 'State Highway';
    const wetRisk = el('quick-wet-flag') ? el('quick-wet-flag').checked : false;

    const result = await window.RimReaperDB.logHazard({
      lat: backtracked.lat,
      lon: backtracked.lon,
      heading: t.heading,
      cardinal: t.cardinal,
      laneSide: backtracked.laneSide,
      wheelTrack: t.wheelTrack,
      severity,
      hazardType,
      roadType,
      roadName: t.roadName,
      wetWeatherRisk: wetRisk,
      diameterCm: severity === 'Rim Bender' ? 62 : severity === 'Bump' ? 42 : 28,
      depthCm: severity === 'Rim Bender' ? 14 : severity === 'Bump' ? 9 : 5,
      gForce: severity === 'Rim Bender' ? Math.max(2.7, t.gForceZ) : Math.max(1.9, t.gForceZ),
      accuracyM: t.accuracyM,
      photoDataUrl: photoDataUrlOverride || state.pendingPhotoDataUrl || null,
      notes: `Logged via ${sourceLabel} (Backtracked ${backtracked.backtrackMeters}m to impact point in ${backtracked.laneSide}, ${t.wheelTrack}).`
    });

    if (result.rejected) {
      showToast(`LOG REJECTED: ${result.reason}`);
      return;
    }

    state.pendingPhotoDataUrl = null;
    if (el('review-photo-box')) el('review-photo-box').style.display = 'none';

    window.AudioRadar.playLogConfirmationTone(severity);
    window.GeoLaneEngine.markGracePeriod(result.record.id);

    await window.RimReaperDB.addDashcamBookmark({
      id: result.record.id,
      isoTime: new Date().toISOString(),
      roadName: result.record.roadName,
      lat: result.record.lat,
      lon: result.record.lon,
      severity: result.record.severity,
      rammRef: result.record.rammRef
    });

    state.cachedHazards = await window.RimReaperDB.getAllHazards();
    state.selectedHazardId = result.record.id;
    refreshTelemetryAndHUD();

    const actionVerb = result.deduplicated
      ? `MERGED DUPLICATE (≤8m, Conf #${result.record.confirmations})`
      : `LOGGED ${result.record.id}`;
    showToast(`${actionVerb} • ${result.record.laneSide} • ${result.record.rammRef}`);
  }

  function updateGeigerSegments(litCount) {
    for (let i = 1; i <= 10; i++) {
      const seg = el(`geiger-seg-${i}`);
      if (!seg) continue;
      seg.className = 'geiger-seg';
      if (i <= litCount) {
        if (i <= 3) seg.classList.add('lit-green');
        else if (i <= 7) seg.classList.add('lit-amber');
        else seg.classList.add('lit-red');
      }
    }
  }

  function triggerPassByPrompt(hazard) {
    state.passByPromptHazardId = hazard.id;
    const promptEl = el('passby-banner');
    const labelEl = el('passby-label');
    if (!promptEl || !labelEl) return;

    labelEl.textContent = `PASSING ${hazard.id} (${hazard.severity}): STILL THERE OR FIXED?`;
    promptEl.classList.add('visible');

    if (state.passByTimeout) clearTimeout(state.passByTimeout);
    state.passByTimeout = setTimeout(() => {
      promptEl.classList.remove('visible');
    }, 4500);
  }

  async function handlePassByResponse(choice) {
    const promptEl = el('passby-banner');
    if (promptEl) promptEl.classList.remove('visible');
    if (!state.passByPromptHazardId) return;

    if (choice === 'Fixed') {
      await window.RimReaperDB.updateHazard(state.passByPromptHazardId, {
        status: 'Fixed',
        fixedAt: Date.now()
      });
      showToast(`MARKED ${state.passByPromptHazardId} AS FIXED!`);
    } else {
      const target = state.cachedHazards.find((h) => h.id === state.passByPromptHazardId);
      if (target) {
        await window.RimReaperDB.updateHazard(state.passByPromptHazardId, {
          confirmations: Number(target.confirmations || 1) + 1,
          lastConfirmedAt: Date.now()
        });
        showToast(`CONFIRMED ${state.passByPromptHazardId} STILL THERE (+1 Confirmation)`);
      }
    }
    state.cachedHazards = await window.RimReaperDB.getAllHazards();
    refreshTelemetryAndHUD();
  }

  function renderApproachingMiniList(approachingList) {
    const list = approachingList.length > 0 ? approachingList.slice(0, 8) : state.cachedHazards.slice(0, 8);
    const html = list
      .map((h) => {
        const distLabel = typeof h.distanceM === 'number' ? `${h.distanceM}m` : 'Corridor';
        const sevClass =
          h.severity === 'Rim Bender' ? 'sev-rim' : h.severity === 'Bump' ? 'sev-bump' : 'sev-ding';
        return `<tr data-id="${h.id}" style="cursor:pointer;">
          <td><span class="status-pill ${sevClass}">${h.severity}</span></td>
          <td>${h.roadName}</td>
          <td>${h.wheelTrack.replace(/ \(.*\)/, '')}</td>
          <td style="font-family:var(--font-mono);font-weight:800;color:var(--accent-amber);">${distLabel}</td>
          <td>${h.confidenceScore}% (${h.confirmations}x)</td>
        </tr>`;
      })
      .join('');

    ['approaching-tbody', 'sheet-approaching-tbody'].forEach((tid) => {
      const tbody = el(tid);
      if (!tbody) return;
      tbody.innerHTML = html;
      tbody.querySelectorAll('tr').forEach((row) => {
        row.addEventListener('click', () => {
          state.selectedHazardId = row.getAttribute('data-id');
          showToast(`Selected Hazard ${state.selectedHazardId}`);
        });
      });
    });
  }

  async function renderDriverStatsBar() {
    const stats = await window.RimReaperDB.getStats();
    const kmStr = `${Number(stats.kmScanned || 0).toFixed(1)} km`;
    const logStr = `${state.cachedHazards.length}`;
    const fixedStr = `${state.cachedHazards.filter((h) => h.status === 'Fixed').length}`;

    if (el('stat-km')) el('stat-km').textContent = kmStr;
    if (el('stat-logged')) el('stat-logged').textContent = logStr;
    if (el('stat-fixed')) el('stat-fixed').textContent = fixedStr;
    if (el('sheet-stat-km')) el('sheet-stat-km').textContent = kmStr;
    if (el('sheet-stat-logged')) el('sheet-stat-logged').textContent = logStr;
    if (el('sheet-stat-fixed')) el('sheet-stat-fixed').textContent = fixedStr;
  }

  function refreshTelemetryAndHUD() {
    const t = window.GeoLaneEngine.getState();
    const juris = window.NZ_DATA.resolveJurisdiction(t.lat, t.lon, t.roadName);

    if (el('map-loc-text')) {
      const locTitle = t.placeLabel && t.placeLabel !== 'Locating Device...' ? t.placeLabel : t.roadName;
      const srcBadge = t.isSimulating ? 'SIM' : t.hasRealGps ? `GPS ±${Math.round(t.accuracyM)}m` : 'DEVICE LOC';
      el('map-loc-text').textContent = `📍 ${locTitle} • ${t.lat.toFixed(4)}, ${t.lon.toFixed(4)} (${srcBadge})`;
    }

    if (!window.isSecureContext && el('btn-https-switch')) {
      el('btn-https-switch').style.display = 'inline-flex';
    }

    const setTxt = (id, val) => {
      if (el(id)) el(id).textContent = val;
    };

    setTxt('hud-speed-val', `${t.speedKmh}`);
    setTxt('sheet-speed-val', `${t.speedKmh} km/h`);
    setTxt('min-speed-num', `${t.speedKmh}`);
    setTxt('minimal-heading-pill', `${t.heading}° ${t.cardinal} • NZ LEFT LANE`);
    setTxt('hud-speed-limit', `${t.speedLimitKmh}`);
    setTxt('hud-heading-val', `${t.heading}° ${t.cardinal}`);
    setTxt('sheet-heading-val', `${t.heading}° ${t.cardinal}`);
    setTxt('hud-coords-val', `${t.lat.toFixed(4)}, ${t.lon.toFixed(4)}`);
    setTxt('sheet-coords-val', `${t.lat.toFixed(5)}, ${t.lon.toFixed(5)}`);
    setTxt('hud-accuracy-val', `±${t.accuracyM.toFixed(1)}m (${t.altitudeM}m ASL)`);
    setTxt('hud-gforce-val', `${t.gForceZ.toFixed(2)} G`);
    setTxt('sheet-gforce-val', `${t.gForceZ.toFixed(2)} G`);
    setTxt('hud-road-badge', `${t.roadName} • ${juris.rammRef}`);
    setTxt('sheet-road-badge', `${t.roadName} • ${juris.rammRef}`);
    setTxt('hud-council-badge', `${juris.primaryAgency.name}`);
    setTxt('sheet-council-badge', `${juris.primaryAgency.name}`);
    setTxt('hud-lane-vector', `${t.cardinal}-Bound Left-Hand Lane (LHL)`);
    setTxt(
      'hud-divided-flag',
      juris.isDividedRoad
        ? 'DIVIDED MOTORWAY (OPPOSING CARRIAGEWAY IGNORED)'
        : 'SINGLE CARRIAGEWAY (±45° DIRECTIONAL FILTER ACTIVE)'
    );

    const locked = t.speedKmh > 10 && !state.coPilotUnlocked;
    ['review', 'planner', 'council'].forEach((v) => {
      const tab = el(`tab-${v}`);
      if (tab) tab.classList.toggle('locked-tab', locked);
    });
    if (locked && state.currentViewIdx !== 0) {
      showView(0, true);
    }

    const scan = window.GeoLaneEngine.scanApproachingHazards(state.cachedHazards);
    const banner = el('geiger-banner');
    const zoneTitle = el('geiger-zone-title');
    const distReadout = el('geiger-distance-readout');
    const detailLine = el('geiger-detail-line');

    const craterBand = el('band-CRATER');
    const bumpBand = el('band-BUMP');
    const slipBand = el('band-SLIP');
    const wetBand = el('band-WET');

    if (scan.nearest) {
      const alertInfo = window.AudioRadar.evaluateProximityAlert(
        scan.nearest.distanceM,
        t.speedKmh,
        scan.isCluster,
        t.isSimulating
      );
      if (banner) banner.className = `geiger-alert-banner level-${alertInfo.level}`;
      if (zoneTitle) {
        zoneTitle.textContent = scan.isCluster
          ? `⚠️ SWISS CHEESE CLUSTER (${scan.clusterCount} CRATERS IN 50M)`
          : `⚠️ ${scan.nearest.severity.toUpperCase()} AHEAD — ${alertInfo.zoneName}`;
      }
      if (distReadout) distReadout.textContent = `${scan.nearest.distanceM} m`;
      if (detailLine) {
        const wetTag = scan.nearest.wetWeatherRisk ? ' • 🌧️ WATER-FILLED RISK' : '';
        detailLine.textContent = `${scan.nearest.roadName} • ${scan.nearest.wheelTrack} • Conf ${scan.nearest.confidenceScore}% (${scan.nearest.confirmations}x)${wetTag}`;
      }

      if (craterBand) craterBand.classList.toggle('active-danger', scan.nearest.severity === 'Rim Bender');
      if (bumpBand) bumpBand.classList.toggle('active-band', scan.nearest.severity === 'Bump');
      if (slipBand) {
        slipBand.classList.toggle(
          'active-danger',
          Boolean(scan.nearest.hazardType && scan.nearest.hazardType.includes('Slip'))
        );
      }
      if (wetBand) wetBand.classList.toggle('active-danger', Boolean(scan.nearest.wetWeatherRisk));

      updateGeigerSegments(alertInfo.level * 2);

      if (scan.nearest.distanceM <= 38 && state.passByPromptHazardId !== scan.nearest.id) {
        triggerPassByPrompt(scan.nearest);
      }
    } else {
      if (banner) banner.className = 'geiger-alert-banner';
      if (zoneTitle) zoneTitle.textContent = 'POTHOLE SCANNER ACTIVE — CLEAR CORRIDOR AHEAD';
      if (distReadout) distReadout.textContent = 'CLEAR';
      if (detailLine) {
        detailLine.textContent = `Scanning ${t.cardinal}-Bound Left-Hand Lane (±45° cone) • Opposite-lane potholes suppressed`;
      }
      if (craterBand) craterBand.classList.remove('active-danger');
      if (bumpBand) bumpBand.classList.remove('active-band');
      if (slipBand) slipBand.classList.remove('active-danger');
      if (wetBand) wetBand.classList.remove('active-danger');
      updateGeigerSegments(0);
    }

    if (window.RimReaperMaps) window.RimReaperMaps.updateRadarMap();
    renderApproachingMiniList(scan.approachingList);
    renderDriverStatsBar();
  }

  function startRadarCanvasLoop() {
    const canvas = el('radar-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    function frame() {
      const rect = canvas.parentElement.getBoundingClientRect();
      const targetW = Math.max(180, Math.floor(rect.width));
      const targetH = Math.max(100, Math.floor(rect.height));
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }

      const w = canvas.width;
      const h = canvas.height;
      const horizonY = h * 0.14;
      const bottomY = h * 0.94;
      const cx = w * 0.5;

      ctx.clearRect(0, 0, w, h);

      const topHalfW = w * 0.12;
      const botHalfW = w * 0.44;

      ctx.fillStyle = 'rgba(0, 245, 140, 0.09)';
      ctx.beginPath();
      ctx.moveTo(cx - topHalfW, horizonY);
      ctx.lineTo(cx, horizonY);
      ctx.lineTo(cx, bottomY);
      ctx.lineTo(cx - botHalfW, bottomY);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.025)';
      ctx.beginPath();
      ctx.moveTo(cx, horizonY);
      ctx.lineTo(cx + topHalfW, horizonY);
      ctx.lineTo(cx + botHalfW, bottomY);
      ctx.lineTo(cx, bottomY);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = 'rgba(0, 245, 140, 0.75)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(cx - topHalfW, horizonY);
      ctx.lineTo(cx - botHalfW, bottomY);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(155, 176, 201, 0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx + topHalfW, horizonY);
      ctx.lineTo(cx + botHalfW, bottomY);
      ctx.stroke();

      ctx.strokeStyle = '#ffb000';
      ctx.lineWidth = 3;
      ctx.setLineDash([14, 12]);
      ctx.beginPath();
      ctx.moveTo(cx, horizonY);
      ctx.lineTo(cx, bottomY);
      ctx.stroke();
      ctx.setLineDash([]);

      const distMarkers = [
        { d: 100, frac: 0.78, label: '100m BRACE' },
        { d: 250, frac: 0.56, label: '250m CAUTION' },
        { d: 450, frac: 0.36, label: '450m APPROACH' },
        { d: 700, frac: 0.2, label: '700m HORIZON' }
      ];

      distMarkers.forEach((m) => {
        const y = horizonY + (bottomY - horizonY) * m.frac;
        const halfW = topHalfW + (botHalfW - topHalfW) * m.frac;
        ctx.strokeStyle = 'rgba(0, 212, 255, 0.2)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx - halfW, y);
        ctx.lineTo(cx + halfW, y);
        ctx.stroke();

        ctx.fillStyle = 'rgba(155, 176, 201, 0.75)';
        ctx.font = 'bold 10px monospace';
        ctx.fillText(m.label, cx - halfW + 6, y - 4);
      });

      ctx.fillStyle = '#00f58c';
      ctx.font = 'bold 11px monospace';
      ctx.fillText('▲ NZ KEEP-LEFT LANE (ACTIVE)', cx - botHalfW + 10, bottomY - 10);
      ctx.fillStyle = 'rgba(155, 176, 201, 0.5)';
      ctx.fillText('▼ OPPOSING LANE (IGNORED)', cx + 14, bottomY - 10);

      const t = window.GeoLaneEngine.getState();
      state.cachedHazards.forEach((hz) => {
        if (hz.status === 'Fixed') return;
        const distM = window.NZ_DATA.haversineMeters(t.lat, t.lon, hz.lat, hz.lon);
        if (distM > 800) return;

        const sameDirection = Math.abs(((t.heading - hz.heading + 540) % 360) - 180) <= 45;
        const progress = Math.max(0.05, Math.min(0.95, 1 - distM / 800));
        const y = horizonY + (bottomY - horizonY) * progress;
        const laneHalfW = topHalfW + (botHalfW - topHalfW) * progress;

        let trackOffset = -0.52;
        if (hz.wheelTrack && hz.wheelTrack.includes('Left Wheel')) trackOffset = -0.76;
        else if (hz.wheelTrack && hz.wheelTrack.includes('Right Wheel')) trackOffset = -0.25;

        const px = sameDirection ? cx + laneHalfW * trackOffset : cx + laneHalfW * 0.5;
        const radius = Math.max(5, 11 * progress);

        ctx.fillStyle = !sameDirection
          ? 'rgba(130, 150, 175, 0.3)'
          : hz.severity === 'Rim Bender'
          ? '#ff2a2a'
          : hz.severity === 'Bump'
          ? '#ffb000'
          : '#00d4ff';

        ctx.beginPath();
        ctx.ellipse(px, y, radius * 1.35, radius * 0.75, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        if (sameDirection) {
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 10px monospace';
          ctx.fillText(`${hz.severity.toUpperCase()} (${Math.round(distM)}m)`, px + radius + 6, y + 3);
        }
      });

      requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);
  }

  return {
    runBootSequence,
    dismissSplashIntoSplitMap,
    handleQuickLog,
    refreshTelemetryAndHUD,
    handlePassByResponse,
    startRadarCanvasLoop,
    renderDriverStatsBar
  };
})();
