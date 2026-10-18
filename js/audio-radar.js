/**
 * Rim-Reaper-NZ — Web Audio API Radar Detector Synthesizer, Haptics & Hands-Free Voice/Media Triggers
 * Zero external audio files required.
 */

window.AudioRadar = (function () {
  let ctx = null;
  let muted = false;
  let hapticOnly = false;
  let language = 'en'; // 'en' | 'mi'
  let lastBeepTime = 0;
  let voiceRecognizer = null;
  let voiceActive = false;

  function ensureContext() {
    if (!ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        ctx = new AudioCtx();
      }
    }
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    return ctx;
  }

  function playTone(freq, durationMs, type = 'sawtooth', gainVal = 0.22, startOffsetSec = 0) {
    if (muted || hapticOnly) {
      if (hapticOnly && navigator.vibrate) {
        navigator.vibrate(Math.min(200, durationMs));
      }
      return;
    }
    const audio = ensureContext();
    if (!audio) return;

    const now = audio.currentTime + startOffsetSec;
    const osc = audio.createOscillator();
    const gain = audio.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(gainVal, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + durationMs / 1000);

    osc.connect(gain);
    gain.connect(audio.destination);

    osc.start(now);
    osc.stop(now + durationMs / 1000 + 0.02);
  }

  /**
   * Hardware-Style Pothole Scanner Power-On Self-Test Boot Sequence
   * Sweeps Pothole Hazard Channels: CRATER, BUMP, RUT, SLIP, BRIDGE, WET, GPS, NZTA
   */
  function playBootSequence(onBandActive) {
    ensureContext();
    const steps = [
      { band: 'CRATER', label: 'CHECKING RIM-BENDER CRATER SENSOR...', delayMs: 0, freq: 880, dur: 140, type: 'sawtooth' },
      { band: 'BUMP', label: 'CALIBRATING Z-AXIS SUSPENSION G-FORCE...', delayMs: 170, freq: 1180, dur: 140, type: 'sawtooth' },
      { band: 'RUT', label: 'LOADING WHEEL-TRACK RUT FILTER...', delayMs: 340, freq: 1480, dur: 140, type: 'sawtooth' },
      { band: 'SLIP', label: 'SCANNING WASHOUT & SLIP CORRIDORS...', delayMs: 510, freq: 1860, dur: 150, type: 'square' },
      { band: 'BRIDGE', label: 'VERIFYING ONE-LANE & BRIDGE DECK DB...', delayMs: 690, freq: 2350, dur: 130, type: 'square' },
      { band: 'WET', label: 'ARMING WATER-FILLED CRATER ALERTS...', delayMs: 850, freq: 2950, dur: 120, type: 'square' },
      { band: 'GPS', label: 'LOCKING NZ KEEP-LEFT LANE VECTOR (±45°)...', delayMs: 1010, freq: 1980, dur: 150, type: 'triangle' },
      { band: 'NZTA', label: '67 NZ COUNCILS + WAKA KOTAHI RAMM READY...', delayMs: 1190, freq: 2640, dur: 240, type: 'sine' }
    ];

    steps.forEach((step) => {
      setTimeout(() => {
        playTone(step.freq, step.dur, step.type, 0.25, 0);
        if (typeof onBandActive === 'function') {
          onBandActive(step.band, step.label);
        }
      }, step.delayMs);
    });

    setTimeout(() => {
      playTone(3120, 90, 'sine', 0.22, 0);
      playTone(3520, 160, 'sine', 0.24, 0.11);
      if (typeof onBandActive === 'function') {
        onBandActive('READY', 'POTHOLE SCANNER ONLINE — NZ LEFT-HAND LANE ARMED');
      }
      speakAnnouncement(
        language === 'mi'
          ? 'Kua rite te pūnaha Rim Reaper. Kei te matawai i ngā kōhao rori o Aotearoa.'
          : 'Rim Reaper New Zealand Online. Left-Hand Lane Pothole Scanner Active.'
      );
    }, 1520);
  }

  function speakAnnouncement(text) {
    if (muted || hapticOnly) return;
    if ('speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(text);
        utter.lang = language === 'mi' ? 'mi-NZ' : 'en-NZ';
        utter.rate = 1.04;
        utter.pitch = 0.96;
        window.speechSynthesis.speak(utter);
      } catch (e) {
        // Fallback chime if speechSynthesis fails
      }
    }
  }

  /**
   * Geiger-Counter Proximity Alert Loop
   * - Auto-mutes below 15 km/h unless override is enabled
   * - Scales lead distance up to 800m at 100-110 km/h
   * - Supports Swiss-Cheese Cluster degraded road alerts
   */
  function evaluateProximityAlert(distanceM, speedKmh, isCluster = false, forceSim = false) {
    if (!forceSim && speedKmh < 15) {
      return { level: 0, zoneName: 'AUTO-MUTED (<15 KM/H)' };
    }

    const scaleFactor = speedKmh >= 95 ? 1.5 : speedKmh >= 70 ? 1.2 : 1.0;
    const detectLimit = 500 * scaleFactor;
    const approachLimit = 300 * scaleFactor;
    const impactLimit = 110 * scaleFactor;

    if (distanceM > detectLimit) {
      return { level: 0, zoneName: 'CLEAR SCANNING' };
    }

    const now = performance.now();
    let intervalMs = 1400;
    let freq = 2400;
    let level = 1;
    let zoneName = 'DETECTION ZONE';

    if (distanceM <= impactLimit) {
      level = 5;
      intervalMs = 115; // 9-10 beeps/sec continuous radar brap
      freq = isCluster ? 3200 : 2950;
      zoneName = isCluster ? 'SWISS CHEESE CORRIDOR AHEAD' : 'IMPACT ZONE — KEEP CLEAR';
    } else if (distanceM <= approachLimit) {
      const ratio = (distanceM - impactLimit) / Math.max(1, approachLimit - impactLimit);
      level = ratio < 0.4 ? 4 : ratio < 0.75 ? 3 : 2;
      intervalMs = 200 + ratio * 450; // 2 to 5 beeps/sec
      freq = 2650;
      zoneName = isCluster ? 'CLUSTER APPROACH' : 'APPROACH ZONE';
    }

    if (now - lastBeepTime >= intervalMs) {
      lastBeepTime = now;
      playTone(freq, level === 5 ? 75 : 95, level === 5 ? 'square' : 'sawtooth', 0.25);
      if (navigator.vibrate) {
        navigator.vibrate(level === 5 ? [70, 40, 70] : 50);
      }
    }

    return { level, zoneName };
  }

  function playLogConfirmationTone(severity = 'Rim Bender') {
    if (severity === 'Rim Bender') {
      playTone(1900, 90, 'square', 0.28, 0);
      playTone(2850, 140, 'sawtooth', 0.28, 0.11);
    } else {
      playTone(1650, 120, 'sine', 0.24, 0);
    }
    if (navigator.vibrate) navigator.vibrate([90, 40, 90]);
  }

  /**
   * Steering-Wheel Media Button & Offline Voice Trigger Setup
   */
  function initHandsFreeTriggers(callbacks) {
    if ('mediaSession' in navigator) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: 'Rim-Reaper-NZ Pothole Radar',
          artist: 'Left-Lane Hazard Scanner',
          album: 'Waka Kotahi & 67 Councils'
        });
        navigator.mediaSession.setActionHandler('nexttrack', () => {
          if (callbacks && callbacks.onQuickLog) callbacks.onQuickLog('Rim Bender', 'Bluetooth Media Button');
        });
        navigator.mediaSession.setActionHandler('previoustrack', () => {
          if (callbacks && callbacks.onQuickLog) callbacks.onQuickLog('Bump', 'Bluetooth Media Button');
        });
      } catch (e) {
        // Ignore if unsupported
      }
    }

    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRec) {
      voiceRecognizer = new SpeechRec();
      voiceRecognizer.continuous = true;
      voiceRecognizer.interimResults = false;
      voiceRecognizer.lang = 'en-NZ';
      voiceRecognizer.onresult = (event) => {
        const last = event.results[event.results.length - 1];
        if (!last || !last[0]) return;
        const transcript = last[0].transcript.toLowerCase().trim();
        if (transcript.includes('big pothole') || transcript.includes('rim bender')) {
          if (callbacks.onQuickLog) callbacks.onQuickLog('Rim Bender', `Voice ("${transcript}")`);
        } else if (transcript.includes('pothole') || transcript.includes('bump')) {
          if (callbacks.onQuickLog) callbacks.onQuickLog('Bump', `Voice ("${transcript}")`);
        } else if (transcript.includes('slip') || transcript.includes('washout')) {
          if (callbacks.onQuickLog) callbacks.onQuickLog('Rim Bender', `Voice Slip ("${transcript}")`, 'Slip / Washout / Dropout');
        } else if (transcript.includes('fixed') || transcript.includes('repaired')) {
          if (callbacks.onPassByVerify) callbacks.onPassByVerify('Fixed');
        }
      };
      voiceRecognizer.onerror = () => {
        voiceActive = false;
      };
    }
  }

  function toggleVoiceTrigger() {
    if (!voiceRecognizer) return false;
    if (voiceActive) {
      try {
        voiceRecognizer.stop();
      } catch (e) {}
      voiceActive = false;
    } else {
      try {
        voiceRecognizer.start();
        voiceActive = true;
      } catch (e) {
        voiceActive = false;
      }
    }
    return voiceActive;
  }

  function setMuted(val) {
    muted = Boolean(val);
    return muted;
  }

  function setHapticOnly(val) {
    hapticOnly = Boolean(val);
    return hapticOnly;
  }

  function setLanguage(lang) {
    language = lang === 'mi' ? 'mi' : 'en';
    return language;
  }

  return {
    playBootSequence,
    evaluateProximityAlert,
    playLogConfirmationTone,
    speakAnnouncement,
    initHandsFreeTriggers,
    toggleVoiceTrigger,
    setMuted,
    setHapticOnly,
    setLanguage,
    isMuted: () => muted,
    isHapticOnly: () => hapticOnly,
    isVoiceActive: () => voiceActive
  };
})();
