/**
 * Rim-Reaper-NZ — Core State, DOM Helpers, Clock, View Router & Keyboard Protocol
 */

window.RimReaperCore = (function () {
  const VIEWS = ['radar', 'review', 'planner', 'council'];
  const SIM_CORRIDORS = ['SH1-DOME', 'SH1-DESERT', 'SH73-OTIRA', 'SH2-REMUTAKA'];

  const state = {
    currentViewIdx: 0,
    currentCorridorIdx: 0,
    coPilotUnlocked: false,
    selectedHazardId: null,
    cachedHazards: [],
    passByPromptHazardId: null,
    passByTimeout: null,
    pendingPhotoDataUrl: null,
    cameraCaptureSource: 'hud',
    deferredInstallPrompt: null,
    slideDurationMs: 20000,
    slideTimer: null,
    slidePaused: true,
    freezeLocked: false,
    currentLang: 'en',
    toastTimeout: null
  };

  const I18N = {
    en: {
      tabRadar: '1. DRIVE',
      tabReview: '2. LOG',
      tabPlanner: '3. ROUTE',
      tabCouncil: '4. REPORT',
      tapLogMain: '💥 TAP TO LOG POTHOLE (LEFT LANE)',
      tapLogSub: '1.75s Reaction Lookback • Auto-Deduplicates ≤8m • NZ Left-Hand Lane'
    },
    mi: {
      tabRadar: '1. MATAWAI',
      tabReview: '2. RĀRANGI',
      tabPlanner: '3. HAERENGA',
      tabCouncil: '4. KAUNIHERA',
      tapLogMain: '💥 RĒHITA KŌHAO (ARA MAUĪ)',
      tapLogSub: '1.75s Hoki-Whakamuri • Kaunihera & Waka Kotahi • Ara Mauī o Aotearoa'
    }
  };

  function el(id) {
    return document.getElementById(id);
  }

  function bind(id, event, handler) {
    const node = el(id);
    if (node) node.addEventListener(event, handler);
    return node;
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

  function showToast(msg) {
    const footerNode = el('footer-status-msg');
    if (footerNode) {
      footerNode.textContent = msg;
      footerNode.style.color = 'var(--accent-amber)';
    }
    const mobileToast = el('floating-toast');
    if (mobileToast) {
      mobileToast.textContent = msg;
      mobileToast.classList.add('visible');
    }
    if (state.toastTimeout) clearTimeout(state.toastTimeout);
    state.toastTimeout = setTimeout(() => {
      if (footerNode) footerNode.style.color = 'var(--text-secondary)';
      if (mobileToast) mobileToast.classList.remove('visible');
    }, 2800);
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

  function applyLanguage(lang) {
    state.currentLang = lang === 'mi' ? 'mi' : 'en';
    window.AudioRadar.setLanguage(state.currentLang);
    const dict = I18N[state.currentLang];
    const updateTab = (btnId, text) => {
      const btn = el(btnId);
      if (!btn) return;
      const label = btn.querySelector('.nav-tab-label');
      if (label) {
        label.textContent = text.replace(/^\d+\.\s*/, '');
      } else {
        btn.textContent = text;
      }
    };
    updateTab('tab-btn-radar', dict.tabRadar);
    updateTab('tab-btn-log', dict.tabReview);
    updateTab('tab-btn-planner', dict.tabPlanner);
    updateTab('tab-btn-report', dict.tabCouncil);
    if (el('tab-radar')) el('tab-radar').textContent = dict.tabRadar;
    if (el('tab-review')) el('tab-review').textContent = dict.tabReview;
    if (el('tab-planner')) el('tab-planner').textContent = dict.tabPlanner;
    if (el('tab-council')) el('tab-council').textContent = dict.tabCouncil;
    if (el('btn-giant-title')) el('btn-giant-title').textContent = dict.tapLogMain;
    if (el('btn-giant-sub')) el('btn-giant-sub').textContent = dict.tapLogSub;
  }

  function showView(index, force = false) {
    if (state.freezeLocked && !force) return;
    const telemetry = window.GeoLaneEngine.getState();
    const targetIdx = (index + VIEWS.length) % VIEWS.length;

    if (telemetry.speedKmh > 10 && !state.coPilotUnlocked && targetIdx !== 0) {
      showToast('SAFETY LOCK-OUT (>10 KM/H): Unlock Co-Pilot in ⚙️ Settings to open tabs while moving.');
      return;
    }

    state.currentViewIdx = targetIdx;
    const viewName = VIEWS[state.currentViewIdx];

    VIEWS.forEach((v, idx) => {
      const panel = el(`view-${v}`);
      const tab = el(`tab-${v}`);
      if (panel) panel.classList.toggle('active-view', idx === state.currentViewIdx);
      if (tab) tab.classList.toggle('active', idx === state.currentViewIdx);
    });

    if (viewName === 'radar' && window.RimReaperMaps) {
      setTimeout(() => window.RimReaperMaps.invalidateRadar(), 80);
    }
    if (viewName === 'review' && window.RimReaperLog) {
      window.RimReaperLog.renderReviewTable();
      setTimeout(() => window.RimReaperMaps.invalidateReview(), 80);
    }
    if (viewName === 'planner' && window.RimReaperLog) {
      window.RimReaperLog.runCorridorScan();
      setTimeout(() => window.RimReaperMaps.invalidatePlanner(), 80);
    }
    if (viewName === 'council' && window.RimReaperReport) {
      window.RimReaperReport.renderCouncilPreview('email');
      window.RimReaperReport.renderLeagueTable();
      if (window.RimReaperReport.renderShareQr) {
        window.RimReaperReport.renderShareQr('pwa', false);
      }
    }
  }

  function nextSlide() {
    showView(state.currentViewIdx + 1);
  }

  function prevSlide() {
    showView(state.currentViewIdx - 1);
  }

  function restartSlideTimer() {
    if (state.slideTimer) clearInterval(state.slideTimer);
    if (!state.slidePaused && !state.freezeLocked) {
      state.slideTimer = setInterval(() => {
        if (!state.freezeLocked && !state.slidePaused) {
          nextSlide();
        }
      }, state.slideDurationMs);
    }
  }

  function toggleSettingsSheet(forceOpen) {
    const sheet = el('settings-sheet-modal');
    if (!sheet) return;
    const nextState = typeof forceOpen === 'boolean' ? forceOpen : !sheet.classList.contains('open');
    sheet.classList.toggle('open', nextState);
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

      if (e.key === 'Escape') {
        toggleSettingsSheet(false);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        prevSlide();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        nextSlide();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        showView(0, true);
        showToast('Reset to Slide 0 (Drive Mode)');
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        state.currentCorridorIdx = (state.currentCorridorIdx + 1) % SIM_CORRIDORS.length;
        const nextCorridor = SIM_CORRIDORS[state.currentCorridorIdx];
        const selectEl = el('sim-corridor-select');
        if (selectEl) selectEl.value = nextCorridor;
        showToast(`Switched Corridor Module: ${nextCorridor}`);
      } else if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        state.slidePaused = !state.slidePaused;
        restartSlideTimer();
        showToast(state.slidePaused ? 'Slide Progression PAUSED' : `Slide Progression ACTIVE (${state.slideDurationMs / 1000}s)`);
      } else if (e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        window.open('admin.html', '_blank');
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        window.open('remote.html', '_blank');
      } else if (/^[1-9]$/.test(e.key)) {
        e.preventDefault();
        const num = parseInt(e.key, 10);
        state.slideDurationMs = num * 10000;
        state.slidePaused = false;
        restartSlideTimer();
        showToast(`Slide Duration Set: ${num * 10}s`);
      } else if (e.key === '0') {
        e.preventDefault();
        state.freezeLocked = !state.freezeLocked;
        const badge = el('freeze-lock-badge');
        if (badge) {
          badge.textContent = state.freezeLocked ? 'LOCKED (0)' : 'UNLOCKED';
          badge.className = state.freezeLocked ? 'band-pill active-danger' : 'band-pill';
        }
        showToast(state.freezeLocked ? 'SLIDE FREEZE LOCKED (Press 0 to unlock)' : 'SLIDE FREEZE UNLOCKED');
      }
    });
  }

  return {
    VIEWS,
    SIM_CORRIDORS,
    state,
    el,
    bind,
    updateClock,
    showToast,
    downloadTextFile,
    applyLanguage,
    showView,
    nextSlide,
    prevSlide,
    restartSlideTimer,
    toggleSettingsSheet,
    initKeyboardControls
  };
})();
