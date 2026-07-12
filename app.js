// =====================================================================
// MAÇ TAHMİN LİGİ — app.js (Haftalık Sabit Fikstür & Gelişmiş Kurallar)
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
// SABİT HAFTALIK FİKSTÜR
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
    { id: "w15_m2", location: "Eyüpspor", awayTeam: "Galatasaray" },
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
  matches: [],       
  predictions: [],   
  selectedWeek: "1. Hafta", 
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

  setupWeekSelectListeners();
  startRealtimeListeners();
});

function setupWeekSelectListeners() {
  const mainWeekSelect = document.getElementById("main-week-select");
  const adminWeekSelect = document.getElementById("admin-week-select");

  if (mainWeekSelect) {
    mainWeekSelect.value = state.selectedWeek;
    mainWeekSelect.removeEventListener("change", handleWeekChange);
    mainWeekSelect.addEventListener("change", handleWeekChange);
  }
  if (adminWeekSelect) {
    adminWeekSelect.value = state.selectedWeek;
    adminWeekSelect.removeEventListener("change", handleWeekChange);
    adminWeekSelect.addEventListener("change", handleWeekChange);
  }
}

function handleWeekChange(e) {
  state.selectedWeek = e.target.value;
  const mainWeekSelect = document.getElementById("main-week-select");
  const adminWeekSelect = document.getElementById("admin-week-select");
  if (mainWeekSelect) mainWeekSelect.value = state.selectedWeek;
  if (adminWeekSelect) adminWeekSelect.value = state.selectedWeek;
  renderAll();
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
    renderAdmin(); 
  });

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
// 9) "MAÇLAR" SEKMESİ — Tahmin Girişi, Kendi Tahminini Görme ve Silme
// ---------------------------------------------------------------------
function renderMaclar() {
  const container = document.getElementById("maclar-list");
  const emptyEl = document.getElementById("maclar-empty");
  
  const currentWeekMatches = FIXED_MATCHES_BY_WEEK[state.selectedWeek] || [];

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

    const isAdmin = state.currentUser.role === "admin";

    let bodyHtml = `
      <div class="match-card-top">
        <span class="match-datetime">${state.selectedWeek}</span>
        <span class="match-status-badge ${match.isLocked ? "badge-locked" : "badge-open"}">
          ${match.isLocked ? "Kilitli" : "Tahmine Açık"}
        </span>
      </div>
      <div class="match-teams-row">
        <span class="team-name home">${escapeHtml(match.homeTeam)}</span>
        <div class="score-box-group">
          <input type="number" min="0" max="99" class="score-box pred-home" ${match.isLocked || isAdmin ? "disabled" : ""}
                 value="${myPred ? myPred.predHome : ""}" placeholder="-">
          <span class="score-sep">-</span>
          <input type="number" min="0" max="99" class="score-box pred-away" ${match.isLocked || isAdmin ? "disabled" : ""}
                 value="${myPred ? myPred.predAway : ""}" placeholder="-">
        </div>
        <span class="team-name away">${escapeHtml(match.awayTeam)}</span>
      </div>
    `;

    if (isAdmin) {
      bodyHtml += `<div class="field-hint" style="text-align:center; margin-top:10px; color:var(--text-muted);">Admin hesapları tahmin yapamaz.</div>`;
    } else if (!match.isLocked) {
      bodyHtml += `
        <div class="match-card-footer" style="display:flex; gap:10px; justify-content:center; margin-top:12px;">
          <button class="btn-save-pred" data-matchid="${match.id}">Tahmini Kaydet</button>
          ${myPred ? `<button class="btn-delete-pred" data-matchid="${match.id}" style="background:#ef4444; color:#fff; border:none; padding:6px 12px; border-radius:6px; cursor:pointer;">Tahmini Sil</button>` : ""}
        </div>
        ${myPred ? `
          <div style="text-align:center; margin-top:10px; font-size:0.9rem; color:#10b981;">
            Mevcut Tahmininiz: <b>${myPred.predHome} - ${myPred.predAway}</b>
          </div>
        ` : ""}
      `;
    } else {
      // Maç kilitliyse sadece DİĞER kullanıcıların tahminlerini göster
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

    if (!match.isLocked && !isAdmin) {
      card.querySelector(".btn-save-pred").addEventListener("click", () => saveMyPrediction(match));
      const delBtn = card.querySelector(".btn-delete-pred");
      if (delBtn) {
        delBtn.addEventListener("click", () => deleteMyPrediction(match.id));
      }
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

async function deleteMyPrediction(matchId) {
  if (!confirm("Tahmininizi silmek istediğinize emin misiniz?")) return;
  const predId = `${matchId}_${state.currentUser.uid}`;
  try {
    await deleteDoc(doc(db, "predictions", predId));
    showToast("Tahmininiz silindi");
  } catch (err) {
    showToast("Tahmin silinemedi");
  }
}

// ---------------------------------------------------------------------
// 10) "SONUÇLAR" SEKMESİ
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
      <div class="match-teams-row">
        <span class="team-name home">${escapeHtml(match.homeTeam)}</span>
        <span class="match-final-score" style="font-weight:bold; font-size:1.2rem;">${match.homeScore} - ${match.awayScore}</span>
        <span class="team-name away">${escapeHtml(match.awayTeam)}</span>
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

// ... (İlk kısımlar, Firebase imports ve FIXED_MATCHES_BY_WEEK aynı kalmalı) ...

// 1) DÜZELTİLMİŞ RENDER SIRALAMA (Takım kısaltması yerine isim üzerinden eşleme)
function renderSiralama() {
  const tbody = document.getElementById("leaderboard-body");
  const teamStatsBody = document.getElementById("team-stats-body");
  const emptyEl = document.getElementById("leaderboard-empty");
  if (!state.currentUser) return;

  const allFixedMatches = Object.values(FIXED_MATCHES_BY_WEEK).flat();
  const finishedMatches = allFixedMatches.map(fixedMatch => {
    const liveState = state.matches.find(m => m.id === fixedMatch.id) || { isFinished: false };
    return { ...fixedMatch, ...liveState };
  }).filter((m) => m.isFinished);

  const playersOnly = state.users.filter(u => u.role !== "admin");

  const rows = playersOnly.map((user) => {
    let P = 0, TS = 0, KB = 0, Y = 0;
    const teamTS = { "Beşiktaş": 0, "Galatasaray": 0, "Fenerbahçe": 0, "Trabzonspor": 0 };

    finishedMatches.forEach((match) => {
      const pred = state.predictions.find((p) => p.matchId === match.id && p.uid === user.uid);
      if (!pred) { Y += 1; return; }
      const { points, type } = calculatePoints(pred.predHome, pred.predAway, match.homeScore, match.awayScore);
      P += points;
      
      if (type === "TS") {
        TS += 1;
        if (teamTS.hasOwnProperty(match.homeTeam)) {
          teamTS[match.homeTeam] += 1;
        }
      } else if (type === "KB") {
        KB += 1;
      } else {
        Y += 1;
      }
    });

    return { uid: user.uid, username: user.username, P, TS, KB, Y, teamTS };
  });

  rows.sort((a, b) => b.P - a.P || a.Y - b.Y);

  if (tbody) {
    tbody.innerHTML = rows.map((r, i) => `
      <tr class="${i === 0 ? "rank-1" : ""} ${r.uid === state.currentUser.uid ? "is-me" : ""}">
        <td class="col-rank">${i + 1}</td>
        <td class="col-name">${escapeHtml(r.username)}</td>
        <td class="col-points">${r.P}</td>
        <td>${r.TS}</td>
        <td>${r.KB}</td>
        <td>${r.Y}</td>
      </tr>
    `).join("");
  }

  if (teamStatsBody) {
    teamStatsBody.innerHTML = rows.map(r => `
      <tr>
        <td>${escapeHtml(r.username)}</td>
        <td>${r.teamTS["Beşiktaş"]}</td>
        <td>${r.teamTS["Galatasaray"]}</td>
        <td>${r.teamTS["Fenerbahçe"]}</td>
        <td>${r.teamTS["Trabzonspor"]}</td>
      </tr>
    `).join("");
  }
}

// =====================================================================
// GÜNCEL VE TEMİZLENMİŞ KOD YAPISI
// =====================================================================

// 1) TEK BİR ESCAPEHTML FONKSİYONU (DOM tabanlı ve güvenli)
function escapeHtml(text) {
  if (text == null) return "";
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// 2) GÜNCEL renderMaclar FONKSİYONU
function renderMatches() {
  const container = document.getElementById("maclar-list");
  const emptyEl = document.getElementById("maclar-empty");
  const currentWeekMatches = FIXED_MATCHES_BY_WEEK[state.selectedWeek] || [];

  container.innerHTML = "";
  
  currentWeekMatches.forEach(fixedMatch => {
    const liveState = state.matches.find(m => m.id === fixedMatch.id) || { 
        isLocked: false, 
        isFinished: false 
    };
    
    const match = { ...fixedMatch, ...liveState };

    if (match.isFinished) return;

    const myPred = state.predictions.find((p) => p.matchId === match.id && p.uid === state.currentUser?.uid);
    const isAdmin = state.currentUser?.role === "admin";
    
    const card = document.createElement("div");
    card.className = "match-card";
    
    card.innerHTML = `
      <div class="match-card-top">
        <span>${state.selectedWeek}</span>
        <span class="${match.isLocked ? "badge-locked" : "badge-open"}">
           ${match.isLocked ? "Kilitli" : "Tahmine Açık"}
        </span>
      </div>
      <div class="match-teams-row">
        <span>${escapeHtml(match.homeTeam)}</span>
        <input type="number" class="pred-home" value="${myPred?.predHome ?? ""}" ${match.isLocked || isAdmin ? "disabled" : ""}>
        <span>-</span>
        <input type="number" class="pred-away" value="${myPred?.predAway ?? ""}" ${match.isLocked || isAdmin ? "disabled" : ""}>
        <span>${escapeHtml(match.awayTeam)}</span>
      </div>
      ${!match.isLocked && !isAdmin ? `<button class="btn-save-pred" data-matchid="${match.id}">Tahmini Kaydet</button>` : ""}
    `;
    container.appendChild(card);
  });

  const activeCount = currentWeekMatches.filter(fm => {
      const m = state.matches.find(ma => ma.id === fm.id);
      return !m || !m.isFinished;
  }).length;
  
  emptyEl.classList.toggle("hidden", activeCount > 0);

  container.querySelectorAll(".btn-save-pred").forEach(btn => 
    btn.addEventListener("click", () => saveMyPrediction({ id: btn.dataset.matchid }))
  );
}

// 3) MODAL YARDIMCI FONKSİYONU
function openScoreModal(matchId, home, away) {
  state.scoreModalMatchId = matchId;
  document.getElementById("score-modal-teams").textContent = `${home} vs ${away}`;
  document.getElementById("score-modal").classList.remove("hidden");
}

// 4) MODAL ONAY İŞLEMİ
document.getElementById("score-modal-confirm").addEventListener("click", async () => {
  const homeScore = parseInt(document.getElementById("score-modal-home").value);
  const awayScore = parseInt(document.getElementById("score-modal-away").value);
  
  await setDoc(doc(db, "matches", state.scoreModalMatchId), {
    isFinished: true, isLocked: true, homeScore, awayScore
  }, { merge: true });
  
  document.getElementById("score-modal").classList.add("hidden");
  showToast("Skor girildi ve maç kapandı");
});
// ---------------------------------------------------------------------
// 12) "ADMIN" SEKMESİ — Maç Yönetimi ve Kullanıcı Silme
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

  // --- 1. Maç Yönetim Paneli ---
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
      <div class="match-teams-row">
        <span class="team-name home">${escapeHtml(match.homeTeam)}</span>
        ${match.isFinished
          ? `<span class="match-final-score" style="font-weight:bold;">${match.homeScore} - ${match.awayScore}</span>`
          : `<span class="score-sep">vs</span>`
        }
        <span class="team-name away">${escapeHtml(match.awayTeam)}</span>
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

  // --- 2. Dinamik Kullanıcı Listesi ve Silme Butonları (Arayüz Entegresi) ---
  renderUserManagementSection();
}

function renderUserManagementSection() {
  let userSection = document.getElementById("admin-user-management");
  if (!userSection) {
    userSection = document.createElement("div");
    userSection.id = "admin-user-management";
    userSection.style.marginTop = "30px";
    userSection.style.paddingTop = "20px";
    userSection.style.borderTop = "2px dashed #4f5464";
    document.getElementById("tab-admin").appendChild(userSection);
  }

  userSection.innerHTML = `
    <h3 style="margin-bottom: 12px; font-family:'Rajdhani'; font-size:1.4rem;">👤 Kullanıcı Yönetimi</h3>
    <div class="user-list-container" style="display:flex; flex-direction:column; gap:8px;">
      ${state.users.map(u => {
        const isMe = u.uid === state.currentUser.uid;
        return `
          <div style="display:flex; justify-content:space-between; align-items:center; background:var(--bg-card, #2a2d34); padding:10px 16px; border-radius:8px;">
            <span>${escapeHtml(u.username)} <small style="color:gray;">(${u.role})</small></span>
            ${!isMe ? `<button class="btn-delete-user" data-uid="${u.uid}" style="background:#ef4444; color:#fff; border:none; padding:6px 12px; border-radius:6px; cursor:pointer; font-weight:600;">Kullanıcıyı Sil</button>` : `<span style="color:gray; font-size:0.9rem;">Siz</span>`}
          </div>
        `;
      }).join("")}
    </div>
  `;

  userSection.querySelectorAll(".btn-delete-user").forEach(btn => {
    btn.addEventListener("click", () => deleteUserFromSystem(btn.dataset.uid));
  });
}

async function deleteUserFromSystem(uid) {
  if (!confirm("Bu kullanıcıyı sistemden tamamen silmek istediğinize emin misiniz? Tüm verileri kaybolacaktır.")) return;
  try {
    // Kullanıcıyı Firestore'dan sil
    await deleteDoc(doc(db, "users", uid));

    // Kullanıcının yaptığı tüm tahminleri topluca temizle (Batch write)
    const userPreds = state.predictions.filter(p => p.uid === uid);
    if (userPreds.length > 0) {
      const batch = writeBatch(db);
      userPreds.forEach(p => {
        batch.delete(doc(db, "predictions", p.id));
      });
      await batch.commit();
    }
    showToast("Kullanıcı başarıyla silindi");
  } catch (err) {
    showToast("Kullanıcı silinirken bir hata oluştu");
  }
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
    .replace(/"/g, "&quot.");
}
