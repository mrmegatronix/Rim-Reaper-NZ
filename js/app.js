/**
 * Rim-Reaper-NZ — Main Application Controller
 * Implements:
 *  - Mode 1: Driving / Radar HUD, Polar Scope, Geiger Bar, 10 km/h Lock-Out & Pass-By Prompt
 *  - Mode 2: Review Table, Manual Input & Reference Scale Photo Size Estimator
 *  - Mode 3: NZ Trip Corridor Scanner & Dashcam .SRT Subtitle Exporter
 *  - Mode 4: 67 NZ Council + Waka Kotahi NZTA Export, Damage Claim Dossier, LGOIMA/OIA & League Table
 *  - Full Antigravity Keyboard Navigation & Slideshow Protocol
 */

window.RimReaperApp = (function () {
  const VIEWS = ['radar', 'review', 'planner', 'council'];
  const SIM_CORRIDORS = ['SH1-DOME', 'SH1-DESERT', 'SH73-OTIRA', 'SH2-REMUTAKA'];

  let currentViewIdx = 0;
  let currentCorridorIdx = 0;
  let coPilotUnlocked = false;
  let selectedHazardId = null;
  let cachedHazards = [];
  let sweepAngle = 0;
  let passByPromptHazardId = null;
  let passByTimeout = null;

  // Slideshow / Kiosk Auto-Cycle Controls (per User Rules Section 3)
  let slideDurationMs = 20000;
  let slideTimer = null;
  let slidePaused = true; // Starts paused in interactive radar mode; Spacebar or 1-9 toggles auto-cycle
  let freezeLocked = false;

  // Bilingual UI dictionary (English / Te Reo Māori)
  let currentLang = 'en';
  const I18N = {
    en: {
      tabRadar: '1. RADAR HUD',
      tabReview: '2. HAZARD LOG & SIZING',
      tabPlanner: '3. TRIP CORRIDOR SCAN',
      tabCouncil: '4. COUNCIL / NZTA / OIA',
      tapLogMain: 'TAP TO LOG POTHOLE (LEFT LANE)',
      tapLogSub: '1.75s Reaction Lookback • Auto-Deduplicates ≤8m • Tags NZ Left-Hand Lane'
    },
    mi: {
      tabRadar: '1. MATAWAI RORI (HUD)',
      tabReview: '2. RĀRANGI KŌhao & INE',
      tabPlanner: '3. MAHERE HAERENGA',
      tabCouncil: '4. KAUNIHERA / WAKA KOTAHI',
      tapLogMain: 'PĀTene KI TE RĒHITA KŌHAO (ARA MAUĪ)',
      tapLogSub: '1.75s Hoki-Whakamuri • Kaunihera & Waka Kotahi • Ara Mauī o Aotearoa'
    }
  };

  function el(id) {
    return document.getElementById(id);
  }

  /**
   * Blinking Colon Clock (Mandatory Rule: ALL CLOCKS MUST HAVE BLINKING COLONS!)
   */
  function updateClock() {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    const html = `${hh}<span class="blink-colon">:</span>${mm}<span class="blink-colon">:</span>${ss}`;
    document.querySelectorAll('.live-clock-target').forEach((node) => {
      node.innerHTML = html;
    });
  }

  /**
   * Switch active view with 10 km/h Moving Lock-Out protection
   */
  function showView(index, force = false) {
    if (freezeLocked && !force) return;
    const telemetry = window.GeoLaneEngine.getState();
    const targetIdx = (index + VIEWS.length) % VIEWS.length;

    // Enforce >10 km/h lock-out unless Co-Pilot Mode is unlocked
    if (telemetry.speedKmh > 10 && !coPilotUnlocked && targetIdx !== 0) {
      showToast('SAFETY LOCK-OUT (>10 KM/H): Enable Co-Pilot Mode to open menus while moving.');
      return;
    }

    currentViewIdx = targetIdx;
    const viewName = VIEWS[currentViewIdx];

    VIEWS.forEach((v, idx) => {
      const panel = el(`view-${v}`);
      const tab = el(`tab-${v}`);
      if (panel) panel.classList.toggle('active-view', idx === currentViewIdx);
      if (tab) tab.classList.toggle('active', idx === currentViewIdx);
    });

    if (viewName === 'review') renderReviewTable();
    if (viewName === 'planner') runCorridorScan();
    if (viewName === 'council') {
      renderCouncilPreview('email');
      renderLeagueTable();
    }
  }

  function nextSlide() {
    showView(currentViewIdx + 1);
  }

  function prevSlide() {
    showView(currentViewIdx - 1);
  }

  function restartSlideTimer() {
    if (slideTimer) clearInterval(slideTimer);
    if (!slidePaused && !freezeLocked) {
      slideTimer = setInterval(() => {
        if (!freezeLocked && !slidePaused) {
          nextSlide();
        }
      }, slideDurationMs);
    }
  }

  /**
   * Keyboard Navigation & Control Rules (Strictly per User Rules Section 3)
   */
  function initKeyboardControls() {
    window.addEventListener('keydown', (e) => {
      const tag = (e.target && e.target.tagName ? e.target.tagName : '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable) {
        return; // Input Guard
      }

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        prevSlide();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        nextSlide();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        showView(0, true); // Reset to slide 0 (Radar Mode)
        showToast('Reset to Slide 0 (Radar Mode)');
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        // Skip to next highway corridor module
        currentCorridorIdx = (currentCorridorIdx + 1) % SIM_CORRIDORS.length;
        const nextCorridor = SIM_CORRIDORS[currentCorridorIdx];
        const selectEl = el('sim-corridor-select');
        if (selectEl) selectEl.value = nextCorridor;
        showToast(`Switched Corridor Module: ${nextCorridor}`);
      } else if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        slidePaused = !slidePaused;
        restartSlideTimer();
        showToast(slidePaused ? 'Slide Progression PAUSED' : `Slide Progression ACTIVE (${slideDurationMs / 1000}s)`);
      } else if (e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        window.open('admin.html', '_blank');
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        window.open('remote.html', '_blank');
      } else if (/^[1-9]$/.test(e.key)) {
        e.preventDefault();
        const num = parseInt(e.key, 10);
        slideDurationMs = num * 10000;
        slidePaused = false;
        restartSlideTimer();
        showToast(`Slide Duration Set: ${num * 10}s`);
      } else if (e.key === '0') {
        e.preventDefault();
        freezeLocked = !freezeLocked;
        const badge = el('freeze-lock-badge');
        if (badge) {
          badge.textContent = freezeLocked ? 'LOCKED (0)' : 'UNLOCKED';
          badge.className = freezeLocked ? 'band-pill active-danger' : 'band-pill';
        }
        showToast(freezeLocked ? 'SLIDE FREEZE LOCKED (Press 0 to unlock)' : 'SLIDE FREEZE UNLOCKED');
      }
    });
  }

  /**
   * Trigger Radar Boot-Up Self-Test Sequence
   */
  function runBootSequence() {
    const bandIds = ['X', 'K', 'Ka', 'LASER', 'POTHOLE', 'SLIP', 'GPS', 'NZTA'];
    bandIds.forEach((b) => {
      const node = el(`band-${b}`);
      if (node) node.classList.add('active-band');
    });

    window.AudioRadar.playBootSequence((activeBand) => {
      bandIds.forEach((b) => {
        const node = el(`band-${b}`);
        if (!node) return;
        node.classList.remove('active-band', 'active-danger');
        if (b === activeBand) {
          node.classList.add('active-danger');
        }
      });
      if (activeBand === 'READY') {
        const gpsNode = el('band-GPS');
        const nztaNode = el('band-NZTA');
        if (gpsNode) gpsNode.classList.add('active-ok');
        if (nztaNode) nztaNode.classList.add('active-ok');
      }
    });
  }

  /**
   * Instant 1-Tap Pothole / Hazard Logger with Reaction-Time Lookback & NZ Left-Lane Vector
   */
  async function handleQuickLog(severity = 'Rim Bender', sourceLabel = '1-Tap HUD', hazardTypeOverride = null) {
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
      notes: `Logged via ${sourceLabel} (Backtracked ${backtracked.backtrackMeters}m to impact point in ${backtracked.laneSide}, ${t.wheelTrack}).`
    });

    if (result.rejected) {
      showToast(`LOG REJECTED: ${result.reason}`);
      return;
    }

    window.AudioRadar.playLogConfirmationTone(severity);
    window.GeoLaneEngine.markGracePeriod(result.record.id);

    // Record Dashcam .SRT Bookmark
    await window.RimReaperDB.addDashcamBookmark({
      id: result.record.id,
      isoTime: new Date().toISOString(),
      roadName: result.record.roadName,
      lat: result.record.lat,
      lon: result.record.lon,
      severity: result.record.severity,
      rammRef: result.record.rammRef
    });

    cachedHazards = await window.RimReaperDB.getAllHazards();
    selectedHazardId = result.record.id;
    refreshTelemetryAndHUD();

    const actionVerb = result.deduplicated
      ? `MERGED DUPLICATE (≤8m, Conf #${result.record.confirmations})`
      : `LOGGED ${result.record.id}`;
    showToast(`${actionVerb} • ${result.record.laneSide} • ${result.record.rammRef}`);
  }

  /**
   * Update Telemetry Readouts, Geiger Bar & Pass-By Verification Banner
   */
  function refreshTelemetryAndHUD() {
    const t = window.GeoLaneEngine.getState();
    const juris = window.NZ_DATA.resolveJurisdiction(t.lat, t.lon, t.roadName);

    if (el('hud-speed-val')) el('hud-speed-val').textContent = `${t.speedKmh}`;
    if (el('hud-speed-limit')) el('hud-speed-limit').textContent = `${t.speedLimitKmh}`;
    if (el('hud-heading-val')) el('hud-heading-val').textContent = `${t.heading}° ${t.cardinal}`;
    if (el('hud-coords-val')) el('hud-coords-val').textContent = `${t.lat.toFixed(4)}, ${t.lon.toFixed(4)}`;
    if (el('hud-accuracy-val')) el('hud-accuracy-val').textContent = `±${t.accuracyM.toFixed(1)}m (${t.altitudeM}m ASL)`;
    if (el('hud-gforce-val')) el('hud-gforce-val').textContent = `${t.gForceZ.toFixed(2)} G`;
    if (el('hud-road-badge')) el('hud-road-badge').textContent = `${t.roadName} • ${juris.rammRef}`;
    if (el('hud-council-badge')) el('hud-council-badge').textContent = `${juris.primaryAgency.name}`;
    if (el('hud-lane-vector')) el('hud-lane-vector').textContent = `${t.cardinal}-Bound Left-Hand Lane (LHL)`;
    if (el('hud-divided-flag')) {
      el('hud-divided-flag').textContent = juris.isDividedRoad
        ? 'DIVIDED MOTORWAY (OPPOSING CARRIAGEWAY IGNORED)'
        : 'SINGLE CARRIAGEWAY (±45° DIRECTIONAL FILTER ACTIVE)';
    }

    // Lock-out visual state on tabs when moving >10 km/h
    const locked = t.speedKmh > 10 && !coPilotUnlocked;
    ['review', 'planner', 'council'].forEach((v) => {
      const tab = el(`tab-${v}`);
      if (tab) tab.classList.toggle('locked-tab', locked);
    });
    if (locked && currentViewIdx !== 0) {
      showView(0, true);
    }

    // Scan approaching hazards in driver's NZ Left-Hand Lane
    const scan = window.GeoLaneEngine.scanApproachingHazards(cachedHazards);
    const banner = el('geiger-banner');
    const zoneTitle = el('geiger-zone-title');
    const distReadout = el('geiger-distance-readout');
    const detailLine = el('geiger-detail-line');

    const potholeBand = el('band-POTHOLE');
    const slipBand = el('band-SLIP');

    if (scan.nearest) {
      const alertInfo = window.AudioRadar.evaluateProximityAlert(
        scan.nearest.distanceM,
        t.speedKmh,
        scan.isCluster,
        t.isSimulating
      );
      if (banner) {
        banner.className = `geiger-alert-banner level-${alertInfo.level}`;
      }
      if (zoneTitle) {
        zoneTitle.textContent = scan.isCluster
          ? `⚠️ SWISS CHEESE CLUSTER (${scan.clusterCount} CRATERS IN 50M)`
          : `⚠️ ${scan.nearest.severity.toUpperCase()} AHEAD — ${alertInfo.zoneName}`;
      }
      if (distReadout) {
        distReadout.textContent = `${scan.nearest.distanceM} m`;
      }
      if (detailLine) {
        const wetTag = scan.nearest.wetWeatherRisk ? ' • 🌧️ WATER-FILLED RISK' : '';
        detailLine.textContent = `${scan.nearest.roadName} • ${scan.nearest.wheelTrack} • Conf ${scan.nearest.confidenceScore}% (${scan.nearest.confirmations}x)${wetTag}`;
      }

      if (potholeBand) potholeBand.classList.toggle('active-danger', alertInfo.level >= 2);
      if (slipBand) {
        slipBand.classList.toggle(
          'active-danger',
          Boolean(scan.nearest.hazardType && scan.nearest.hazardType.includes('Slip'))
        );
      }

      updateGeigerSegments(alertInfo.level * 2);

      // Trigger 4-second STILL THERE / FIXED Pass-By Verification prompt when passing within 38m
      if (scan.nearest.distanceM <= 38 && passByPromptHazardId !== scan.nearest.id) {
        triggerPassByPrompt(scan.nearest);
      }
    } else {
      if (banner) banner.className = 'geiger-alert-banner';
      if (zoneTitle) zoneTitle.textContent = 'RADAR SCANNING — NO HAZARDS IN LEFT-HAND LANE CORRIDOR';
      if (distReadout) distReadout.textContent = 'CLEAR';
      if (detailLine) {
        detailLine.textContent = `Scanning ${t.cardinal}-Bound Left-Hand Lane (±45° cone) • Opposite-lane potholes suppressed`;
      }
      if (potholeBand) potholeBand.classList.remove('active-danger');
      if (slipBand) slipBand.classList.remove('active-danger');
      updateGeigerSegments(0);
    }

    renderApproachingMiniList(scan.approachingList);
    renderDriverStatsBar();
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
    passByPromptHazardId = hazard.id;
    const promptEl = el('passby-banner');
    const labelEl = el('passby-label');
    if (!promptEl || !labelEl) return;

    labelEl.textContent = `PASSING ${hazard.id} (${hazard.severity}): STILL THERE OR FIXED?`;
    promptEl.classList.add('visible');

    if (passByTimeout) clearTimeout(passByTimeout);
    passByTimeout = setTimeout(() => {
      promptEl.classList.remove('visible');
    }, 4500);
  }

  async function handlePassByResponse(choice) {
    const promptEl = el('passby-banner');
    if (promptEl) promptEl.classList.remove('visible');
    if (!passByPromptHazardId) return;

    if (choice === 'Fixed') {
      await window.RimReaperDB.updateHazard(passByPromptHazardId, {
        status: 'Fixed',
        fixedAt: Date.now()
      });
      showToast(`MARKED ${passByPromptHazardId} AS FIXED!`);
    } else {
      const target = cachedHazards.find((h) => h.id === passByPromptHazardId);
      if (target) {
        await window.RimReaperDB.updateHazard(passByPromptHazardId, {
          confirmations: Number(target.confirmations || 1) + 1,
          lastConfirmedAt: Date.now()
        });
        showToast(`CONFIRMED ${passByPromptHazardId} STILL THERE (+1 Confirmation)`);
      }
    }
    cachedHazards = await window.RimReaperDB.getAllHazards();
    refreshTelemetryAndHUD();
  }

  function renderApproachingMiniList(approachingList) {
    const tbody = el('approaching-tbody');
    if (!tbody) return;
    const list = approachingList.length > 0 ? approachingList.slice(0, 8) : cachedHazards.slice(0, 8);
    tbody.innerHTML = list
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

    tbody.querySelectorAll('tr').forEach((row) => {
      row.addEventListener('click', () => {
        selectedHazardId = row.getAttribute('data-id');
        showToast(`Selected Hazard ${selectedHazardId}`);
      });
    });
  }

  /**
   * High-FPS Canvas Polar Radar Scope Renderer
   */
  function startRadarCanvasLoop() {
    const canvas = el('radar-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    function frame() {
      const rect = canvas.parentElement.getBoundingClientRect();
      if (canvas.width !== Math.floor(rect.width) || canvas.height !== Math.floor(rect.height)) {
        canvas.width = Math.max(300, Math.floor(rect.width));
        canvas.height = Math.max(220, Math.floor(rect.height));
      }

      const w = canvas.width;
      const h = canvas.height;
      const cx = w / 2;
      const cy = h * 0.62;
      const maxR = Math.min(w * 0.44, h * 0.56);

      ctx.clearRect(0, 0, w, h);

      // Range rings (100m, 300m, 500m, 800m)
      const rings = [
        { r: maxR * 0.25, label: '100m IMPACT' },
        { r: maxR * 0.55, label: '300m APPROACH' },
        { r: maxR * 0.85, label: '500m DETECT' },
        { r: maxR * 1.05, label: '800m HWY' }
      ];

      ctx.lineWidth = 1;
      rings.forEach((ring) => {
        ctx.strokeStyle = 'rgba(0, 212, 255, 0.22)';
        ctx.beginPath();
        ctx.arc(cx, cy, ring.r, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = 'rgba(155, 176, 201, 0.65)';
        ctx.font = '10px monospace';
        ctx.fillText(ring.label, cx + 6, cy - ring.r + 11);
      });

      // NZ Left-Hand Lane Corridor Cone (±45° ahead)
      ctx.fillStyle = 'rgba(0, 245, 140, 0.07)';
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, maxR * 1.05, -Math.PI * 0.75, -Math.PI * 0.25);
      ctx.closePath();
      ctx.fill();

      // Road Centerline & Left-Lane Guide
      ctx.strokeStyle = 'rgba(255, 176, 0, 0.45)';
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(cx, cy + 40);
      ctx.lineTo(cx, cy - maxR * 1.05);
      ctx.stroke();
      ctx.setLineDash([]);

      // Rotating Radar Sweep Beam
      sweepAngle = (sweepAngle + 0.032) % (Math.PI * 2);
      const grad = ctx.createRadialGradient(cx, cy, 4, cx, cy, maxR);
      grad.addColorStop(0, 'rgba(0, 245, 140, 0.35)');
      grad.addColorStop(1, 'rgba(0, 245, 140, 0.0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, maxR * 1.05, sweepAngle, sweepAngle + 0.38);
      ctx.closePath();
      ctx.fill();

      // Plot Hazards Relative to Vehicle Heading
      const t = window.GeoLaneEngine.getState();
      cachedHazards.forEach((hz) => {
        if (hz.status === 'Fixed') return;
        const distM = window.NZ_DATA.haversineMeters(t.lat, t.lon, hz.lat, hz.lon);
        if (distM > 900) return;

        const brg = window.GeoLaneEngine.computeBearing(t.lat, t.lon, hz.lat, hz.lon);
        const relDeg = ((brg - t.heading + 540) % 360) - 180;
        const relRad = ((relDeg - 90) * Math.PI) / 180;
        const normR = Math.min(maxR * 1.04, (distM / 800) * maxR);

        const px = cx + normR * Math.cos(relRad);
        const py = cy + normR * Math.sin(relRad);

        const sameDirection = Math.abs(((t.heading - hz.heading + 540) % 360) - 180) <= 45;
        ctx.fillStyle = !sameDirection
          ? 'rgba(130, 150, 175, 0.35)'
          : hz.severity === 'Rim Bender'
          ? '#ff2a2a'
          : hz.severity === 'Bump'
          ? '#ffb000'
          : '#00d4ff';

        ctx.beginPath();
        ctx.arc(px, py, sameDirection ? 6.5 : 4, 0, Math.PI * 2);
        ctx.fill();

        if (sameDirection) {
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 10px monospace';
          ctx.fillText(`${hz.id.replace('NZ-POT-', '#')} (${Math.round(distM)}m)`, px + 9, py + 3);
        }
      });

      // Vehicle Origin Marker (Shifted slightly left of centerline to illustrate NZ Left-Hand Lane)
      ctx.fillStyle = '#00f58c';
      ctx.beginPath();
      ctx.arc(cx - 10, cy, 6, 0, Math.PI * 2);
      ctx.fill();

      requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);
  }

  /**
   * Mode 2: Render Review Table, SLA Timers & Reference Scale Photo Size Estimator
   */
  function renderReviewTable() {
    const tbody = el('review-table-body');
    if (!tbody) return;
    const filterVal = el('review-filter-select') ? el('review-filter-select').value : 'ALL';

    const filtered = cachedHazards.filter((h) => {
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
        selectedHazardId = btn.getAttribute('data-id');
        showView(3, true); // Open Council/NZTA Suite for this pothole
      });
    });

    tbody.querySelectorAll('.btn-fix-row').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        const target = cachedHazards.find((x) => x.id === id);
        if (!target) return;
        const nextStatus = target.status === 'Fixed' ? 'Unreported' : 'Fixed';
        await window.RimReaperDB.updateHazard(id, {
          status: nextStatus,
          fixedAt: nextStatus === 'Fixed' ? Date.now() : null
        });
        cachedHazards = await window.RimReaperDB.getAllHazards();
        renderReviewTable();
        refreshTelemetryAndHUD();
      });
    });
  }

  /**
   * Mode 3: Trip Planner & Route Hazard Corridor Scanner + .SRT Dashcam Exporter
   */
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
    destSel.value = '5'; // Auckland CBD (scans SH1 Dome Valley!)
  }

  function runCorridorScan() {
    const origSel = el('trip-origin-select');
    const destSel = el('trip-dest-select');
    if (!origSel || !destSel) return;

    const orig = window.NZ_DATA.TOWNS[Number(origSel.value) || 0];
    const dest = window.NZ_DATA.TOWNS[Number(destSel.value) || 5];
    const report = window.GeoLaneEngine.scanTripCorridor(orig, dest, cachedHazards);

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
  }

  async function downloadDashcamSRT() {
    const stats = await window.RimReaperDB.getStats();
    const bookmarks = stats.dashcamBookmarks && stats.dashcamBookmarks.length > 0
      ? stats.dashcamBookmarks
      : cachedHazards.slice(0, 8).map((h) => ({
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

  /**
   * Mode 4: NZ Council, Waka Kotahi NZTA, Tyre/Rim Claim Dossier, OIA/LGOIMA & League Table
   */
  function getSelectedHazard() {
    return cachedHazards.find((h) => h.id === selectedHazardId) || cachedHazards[0];
  }

  function renderCouncilPreview(mode = 'email') {
    const h = getSelectedHazard();
    const box = el('council-export-preview');
    if (!box || !h) return;

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
    cachedHazards.forEach((h) => {
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

  async function renderDriverStatsBar() {
    const stats = await window.RimReaperDB.getStats();
    if (el('stat-km')) el('stat-km').textContent = `${Number(stats.kmScanned || 0).toFixed(1)} km`;
    if (el('stat-logged')) el('stat-logged').textContent = `${cachedHazards.length}`;
    if (el('stat-fixed')) {
      const fixedCount = cachedHazards.filter((h) => h.status === 'Fixed').length;
      el('stat-fixed').textContent = `${fixedCount}`;
    }
  }

  function downloadTextFile(filename, content, mime = 'text/plain') {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 200);
  }

  function showToast(msg) {
    const node = el('footer-status-msg');
    if (node) {
      node.textContent = msg;
      node.style.color = 'var(--accent-amber)';
      setTimeout(() => {
        node.style.color = 'var(--text-secondary)';
      }, 2800);
    }
  }

  function applyLanguage(lang) {
    currentLang = lang === 'mi' ? 'mi' : 'en';
    window.AudioRadar.setLanguage(currentLang);
    const dict = I18N[currentLang];
    if (el('tab-radar')) el('tab-radar').textContent = dict.tabRadar;
    if (el('tab-review')) el('tab-review').textContent = dict.tabReview;
    if (el('tab-planner')) el('tab-planner').textContent = dict.tabPlanner;
    if (el('tab-council')) el('tab-council').textContent = dict.tabCouncil;
    if (el('btn-giant-title')) el('btn-giant-title').textContent = dict.tapLogMain;
    if (el('btn-giant-sub')) el('btn-giant-sub').textContent = dict.tapLogSub;
  }

  async function init() {
    updateClock();
    setInterval(updateClock, 1000);

    cachedHazards = await window.RimReaperDB.getAllHazards();
    selectedHazardId = cachedHazards[0] ? cachedHazards[0].id : null;

    populateTownSelects();
    initKeyboardControls();
    startRadarCanvasLoop();

    // Register Service Worker for 100% offline capability
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }

    // Listen for real-time cross-tab updates from admin.html or remote.html
    window.RimReaperDB.onUpdate(async (type, payload) => {
      if (type === 'telemetry_override' && payload) {
        window.GeoLaneEngine.setManualTelemetry(payload);
      }
      cachedHazards = await window.RimReaperDB.getAllHazards();
      refreshTelemetryAndHUD();
      if (currentViewIdx === 1) renderReviewTable();
      if (currentViewIdx === 2) runCorridorScan();
      if (currentViewIdx === 3) {
        renderCouncilPreview('email');
        renderLeagueTable();
      }
    });

    // Bind Navigation Tabs
    VIEWS.forEach((v, idx) => {
      const tab = el(`tab-${v}`);
      if (tab) tab.addEventListener('click', () => showView(idx));
    });

    // Bind 1-Click Logo Switcher (Cycles Logo 1 -> Logo 2 -> Logo 3 -> Logo 4)
    const LOGOS = ['./logo.jpg', './logo_v2.jpg', './logo_v3.jpg', './logo_v4.jpg'];
    let logoIdx = 0;
    if (el('app-brand-logo')) {
      el('app-brand-logo').addEventListener('click', () => {
        logoIdx = (logoIdx + 1) % LOGOS.length;
        el('app-brand-logo').src = LOGOS[logoIdx];
        showToast(`Switched Active Logo: Option #${logoIdx + 1} (${LOGOS[logoIdx]})`);
      });
    }

    // Bind Boot Sweep Button
    if (el('btn-boot-sweep')) {
      el('btn-boot-sweep').addEventListener('click', runBootSequence);
    }

    // Bind Drive Simulator Button
    if (el('btn-sim-drive')) {
      el('btn-sim-drive').addEventListener('click', () => {
        const corridor = el('sim-corridor-select') ? el('sim-corridor-select').value : 'SH1-DOME';
        const active = window.GeoLaneEngine.toggleDriveSimulation(corridor, () => {
          refreshTelemetryAndHUD();
        });
        el('btn-sim-drive').textContent = active ? '⏹ STOP SIM DRIVE' : '▶ SIMULATE NZ DRIVE';
        el('btn-sim-drive').className = active ? 'btn btn-primary' : 'btn btn-success';
        if (active) runBootSequence();
      });
    }

    // Bind Giant 1-Tap Log Buttons
    if (el('btn-log-rim')) {
      el('btn-log-rim').addEventListener('click', () => handleQuickLog('Rim Bender', '1-Tap HUD'));
    }
    if (el('btn-log-bump')) {
      el('btn-log-bump').addEventListener('click', () => handleQuickLog('Bump', '1-Tap HUD'));
    }
    if (el('btn-log-slip')) {
      el('btn-log-slip').addEventListener('click', () =>
        handleQuickLog('Rim Bender', '1-Tap Slip Button', 'Slip / Washout / Dropout')
      );
    }

    // Bind Wheel Track Selector Buttons
    document.querySelectorAll('.track-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.track-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        const track = btn.getAttribute('data-track');
        window.GeoLaneEngine.setManualTelemetry({ wheelTrack: track }, refreshTelemetryAndHUD);
      });
    });

    // Bind Co-Pilot Toggle
    if (el('btn-copilot-toggle')) {
      el('btn-copilot-toggle').addEventListener('click', () => {
        coPilotUnlocked = !coPilotUnlocked;
        el('btn-copilot-toggle').textContent = coPilotUnlocked ? 'CO-PILOT: UNLOCKED' : 'CO-PILOT: LOCKED';
        el('btn-copilot-toggle').className = coPilotUnlocked ? 'btn btn-success' : 'btn';
        refreshTelemetryAndHUD();
      });
    }

    // Bind Theme / Night-Vision Selector
    if (el('theme-select')) {
      el('theme-select').addEventListener('change', (e) => {
        document.body.classList.remove('theme-night-red', 'theme-amber-v1', 'theme-colorblind');
        if (e.target.value !== 'default') {
          document.body.classList.add(e.target.value);
        }
      });
    }

    // Bind Vehicle Profile Selector
    if (el('vehicle-profile-select')) {
      el('vehicle-profile-select').addEventListener('change', (e) => {
        window.GeoLaneEngine.setProfile(e.target.value);
        showToast(`Vehicle Calibration: ${e.target.value}`);
      });
    }

    // Bind Gravel Suppression & Holiday Presets
    if (el('chk-gravel-suppress')) {
      el('chk-gravel-suppress').addEventListener('change', (e) => {
        window.GeoLaneEngine.setGravelSuppression(e.target.checked);
        showToast(e.target.checked ? 'Gravel Road Bump Suppression ACTIVE' : 'Gravel Suppression OFF');
      });
    }
    if (el('chk-holiday-preset')) {
      el('chk-holiday-preset').addEventListener('change', (e) => {
        window.GeoLaneEngine.setHolidayPreset(e.target.checked);
        showToast(e.target.checked ? 'NZ Holiday Road Toll High-Alert Preset ACTIVE' : 'Standard Alert Sensitivity');
      });
    }

    // Bind Audio Mute, Haptic-Only & Voice Trigger
    if (el('btn-mute-audio')) {
      el('btn-mute-audio').addEventListener('click', () => {
        const m = window.AudioRadar.setMuted(!window.AudioRadar.isMuted());
        el('btn-mute-audio').textContent = m ? '🔇 MUTED' : '🔊 AUDIO ON';
      });
    }
    if (el('btn-haptic-mode')) {
      el('btn-haptic-mode').addEventListener('click', () => {
        const h = window.AudioRadar.setHapticOnly(!window.AudioRadar.isHapticOnly());
        el('btn-haptic-mode').textContent = h ? '📳 HAPTIC ONLY' : '📳 HAPTIC+AUDIO';
      });
    }
    if (el('btn-voice-trigger')) {
      el('btn-voice-trigger').addEventListener('click', () => {
        const v = window.AudioRadar.toggleVoiceTrigger();
        el('btn-voice-trigger').textContent = v ? '🎙️ VOICE: LISTENING' : '🎙️ VOICE LOG';
        el('btn-voice-trigger').className = v ? 'btn btn-primary' : 'btn';
      });
    }

    // Bind Bilingual EN / MI Toggle
    if (el('btn-lang-toggle')) {
      el('btn-lang-toggle').addEventListener('click', () => {
        const nextLang = currentLang === 'en' ? 'mi' : 'en';
        applyLanguage(nextLang);
        el('btn-lang-toggle').textContent = nextLang === 'mi' ? '🌐 TE REO MĀORI' : '🌐 EN / MĀORI';
      });
    }

    // Bind Pass-By STILL THERE / FIXED Buttons
    if (el('btn-passby-still')) {
      el('btn-passby-still').addEventListener('click', () => handlePassByResponse('StillThere'));
    }
    if (el('btn-passby-fixed')) {
      el('btn-passby-fixed').addEventListener('click', () => handlePassByResponse('Fixed'));
    }

    // Bind Review Filter & Manual Entry Form
    if (el('review-filter-select')) {
      el('review-filter-select').addEventListener('change', renderReviewTable);
    }
    if (el('btn-manual-save')) {
      el('btn-manual-save').addEventListener('click', async () => {
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
          manualOverride: true,
          notes
        });
        cachedHazards = await window.RimReaperDB.getAllHazards();
        selectedHazardId = res.record.id;
        renderReviewTable();
        refreshTelemetryAndHUD();
        showToast(`Saved Hazard ${res.record.id} (${res.record.authorityName})`);
      });
    }

    // Reference Scale Photo Size Estimator (NZ $2 Coin = 26.5mm, NZ Edge Line = 100mm, Boot = 300mm)
    if (el('btn-calc-scale')) {
      el('btn-calc-scale').addEventListener('click', () => {
        const refMm = parseFloat(el('scale-ref-type').value) || 100;
        const ratio = parseFloat(el('scale-multiplier').value) || 5.5;
        const estDiamCm = Math.round((refMm * ratio) / 10);
        const estDepthCm = Math.max(4, Math.round(estDiamCm * 0.22));
        if (el('man-diam')) el('man-diam').value = estDiamCm;
        if (el('man-depth')) el('man-depth').value = estDepthCm;
        showToast(`Photo Scale Estimate: ${estDiamCm}cm diameter × ${estDepthCm}cm depth`);
      });
    }

    // Bind Trip Planner Controls
    if (el('btn-scan-corridor')) {
      el('btn-scan-corridor').addEventListener('click', runCorridorScan);
    }
    if (el('btn-export-srt')) {
      el('btn-export-srt').addEventListener('click', downloadDashcamSRT);
    }

    // Bind Council / NZTA Suite Template Switchers & Exporters
    document.querySelectorAll('.btn-doc-mode').forEach((btn) => {
      btn.addEventListener('click', () => {
        const mode = btn.getAttribute('data-mode');
        renderCouncilPreview(mode);
      });
    });

    if (el('btn-send-mailto')) {
      el('btn-send-mailto').addEventListener('click', async () => {
        const h = getSelectedHazard();
        if (!h) return;
        await window.RimReaperDB.updateHazard(h.id, { status: 'Exported', exportedAt: Date.now() });
        cachedHazards = await window.RimReaperDB.getAllHazards();
        renderCouncilPreview('email');
        renderLeagueTable();
        const subj = encodeURIComponent(`[ROAD DEFECT] ${h.severity} ${h.hazardType} — ${h.roadName} (${h.rammRef})`);
        const body = encodeURIComponent(el('council-export-preview').textContent);
        window.open(`mailto:${h.authorityEmail}?cc=${h.councillorEmail}&subject=${subj}&body=${body}`, '_self');
      });
    }

    if (el('btn-copy-preview')) {
      el('btn-copy-preview').addEventListener('click', () => {
        const txt = el('council-export-preview') ? el('council-export-preview').textContent : '';
        if (navigator.clipboard) navigator.clipboard.writeText(txt);
        showToast('Copied Report Dossier to Clipboard');
      });
    }

    if (el('btn-export-csv')) {
      el('btn-export-csv').addEventListener('click', () => {
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
        const rows = cachedHazards.map((h) =>
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
      });
    }

    if (el('btn-export-geojson')) {
      el('btn-export-geojson').addEventListener('click', () => {
        const geojson = {
          type: 'FeatureCollection',
          name: 'Rim-Reaper-NZ-Hazards',
          features: cachedHazards.map((h) => ({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [h.lon, h.lat] },
            properties: h
          }))
        };
        downloadTextFile('Rim-Reaper-NZ-GIS.geojson', JSON.stringify(geojson, null, 2), 'application/geo+json');
        showToast('Downloaded GIS GeoJSON Bundle');
      });
    }

    if (el('btn-backup-db')) {
      el('btn-backup-db').addEventListener('click', async () => {
        const bundle = await window.RimReaperDB.exportBackupBundle();
        downloadTextFile('Rim-Reaper-NZ-Backup.pothole.json', JSON.stringify(bundle, null, 2), 'application/json');
        showToast('Downloaded Encrypted Offline Database Backup');
      });
    }

    // Initialize Sensors & Hands-Free Media/Voice Triggers
    window.AudioRadar.initHandsFreeTriggers({
      onQuickLog: (sev, src, hType) => handleQuickLog(sev, src, hType),
      onPassByVerify: (choice) => handlePassByResponse(choice)
    });
    window.GeoLaneEngine.startSensors(
      () => refreshTelemetryAndHUD(),
      (gForce, track) => {
        handleQuickLog(gForce >= 2.7 ? 'Rim Bender' : 'Bump', `Accelerometer Auto-Bump (${gForce}G, ${track})`);
      }
    );

    refreshTelemetryAndHUD();
    setTimeout(runBootSequence, 350);
  }

  return {
    init,
    nextSlide,
    prevSlide,
    handleQuickLog
  };
})();

window.addEventListener('DOMContentLoaded', () => {
  window.RimReaperApp.init();
});
