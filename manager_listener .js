// manager_listener.js - FINAL FIXED VERSION
// ================================
// يستمع للتسجيلات ويرسلها مباشرة للنظام الأصلي بدون أي حساب داخلي
// السعر – الوقت – الكيمات كلها تصل كما جاءت من صفحة التسجيل

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getDatabase, ref, get, onChildAdded } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyC9Y_FW-ULjOD5F7U-WBV7aBMMvEyKAhfg",
  authDomain: "billiard-system.firebaseapp.com",
  databaseURL: "https://billiard-system-default-rtdb.firebaseio.com",
  projectId: "billiard-system",
  storageBucket: "billiard-system.firebasestorage.app",
  messagingSenderId: "152994650455",
  appId: "1:152994650455:web:1a680b2cd713b11a9cc612"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

function showToast(txt) {
  const d = document.createElement("div");
  d.style.cssText =
    "position:fixed;right:15px;bottom:15px;background:#222;color:#fff;padding:12px 16px;border-radius:10px;font-size:15px;z-index:9999;";
  d.textContent = txt;
  document.body.appendChild(d);
  setTimeout(() => d.remove(), 6000);
}

function beep() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioCtx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g).connect(ctx.destination);
    o.type = "square";
    o.frequency.value = 900;
    g.gain.setValueAtTime(0.3, ctx.currentTime);
    o.start(ctx.currentTime);
    o.stop(ctx.currentTime + 0.4);
  } catch (e) {}
}

async function attach(tableId) {
  const path = `registrations/${tableId}`;
  const tableRef = ref(db, path);
  try {
    const snap = await get(tableRef);
    if (snap.exists()) snap.forEach(() => {});

    onChildAdded(tableRef, (childSnap) => {
      const data = childSnap.val() || {};
      const name = data.playerName || data.name || "لاعب";
      showToast(`🎱 تسجيل جديد: ${name} على ${tableId}`);
      beep();

      if (typeof window.addPlayerToSystem === "function") {
        window.addPlayerToSystem(data, tableId);
      }
    });

    console.log("Listener Ready:", tableId);
  } catch (e) {
    console.error("Error listener:", e);
  }
}

const tables = ["b1", "b2", "b3", "b4", "b5", "b6", "ps1", "ps2", "ps3", "ps4"];
tables.forEach(attach);

console.log("Manager Listener Loaded (FINAL FIXED)");
