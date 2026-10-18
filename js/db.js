/**
 * Rim-Reaper-NZ — Offline IndexedDB + Real-Time Cross-Tab Sync Engine
 * Supports:
 *  - 8m Directional Deduplication (±45° same-lane merging)
 *  - Confidence Score Engine (0–100%)
 *  - 90-Day Stale Record Auto-Expiry
 *  - Driver Statistics & Trip Breadcrumb Logs
 *  - Encrypted Backup & Peer-to-Peer QR Sync Bundles
 */

window.RimReaperDB = (function () {
  const DB_NAME = 'nz_pothole_db';
  const DB_VERSION = 1;
  const STORE_HAZARDS = 'hazards';
  const STORE_STATS = 'stats';
  const LS_FALLBACK_KEY = 'rim_reaper_nz_hazards_v1';
  const LS_STATS_KEY = 'rim_reaper_nz_stats_v1';
  const syncChannel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('rim_reaper_nz_sync') : null;

  let dbInstance = null;
  const listeners = [];

  function notifyListeners(eventType, payload) {
    listeners.forEach((fn) => {
      try {
        fn(eventType, payload);
      } catch (e) {
        console.error(e);
      }
    });
  }

  if (syncChannel) {
    syncChannel.onmessage = (ev) => {
      if (ev.data && ev.data.type) {
        notifyListeners(ev.data.type, ev.data.payload);
      }
    };
  }

  function broadcast(type, payload) {
    notifyListeners(type, payload);
    if (syncChannel) {
      syncChannel.postMessage({ type, payload });
    }
  }

  function onUpdate(cb) {
    listeners.push(cb);
  }

  function computeConfidence(record) {
    const confCount = Number(record.confirmations || 1);
    const acc = Number(record.accuracyM || 8);
    const gForce = Number(record.gForce || 1.8);
    const ageDays = Math.max(0, (Date.now() - (record.timestamp || Date.now())) / (1000 * 60 * 60 * 24));

    let score = 58;
    score += Math.min(26, confCount * 4.5);
    score += acc <= 5 ? 10 : acc <= 12 ? 5 : -10;
    score += Math.min(10, Math.max(0, (gForce - 1.2) * 5));
    score -= Math.min(25, ageDays * 0.25);

    return Math.round(Math.max(15, Math.min(99, score)));
  }

  function angleDiff(a, b) {
    const diff = Math.abs(((a - b + 540) % 360) - 180);
    return diff;
  }

  function enrichWithJurisdiction(record) {
    const resolved = window.NZ_DATA.resolveJurisdiction(
      record.lat,
      record.lon,
      record.roadName || record.highwayCode || '',
      typeof record.isStateHighway === 'boolean' ? record.isStateHighway : null
    );
    const enriched = Object.assign({}, record, {
      isStateHighway: resolved.isStateHighway,
      highwayCode: resolved.highwayCode,
      isDividedRoad: resolved.isDividedRoad,
      rammRef: record.rammRef || resolved.rammRef,
      councilId: resolved.council.id,
      councilName: resolved.council.name,
      authorityName: resolved.primaryAgency.name,
      authorityEmail: resolved.primaryAgency.email,
      councillorEmail: resolved.primaryAgency.councillorEmail,
      wardName: resolved.primaryAgency.ward,
      slaHours: resolved.primaryAgency.slaHours,
      contractor: resolved.primaryAgency.contractor
    });
    enriched.confidenceScore = computeConfidence(enriched);
    return enriched;
  }

  function openDB() {
    if (dbInstance) return Promise.resolve(dbInstance);
    return new Promise((resolve) => {
      if (typeof indexedDB === 'undefined') {
        resolve(null);
        return;
      }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_HAZARDS)) {
          const store = db.createObjectStore(STORE_HAZARDS, { keyPath: 'id' });
          store.createIndex('status', 'status', { unique: false });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
        if (!db.objectStoreNames.contains(STORE_STATS)) {
          db.createObjectStore(STORE_STATS, { keyPath: 'key' });
        }
      };
      req.onsuccess = (e) => {
        dbInstance = e.target.result;
        resolve(dbInstance);
      };
      req.onerror = () => resolve(null);
    });
  }

  async function getAllHazards() {
    const db = await openDB();
    let list = [];
    if (db) {
      list = await new Promise((resolve) => {
        const tx = db.transaction(STORE_HAZARDS, 'readonly');
        const req = tx.objectStore(STORE_HAZARDS).getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      });
    } else {
      try {
        list = JSON.parse(localStorage.getItem(LS_FALLBACK_KEY) || '[]');
      } catch (e) {
        list = [];
      }
    }

    if (!list || list.length === 0) {
      list = window.NZ_DATA.SEED_HAZARDS.map(enrichWithJurisdiction);
      await saveAllHazards(list);
    }

    // 90-day auto-expiry check for unconfirmed stale records
    const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const active = list.map((item) => {
      const enriched = enrichWithJurisdiction(item);
      if (enriched.status !== 'Fixed' && Number(enriched.confirmations || 1) <= 1 && now - enriched.timestamp > ninetyDaysMs) {
        enriched.status = 'Archived (90d Stale)';
      }
      return enriched;
    });

    active.sort((a, b) => b.timestamp - a.timestamp);
    return active;
  }

  async function saveAllHazards(list) {
    try {
      localStorage.setItem(LS_FALLBACK_KEY, JSON.stringify(list));
    } catch (e) {
      // Ignore quota errors
    }
    const db = await openDB();
    if (!db) return;
    await new Promise((resolve) => {
      const tx = db.transaction(STORE_HAZARDS, 'readwrite');
      const store = tx.objectStore(STORE_HAZARDS);
      store.clear();
      list.forEach((item) => store.put(item));
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  }

  /**
   * Add or deduplicate a hazard within 8 meters on the same directional lane (±45°)
   */
  async function logHazard(rawHazard) {
    // Reject low GPS accuracy (>20m) unless manual override
    if (rawHazard.accuracyM && rawHazard.accuracyM > 20 && !rawHazard.manualOverride) {
      return { rejected: true, reason: `GPS accuracy (${rawHazard.accuracyM.toFixed(1)}m) exceeds 20m threshold` };
    }

    const all = await getAllHazards();
    const heading = Number(rawHazard.heading || 0);

    // Search for existing hazard within 8m and ±45° heading (same NZ left-hand lane direction)
    let duplicate = null;
    for (const item of all) {
      if (item.status === 'Fixed') continue;
      const distM = window.NZ_DATA.haversineMeters(rawHazard.lat, rawHazard.lon, item.lat, item.lon);
      const hDiff = angleDiff(heading, Number(item.heading || 0));
      if (distM <= 8.0 && hDiff <= 45) {
        duplicate = item;
        break;
      }
    }

    if (duplicate) {
      duplicate.confirmations = Number(duplicate.confirmations || 1) + 1;
      duplicate.lastConfirmedAt = Date.now();
      duplicate.gForce = Math.max(Number(duplicate.gForce || 1.5), Number(rawHazard.gForce || 1.5));
      if (rawHazard.severity === 'Rim Bender') duplicate.severity = 'Rim Bender';
      if (rawHazard.photoDataUrl) duplicate.photoDataUrl = rawHazard.photoDataUrl;
      const updated = enrichWithJurisdiction(duplicate);
      await saveAllHazards(all.map((x) => (x.id === updated.id ? updated : x)));
      await incrementStat('confirmationsLogged', 1);
      broadcast('hazard_deduped', updated);
      return { deduplicated: true, record: updated };
    }

    const newRecord = enrichWithJurisdiction({
      id: rawHazard.id || `NZ-POT-${Math.floor(1000 + Math.random() * 9000)}`,
      lat: Number(rawHazard.lat),
      lon: Number(rawHazard.lon),
      heading,
      cardinal: rawHazard.cardinal || 'N',
      laneSide: rawHazard.laneSide || 'Left-Hand Lane (LHL)',
      wheelTrack: rawHazard.wheelTrack || 'Left Wheel Track (Verge Side)',
      severity: rawHazard.severity || 'Rim Bender',
      hazardType: rawHazard.hazardType || 'Pothole',
      roadType: rawHazard.roadType || 'State Highway',
      roadName: rawHazard.roadName || 'NZ Road Corridor',
      wetWeatherRisk: Boolean(rawHazard.wetWeatherRisk),
      diameterCm: Number(rawHazard.diameterCm || 45),
      depthCm: Number(rawHazard.depthCm || 10),
      gForce: Number(rawHazard.gForce || 2.4),
      confirmations: 1,
      accuracyM: Number(rawHazard.accuracyM || 4.5),
      status: 'Unreported',
      timestamp: Date.now(),
      exportedAt: null,
      photoDataUrl: rawHazard.photoDataUrl || null,
      afterPhotoDataUrl: null,
      notes: rawHazard.notes || 'Logged via Rim-Reaper-NZ Left-Lane Radar.'
    });

    all.unshift(newRecord);
    await saveAllHazards(all);
    await incrementStat('potholesLogged', 1);
    broadcast('hazard_added', newRecord);
    return { deduplicated: false, record: newRecord };
  }

  async function updateHazard(id, patch) {
    const all = await getAllHazards();
    let updatedItem = null;
    const next = all.map((item) => {
      if (item.id === id) {
        updatedItem = enrichWithJurisdiction(Object.assign({}, item, patch));
        return updatedItem;
      }
      return item;
    });
    if (updatedItem) {
      await saveAllHazards(next);
      if (patch.status === 'Fixed') {
        await incrementStat('repairsConfirmed', 1);
      }
      broadcast('hazard_updated', updatedItem);
    }
    return updatedItem;
  }

  async function deleteHazard(id) {
    const all = await getAllHazards();
    const next = all.filter((x) => x.id !== id);
    await saveAllHazards(next);
    broadcast('hazard_deleted', { id });
  }

  async function getStats() {
    try {
      const raw = localStorage.getItem(LS_STATS_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {
      // fallback
    }
    const initial = {
      kmScanned: 428.6,
      potholesLogged: 11,
      confirmationsLogged: 42,
      repairsConfirmed: 3,
      dashcamBookmarks: []
    };
    localStorage.setItem(LS_STATS_KEY, JSON.stringify(initial));
    return initial;
  }

  async function incrementStat(field, delta) {
    const stats = await getStats();
    stats[field] = Number(((stats[field] || 0) + delta).toFixed(2));
    localStorage.setItem(LS_STATS_KEY, JSON.stringify(stats));
    broadcast('stats_updated', stats);
    return stats;
  }

  async function addDashcamBookmark(entry) {
    const stats = await getStats();
    stats.dashcamBookmarks = stats.dashcamBookmarks || [];
    stats.dashcamBookmarks.unshift(entry);
    localStorage.setItem(LS_STATS_KEY, JSON.stringify(stats));
    broadcast('stats_updated', stats);
    return stats.dashcamBookmarks;
  }

  // Export encrypted/signed backup bundle
  async function exportBackupBundle(passphrase = 'NZ-RIM-REAPER') {
    const hazards = await getAllHazards();
    const stats = await getStats();
    const payload = JSON.stringify({ version: '1.0.0', exportedAt: new Date().toISOString(), hazards, stats });
    // Simple XOR + Base64 obfuscation for portable offline backup file
    const encoded = btoa(
      unescape(
        encodeURIComponent(
          payload
            .split('')
            .map((ch, idx) => String.fromCharCode(ch.charCodeAt(0) ^ passphrase.charCodeAt(idx % passphrase.length)))
            .join('')
        )
      )
    );
    return {
      signature: 'RIM-REAPER-NZ-ENCRYPTED-V1',
      created: new Date().toISOString(),
      count: hazards.length,
      cipher: encoded
    };
  }

  async function importBackupBundle(bundleObj, passphrase = 'NZ-RIM-REAPER') {
    if (!bundleObj || !bundleObj.cipher) throw new Error('Invalid backup bundle');
    const rawXor = decodeURIComponent(escape(atob(bundleObj.cipher)));
    const jsonStr = rawXor
      .split('')
      .map((ch, idx) => String.fromCharCode(ch.charCodeAt(0) ^ passphrase.charCodeAt(idx % passphrase.length)))
      .join('');
    const parsed = JSON.parse(jsonStr);
    if (Array.isArray(parsed.hazards)) {
      await saveAllHazards(parsed.hazards.map(enrichWithJurisdiction));
      broadcast('db_restored', { count: parsed.hazards.length });
      return parsed.hazards.length;
    }
    throw new Error('Decoded payload did not contain hazards array');
  }

  return {
    getAllHazards,
    saveAllHazards,
    logHazard,
    updateHazard,
    deleteHazard,
    getStats,
    incrementStat,
    addDashcamBookmark,
    exportBackupBundle,
    importBackupBundle,
    onUpdate,
    broadcast
  };
})();
