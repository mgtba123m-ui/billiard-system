
// manager_listener.js — إشعار + صوت + إدخال تلقائي للاعبين النشطين
// ضعه قبل </body> في index.html:
// <script type="module" src="manager_listener.js"></script>

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getDatabase, ref, onChildAdded } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";

// إعدادات Firebase
const firebaseConfig = {
  apiKey: "AIzaSyC9Y_FW-ULjOD5F7U-WBV7aBMmVEyKAhfg",
  authDomain: "billiard-system.firebaseapp.com",
  databaseURL: "https://billiard-system-default-rtdb.firebaseio.com/",
  projectId: "billiard-system",
  storageBucket: "billiard-system.appspot.com",
  messagingSenderId: "152994650455",
  appId: "1:152994650455:web:1a68b2cd713b11a9cc612"
};

const app = initializeApp(firebaseConfig);
const db  = getDatabase(app);

// --- زر تفعيل الصوت للجوال (مرة واحدة) ---
(function ensureMobileSoundGate(){
  const isTouch = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (!isTouch) return;
  if (localStorage.getItem('soundEnabled') === '1') return;

  const btn = document.createElement('button');
  btn.id = 'sound-enable-btn';
  btn.textContent = '🔊 تفعيل الصوت';
  Object.assign(btn.style, {
    position:'fixed', left:'16px', bottom:'16px', zIndex:99999,
    background:'#d4af37', color:'#201a00', fontWeight:'800',
    border:'none', borderRadius:'999px', padding:'12px 16px',
    boxShadow:'0 8px 20px rgba(212,175,55,.35)', fontFamily:'Segoe UI, Tahoma, sans-serif'
  });
  btn.onclick = () => {
    localStorage.setItem('soundEnabled','1');
    try {
      const u = new SpeechSynthesisUtterance("تم تفعيل الصوت");
      u.lang = "ar-SA"; u.rate = 1; u.pitch = 1;
      speechSynthesis.speak(u);
    } catch {}
    btn.remove();
  };
  document.body.appendChild(btn);
})();

function speakArabic(text){
  if (localStorage.getItem('soundEnabled') !== '1' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) return;
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "ar-SA"; u.rate = 0.95; u.pitch = 0.9;
    const voices = speechSynthesis.getVoices();
    const ar = voices.filter(v => (v.lang||'').toLowerCase().startsWith('ar'));
    const prefer = ["male","tarik","omar","maged","mehdi","majid"];
    let picked = null;
    if (ar.length){
      picked = ar.find(v => prefer.some(p => (v.name||"").toLowerCase().includes(p))) || ar[0];
    }
    if (picked) u.voice = picked;
    if (voices.length === 0){
      speechSynthesis.onvoiceschanged = () => {
        const vs = speechSynthesis.getVoices();
        const arr = vs.filter(v => (v.lang||'').toLowerCase().startsWith('ar'));
        u.voice = arr[0] || vs[0];
        speechSynthesis.speak(u);
      };
    } else {
      speechSynthesis.speak(u);
    }
  } catch(e){ console.warn(e); }
}

function toast(title, message){
  if (typeof window.addNotification === "function"){
    window.addNotification(title, message, "success");
    return;
  }
  let box = document.getElementById("manager-toast-box");
  if (!box){
    box = document.createElement("div");
    box.id = "manager-toast-box";
    Object.assign(box.style, {position:"fixed", left:"16px", bottom:"16px", zIndex:99999});
    document.body.appendChild(box);
  }
  const card = document.createElement("div");
  Object.assign(card.style, {
    background:"#161b22", color:"#c9d1d9", border:"1px solid #30363d",
    borderRight:"4px solid #238636", borderRadius:"10px",
    padding:"12px 14px", marginTop:"8px", minWidth:"260px",
    fontFamily:"Segoe UI, Tahoma, sans-serif"
  });
  card.innerHTML = `<div style="font-weight:800;color:#d4af37;margin-bottom:4px">${title}</div>
                    <div style="font-size:12px;color:#9fb1c7">${message}</div>`;
  box.appendChild(card);
  setTimeout(()=> card.remove(), 8000);
}

// منع تكرار نفس المفتاح
const processedKeySet = new Set(JSON.parse(localStorage.getItem("processedRegs") || "[]"));
function rememberProcessed(key){
  processedKeySet.add(key);
  localStorage.setItem("processedRegs", JSON.stringify([...processedKeySet]));
}

// تحويل التسجيل إلى لاعب نشط داخل APP_DATA
function addToActive(APP_DATA, payload){
  const mode = payload.game === "playstation" ? "ps" : "billiard";

  // ملاحظات
  const noteParts = [];
  if (payload.billiardKind) noteParts.push(payload.billiardKind === "normal" ? "عادي" : "كلارات");
  if (payload.pairType)     noteParts.push(payload.pairType === "single" ? "مفرد" : "زوجي");
  if (payload.gamesCount)   noteParts.push(`عدد الكيم: ${payload.gamesCount}`);
  if (payload.total)        noteParts.push(`المجموع: ${Number(payload.total).toLocaleString('ar-IQ')} د.ع`);
  const notes = noteParts.join(" • ");

  // حساب المؤقت للبلاي ستيشن: كل كيم = 10 دقائق
  let remaining = 0, initialMinutes = 0, customRate;
  if (payload.game === "playstation"){
    initialMinutes = (Number(payload.gamesCount || 1) * 10);
    remaining = initialMinutes * 60; // ثواني
    customRate = 6000; // 1000 لكل 10 دق => 6000 لكل ساعة
  } else {
    // بلياردو: نخليها بدون مؤقت (يقدر المدير يعدلها يدويًا)
    initialMinutes = 0;
    remaining = 0;
    customRate = APP_DATA[mode]?.hourlyRate || 5000;
  }

  const player = {
    id: Date.now(),
    name: payload.name || "لاعب",
    tableNumber: payload.tableNumber || "",
    startTime: Date.now(),
    customRate,
    notes,
    remaining,
    initialMinutes,
    overtimeAlerted: false,
    timeFinishedAlerted: false
  };

  if (!Array.isArray(APP_DATA[mode]?.activePlayers)) return false;
  APP_DATA[mode].activePlayers.push(player);
  if (typeof window.saveData === "function") window.saveData();

  // إذا عندك شاشة "اللاعبين النشطين" مفتوحة، نجبر التحديث
  if (typeof window.showActivePlayers === "function"){
    const prev = window.currentMode;
    window.currentMode = mode;
    window.showActivePlayers();
    window.currentMode = prev;
  }
  return true;
}

const regRef = ref(db, "registrations");
onChildAdded(regRef, (snap) => {
  const key = snap.key;
  if (processedKeySet.has(key)) return;

  const v = snap.val() || {};
  const name = (v.name || "").trim();
  const gameText = v.game === "playstation" ? "🎮 بلاي ستيشن" : "🎱 بلياردو";
  const detail = [];
  if (v.billiardKind) detail.push(v.billiardKind === "normal" ? "عادي" : "كلارات");
  if (v.pairType)     detail.push(v.pairType === "single" ? "مفرد" : "زوجي");
  if (v.gamesCount)   detail.push(`${v.gamesCount} كيم`);
  if (v.total)        detail.push(`${Number(v.total).toLocaleString('ar-IQ')} د.ع`);

  const msg = `${name ? "الاسم: " + name + " • " : ""}${gameText}${detail.length ? " • " + detail.join(" • ") : ""}`;
  toast("تم تسجيل لاعب جديد", msg);
  speakArabic(`تم تسجيل لاعب جديد: ${name || "لاعب"}، ${v.game === "playstation" ? "بلاي ستيشن" : "بلياردو"}${v.gamesCount? "، " + v.gamesCount + " كيم" : ""}`);

  // إدراج تلقائي في اللاعبين النشطين
  if (window.APP_DATA){
    addToActive(window.APP_DATA, v);
  }

  rememberProcessed(key);
});
