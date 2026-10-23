/**
 * Rim-Reaper-NZ — Main Application Orchestrator
 */

window.RimReaperApp = (function () {
  const {
    VIEWS,
    state,
    el,
    bind,
    updateClock,
    showToast,
    applyLanguage,
    showView,
    nextSlide,
    prevSlide,
    toggleSettingsSheet,
    initKeyboardControls
  } = window.RimReaperCore;

  async function init() {
    updateClock();
    setInterval(updateClock, 1000);

    state.cachedHazards = await window.RimReaperDB.getAllHazards();
    state.selectedHazardId = state.cachedHazards[0] ? state.cachedHazards[0].id : null;

    window.RimReaperLog.populateTownSelects();
    initKeyboardControls();
    window.RimReaperMaps.initLeafletMaps();
    window.RimReaperDrive.startRadarCanvasLoop();

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }

    window.RimReaperDB.onUpdate(async (type, payload) => {
      if (type === 'telemetry_override' && payload) {
        window.GeoLaneEngine.setManualTelemetry(payload);
      }
      state.cachedHazards = await window.RimReaperDB.getAllHazards();
      window.RimReaperDrive.refreshTelemetryAndHUD();
      if (state.currentViewIdx === 1) window.RimReaperLog.renderReviewTable();
      if (state.currentViewIdx === 2) window.RimReaperLog.runCorridorScan();
      if (state.currentViewIdx === 3) {
        window.RimReaperReport.renderCouncilPreview('email');
        window.RimReaperReport.renderLeagueTable();
      }
    });

    // Navigation Tabs (1. DRIVE, 2. LOG, 3. ROUTE, 4. REPORT)
    VIEWS.forEach((v, idx) => {
      bind(`tab-${v}`, 'click', () => showView(idx));
    });

    // Settings Sheet Open/Close
    bind('btn-open-settings', 'click', () => toggleSettingsSheet());
    bind('btn-drive-settings', 'click', () => toggleSettingsSheet(true));
    bind('btn-close-settings', 'click', () => toggleSettingsSheet(false));
    bind('settings-sheet-backdrop', 'click', () => toggleSettingsSheet(false));

    // Splash Screen Power-On & Replay Boot
    bind('btn-splash-boot', 'click', () => window.RimReaperDrive.dismissSplashIntoSplitMap());
    bind('splash-logo-img', 'click', () => window.RimReaperDrive.dismissSplashIntoSplitMap());
    bind('btn-boot-sweep', 'click', () => window.RimReaperDrive.runBootSequence(true));

    // Transparent tap anywhere on splash unlocks mobile Web Audio & permissions without interrupting 15s countdown
    const splashScreen = el('boot-splash-screen');
    if (splashScreen) {
      splashScreen.addEventListener('pointerdown', () => {
        if (window.AudioRadar && window.AudioRadar.ensureContext) window.AudioRadar.ensureContext();
        if (window.GeoLaneEngine && window.GeoLaneEngine.requestMobileHardwarePermissions) {
          window.GeoLaneEngine.requestMobileHardwarePermissions();
        }
      }, { passive: true });
    }

    // Single Map/3D-Lane/Split Cycle Button on Map Corner
    bind('btn-cycle-view', 'click', () => window.RimReaperMaps.cycleRadarViewMode());

    // Single Location Bar on Map (Tap to Re-Locate Device)
    const triggerLocateMe = () => {
      showToast('Locking onto Real Device Location & Motion Sensors...');
      window.GeoLaneEngine.locateMeNow((res) => {
        if (res && res.ok) {
          window.RimReaperMaps.focusDeviceLocationOnMap(true);
          showToast(
            `📍 DEVICE LOCATED: ${res.state.placeLabel || res.state.roadName} (${res.state.lat.toFixed(5)}, ${res.state.lon.toFixed(5)})`
          );
        } else {
          if (res && res.httpsRequired && el('btn-https-switch')) {
            el('btn-https-switch').style.display = 'inline-flex';
          }
          showToast(res ? res.message : 'Location Lock Failed');
        }
      });
    };
    bind('map-device-location-bar', 'click', triggerLocateMe);

    // Drive Simulator (Inside Settings Sheet & Desktop Side Panel)
    const toggleSimDrive = () => {
      if (window.RimReaperDB.isFakeDataDisabled && window.RimReaperDB.isFakeDataDisabled()) {
        showToast('Fake data & simulation disabled. Re-enable in Settings to run simulator.');
        return;
      }
      const corridor = el('sim-corridor-select') ? el('sim-corridor-select').value : 'SH1-DOME';
      const active = window.GeoLaneEngine.toggleDriveSimulation(corridor, () => {
        window.RimReaperDrive.refreshTelemetryAndHUD();
      });
      if (el('btn-sim-drive')) {
        el('btn-sim-drive').textContent = active ? '⏹ STOP SIM DRIVE' : '▶ SIMULATE NZ DRIVE';
        el('btn-sim-drive').className = active ? 'btn btn-primary' : 'btn btn-success';
      }
      toggleSettingsSheet(false);
    };
    bind('btn-sim-drive', 'click', toggleSimDrive);

    // Toggle All Fake Data (Pure Live Sensors Mode)
    const updateFakeDataUI = (disabled) => {
      const btn = el('btn-toggle-fake-data');
      const badge = el('fake-data-badge');
      const note = el('fake-data-status-note');
      const simBtn = el('btn-sim-drive');

      if (disabled) {
        if (btn) {
          btn.textContent = '🔄 RESTORE DEMO DATA & SIMULATOR';
          btn.className = 'btn btn-cyan';
        }
        if (badge) {
          badge.textContent = 'PURE REAL SENSORS';
          badge.className = 'status-pill stat-fixed';
        }
        if (note) {
          note.textContent = '✅ All fake data purged. Database and radar operate 100% on live device GPS fixes and hardware motion sensors.';
        }
        if (simBtn) {
          simBtn.textContent = '⛔ SIMULATOR DISABLED';
          simBtn.disabled = true;
          simBtn.className = 'btn';
        }
      } else {
        if (btn) {
          btn.textContent = '🚫 TURN OFF ALL FAKE DATA (REAL SENSORS ONLY)';
          btn.className = 'btn btn-danger';
        }
        if (badge) {
          badge.textContent = 'DEMO DATA ACTIVE';
          badge.className = 'status-pill stat-unreported';
        }
        if (note) {
          note.textContent = 'Purges all 11 seed demo potholes, stops test drive simulation, and runs 100% on live physical GPS and motion sensors.';
        }
        if (simBtn) {
          simBtn.textContent = '▶ SIMULATE NZ DRIVE';
          simBtn.disabled = false;
          simBtn.className = 'btn btn-success';
        }
      }
    };

    const toggleFakeData = async () => {
      const isCurrentlyDisabled = window.RimReaperDB.isFakeDataDisabled();
      if (isCurrentlyDisabled) {
        await window.RimReaperDB.restoreFakeData();
        window.GeoLaneEngine.setNoFakeDataMode(false);
        updateFakeDataUI(false);
        showToast('ℹ️ DEMO SEED HAZARDS & SIMULATOR RESTORED');
      } else {
        await window.RimReaperDB.purgeAllFakeData();
        window.GeoLaneEngine.setNoFakeDataMode(true);
        updateFakeDataUI(true);
        showToast('🚫 ALL FAKE DATA PURGED — RUNNING 100% ON LIVE HARDWARE SENSORS');
      }
      window.RimReaperDrive.refreshTelemetryAndHUD();
      if (window.RimReaperLog) window.RimReaperLog.renderLeagueTable();
      if (window.RimReaperMaps) {
        window.RimReaperMaps.updateRadarMap();
        window.RimReaperMaps.renderReviewMapMarkers();
      }
    };
    bind('btn-toggle-fake-data', 'click', toggleFakeData);
    if (window.RimReaperDB.isFakeDataDisabled) {
      updateFakeDataUI(window.RimReaperDB.isFakeDataDisabled());
    }

    // 1-Tap Hazard Logging Buttons on Drive Screen
    bind('btn-log-rim', 'click', () => window.RimReaperDrive.handleQuickLog('Rim Bender', '1-Tap HUD'));
    bind('btn-log-bump', 'click', () => window.RimReaperDrive.handleQuickLog('Bump', '1-Tap HUD'));
    bind('btn-log-slip', 'click', () =>
      window.RimReaperDrive.handleQuickLog('Rim Bender', '1-Tap Slip Button', 'Slip / Washout / Dropout')
    );

    // Wheel Track Selector Buttons
    document.querySelectorAll('.track-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.track-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        const track = btn.getAttribute('data-track');
        window.GeoLaneEngine.setManualTelemetry({ wheelTrack: track }, window.RimReaperDrive.refreshTelemetryAndHUD);
      });
    });

    // Co-Pilot 10 km/h Lock-Out Override, Theme, Vehicle Profile, Gravel & Holiday Presets
    bind('btn-copilot-toggle', 'click', () => {
      state.coPilotUnlocked = !state.coPilotUnlocked;
      if (el('btn-copilot-toggle')) {
        el('btn-copilot-toggle').textContent = state.coPilotUnlocked ? 'CO-PILOT: UNLOCKED' : 'CO-PILOT: LOCKED';
        el('btn-copilot-toggle').className = state.coPilotUnlocked ? 'btn btn-success' : 'btn';
      }
      window.RimReaperDrive.refreshTelemetryAndHUD();
    });

    bind('theme-select', 'change', (e) => {
      document.body.classList.remove('theme-night-red', 'theme-amber-v1', 'theme-colorblind');
      if (e.target.value !== 'default') document.body.classList.add(e.target.value);
    });

    bind('vehicle-profile-select', 'change', (e) => {
      window.GeoLaneEngine.setProfile(e.target.value);
      showToast(`Vehicle Calibration: ${e.target.value}`);
    });

    bind('chk-gravel-suppress', 'change', (e) => {
      window.GeoLaneEngine.setGravelSuppression(e.target.checked);
      showToast(e.target.checked ? 'Gravel Road Bump Suppression ACTIVE' : 'Gravel Suppression OFF');
    });

    bind('chk-holiday-preset', 'change', (e) => {
      window.GeoLaneEngine.setHolidayPreset(e.target.checked);
      showToast(e.target.checked ? 'NZ Holiday Road Toll High-Alert Preset ACTIVE' : 'Standard Alert Sensitivity');
    });

    // Audio, Haptic, Voice & Language Controls
    bind('btn-mute-audio', 'click', () => {
      const m = window.AudioRadar.setMuted(!window.AudioRadar.isMuted());
      if (el('btn-mute-audio')) el('btn-mute-audio').textContent = m ? '🔇 MUTED' : '🔊 AUDIO ON';
    });

    bind('btn-haptic-mode', 'click', () => {
      const h = window.AudioRadar.setHapticOnly(!window.AudioRadar.isHapticOnly());
      if (el('btn-haptic-mode')) el('btn-haptic-mode').textContent = h ? '📳 HAPTIC ONLY' : '📳 HAPTIC+AUDIO';
    });

    bind('btn-voice-trigger', 'click', () => {
      const v = window.AudioRadar.toggleVoiceTrigger();
      if (el('btn-voice-trigger')) {
        el('btn-voice-trigger').textContent = v ? '🎙️ VOICE: ON' : '🎙️ VOICE LOG';
        el('btn-voice-trigger').className = v ? 'btn btn-primary' : 'btn';
      }
    });

    bind('btn-lang-toggle', 'click', () => {
      const nextLang = state.currentLang === 'en' ? 'mi' : 'en';
      applyLanguage(nextLang);
      if (el('btn-lang-toggle')) {
        el('btn-lang-toggle').textContent = nextLang === 'mi' ? '🌐 TE REO MĀORI' : '🌐 EN / MĀORI';
      }
    });

    // Pass-By Prompt Responses
    bind('btn-passby-still', 'click', () => window.RimReaperDrive.handlePassByResponse('StillThere'));
    bind('btn-passby-fixed', 'click', () => window.RimReaperDrive.handlePassByResponse('Fixed'));

    // Mode 2: Review Filter, Manual Save, Scale Calculator & Camera Capture
    bind('review-filter-select', 'change', window.RimReaperLog.renderReviewTable);
    bind('btn-manual-save', 'click', window.RimReaperLog.saveManualEntry);
    bind('btn-calc-scale', 'click', window.RimReaperLog.estimateReferenceScale);

    bind('btn-camera-hud', 'click', () => {
      state.cameraCaptureSource = 'hud';
      if (el('camera-file-input')) el('camera-file-input').click();
    });
    bind('btn-camera-review', 'click', () => {
      state.cameraCaptureSource = 'review';
      if (el('camera-file-input')) el('camera-file-input').click();
    });
    bind('camera-file-input', 'change', async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const dataUrl = await window.RimReaperLog.compressCameraImage(file);
      state.pendingPhotoDataUrl = dataUrl;
      if (el('review-photo-preview')) el('review-photo-preview').src = dataUrl;
      if (el('review-photo-box')) el('review-photo-box').style.display = 'flex';

      if (state.cameraCaptureSource === 'hud') {
        await window.RimReaperDrive.handleQuickLog('Rim Bender', 'Rear Camera Photo HUD', 'Pothole', dataUrl);
      } else if (state.selectedHazardId) {
        await window.RimReaperDB.updateHazard(state.selectedHazardId, { photoDataUrl: dataUrl });
        state.cachedHazards = await window.RimReaperDB.getAllHazards();
        window.RimReaperLog.renderReviewTable();
        window.RimReaperDrive.refreshTelemetryAndHUD();
        showToast(`📷 Photo Attached to Hazard ${state.selectedHazardId}`);
      }
      e.target.value = '';
    });

    // PWA Install Prompt
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      state.deferredInstallPrompt = e;
      if (el('btn-install-pwa')) el('btn-install-pwa').style.display = 'inline-flex';
    });
    bind('btn-install-pwa', 'click', async () => {
      if (state.deferredInstallPrompt) {
        state.deferredInstallPrompt.prompt();
        await state.deferredInstallPrompt.userChoice;
        state.deferredInstallPrompt = null;
        if (el('btn-install-pwa')) el('btn-install-pwa').style.display = 'none';
      } else {
        showToast('Tap Browser Menu -> "Add to Home Screen"');
      }
    });

    // Mode 3: Trip Corridor Scanner & .SRT Dashcam Exporter
    bind('btn-scan-corridor', 'click', window.RimReaperLog.runCorridorScan);
    bind('btn-export-srt', 'click', window.RimReaperLog.downloadDashcamSRT);

    // Mode 4: Report Generator, Share, Mailto & Unified Export Menu
    document.querySelectorAll('.btn-doc-mode').forEach((btn) => {
      btn.addEventListener('click', () => window.RimReaperReport.renderCouncilPreview(btn.getAttribute('data-mode')));
    });
    bind('btn-native-share', 'click', window.RimReaperReport.shareOrCopyReport);
    bind('btn-send-mailto', 'click', window.RimReaperReport.sendMailtoCouncil);
    bind('btn-export-csv', 'click', window.RimReaperReport.exportCsv);
    bind('btn-export-geojson', 'click', window.RimReaperReport.exportGeoJson);
    bind('btn-backup-db', 'click', window.RimReaperReport.exportBackupDb);

    // QR Code Share Suite & Modal Controls
    bind('btn-open-share', 'click', () => window.RimReaperReport.openShareModal('pwa'));
    bind('btn-close-qr-modal', 'click', () => window.RimReaperReport.closeShareModal());
    bind('qr-modal-backdrop', 'click', () => window.RimReaperReport.closeShareModal());

    document.querySelectorAll('.btn-qr-target').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.btn-qr-target').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        const target = btn.getAttribute('data-target') || 'pwa';
        window.RimReaperReport.renderShareQr(target, false);
      });
    });

    document.querySelectorAll('.btn-modal-qr').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.btn-modal-qr').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        const target = btn.getAttribute('data-target') || 'pwa';
        window.RimReaperReport.renderShareQr(target, true);
      });
    });

    bind('btn-copy-qr-link', 'click', () => {
      window.RimReaperReport.copyShareLink(window.RimReaperReport.getActiveTargets().report);
    });
    bind('btn-native-share-app', 'click', () => {
      window.RimReaperReport.shareAppLink(window.RimReaperReport.getActiveTargets().report);
    });
    bind('btn-modal-copy-link', 'click', () => {
      window.RimReaperReport.copyShareLink(window.RimReaperReport.getActiveTargets().modal);
    });
    bind('btn-modal-share-app', 'click', () => {
      window.RimReaperReport.shareAppLink(window.RimReaperReport.getActiveTargets().modal);
    });

    // Initialize Sensors & Hands-Free Media/Voice Triggers
    window.AudioRadar.initHandsFreeTriggers({
      onQuickLog: (sev, src, hType) => window.RimReaperDrive.handleQuickLog(sev, src, hType),
      onPassByVerify: (choice) => window.RimReaperDrive.handlePassByResponse(choice)
    });
    window.GeoLaneEngine.startSensors(
      () => window.RimReaperDrive.refreshTelemetryAndHUD(),
      (gForce, track) => {
        window.RimReaperDrive.handleQuickLog(
          gForce >= 2.7 ? 'Rim Bender' : 'Bump',
          `Accelerometer Auto-Bump (${gForce}G, ${track})`
        );
      }
    );

    window.RimReaperDrive.refreshTelemetryAndHUD();

    // Automatic 15s Pothole Radar Self-Test & Auto-Open 3D Split Map Mode
    window.RimReaperDrive.runBootSequence(false);
  }

  return {
    init,
    nextSlide,
    prevSlide,
    handleQuickLog: window.RimReaperDrive.handleQuickLog
  };
})();

window.addEventListener('DOMContentLoaded', () => {
  window.RimReaperApp.init();
});
