
// manager_listener.js - مستمع إشعارات الطاولات مع نطق باللهجة العراقية وصوت تنبيه

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getDatabase, ref, child, get, onChildAdded } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";
import { getMessaging, getToken, onMessage, isSupported } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-messaging.js";

const firebaseConfig = {
  apiKey: "AIzaSyC9Y_FW-ULJ0D5F7U-WBV7aBMvEyKAhfg",
  authDomain: "billiard-system.firebaseapp.com",
  databaseURL: "https://billiard-system-default-rtdb.firebaseio.com/",
  projectId: "billiard-system",
  storageBucket: "billiard-system.appspot.com",
  messagingSenderId: "152994650455",
  appId: "1:152994650455:web:1a680b2cd713b11a9cc612",
  measurementId: "G-MH7K2ZJWNR"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db = getDatabase(app);
const baseRef = ref(db, "registrations");

function shortMsg(name, tableLabel) {
  return `${name} سجل في ${tableLabel}`;
}

function playStrongBeep() {
  const audio = new Audio("https://www.soundjay.com/button/beep-07.wav");
  audio.play();
}

function speakIraqi(text) {
  const msg = new SpeechSynthesisUtterance();
  msg.text = text;
  msg.lang = "ar-IQ";
  window.speechSynthesis.speak(msg);
}

function showToast(title, body) {
  const toast = document.createElement("div");
  toast.style.cssText = "position:fixed;bottom:30px;left:30px;padding:20px;background:#222;color:#fff;border-radius:8px;z-index:9999";
  toast.textContent = `${title}: ${body}`;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 5000);
}

const rememberSet = new Set();
function rememberProcessed(key) {
  rememberSet.add(key);
}
function alreadyProcessed(key) {
  return rememberSet.has(key);
}

async function attachPerTable(tableKey) {
  const tableRef = child(baseRef, tableKey);
  onChildAdded(tableRef, (chSnap) => {
    const key = chSnap.key;
    if (alreadyProcessed(key)) return;
    rememberProcessed(key);

    const v = chSnap.val() || {};
    const name = v.playerName || v.name || v.player || v.fullName || "";
    const tableLabel = v.tableId || tableKey;
    const msg = shortMsg(name, tableLabel);
    showToast("🧾 تسجيل لاعب جديد", msg);
    playStrongBeep();
    speakIraqi(msg);
  });

  console.log(`[Manager] Listening on table: ${tableKey}`);
}

const knownTables = ["b1", "b2", "b3", "b4", "ps1", "ps2", "ps3", "ps4", "ps5", "ps6"];
knownTables.forEach(attachPerTable);

// مستمع للطاولات الجديدة التي قد تضاف لاحقًا
onChildAdded(baseRef, (topSnap) => {
  const key = topSnap.key;
  if (!key || knownTables.includes(key)) return;
  attachPerTable(key);
});
