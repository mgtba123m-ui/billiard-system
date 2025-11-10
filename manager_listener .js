// 4) تهيئة اتصال Firebase (إعدادات المشروع)
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getDatabase, ref, onChildAdded } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyC9Y_FW-ULj0D5F7U-WBV7aBMNvEyKAhfg",
    authDomain: "billiard-system.firebaseapp.com",
    databaseURL: "https://billiard-system-default-rtdb.firebaseio.com/",
    projectId: "billiard-system",
    storageBucket: "billiard-system.appspot.com",
    messagingSenderId: "152994650455",
    appId: "1:152994650455:web:1a68b2cd713b11a9cc612"
};
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// 5) منع التكرار: تخزين مفاتيح التسجيلات التي تمت معالجتها محليًا
const PROCESSED_KEY = 'firebase_processed_registration_ids';
function getProcessed() {
    try {
        return JSON.parse(localStorage.getItem(PROCESSED_KEY) || '[]');
    } catch {
        return [];
    }
}
function addProcessed(id) {
    const arr = getProcessed();
    if (!arr.includes(id)) {
        arr.push(id);
        // الاحتفاظ بآخر 500 معرّف فقط لتجنب التضخم
        localStorage.setItem(PROCESSED_KEY, JSON.stringify(arr.slice(-500)));
    }
}

// دوال مساعدة (يفترض وجود APP_DATA وواجهات إشعار أخرى في النظام)
function showRedToast(text) {
    const t = document.createElement('div');
    t.className = 'toast-red';
    t.textContent = text || 'تم تسجيل لاعب جديد';
    document.body.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => {
        t.classList.remove('show');
        setTimeout(() => t.remove(), 250);
    }, 5000);
}
function speakArabic(text) {
    try {
        const u = new SpeechSynthesisUtterance(text || 'تم تسجيل لاعب جديد في النظام');
        const voices = speechSynthesis.getVoices();
        const preferred = voices.find(v =>
            (/^ar/i.test(v.lang)) && /male|man|m|عثمان|سامي|Hassan|عرب/.test(v.name || '')
        ) || voices.find(v => /^ar/i.test(v.lang));
        if (preferred) u.voice = preferred;
        u.lang = (preferred && preferred.lang) || 'ar';
        u.rate = 1.0; u.pitch = 1.0; u.volume = 1.0;
        speechSynthesis.cancel();
        speechSynthesis.speak(u);
    } catch (e) { /* لا شيء */ }
}

// 7) معالجة بيانات التسجيل الواردة من Firebase وإضافتها للنظام
function addIncomingPlayerToSystem(payload, snapKey) {
    try {
        // تحديد القسم (بلياردو أو بلايستيشن) اعتمادًا على نوع اللعبة
        const gameType = (payload.gameType || payload.game || '').toString().toLowerCase();
        const sectionMode = (gameType.includes('ps') || gameType.includes('play')) ? 'ps' : 'billiard';

        // قراءة الحقول الأساسية من البيانات القادمة
        const name = payload.playerName || payload.name || 'لاعب';
        const table = payload.tableId || payload.table || payload.device || payload.tableNumber || '1';
        const count = Number(payload.count || payload.sets || payload.games || 1);

        // حساب مدة الجلسة بالدقائق (كل جيم 10 دقائق افتراضيًا إن لم يرسل)
        const minutes = Number(payload.minutes || payload.duration || (count * 10));
        // تحديد السعر (إذا أُرسل معدل خاص وإلا استخدام السعر الافتراضي المخزّن أو 5000/7000 حسب القسم)
        const rate = Number(payload.rate || (APP_DATA?.[sectionMode]?.hourlyRate || (sectionMode === 'ps' ? 7000 : 5000)));

        // إنشاء كائن اللاعب النشط لإضافته إلى النظام المحلي
        const player = {
            id: Date.now(),
            name: name,
            tableNumber: table,
            startTime: Date.now(),
            customRate: rate,
            notes: (payload.notes || '').toString(),
            remaining: Math.max(0, minutes) * 60,      // بالثواني
            initialMinutes: Math.max(1, minutes),
            overtimeAlerted: false,
            timeFinishedAlerted: false
        };

        // ضمان وجود مصفوفة اللاعبين النشطين للقسم المستهدف
        APP_DATA[sectionMode] = APP_DATA[sectionMode] || { activePlayers: [], completedSessions: [], hourlyRate: rate };
        APP_DATA[sectionMode].activePlayers = APP_DATA[sectionMode].activePlayers || [];

        // إضافة اللاعب إلى قائمة النشطين
        APP_DATA[sectionMode].activePlayers.push(player);

        // حفظ البيانات محليًا وإظهار الإشعارات (داخلي Toast + صوت)
        if (typeof saveData === 'function') saveData();
        const deviceLabel = (sectionMode === 'ps') ? 'الجهاز' : 'الطاولة';
        if (typeof addNotification === 'function') {
            addNotification('تسجيل تلقائي', `تم تسجيل ${name} على ${deviceLabel} ${table} (${minutes} دقيقة)`, 'success');
        }
        showRedToast('تم تسجيل لاعب جديد');
        speakArabic(`تم تسجيل لاعب جديد في النظام على ${deviceLabel} ${table}`);

        // تحديث واجهة قائمة اللاعبين النشطين إذا كانت مفتوحة على نفس القسم
        if (typeof currentMode !== 'undefined' && typeof showActivePlayers === 'function') {
            if (currentMode === sectionMode) {
                showActivePlayers();
            }
        }
    } catch (e) {
        console.error('Firebase → فشل إضافة لاعب للنظام:', e);
    }
}

// 8) الاستماع للتسجيلات الجديدة تحت جميع الطاولات
const registrationsRef = ref(db, 'registrations');
// عند إضافة عقدة طاولة جديدة تحت "registrations"
onChildAdded(registrationsRef, (tableSnap) => {
    const tableId = tableSnap.key;
    if (!tableId) return;
    // إرفاق مستمع للإضافات الجديدة تحت هذه الطاولة
    const tableRegRef = ref(db, `registrations/${tableId}`);
    // تعليم المفاتيح الموجودة (التسجيلات الحالية) كمُعالَجة لتفادي الإشعارات المتأخرة
    const existingEntries = tableSnap.val() || {};
    Object.keys(existingEntries).forEach(entryId => addProcessed(entryId));
    // مستمع على أي تسجيل *جديد* يضاف تحت الطاولة المحددة
    onChildAdded(tableRegRef, (entrySnap) => {
        const entryKey = entrySnap.key;
        const entryData = entrySnap.val() || {};
        if (!entryKey) return;
        // منع التكرار: تجاهل إذا كان هذا المفتاح تمت معالجته سابقًا
        if (getProcessed().includes(entryKey)) return;
        addProcessed(entryKey);
        // إضافة معرف الطاولة للبيانات إذا لم يكن موجودًا لضمان اكتمال المعلومات
        entryData.tableId = entryData.tableId || tableId;
        // إرسال البيانات لمعالجتها وإظهار الإشعار
        addIncomingPlayerToSystem(entryData, entryKey);
    }, (err) => {
        console.error(`Firebase listener error (table ${tableId}):`, err);
    });
}, (error) => {
    console.error('Firebase onChildAdded error (registrations root):', error);
});
