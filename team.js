import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getFirestore, doc, getDoc, setDoc, onSnapshot, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import {
  getAuth, signInAnonymously, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import { firebaseConfig } from "./firebase-config.js";
import { LOTS } from "./game-data.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const $ = id => document.getElementById(id);
let user = null;
let roomCode = null;
let teamId = null;
let roomUnsub = null;
let teamUnsub = null;
let currentRoom = null;
let currentTeam = null;
let ranking = ["A","B","C","D","E","F"];
let submitted = false;

function toast(msg) {
  const el = $("teamToast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove("show"), 2200);
}

function firebaseConfigured() {
  return firebaseConfig.apiKey && !firebaseConfig.apiKey.includes("PASTE_");
}

function escapeHtml(v) {
  return String(v ?? "")
    .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
    .replaceAll('"',"&quot;").replaceAll("'","&#039;");
}

async function joinRoom() {
  if (!user) return toast("Still connecting.");
  const code = $("joinRoomCode").value.trim().toUpperCase();
  const selectedTeam = $("joinTeamId").value;
  const pin = $("joinPin").value.trim();

  if (!/^[A-Z2-9]{5}$/.test(code)) {
    $("joinMessage").textContent = "Enter the 5-character room code shown by the facilitator.";
    return;
  }
  if (!/^\d{4}$/.test(pin)) {
    $("joinMessage").textContent = "Enter your 4-digit team PIN.";
    return;
  }

  const roomSnap = await getDoc(doc(db, "rooms", code));
  if (!roomSnap.exists()) {
    $("joinMessage").textContent = "Room not found. Check the code.";
    return;
  }

  const teamSnap = await getDoc(doc(db, "rooms", code, "teams", selectedTeam));
  if (!teamSnap.exists()) {
    $("joinMessage").textContent = "That team does not exist in this room.";
    return;
  }

  try {
    await setDoc(doc(db, "rooms", code, "joins", user.uid), {
      uid: user.uid,
      teamId: selectedTeam,
      pin,
      joinedAt: serverTimestamp()
    });

    roomCode = code;
    teamId = selectedTeam;
    localStorage.setItem("sourceAuctionTeamSession", JSON.stringify({roomCode, teamId}));
    $("joinPanel").classList.add("hidden");
    $("teamRoom").classList.remove("hidden");
    subscribeToRoom();
  } catch (err) {
    console.error(err);
    $("joinMessage").textContent = "Could not join. Check your team PIN.";
  }
}

function subscribeToRoom() {
  if (roomUnsub) roomUnsub();
  if (teamUnsub) teamUnsub();

  roomUnsub = onSnapshot(doc(db, "rooms", roomCode), snap => {
    if (!snap.exists()) return;
    currentRoom = snap.data();
    updateTeamScreen();
  });

  teamUnsub = onSnapshot(doc(db, "rooms", roomCode, "teams", teamId), snap => {
    if (!snap.exists()) return;
    currentTeam = snap.data();
    $("joinedTeamName").textContent = currentTeam.name;
    $("joinedRoomCode").textContent = roomCode;
    updatePortfolio();
  });
}

function updatePortfolio() {
  if (!currentTeam) return;
  $("teamPortfolio").innerHTML = `
    <strong>Your current portfolio</strong>
    <div>Sources: ${escapeHtml((currentTeam.sources || []).join(", ") || "None yet")}</div>
    <div>Cash remaining: $${Number(currentTeam.cash || 0).toLocaleString()}</div>
  `;
}

function updateTeamScreen() {
  if (!currentRoom || submitted) return;
  $("waitingPanel").classList.add("hidden");
  $("rankingPanel").classList.add("hidden");
  $("closedPanel").classList.add("hidden");

  if (currentRoom.status === "ranking") {
    $("rankingPanel").classList.remove("hidden");
    renderRanking();
  } else if (currentRoom.status === "results") {
    $("closedPanel").classList.remove("hidden");
  } else {
    $("waitingPanel").classList.remove("hidden");
    $("waitingTitle").textContent = currentRoom.updateLevel >= 2 ? "Trading / debrief in progress" : "Auction in progress";
    $("waitingText").textContent = "Keep this page open. The final ranking screen will appear automatically when your facilitator opens it.";
  }
}

function renderRanking() {
  $("rankingList").innerHTML = ranking.map((id, index) => {
    const lot = LOTS.find(x => x.id === id);
    const details = lot.final.map(x => `<li>${escapeHtml(x)}</li>`).join("");
    return `<article class="rank-item source-${id}" data-source="${id}">`
      <div class="rank-position">${index + 1}</div>
      <div class="rank-copy">
        <div class="team-row">
          <strong>Source ${id}</strong>
          <span class="source-badge">${index === 0 ? "STRONGEST" : index === ranking.length - 1 ? "WEAKEST" : ""}</span>
        </div>
        <h3>${escapeHtml(lot.title)}</h3>
        <ul>${details}</ul>
      </div>
      <div class="rank-controls">
        <button class="btn btn-secondary arrow-btn" data-up="${index}" ${index === 0 ? "disabled" : ""}>↑</button>
        <button class="btn btn-secondary arrow-btn" data-down="${index}" ${index === ranking.length - 1 ? "disabled" : ""}>↓</button>
      </div>
    </article>`;
  }).join("");

  document.querySelectorAll("[data-up]").forEach(btn => btn.addEventListener("click", () => moveRank(Number(btn.dataset.up), -1)));
  document.querySelectorAll("[data-down]").forEach(btn => btn.addEventListener("click", () => moveRank(Number(btn.dataset.down), 1)));
}

function moveRank(index, delta) {
  const other = index + delta;
  if (other < 0 || other >= ranking.length) return;
  [ranking[index], ranking[other]] = [ranking[other], ranking[index]];
  renderRanking();
}

async function submitRanking() {
  if (!user || !roomCode || !teamId) return;
  const order = ranking.join("");
  if (!confirm(`Submit final ranking ${ranking.join(" → ")} for your group? This will lock your submission.`)) return;

  try {
    await setDoc(doc(db, "rooms", roomCode, "submissions", teamId), {
      uid: user.uid,
      teamId,
      ranking: order,
      submittedAt: serverTimestamp()
    });
    submitted = true;
    $("rankingPanel").classList.add("hidden");
    $("waitingPanel").classList.add("hidden");
    $("closedPanel").classList.add("hidden");
    $("submittedPanel").classList.remove("hidden");
    $("submittedOrder").textContent = ranking.join(" → ");
    localStorage.setItem(`sourceAuctionSubmitted-${roomCode}-${teamId}`, order);
  } catch (err) {
    console.error(err);
    $("rankingMessage").textContent = "Submission failed. Ranking may be closed, or this team may already have submitted from another device.";
  }
}

function leaveRoom() {
  localStorage.removeItem("sourceAuctionTeamSession");
  if (roomUnsub) roomUnsub();
  if (teamUnsub) teamUnsub();
  roomCode = null;
  teamId = null;
  currentRoom = null;
  currentTeam = null;
  submitted = false;
  $("teamRoom").classList.add("hidden");
  $("joinPanel").classList.remove("hidden");
}

$("joinRoomBtn").addEventListener("click", joinRoom);
$("submitRankingBtn").addEventListener("click", submitRanking);
$("leaveRoomBtn").addEventListener("click", leaveRoom);

if (!firebaseConfigured()) {
  $("teamConnectionBadge").textContent = "Firebase not configured";
  $("teamConnectionBadge").classList.add("error");
  $("joinMessage").textContent = "The host must configure Firebase first. See README.md.";
  $("joinRoomBtn").disabled = true;
} else {
  signInAnonymously(auth).catch(err => {
    $("teamConnectionBadge").textContent = "Connection failed";
    $("joinMessage").textContent = err.message;
  });

  onAuthStateChanged(auth, u => {
    if (!u) return;
    user = u;
    $("teamConnectionBadge").textContent = "Connected";
    $("teamConnectionBadge").classList.add("success");
  });
}
