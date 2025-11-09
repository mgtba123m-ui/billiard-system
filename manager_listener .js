// manager_listener.js - Realtime manager listener with toast + strong beep + Iraqi TTS
// Firebase v11 modules

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getDatabase, ref, child, get, onChildAdded } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";
import { getMessaging, getToken, onMessage, isSupported } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-messaging.js";

// === YOUR FIREBASE CONFIG (provided by you) ===
const firebaseConfig = {
  apiKey: "AIzaSyC9Y_FW-ULjOD5F7U-WBV7aBMMvEyKAhfg",
  authDomain: "billiard-system.firebaseapp.com",
  databaseURL: "https://billiard-system-default-rtdb.firebaseio.com",
  projectId: "billiard-system",
  storageBucket: "billiard-system.firebasestorage.app",
  messagingSenderId: "152994650455",
  appId: "1:152994650455:web:1a680b2cd713b11a9cc612",
  measurementId: "G-MH7K2ZJWNR"
};

// Optional: put your VAPID public key here if you want mobile/web push notifications
// Find it in Firebase Console -> Project settings -> Cloud Messaging -> Web configuration
const VAPID_PUBLIC_KEY = ""; // e.g. "BPAB9F50MXS...."  (leave empty if not set yet)

// === Init Firebase ===
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// === Utilities ===

// Toast (visual) notification
function showToast(title, body) {
  const wrap = document.createElement("div");
  wrap.style.cssText = "position:fixed;right:16px;bottom:16px;z-index:999999;";
  const card = document.createElement("div");
  card.style.cssText = "background:#111;color:#fff;min-width:260px;max-width:360px;padding:12px 14px;border-radius:12px;box-shadow:0 8px 30px rgba(0,0,0,0.45);font-family:system-ui,Segoe UI,Roboto,Arial;direction:rtl;text-align:right";
  const h = document.createElement("div");
  h.style.cssText = "font-weight:700;margin-bottom:6px";
  h.textContent = title;
  const p = document.createElement("div");
  p.style.cssText = "opacity:0.9;font-size:13px;line-height:1.4";
  p.textContent = body;
  card.appendChild(h); card.appendChild(p); wrap.appendChild(card);
  document.body.appendChild(wrap);
  setTimeout(()=>wrap.remove(), 6000);
}

// Strong beep using WebAudio (no external files needed)
let _audioCtx = null;
function playStrongBeep() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    _audioCtx = _audioCtx || new AudioCtx();
    const now = _audioCtx.currentTime;

    function tone(freq, start, dur, gainVal=0.25) {
      const osc = _audioCtx.createOscillator();
      const gain = _audioCtx.createGain();
      osc.type = "square"; // strong
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, now + start);
      gain.gain.linearRampToValueAtTime(gainVal, now + start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);
      osc.connect(gain).connect(_audioCtx.destination);
      osc.start(now + start);
      osc.stop(now + start + dur + 0.05);
    }

    // Two-step alert (strong)
    tone(880, 0.00, 0.18, 0.35);
    tone(660, 0.20, 0.22, 0.30);
  } catch (e) {
    // ignore
  }
}

// Iraqi Arabic short TTS
function speakIraqi(text) {
  if (!("speechSynthesis" in window)) return;
  const synth = window.speechSynthesis;
  const utt = new SpeechSynthesisUtterance(text);
  // try Iraqi / Arabic voices
  const voices = synth.getVoices();
  const preferred = voices.find(v => /ar/i.test(v.lang) && /IQ|SA|AE|EG|JO|KW|QA|BH|MA|DZ|TN|PS|YE/.test(v.lang)) || voices.find(v => /ar/i.test(v.lang));
  if (preferred) utt.voice = preferred;
  utt.lang = preferred?.lang || "ar-IQ";
  utt.rate = 0.95;
  utt.pitch = 1.0;
  // stop previous speech to avoid overlap
  try { synth.cancel(); } catch {}
  synth.speak(utt);
}

// Processed keys cache to avoid duplicates
const LS_KEY = "manager_listener_processed_keys_v1";
const processedKeySet = new Set(JSON.parse(localStorage.getItem(LS_KEY) || "[]"));
function rememberProcessed(key) {
  if (!key) return;
  if (processedKeySet.has(key)) return;
  processedKeySet.add(key);
  // keep last 500
  if (processedKeySet.size > 500) {
    const arr = Array.from(processedKeySet).slice(-500);
    localStorage.setItem(LS_KEY, JSON.stringify(arr));
  } else {
    localStorage.setItem(LS_KEY, JSON.stringify(Array.from(processedKeySet)));
  }
}

// Create nice, short message
function shortMsg(name, tableKey) {
  const displayName = (name || "").toString().trim();
  const tableLabel = (tableKey || "").toString().toUpperCase();
  if (displayName) return `لاعب جديد ${displayName} بطاولة ${tableLabel}`;
  return `لاعب جديد بطاولة ${tableLabel}`;
}

// Add listener safely: prewarm existing children so we don't spam on first load
async function attachPerTable(tableKey) {
  try {
    const tableRef = child(ref(db), tableKey);
    // Pre-warm: mark existing children as processed so we only toast for new ones
    const snap = await get(tableRef);
    if (snap.exists()) {
      snap.forEach(ch => rememberProcessed(ch.key));
    }
    // Now listen for new children
    onChildAdded(tableRef, (chSnap) => {
      const key = chSnap.key;
      if (processedKeySet.has(key)) return; // already seen
      rememberProcessed(key);
      const v = chSnap.val() || {};
      // normalize possible field names
      const name = v.playerName || v.name || v.player || v.fullName || "";
      const tableLabel = v.tableId || tableKey;
      const msg = shortMsg(name, tableLabel);
      showToast("تسجيل لاعب جديد", msg);
      playStrongBeep();
      speakIraqi(msg);
      // If your dashboard has a function to add to active players, call it here:
      // if (window.addToActiveIfPossible) window.addToActiveIfPossible({ table: tableLabel, ...v });
    });
    console.log(`[Manager] Listening on table: ${tableKey}`);
  } catch (e) {
    console.warn(`[Manager] Failed to attach listener for ${tableKey}:`, e);
  }
}

// Known tables + also auto-attach to any top-level node
const knownTables = ["b1", "billiard1", "billiard2", "ps1", "ps2", "ps3"];
knownTables.forEach(attachPerTable);

// Also attach for any NEW top-level child added later
onChildAdded(ref(db), (topSnap) => {
  const key = topSnap.key;
  if (!key) return;
  if (!knownTables.includes(key)) {
    attachPerTable(key);
  }
});

// === Optional: Web Push (foreground) — requires firebase-messaging-sw.js at site root ===
(async () => {
  try {
    if (await isSupported()) {
      const messaging = getMessaging(app);
      // Ask permission only once per session
      if (typeof Notification !== "undefined" && Notification.permission === "default") {
        try { await Notification.requestPermission(); } catch {}
      }
      // Try to get token if VAPID key provided
      if (VAPID_PUBLIC_KEY) {
        try {
          const token = await getToken(messaging, {
            vapidKey: VAPID_PUBLIC_KEY,
            serviceWorkerRegistration: await navigator.serviceWorker.register("/firebase-messaging-sw.js")
          });
          if (token) console.log("[FCM] Web push token:", token.slice(0,16) + "...");
        } catch (e) {
          console.warn("[FCM] getToken failed:", e?.message || e);
        }
      }
      // Foreground messages
      onMessage(messaging, (payload) => {
        console.log("[FCM] foreground message:", payload);
        const title = payload?.notification?.title || "تنبيه";
        const body  = payload?.notification?.body  || "وصول إشعار جديد";
        showToast(title, body);
        playStrongBeep();
        speakIraqi(body);
      });
    } else {
      console.log("[FCM] Messaging not supported in this browser.");
    }
  } catch (e) {
    console.warn("[FCM] init failed:", e?.message || e);
  }
})();

console.log("[Manager] Realtime listener initialized. v1.0");
