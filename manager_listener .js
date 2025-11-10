// manager_listener.js - Realtime manager listener with toast + strong beep + Iraqi TTS
// Firebase v11 modules

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getDatabase, ref, child, get, onChildAdded } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";
import { getMessaging, getToken, onMessage, isSupported } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-messaging.js";

// === YOUR FIREBASE CONFIG ===
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

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// =============== Utilities ===============
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

let _audioCtx = null;
function playStrongBeep() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    _audioCtx = _audioCtx || new AudioCtx();
    const now = _audioCtx.currentTime;
    function tone(freq, start, dur, gainVal=0.25) {
      const osc = _audioCtx.createOscillator();
      const gain = _audioCtx.createGain();
      osc.type = "square";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, now + start);
      gain.gain.linearRampToValueAtTime(gainVal, now + start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);
      osc.connect(gain).connect(_audioCtx.destination);
      osc.start(now + start);
      osc.stop(now + start + dur + 0.05);
    }
    tone(880, 0.00, 0.18, 0.35);
    tone(660, 0.20, 0.22, 0.30);
  } catch (e) {}
}

function speakIraqi(text) {
  if (!("speechSynthesis" in window)) return;
  const synth = window.speechSynthesis;
  const utt = new SpeechSynthesisUtterance(text);
  const voices = synth.getVoices();
  const preferred = voices.find(v => /ar/i.test(v.lang) && /IQ|SA|AE|EG|JO|KW|QA|BH|MA|DZ|TN|PS|YE/.test(v.lang)) || voices.find(v => /ar/i.test(v.lang));
  if (preferred) utt.voice = preferred;
  utt.lang = preferred?.lang || "ar-IQ";
  utt.rate = 0.95;
  utt.pitch = 1.0;
  try { synth.cancel(); } catch {}
  synth.speak(utt);
}

const LS_KEY = "manager_listener_processed_keys_v1";
const processedKeySet = new Set(JSON.parse(localStorage.getItem(LS_KEY) || "[]"));
function rememberProcessed(key) {
  if (!key || processedKeySet.has(key)) return;
  processedKeySet.add(key);
  if (processedKeySet.size > 500) {
    const arr = Array.from(processedKeySet).slice(-500);
    localStorage.setItem(LS_KEY, JSON.stringify(arr));
  } else {
    localStorage.setItem(LS_KEY, JSON.stringify(Array.from(processedKeySet)));
  }
}

function shortMsg(name, tableKey) {
  const displayName = (name || "").toString().trim();
  const tableLabel = (tableKey || "").toString().toUpperCase();
  return displayName ? `لاعب جديد ${displayName} بطاولة ${tableLabel}` : `لاعب جديد بطاولة ${tableLabel}`;
}

// =============== Core Listening Logic ===============
const baseRef = ref(db, "tables");

async function attachPerTable(tableKey) {
  try {
    const tableRef = child(baseRef, tableKey);
    const snap = await get(tableRef);
    if (snap.exists()) snap.forEach(ch => rememberProcessed(ch.key));
    onChildAdded(tableRef, (chSnap) => {
      const key = chSnap.key;
      if (processedKeySet.has(key)) return;
      rememberProcessed(key);
      const v = chSnap.val() || {};
      const name = v.playerName || v.name || v.player || v.fullName || "";
      const tableLabel = v.tableId || tableKey;
      const msg = shortMsg(name, tableLabel);
      showToast("تسجيل لاعب جديد", msg);
      playStrongBeep();
      speakIraqi(msg);
    });
    console.log(`[Manager] Listening on table: ${tableKey}`);
  } catch (e) {
    console.warn(`[Manager] Failed to attach listener for ${tableKey}:`, e);
  }
}

const knownTables = ["b1", "billiard1", "billiard2", "ps1", "ps2", "ps3"];
knownTables.forEach(attachPerTable);

onChildAdded(baseRef, (topSnap) => {
  const key = topSnap.key;
  if (!key) return;
  if (!knownTables.includes(key)) attachPerTable(key);
});

(async () => {
  try {
    if (await isSupported()) {
      const messaging = getMessaging(app);
      if (typeof Notification !== "undefined" && Notification.permission === "default") {
        try { await Notification.requestPermission(); } catch {}
      }
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

console.log("[Manager] Realtime listener initialized (tables path mode). ✅");
