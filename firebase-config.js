// =====================================================================
// FIREBASE YAPILANDIRMASI
// =====================================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Projenize özel Firebase bağlantı bilgileri
const firebaseConfig = {
  apiKey: "AIzaSyDfRP7uRWDidJ_I0smhkHcXbQr34L_7lv4",
  authDomain: "superlig-tahmin.firebaseapp.com",
  projectId: "superlig-tahmin",
  storageBucket: "superlig-tahmin.firebasestorage.app",
  messagingSenderId: "69259937286",
  appId: "1:69259937286:web:489b323ab6666e4b238d67"
};

// Firebase servislerini başlat ve diğer dosyalarda kullanılmak üzere dışa aktar
export const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
