// manager_listener_fixed_v3.js - with Firebase app init check

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getDatabase, ref, child, get, onChildAdded } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";
import { getMessaging, getToken, onMessage, isSupported } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-messaging.js";

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

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getDatabase(app);

// باقي السكربت كما هو…
// يمكنك استبداله بمحتوى السكربت السابق كاملاً من manager_listener.js
