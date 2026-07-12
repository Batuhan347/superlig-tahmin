// =====================================================================
// MAÇ TAHMİN LİGİ — app.js (Haftalık Sabit Fikstür & Otomatik Logo Entegreli)
// Tüm uygulama mantığı: Auth (kullanıcı adı/şifre), Firestore realtime
// senkronizasyon, sekme yönetimi, tahmin/puanlama algoritması.
// =====================================================================

import { auth, db } from "./firebase-config.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc, getDoc, setDoc, updateDoc, deleteDoc, addDoc,
  collection, onSnapshot, query, orderBy,
  runTransaction, serverTimestamp, Timestamp, writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ---------------------------------------------------------------------
// SABİT HAFTALIK FİKSTÜR (Görsellerden Çıkarılan Gerçek Sezon Verisi)
// ---------------------------------------------------------------------
const FIXED_MATCHES_BY_WEEK = {
  "1. Hafta": [
    { id: "w1_m1", homeTeam: "Beşiktaş", awayTeam: "Eyüpspor" },
    { id: "w1_m2", homeTeam: "Galatasaray", awayTeam: "Çorum FK" },
    { id: "w1_m3", homeTeam: "Gençlerbirliği", awayTeam: "Fenerbahçe" },
    { id: "w1_m4", homeTeam: "Kasımpaşa", awayTeam: "Trabzonspor" }
  ],
  "2. Hafta": [
    { id: "w2_m1", homeTeam: "Alanyaspor", awayTeam: "Beşiktaş" },
    { id: "w2_m2", homeTeam: "Erzurumspor FK", awayTeam: "Galatasaray" },
    { id: "w2_m3", homeTeam: "Fenerbahçe", awayTeam: "Konyaspor" },
    { id: "w2_m4", homeTeam: "Trabzonspor", awayTeam: "Başakşehir" }
  ],
  "3. Hafta": [
    { id: "w3_m1", homeTeam: "Beşiktaş", awayTeam: "Çorum FK" },
    { id: "w3_m2", homeTeam: "Galatasaray", awayTeam: "Göztepe" },
    { id: "w3_m3", homeTeam: "Samsunspor", awayTeam: "Fenerbahçe" },
    { id: "w3_m4", homeTeam: "Amed SF", awayTeam: "Trabzonspor" }
  ],
  "4. Hafta": [
    { id: "w4_m1", homeTeam: "Fenerbahçe", awayTeam: "Beşiktaş" },
    { id: "w4_m2", homeTeam: "Başakşehir", awayTeam: "Galatasaray" },
    { id: "w4_m3", homeTeam: "Trabzonspor", awayTeam: "Gençlerbirliği" }
  ],
  "5. Hafta": [
    { id: "w5_m1", homeTeam: "Beşiktaş", awayTeam: "Erzurumspor FK" },
    { id: "w5_m2", homeTeam: "Galatasaray", awayTeam: "Kocaelispor" },
    { id: "w5_m3", homeTeam: "Gaziantep FK", awayTeam: "Fenerbahçe" },
    { id: "w5_m4", homeTeam: "Konyaspor", awayTeam: "Trabzonspor" }
  ],
  "6. Hafta": [
    { id: "w6_m1", homeTeam: "Amed SF", awayTeam: "Beşiktaş" },
    { id: "w6_m2", homeTeam: "Trabzonspor", awayTeam: "Galatasaray" },
    { id: "w6_m3", homeTeam: "Fenerbahçe", awayTeam: "Eyüpspor" }
  ],
  "7. Hafta": [
    { id: "w7_m1", homeTeam: "Beşiktaş", awayTeam: "Kocaelispor" },
    { id: "w7_m2", homeTeam: "Galatasaray", awayTeam: "Kasımpaşa" },
    { id: "w7_m3", homeTeam: "Rizespor", awayTeam: "Fenerbahçe" },
    { id: "w7_m4", homeTeam: "Samsunspor", awayTeam: "Trabzonspor" }
  ],
  "8. Hafta": [
    { id: "w8_m1", homeTeam: "Trabzonspor", awayTeam: "Beşiktaş" },
    { id: "w8_m2", homeTeam: "Gençlerbirliği", awayTeam: "Galatasaray" },
    { id: "w8_m3", homeTeam: "Fenerbahçe", awayTeam: "Alanyaspor" }
  ],
  "9. Hafta": [
    { id: "w9_m1", homeTeam: "Beşiktaş", awayTeam: "Başakşehir" },
    { id: "w9_m2", homeTeam: "Galatasaray", awayTeam: "Fenerbahçe" },
    { id: "w9_m3", homeTeam: "Çaykur Rizespor", awayTeam: "Trabzonspor" }
  ],
  "10. Hafta": [
    { id: "w10_m1", homeTeam: "Kasımpaşa", awayTeam: "Beşiktaş" },
    { id: "w10_m2", homeTeam: "Konyaspor", awayTeam: "Galatasaray" },
    { id: "w10_m3", homeTeam: "Fenerbahçe", awayTeam: "Göztepe" },
    { id: "w10_m4", homeTeam: "Trabzonspor", awayTeam: "Gaziantep FK" }
  ],
  "11. Hafta": [
    { id: "w11_m1", homeTeam: "Beşiktaş", awayTeam: "Gençlerbirliği" },
    { id: "w11_m2", homeTeam: "Galatasaray", awayTeam: "Amed SF" },
    { id: "w11_m3", homeTeam: "Çorum FK", awayTeam: "Fenerbahçe" },
    { id: "w11_m4", homeTeam: "Alanyaspor", awayTeam: "Trabzonspor" }
  ],
  "12. Hafta": [
    { id: "w12_m1", homeTeam: "Konyaspor", awayTeam: "Beşiktaş" },
    { id: "w12_m2", homeTeam: "Galatasaray", awayTeam: "Samsunspor" },
    { id: "w12_m3", homeTeam: "Kocaelispor", awayTeam: "Fenerbahçe" },
    { id: "w12_m4", homeTeam: "Trabzonspor", awayTeam: "Eyüpspor" }
  ],
  "13. Hafta": [
    { id: "w13_m1", homeTeam: "Beşiktaş", awayTeam: "Galatasaray" },
    { id: "w13_m2", homeTeam: "Fenerbahçe", awayTeam: "Erzurumspor FK" },
    { id: "w13_m3", homeTeam: "Göztepe", awayTeam: "Trabzonspor" }
  ],
  "14. Hafta": [
    { id: "w14_m1", homeTeam: "Beşiktaş", awayTeam: "Samsunspor" },
    { id: "w14_m2", homeTeam: "Galatasaray", awayTeam: "Rizespor" },
    { id: "w14_m3", homeTeam: "Başakşehir", awayTeam: "Fenerbahçe" },
    { id: "w14_m4", homeTeam: "Trabzonspor", awayTeam: "Çorum FK" }
  ],
  "15. Hafta": [
    { id: "w15_m1", homeTeam: "Gaziantep FK", awayTeam: "Beşiktaş" },
    { id: "w15_m2", homeTeam: "Eyüpspor", awayTeam: "Galatasaray" },
    { id: "w15_m3", homeTeam: "Fenerbahçe", awayTeam: "Trabzonspor" }
  ],
  "16. Hafta": [
    { id: "w16_m1", homeTeam: "Beşiktaş", awayTeam: "Rizespor" },
    { id: "w16_m2", homeTeam: "Galatasaray", awayTeam: "Alanyaspor" },
    { id: "w16_m3", homeTeam: "Kasımpaşa", awayTeam: "Fenerbahçe" },
    { id: "w16_m4", homeTeam: "Trabzonspor", awayTeam: "Kocaelispor" }
  ],
  "17. Hafta": [
    { id: "w17_m1", homeTeam: "Göztepe", awayTeam: "Beşiktaş" },
    { id: "w17_m2", homeTeam: "Gaziantep FK", awayTeam: "Galatasaray" },
    { id: "w17_m3", homeTeam: "Fenerbahçe", awayTeam: "Amed SF" },
    { id: "w17_m4", homeTeam: "Erzurum FK", awayTeam: "Trabzonspor" }
  ]
};

// ---------------------------------------------------------------------
// 1) YARDIMCI FONKSİYONLAR
// ---------------------------------------------------------------------

// Takım logolarını çeken dinamik sistem
function getTeamLogoUrl(teamName) {
  const name = teamName.toLowerCase().trim();
  if (name.includes("beşiktaş")) return "https://logo.clearbit.com/bjk.com.tr";
  if (name.includes("galatasaray")) return "https://logo.clearbit.com/galatasaray.org";
  if (name.includes("fenerbahçe")) return "https://logo.clearbit.com/fenerbahce.org";
  if (name.includes("trabzonspor")) return "https://logo.clearbit.com/trabzonspor.org.tr";
  
  // Diğer rakipler için harflerden temizlenmiş yedek logo üretici
  const safeName = name.replace(/[^a-z0-9]/g, "");
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(teamName)}&background=random&color=fff&size=128&bold=true`;
}

function usernameToFakeEmail(username) {
  const clean = username.trim().toLowerCase().replace(/\s+/g, "");
  return `${clean}@mactahminligi.local`;
}

function normalizeUsername(username) {
  return username.trim();
}

function showToast(text) {
  const toast = document.getElementById("toast");
  document.getElementById("toast-text").textContent = text;
  toast.classList.add("show");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.remove("show"), 2200);
}

function calculatePoints(predHome, predAway, realHome, realAway) {
  if (predHome === realHome && predAway === realAway) {
    return { points: 2, type: "TS" };
  }
  const predResult = predHome > predAway ? "H" : predHome < predAway ? "A" : "D";
  const realResult = realHome > realAway ? "H" : realHome < realAway ? "A" : "D";
  if (predResult === realResult) {
    return { points: 1, type: "KB" };
  }
  return { points: 0, type: "Y" };
}

// ---------------------------------------------------------------------
// 2) UYGULAMA DURUMU (STATE)
// ---------------------------------------------------------------------
const state = {
  currentUser: null,
  users: [],
  matches: [],       // Firestore'dan gelen canlı maç kilit/skor durumları
  predictions: [],   // Tüm kullanıcı tahminleri
  selectedWeek: "1. Hafta", // Varsayılan seçili hafta
  adminFilter: "active",
  scoreModalMatchId: null
};

let unsubscribers = [];

// ---------------------------------------------------------------------
// 3) AUTH — KAYIT OL
// ---------------------------------------------------------------------
document.getElementById("signup-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errorEl = document.getElementById("signup-error");
  errorEl.textContent = "";

  const usernameRaw = normalizeUsername(document.getElementById("signup-username").value);
  const password = document.getElementById("signup-password").value;

  if (!usernameRaw) { errorEl.textContent = "Kullanıcı adı boş olamaz."; return; }
  if (password.length < 6) { errorEl.textContent = "Şifre en az 6 karakter olmalı."; return; }

  const submitBtn = e.target.querySelector("button[type=submit]");
  submitBtn.disabled = true;

  try {
    const fakeEmail = usernameToFakeEmail(usernameRaw);
    const cred = await createUserWithEmailAndPassword(auth, fakeEmail, password);
    const uid = cred.user.uid;

    const isAdminUsername = usernameRaw.toLowerCase() === "admin";
    const adminConfigRef = doc(db, "config", "admin");

    const finalRole = await runTransaction(db, async (tx) => {
      const adminSnap = await tx.get(adminConfigRef);
      const alreadyClaimed = adminSnap.exists() && adminSnap.data().claimed;

      let role = "player";
      if (isAdminUsername && !alreadyClaimed) {
        role = "admin";
        tx.set(adminConfigRef, { claimed: true, uid, username: usernameRaw, claimedAt: serverTimestamp() });
      }

      tx.set(doc(db, "users", uid), {
        username: usernameRaw,
        usernameLower: usernameRaw.toLowerCase(),
        role,
        createdAt: serverTimestamp()
      });

      return role;
    });

    showToast(finalRole === "admin" ? "Yönetici hesabı oluşturuldu!" : "Hesabın oluşturuldu!");
  } catch (err) {
    errorEl.textContent = firebaseErrorToTurkish(err);
  } finally {
    submitBtn.disabled = false;
  }
});

// ---------------------------------------------------------------------
// 4) AUTH — GİRİŞ YAP
// ---------------------------------------------------------------------
document.getElementById("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errorEl = document.getElementById("login-error");
  errorEl.textContent = "";

  const usernameRaw = normalizeUsername(document.getElementById("login-username").value);
  const password = document.getElementById("login-password").value;
  const submitBtn = e.target.querySelector("button[type=submit]");
  submitBtn.disabled = true;

  try {
    const fakeEmail = usernameToFakeEmail(usernameRaw);
    await signInWithEmailAndPassword(auth, fakeEmail, password);
  } catch (err) {
    errorEl.textContent = firebaseErrorToTurkish(err);
  } finally {
    submitBtn.disabled = false;
  }
});

function firebaseErrorToTurkish(err) {
  const code = err.code || "";
  if (code.includes("email-already-in-use")) return "Bu kullanıcı adı zaten alınmış.";
  if (code.includes("invalid-credential") || code.includes("wrong-password") || code.includes("user-not-found")) {
    return "Kullanıcı adı veya şifre hatalı.";
  }
  if (code.includes("weak-password")) return "Şifre çok zayıf (en az 6 karakter).";
  if (code.includes("invalid-email")) return "Kullanıcı adı geçersiz karakterler içeriyor.";
  return "Bir hata oluştu, lütfen tekrar dene.";
}

document.querySelectorAll(".auth-tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".auth-tab-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    const target = btn.dataset.authtab;
    document.getElementById("login-form").classList.toggle("hidden", target !== "login");
    document.getElementById("signup-form").classList.toggle("hidden", target !== "signup");
  });
});

// ---------------------------------------------------------------------
// 5) AUTH — ÇIKIŞ YAP
// ---------------------------------------------------------------------
document.getElementById("logout-btn").addEventListener("click", () => signOut(auth));

// ---------------------------------------------------------------------
// 6) AUTH DURUM DİNLEYİCİSİ
// ---------------------------------------------------------------------
onAuthStateChanged(auth, async (firebaseUser) => {
  unsubscribers.forEach((unsub) => unsub());
  unsubscribers = [];

  if (!firebaseUser) {
    state.currentUser = null;
    document.getElementById("app").classList.add("hidden");
    document.getElementById("auth-screen").classList.remove("hidden");
    return;
  }

  const userSnap = await getDoc(doc(db, "users", firebaseUser.uid));
  if (!userSnap.exists()) {
    await signOut(auth);
    return;
  }
  const userData = userSnap.data();
  state.currentUser = { uid: firebaseUser.uid, username: userData.username, role: userData.role };

  document.getElementById("auth-screen").classList.add("hidden");
  document.getElementById("app").classList.remove("hidden");
  document.getElementById("current-username").textContent = state.currentUser.username;
  document.getElementById("admin-nav-btn").classList.toggle("hidden", state.currentUser.role !== "admin");

  // Hafta seçici dropdown event listener bağlama
  setupWeekSelectListeners();

  startRealtimeListeners();
});

// ---------------------------------------------------------------------
// HAFTA SEÇİCİ EVENT LISTENERS
// ---------------------------------------------------------------------
function setupWeekSelectListeners() {
  const mainWeekSelect = document.getElementById("main-week-select");
  const adminWeekSelect = document.getElementById("admin-week-select");

  if (mainWeekSelect) {
    mainWeekSelect.value = state.selectedWeek;
    mainWeekSelect.addEventListener("change", (e) => {
      state.selectedWeek = e.target.value;
      if (adminWeekSelect) adminWeekSelect.value = state.selectedWeek;
      renderAll();
    });
  }

  if (adminWeekSelect) {
    adminWeekSelect.value = state.selectedWeek;
    adminWeekSelect.addEventListener("change", (e) => {
      state.selectedWeek = e.target.value;
      if (mainWeekSelect) mainWeekSelect.value = state.selectedWeek;
      renderAll();
    });
  }
}

function renderAll() {
  renderMaclar();
  renderSonuclar();
  renderAdmin();
  renderSiralama();
}

// ---------------------------------------------------------------------
// 7) FIRESTORE REALTIME DİNLEYİCİLERİ
// ---------------------------------------------------------------------
function startRealtimeListeners() {
  const usersUnsub = onSnapshot(collection(db, "users"), (snap) => {
    state.users = snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
    renderSiralama();
  });

  // Maçların kilit ve bitiş skor durumlarını takip eden Firestore koleksiyonu
  const matchesUnsub = onSnapshot(collection(db, "matches"), (snap) => {
    state.matches = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderAll();
  });

  const predsUnsub = onSnapshot(collection(db, "predictions"), (snap) => {
    state.predictions = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderAll();
  });

  unsubscribers.push(usersUnsub, matchesUnsub, predsUnsub);
}

// ---------------------------------------------------------------------
// 8) ALT NAVİGASYON
// ---------------------------------------------------------------------
document.querySelectorAll(".nav-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const tab = btn.dataset.tab;
    document.querySelectorAll(".nav-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
    document.getElementById(`tab-${tab}`).classList.add("active");
  });
});

// ---------------------------------------------------------------------
// 9) "MAÇLAR" SEKMESİ — Seçili haftanın henüz bitmemiş maçları + tahmin girişi
// ---------------------------------------------------------------------
function renderMaclar() {
  const container = document.getElementById("maclar-list");
  const emptyEl = document.getElementById("maclar-empty");
  
  // Sabit fikstürden seçili haftanın maçlarını alıyoruz
  const currentWeekMatches = FIXED_MATCHES_BY_WEEK[state.selectedWeek] || [];

  // Firestore'daki kilit/bitiş durumlarını sabit maç verileriyle harmanla
  const activeMatches = currentWeekMatches.map(fixedMatch => {
    const liveState = state.matches.find(m => m.id === fixedMatch.id) || { isLocked: false, isFinished: false };
    return { ...fixedMatch, ...liveState };
  }).filter(m => !m.isFinished);

  container.innerHTML = "";
  emptyEl.classList.toggle("hidden", activeMatches.length > 0);

  activeMatches.forEach((match) => {
    const myPred = state.predictions.find((p) => p.matchId === match.id && p.uid === state.currentUser.uid);
    const card = document.createElement("div");
    card.className = "match-card";

    let bodyHtml = `
      <div class="match-card-top">
        <span class="match-datetime">${state.selectedWeek}</span>
        <span class="match-status-badge ${match.isLocked ? "badge-locked" : "badge-open"}">
          ${match.isLocked ? "Kilitli" : "Tahmine Açık"}
        </span>
      </div>
      <div class="match-teams-row" style="display:flex; align-items:center; justify-content:space-between; gap:10px;">
        <div class="team-side home" style="display:flex; align-items:center; gap:8px; flex:1; justify-content:flex-end;">
          <span class="team-name">${escapeHtml(match.homeTeam)}</span>
          <img src="${getTeamLogoUrl(match.homeTeam)}" style="width:32px; height:32px; object-fit:contain;" alt="logo">
        </div>
        <div class="score-box-group">
          <input type="number" min="0" max="99" class="score-box pred-home" ${match.isLocked ? "disabled" : ""}
                 value="${myPred ? myPred.predHome : ""}" placeholder="-">
          <span class="score-sep">-</span>
          <input type="number" min="0" max="99" class="score-box pred-away" ${match.isLocked ? "disabled" : ""}
                 value="${myPred ? myPred.predAway : ""}" placeholder="-">
        </div>
        <div class="team-side away" style="display:flex; align-items:center; gap:8px; flex:1; justify-content:flex-start;">
          <img src="${getTeamLogoUrl(match.awayTeam)}" style="width:32px; height:32px; object-fit:contain;" alt="logo">
          <span class="team-name">${escapeHtml(match.awayTeam)}</span>
        </div>
      </div>
    `;

    if (!match.isLocked) {
      bodyHtml += `
        <div class="match-card-footer">
          <button class="btn-save-pred" data-matchid="${match.id}">Tahmini Kaydet</button>
        </div>
      `;
    } else {
      const preds = state.predictions.filter((p) => p.matchId === match.id);
      bodyHtml += `<div class="pred-reveal-list">${
        preds.length
          ? preds.map((p) => `
              <div class="pred-reveal-row">
                <span class="pred-reveal-name">${escapeHtml(p.username)}</span>
                <span class="pred-reveal-score">${p.predHome} - ${p.predAway}</span>
              </div>`).join("")
          : `<span class="pred-reveal-name">Henüz kimse tahmin yapmamış.</span>`
      }</div>`;
    }

    card.innerHTML = bodyHtml;
    container.appendChild(card);

    if (!match.isLocked) {
      card.querySelector(".btn-save-pred").addEventListener("click", () => saveMyPrediction(match));
    }
  });
}

async function saveMyPrediction(match) {
  const card = document.querySelector(`.btn-save-pred[data-matchid="${match.id}"]`).closest(".match-card");
  const homeVal = card.querySelector(".pred-home").value;
  const awayVal = card.querySelector(".pred-away").value;

  if (homeVal === "" || awayVal === "") {
    showToast("Lütfen her iki skoru da gir");
    return;
  }

  const predHome = parseInt(homeVal, 10);
  const predAway = parseInt(awayVal, 10);
  const predId = `${match.id}_${state.currentUser.uid}`;

  try {
    await setDoc(doc(db, "predictions", predId), {
      matchId: match.id,
      week: state.selectedWeek,
      uid: state.currentUser.uid,
      username: state.currentUser.username,
      predHome,
      predAway,
      points: null,
      updatedAt: serverTimestamp()
    }, { merge: true });

    showToast("Başarıyla Kaydedildi");
  } catch (err) {
    showToast("Kaydedilemedi, tekrar dene");
  }
}

// ---------------------------------------------------------------------
// 10) "SONUÇLAR" SEKMESİ — Seçili haftanın tamamlanmış maçları
// ---------------------------------------------------------------------
function renderSonuclar() {
  const container = document.getElementById("sonuclar-list");
  const emptyEl = document.getElementById("sonuclar-empty");
  
  const currentWeekMatches = FIXED_MATCHES_BY_WEEK[state.selectedWeek] || [];

  const finished = currentWeekMatches.map(fixedMatch => {
    const liveState = state.matches.find(m => m.id === fixedMatch.id) || { isFinished: false };
    return { ...fixedMatch, ...liveState };
  }).filter((m) => m.isFinished);

  container.innerHTML = "";
  emptyEl.classList.toggle("hidden", finished.length > 0);

  finished.forEach((match) => {
    const preds = state.predictions.filter((p) => p.matchId === match.id);
    const card = document.createElement("div");
    card.className = "match-card";
    card.innerHTML = `
      <div class="match-card-top">
        <span class="match-datetime">${state.selectedWeek}</span>
        <span class="match-status-badge badge-finished">Tamamlandı</span>
      </div>
      <div class="match-teams-row" style="display:flex; align-items:center; justify-content:space-between; gap:10px;">
        <div class="team-side home" style="display:flex; align-items:center; gap:8px; flex:1; justify-content:flex-end;">
          <span class="team-name">${escapeHtml(match.homeTeam)}</span>
          <img src="${getTeamLogoUrl(match.homeTeam)}" style="width:32px; height:32px; object-fit:contain;" alt="logo">
        </div>
        <span class="match-final-score" style="font-weight:bold; font-size:1.2rem;">${match.homeScore} - ${match.awayScore}</span>
        <div class="team-side away" style="display:flex; align-items:center; gap:8px; flex:1; justify-content:flex-start;">
          <img src="${getTeamLogoUrl(match.awayTeam)}" style="width:32px; height:32px; object-fit:contain;" alt="logo">
          <span class="team-name">${escapeHtml(match.awayTeam)}</span>
        </div>
      </div>
      <div class="pred-reveal-list">
        ${
          preds.length
            ? preds.map((p) => {
                const { points } = calculatePoints(p.predHome, p.predAway, match.homeScore, match.awayScore);
                const ptsClass = points === 2 ? "pts-2" : points === 1 ? "pts-1" : "pts-0";
                return `
                  <div class="pred-reveal-row">
                    <span class="pred-reveal-name">${escapeHtml(p.username)}</span>
                    <span>
                      <span class="pred-reveal-score">${p.predHome} - ${p.predAway}</span>
                      <span class="pred-points ${ptsClass}">(+${points})</span>
                    </span>
                  </div>`;
              }).join("")
            : `<span class="pred-reveal-name">Kimse tahmin yapmamıştı.</span>`
        }
      </div>
    `;
    container.appendChild(card);
  });
}

// ---------------------------------------------------------------------
// 11) "SIRALAMA" SEKMESİ — Genel Liderlik tablosu (Tüm tamamlanan maçlar üzerinden)
// ---------------------------------------------------------------------
function renderSiralama() {
  const tbody = document.getElementById("leaderboard-body");
  const emptyEl = document.getElementById("leaderboard-empty");
  if (!state.currentUser) return;

  // Tüm sabit fikstür listesi üzerinden Firestore'da isFinished olanları buluyoruz
  const allFixedMatches = Object.values(FIXED_MATCHES_BY_WEEK).flat();
  const finishedMatches = allFixedMatches.map(fixedMatch => {
    const liveState = state.matches.find(m => m.id === fixedMatch.id) || { isFinished: false };
    return { ...fixedMatch, ...liveState };
  }).filter((m) => m.isFinished);

  const rows = state.users.map((user) => {
    let P = 0, TS = 0, KB = 0, Y = 0;
    const O = finishedMatches.length;

    finishedMatches.forEach((match) => {
      const pred = state.predictions.find((p) => p.matchId === match.id && p.uid === user.uid);
      if (!pred) {
        Y += 1;
        return;
      }
      const { points, type } = calculatePoints(pred.predHome, pred.predAway, match.homeScore, match.awayScore);
      P += points;
      if (type === "TS") TS += 1;
      else if (type === "KB") KB += 1;
      else Y += 1;
    });

    const AV = O > 0 ? (P / O).toFixed(2) : "0.00";
    return { uid: user.uid, username: user.username, P, O, TS, KB, Y, AV };
  });

  rows.sort((a, b) => b.P - a.P || parseFloat(b.AV) - parseFloat(a.AV));

  if (emptyEl) emptyEl.classList.toggle("hidden", finishedMatches.length > 0);
  if (tbody) {
    tbody.innerHTML = rows.map((r, i) => `
      <tr class="${i === 0 ? "rank-1" : ""} ${r.uid === state.currentUser.uid ? "is-me" : ""}">
        <td class="col-rank">${i + 1}</td>
        <td class="col-name">${escapeHtml(r.username)}</td>
        <td class="col-points">${r.P}</td>
        <td>${r.O}</td>
        <td>${r.TS}</td>
        <td>${r.KB}</td>
        <td>${r.Y}</td>
        <td>${r.AV}</td>
      </tr>
    `).join("");
  }
}

// ---------------------------------------------------------------------
// 12) "ADMIN" SEKMESİ — Seçili haftanın maçlarını kilitleme, skor girme
// ---------------------------------------------------------------------
document.querySelectorAll(".admin-filter-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".admin-filter-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    state.adminFilter = btn.dataset.adminfilter;
    renderAdmin();
  });
});

function renderAdmin() {
  const container = document.getElementById("admin-match-list");
  const emptyEl = document.getElementById("admin-empty");
  if (!state.currentUser || state.currentUser.role !== "admin") return;

  const currentWeekMatches = FIXED_MATCHES_BY_WEEK[state.selectedWeek] || [];

  const combinedMatches = currentWeekMatches.map(fixedMatch => {
    const liveState = state.matches.find(m => m.id === fixedMatch.id) || { isLocked: false, isFinished: false, homeScore: null, awayScore: null };
    return { ...fixedMatch, ...liveState };
  });

  const filtered = state.adminFilter === "active"
    ? combinedMatches.filter((m) => !m.isFinished)
    : combinedMatches.filter((m) => m.isFinished);

  container.innerHTML = "";
  emptyEl.classList.toggle("hidden", filtered.length > 0);

  filtered.forEach((match) => {
    const predCount = state.predictions.filter((p) => p.matchId === match.id).length;
    const card = document.createElement("div");
    card.className = "match-card";
    card.innerHTML = `
      <div class="match-card-top">
        <span class="match-datetime">${state.selectedWeek}</span>
        <span class="match-status-badge ${match.isFinished ? "badge-finished" : match.isLocked ? "badge-locked" : "badge-open"}">
          ${match.isFinished ? "Tamamlandı" : match.isLocked ? "Kilitli" : "Açık"}
        </span>
      </div>
      <div class="match-teams-row" style="display:flex; align-items:center; justify-content:space-between; gap:10px;">
        <div class="team-side home" style="display:flex; align-items:center; gap:8px; flex:1; justify-content:flex-end;">
          <span class="team-name">${escapeHtml(match.homeTeam)}</span>
          <img src="${getTeamLogoUrl(match.homeTeam)}" style="width:28px; height:28px; object-fit:contain;" alt="logo">
        </div>
        ${match.isFinished
          ? `<span class="match-final-score" style="font-weight:bold;">${match.homeScore} - ${match.awayScore}</span>`
          : `<span class="score-sep">vs</span>`
        }
        <div class="team-side away" style="display:flex; align-items:center; gap:8px; flex:1; justify-content:flex-start;">
          <img src="${getTeamLogoUrl(match.awayTeam)}" style="width:28px; height:28px; object-fit:contain;" alt="logo">
          <span class="team-name">${escapeHtml(match.awayTeam)}</span>
        </div>
      </div>
      <p class="field-hint" style="text-align:center;margin-top:8px;">${predCount} tahmin girildi</p>
      <div class="admin-card-actions">
        ${!match.isFinished ? `
          <button class="btn-admin-action ${match.isLocked ? "btn-unlock" : "btn-lock"}" data-action="toggle-lock" data-matchid="${match.id}" data-locked="${match.isLocked}">
            ${match.isLocked ? "Kilidi Aç" : "Kilitle"}
          </button>
          <button class="btn-admin-action btn-score" data-action="enter-score" data-matchid="${match.id}" data-home="${escapeHtml(match.homeTeam)}" data-away="${escapeHtml(match.awayTeam)}">
            Skor Gir
          </button>
        ` : `
          <button class="btn-admin-action btn-unlock" data-action="reset-match" data-matchid="${match.id}">Skoru Sıfırla (Geri Al)</button>
        `}
      </div>
    `;
    container.appendChild(card);
  });

  container.querySelectorAll("[data-action='toggle-lock']").forEach((btn) => {
    btn.addEventListener("click", () => toggleLock(btn.dataset.matchid, btn.dataset.locked === "true"));
  });
  container.querySelectorAll("[data-action='enter-score']").forEach((btn) => {
    btn.addEventListener("click", () => openScoreModal(btn.dataset.matchid, btn.dataset.home, btn.dataset.away));
  });
  container.querySelectorAll("[data-action='reset-match']").forEach((btn) => {
    btn.addEventListener("click", () => resetMatchScore(btn.dataset.matchid));
  });
}

async function toggleLock(matchId, currentlyLocked) {
  await setDoc(doc(db, "matches", matchId), { isLocked: !currentlyLocked }, { merge: true });
  showToast(!currentlyLocked ? "Maç kilitlendi" : "Kilit açıldı");
}

async function resetMatchScore(matchId) {
  if (!confirm("Bu maçın skorunu sıfırlamak ve tahmine geri açmak istediğinize emin misiniz?")) return;
  try {
    await setDoc(doc(db, "matches", matchId), {
      isFinished: false,
      isLocked: false,
      homeScore: null,
      awayScore: null
    }, { merge: true });

    const relatedPreds = state.predictions.filter((p) => p.matchId === matchId);
    if (relatedPreds.length > 0) {
      const batch = writeBatch(db);
      relatedPreds.forEach((p) => {
        batch.update(doc(db, "predictions", p.id), { points: null });
      });
      await batch.commit();
    }
    showToast("Maç skoru sıfırlandı.");
  } catch (err) {
    showToast("İşlem başarısız oldu.");
  }
}

// --- Skor girme modalı ---
function openScoreModal(matchId, home, away) {
  state.scoreModalMatchId = matchId;
  document.getElementById("score-modal-teams").textContent = `${home} vs ${away}`;
  document.getElementById("score-modal-home").value = "";
  document.getElementById("score-modal-away").value = "";
  document.getElementById("score-modal").classList.remove("hidden");
}

document.getElementById("score-modal-cancel").addEventListener("click", () => {
  document.getElementById("score-modal").classList.add("hidden");
  state.scoreModalMatchId = null;
});

document.getElementById("score-modal-confirm").addEventListener("click", async () => {
  const homeVal = document.getElementById("score-modal-home").value;
  const awayVal = document.getElementById("score-modal-away").value;
  if (homeVal === "" || awayVal === "") { showToast("Lütfen her iki skoru da gir"); return; }

  const homeScore = parseInt(homeVal, 10);
  const awayScore = parseInt(awayVal, 10);
  const matchId = state.scoreModalMatchId;

  const confirmBtn = document.getElementById("score-modal-confirm");
  confirmBtn.disabled = true;

  try {
    await setDoc(doc(db, "matches", matchId), {
      isFinished: true,
      isLocked: true,
      homeScore,
      awayScore,
      finishedAt: serverTimestamp()
    }, { merge: true });

    const relatedPreds = state.predictions.filter((p) => p.matchId === matchId);
    if (relatedPreds.length > 0) {
      const batch = writeBatch(db);
      relatedPreds.forEach((p) => {
        const { points } = calculatePoints(p.predHome, p.predAway, homeScore, awayScore);
        batch.update(doc(db, "predictions", p.id), { points });
      });
      await batch.commit();
    }

    document.getElementById("score-modal").classList.add("hidden");
    state.scoreModalMatchId = null;
    showToast("Skor girildi, puanlar hesaplandı!");
  } catch (err) {
    showToast("Bir hata oluştu, tekrar dene");
  } finally {
    confirmBtn.disabled = false;
  }
});

// ---------------------------------------------------------------------
// 13) GÜVENLİK — basit HTML escape
// ---------------------------------------------------------------------
function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
