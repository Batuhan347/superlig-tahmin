// =====================================================================
// MAÇ TAHMİN LİGİ — app.js
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
// 1) YARDIMCI FONKSİYONLAR
// ---------------------------------------------------------------------

// Firebase Auth e-posta ister; kullanıcı adını sahte/deterministik bir
// e-postaya çeviriyoruz. Böylece kullanıcı için "kullanıcı adı + şifre"
// deneyimi korunmuş oluyor.
function usernameToFakeEmail(username) {
  const clean = username.trim().toLowerCase().replace(/\s+/g, "");
  return `${clean}@mactahminligi.local`;
}

function normalizeUsername(username) {
  return username.trim();
}

function formatMatchDate(timestamp) {
  if (!timestamp) return "--";
  const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const gun = String(d.getDate()).padStart(2, "0");
  const ay = String(d.getMonth() + 1).padStart(2, "0");
  const saat = String(d.getHours()).padStart(2, "0");
  const dk = String(d.getMinutes()).padStart(2, "0");
  return `${gun}.${ay}.${d.getFullYear()} ${saat}:${dk}`;
}

function showToast(text) {
  const toast = document.getElementById("toast");
  document.getElementById("toast-text").textContent = text;
  toast.classList.add("show");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.remove("show"), 2200);
}

// Tahmin puanlama algoritması (proje şartnamesindeki kurallara göre):
//   Tam Skor doğru  -> +2  (TS)
//   Sadece kazanan/beraberlik doğru -> +1 (K/B)
//   İkisi de yanlış  -> 0  (Y)
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
  currentUser: null,   // { uid, username, role }
  users: [],           // tüm kayıtlı kullanıcılar [{uid, username, role}]
  matches: [],          // tüm maçlar
  predictions: [],      // tüm tahminler
  adminFilter: "active", // admin sekmesi filtre durumu: 'active' | 'past'
  scoreModalMatchId: null
};

let unsubscribers = []; // logout'ta listener'ları kapatmak için

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

    // Özel Admin Mekanizması:
    // "config/admin" tekil dokümanını transaction içinde okuyup, kullanıcı
    // adı tam olarak "admin" ise VE bu hak daha önce kimseye verilmemişse
    // (claimed=false) bu kullanıcıyı kalıcı admin yapıyoruz. Transaction
    // kullanmamızın sebebi eşzamanlı iki "Admin" kaydında yarış durumunu
    // (race condition) önlemek.
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
    // onAuthStateChanged geri kalanı halledecek (uygulamayı açacak)
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

// Auth sekmeleri arası geçiş (Giriş Yap / Kayıt Ol)
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
// 6) AUTH DURUM DİNLEYİCİSİ — giriş/çıkışta ekranları yönetir
// ---------------------------------------------------------------------
onAuthStateChanged(auth, async (firebaseUser) => {
  // Önce eski dinleyicileri temizle
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
    // Beklenmedik durum: auth var ama kullanıcı dokümanı yok
    await signOut(auth);
    return;
  }
  const userData = userSnap.data();
  state.currentUser = { uid: firebaseUser.uid, username: userData.username, role: userData.role };

  document.getElementById("auth-screen").classList.add("hidden");
  document.getElementById("app").classList.remove("hidden");
  document.getElementById("current-username").textContent = state.currentUser.username;
  document.getElementById("admin-nav-btn").classList.toggle("hidden", state.currentUser.role !== "admin");

  startRealtimeListeners();
});

// ---------------------------------------------------------------------
// 7) FIRESTORE REALTIME DİNLEYİCİLERİ
// ---------------------------------------------------------------------
function startRealtimeListeners() {
  // Kullanıcılar (leaderboard için gerekli)
  const usersUnsub = onSnapshot(collection(db, "users"), (snap) => {
    state.users = snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
    renderSiralama();
  });

  // Maçlar — tarihe göre artan (kronolojik) sırada
  const matchesUnsub = onSnapshot(
    query(collection(db, "matches"), orderBy("matchDate", "asc")),
    (snap) => {
      state.matches = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderMaclar();
      renderSonuclar();
      renderAdmin();
      renderSiralama();
    }
  );

  // Tahminler — tüm tahminleri tek koleksiyondan dinliyoruz
  const predsUnsub = onSnapshot(collection(db, "predictions"), (snap) => {
    state.predictions = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderMaclar();
    renderSonuclar();
    renderSiralama();
  });

  unsubscribers.push(usersUnsub, matchesUnsub, predsUnsub);
}

// ---------------------------------------------------------------------
// 8) ALT NAVİGASYON — sekme geçişi (sayfa yenilenmeden)
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
// 9) "MAÇLAR" SEKMESİ — henüz bitmemiş maçlar + tahmin girişi
// ---------------------------------------------------------------------
function renderMaclar() {
  const container = document.getElementById("maclar-list");
  const emptyEl = document.getElementById("maclar-empty");
  const activeMatches = state.matches.filter((m) => !m.isFinished);

  container.innerHTML = "";
  emptyEl.classList.toggle("hidden", activeMatches.length > 0);

  activeMatches.forEach((match) => {
    const myPred = state.predictions.find((p) => p.matchId === match.id && p.uid === state.currentUser.uid);
    const card = document.createElement("div");
    card.className = "match-card";

    let bodyHtml = `
      <div class="match-card-top">
        <span class="match-datetime">${formatMatchDate(match.matchDate)}</span>
        <span class="match-status-badge ${match.isLocked ? "badge-locked" : "badge-open"}">
          ${match.isLocked ? "Kilitli" : "Tahmine Açık"}
        </span>
      </div>
      <div class="match-teams-row">
        <span class="team-name home">${escapeHtml(match.homeTeam)}</span>
        <div class="score-box-group">
          <input type="number" min="0" max="99" class="score-box pred-home" ${match.isLocked ? "disabled" : ""}
                 value="${myPred ? myPred.predHome : ""}" placeholder="-">
          <span class="score-sep">-</span>
          <input type="number" min="0" max="99" class="score-box pred-away" ${match.isLocked ? "disabled" : ""}
                 value="${myPred ? myPred.predAway : ""}" placeholder="-">
        </div>
        <span class="team-name away">${escapeHtml(match.awayTeam)}</span>
      </div>
    `;

    if (!match.isLocked) {
      bodyHtml += `
        <div class="match-card-footer">
          <button class="btn-save-pred" data-matchid="${match.id}">Tahmini Kaydet</button>
        </div>
      `;
    } else {
      // Maç kilitliyse herkesin tahminini göster
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
      uid: state.currentUser.uid,
      username: state.currentUser.username,
      predHome,
      predAway,
      points: null,       // maç bitene kadar null; admin skoru girince hesaplanır
      updatedAt: serverTimestamp()
    }, { merge: true });

    showToast("Başarıyla Kaydedildi");
  } catch (err) {
    showToast("Kaydedilemedi, tekrar dene");
  }
}

// ---------------------------------------------------------------------
// 10) "SONUÇLAR" SEKMESİ — tamamlanmış maçlar + herkesin tahmini/puanı
// ---------------------------------------------------------------------
function renderSonuclar() {
  const container = document.getElementById("sonuclar-list");
  const emptyEl = document.getElementById("sonuclar-empty");
  const finished = state.matches.filter((m) => m.isFinished);

  container.innerHTML = "";
  emptyEl.classList.toggle("hidden", finished.length > 0);

  finished.forEach((match) => {
    const preds = state.predictions.filter((p) => p.matchId === match.id);
    const card = document.createElement("div");
    card.className = "match-card";
    card.innerHTML = `
      <div class="match-card-top">
        <span class="match-datetime">${formatMatchDate(match.matchDate)}</span>
        <span class="match-status-badge badge-finished">Tamamlandı</span>
      </div>
      <div class="match-teams-row">
        <span class="team-name home">${escapeHtml(match.homeTeam)}</span>
        <span class="match-final-score">${match.homeScore} - ${match.awayScore}</span>
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

// ---------------------------------------------------------------------
// 11) "SIRALAMA" SEKMESİ — Liderlik tablosu (P, O, TS, K/B, Y, AV)
// ---------------------------------------------------------------------
function renderSiralama() {
  const tbody = document.getElementById("leaderboard-body");
  const emptyEl = document.getElementById("leaderboard-empty");
  if (!state.currentUser) return;

  const finishedMatches = state.matches.filter((m) => m.isFinished);

  const rows = state.users.map((user) => {
    let P = 0, TS = 0, KB = 0, Y = 0;
    const O = finishedMatches.length; // Oynanan maç sayısı = sonuçlanan TÜM maçlar (tahmin yapılmasa bile)

    finishedMatches.forEach((match) => {
      const pred = state.predictions.find((p) => p.matchId === match.id && p.uid === user.uid);
      if (!pred) {
        Y += 1; // tahmin yapılmadıysa otomatik yanlış/boş
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

  // Puanı en yüksek olan en üstte
  rows.sort((a, b) => b.P - a.P || parseFloat(b.AV) - parseFloat(a.AV));

  emptyEl.classList.toggle("hidden", finishedMatches.length > 0);
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

// ---------------------------------------------------------------------
// 12) "ADMIN" SEKMESİ — maç ekleme, filtre, kilitleme, skor girme
// ---------------------------------------------------------------------
document.getElementById("add-match-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const homeTeam = document.getElementById("new-home-team").value.trim();
  const awayTeam = document.getElementById("new-away-team").value.trim();
  const datetimeVal = document.getElementById("new-match-datetime").value;
  if (!homeTeam || !awayTeam || !datetimeVal) return;

  try {
    await addDoc(collection(db, "matches"), {
      homeTeam,
      awayTeam,
      matchDate: Timestamp.fromDate(new Date(datetimeVal)),
      isLocked: false,
      isFinished: false,
      homeScore: null,
      awayScore: null,
      createdAt: serverTimestamp()
    });
    e.target.reset();
    showToast("Maç eklendi");
  } catch (err) {
    showToast("Maç eklenemedi");
  }
});

// Aktif / Geçmiş filtre sekmeleri
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

  const filtered = state.adminFilter === "active"
    ? state.matches.filter((m) => !m.isFinished)
    : state.matches.filter((m) => m.isFinished);

  container.innerHTML = "";
  emptyEl.classList.toggle("hidden", filtered.length > 0);

  filtered.forEach((match) => {
    const predCount = state.predictions.filter((p) => p.matchId === match.id).length;
    const card = document.createElement("div");
    card.className = "match-card";
    card.innerHTML = `
      <div class="match-card-top">
        <span class="match-datetime">${formatMatchDate(match.matchDate)}</span>
        <span class="match-status-badge ${match.isFinished ? "badge-finished" : match.isLocked ? "badge-locked" : "badge-open"}">
          ${match.isFinished ? "Tamamlandı" : match.isLocked ? "Kilitli" : "Açık"}
        </span>
      </div>
      <div class="match-teams-row">
        <span class="team-name home">${escapeHtml(match.homeTeam)}</span>
        ${match.isFinished
          ? `<span class="match-final-score">${match.homeScore} - ${match.awayScore}</span>`
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
        ` : ``}
        <button class="btn-admin-action btn-delete" data-action="delete-match" data-matchid="${match.id}">Sil</button>
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
  container.querySelectorAll("[data-action='delete-match']").forEach((btn) => {
    btn.addEventListener("click", () => deleteMatch(btn.dataset.matchid));
  });
}

async function toggleLock(matchId, currentlyLocked) {
  await updateDoc(doc(db, "matches", matchId), { isLocked: !currentlyLocked });
  showToast(!currentlyLocked ? "Maç kilitlendi" : "Kilit açıldı");
}

async function deleteMatch(matchId) {
  if (!confirm("Bu maçı silmek istediğine emin misin? Bu işlem geri alınamaz.")) return;
  await deleteDoc(doc(db, "matches", matchId));
  showToast("Maç silindi");
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
    // 1) Maçı tamamlandı olarak işaretle + gerçek skoru kaydet
    await updateDoc(doc(db, "matches", matchId), {
      isFinished: true,
      isLocked: true,
      homeScore,
      awayScore,
      finishedAt: serverTimestamp()
    });

    // 2) Bu maça yapılmış tüm tahminlerin puanlarını topluca güncelle (batch write)
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
    showToast("Hafta kapatıldı, puanlar güncellendi");
  } catch (err) {
    showToast("Bir hata oluştu, tekrar dene");
  } finally {
    confirmBtn.disabled = false;
  }
});

// ---------------------------------------------------------------------
// 13) GÜVENLİK — basit HTML escape (kullanıcı girdilerini kart içine
//     yazarken XSS'i önlemek için)
// ---------------------------------------------------------------------
function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
