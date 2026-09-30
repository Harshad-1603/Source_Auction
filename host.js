import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getFirestore, doc, setDoc, getDoc, getDocs, updateDoc, collection,
  onSnapshot, serverTimestamp, writeBatch, runTransaction, arrayUnion, arrayRemove
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import {
  getAuth, signInAnonymously, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import { firebaseConfig } from "./firebase-config.js";
import { LOTS, SOURCE_POINTS } from "./game-data.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const $ = id => document.getElementById(id);
const money = n => `$${Number(n || 0).toLocaleString()}`;
const clampInt = (v, min, max, fallback) => {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
};

let currentUser = null;
let roomCode = null;
let room = null;
let teams = {};
let pins = {};
let submissions = {};
let unsubs = [];

function toast(msg) {
  const el = $("toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove("show"), 2200);
}

function firebaseConfigured() {
  return firebaseConfig.apiKey && !firebaseConfig.apiKey.includes("PASTE_");
}

function generateRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({length: 5}, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

function generatePin() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

function escapeHtml(v) {
  return String(v ?? "")
    .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
    .replaceAll('"',"&quot;").replaceAll("'","&#039;");
}

function renderTeamNameSetup() {
  $("teamNameSetup").innerHTML = Array.from({length: 6}, (_, i) => `
    <label>Group ${i + 1}
      <input id="teamName-${i + 1}" value="Group ${i + 1}" />
    </label>
  `).join("");
}

async function createRoom() {
  if (!currentUser) return toast("Still connecting to Firebase.");
  const startingBudget = clampInt($("startingBudget").value, 100, 100000, 1000);
  const minimumBid = clampInt($("minimumBid").value, 50, 10000, 50);
  const bidIncrement = clampInt($("bidIncrement").value, 50, 10000, 50);
  const maxSources = clampInt($("maxSources").value, 1, 6, 2);

  let code = null;
  for (let attempt = 0; attempt < 8; attempt++) {
    const candidate = generateRoomCode();
    const snap = await getDoc(doc(db, "rooms", candidate));
    if (!snap.exists()) { code = candidate; break; }
  }
  if (!code) return toast("Could not generate a unique room. Try again.");

  const roomRef = doc(db, "rooms", code);
  await setDoc(roomRef, {
    hostUid: currentUser.uid,
    createdAt: serverTimestamp(),
    status: "auction",
    startingBudget,
    minimumBid,
    bidIncrement,
    maxSources,
    currentLot: 0,
    currentBid: 0,
    highestBidder: null,
    updateLevel: 0,
    sold: {}
  });

  const batch = writeBatch(db);
  for (let i = 1; i <= 6; i++) {
    const name = $(`teamName-${i}`).value.trim() || `Group ${i}`;
    const pin = generatePin();
    batch.set(doc(db, "rooms", code, "teams", String(i)), {
      id: String(i),
      name,
      cash: startingBudget,
      sources: []
    });
    batch.set(doc(db, "rooms", code, "privatePins", String(i)), { pin });
  }
  await batch.commit();

  localStorage.setItem("sourceAuctionHostRoom", code);
  await loadHostRoom(code);
  toast(`Room ${code} created.`);
}

async function resumeRoom() {
  const saved = localStorage.getItem("sourceAuctionHostRoom");
  if (!saved) return toast("No saved host room exists in this browser.");
  await loadHostRoom(saved);
}

async function loadHostRoom(code) {
  const ref = doc(db, "rooms", code);
  const snap = await getDoc(ref);
  if (!snap.exists()) return toast("That saved room no longer exists.");
  if (snap.data().hostUid !== currentUser.uid) {
    return toast("This browser is not the host owner for that room.");
  }

  roomCode = code;
  $("hostSetup").classList.add("hidden");
  $("hostGame").classList.remove("hidden");
  $("roomBadge").classList.remove("hidden");
  $("roomBadge").textContent = `Room ${code}`;
  $("roomCodeBig").textContent = code;

  unsubs.forEach(fn => fn());
  unsubs = [];

  unsubs.push(onSnapshot(ref, snap2 => {
    room = snap2.data();
    renderAll();
  }));

  unsubs.push(onSnapshot(collection(db, "rooms", code, "teams"), snap2 => {
    teams = {};
    snap2.forEach(d => teams[d.id] = d.data());
    renderAll();
  }));

  unsubs.push(onSnapshot(collection(db, "rooms", code, "submissions"), snap2 => {
    submissions = {};
    snap2.forEach(d => submissions[d.id] = d.data());
    renderRankingHost();
    renderResults();
  }));

  const pinSnaps = await getDocs(collection(db, "rooms", code, "privatePins"));
  pins = {};
  pinSnaps.forEach(d => pins[d.id] = d.data().pin);
  renderPins();
}

function renderPins() {
  $("pinGrid").innerHTML = Object.keys(pins).sort().map(id => {
    const t = teams[id];
    return `<div class="pin-card"><span>${escapeHtml(t?.name || `Group ${id}`)}</span><strong>${escapeHtml(pins[id])}</strong></div>`;
  }).join("");
}

function renderAll() {
  if (!room) return;
  renderAuction();
  renderIntel();
  renderTrade();
  renderRankingHost();
  renderResults();
}

function renderAuction() {
  const lot = LOTS[room.currentLot || 0];
  if (!lot) return;
  $("lotBadge").textContent = `LOT ${lot.id}`;
  $("lotTitle").textContent = lot.title;
  $("lotTeaser").textContent = lot.teaser;

  const soldInfo = room.sold?.[lot.id];
  $("lotStatus").textContent = soldInfo ? `SOLD TO ${teams[soldInfo.teamId]?.name || soldInfo.teamId}` : "AVAILABLE";
  $("lotStatus").classList.toggle("sold", Boolean(soldInfo));
  $("currentBid").textContent = money(room.currentBid || 0);
  $("highestBidder").textContent = room.highestBidder ? (teams[room.highestBidder]?.name || "—") : "—";

  $("prevLotBtn").disabled = (room.currentLot || 0) <= 0;
  $("nextLotBtn").disabled = (room.currentLot || 0) >= LOTS.length - 1;
  $("soldBtn").disabled = Boolean(soldInfo) || !room.highestBidder;

  const nextBid = room.currentBid ? room.currentBid + room.bidIncrement : room.minimumBid;
  $("bidButtons").innerHTML = Object.keys(teams).sort().map(id => {
    const t = teams[id];
    const disabled = soldInfo || t.cash < nextBid || (t.sources?.length || 0) >= room.maxSources;
    return `<button class="btn btn-secondary bid-team-btn" data-bid-team="${id}" ${disabled ? "disabled" : ""}>
      <strong>${escapeHtml(t.name)}</strong>
      <span>${money(t.cash)} left · next ${money(nextBid)}</span>
    </button>`;
  }).join("");

  document.querySelectorAll("[data-bid-team]").forEach(btn => {
    btn.addEventListener("click", () => placeBid(btn.dataset.bidTeam));
  });

  renderTeamCards($("auctionTeamCards"));
}

async function placeBid(teamId) {
  const t = teams[teamId];
  const nextBid = room.currentBid ? room.currentBid + room.bidIncrement : room.minimumBid;
  if (!t || t.cash < nextBid) return toast("That team cannot afford the next bid.");
  if ((t.sources?.length || 0) >= room.maxSources) return toast("That team already owns the maximum number of sources.");
  await updateDoc(doc(db, "rooms", roomCode), {
    currentBid: nextBid,
    highestBidder: teamId
  });
}

async function changeLot(delta) {
  const next = Math.max(0, Math.min(LOTS.length - 1, (room.currentLot || 0) + delta));
  await updateDoc(doc(db, "rooms", roomCode), {
    currentLot: next,
    currentBid: 0,
    highestBidder: null
  });
}

async function sellLot() {
  const lot = LOTS[room.currentLot || 0];
  const bidder = room.highestBidder;
  const price = room.currentBid || 0;
  if (!bidder || !price) return;

  const roomRef = doc(db, "rooms", roomCode);
  const teamRef = doc(db, "rooms", roomCode, "teams", bidder);

  try {
    await runTransaction(db, async tx => {
      const rSnap = await tx.get(roomRef);
      const tSnap = await tx.get(teamRef);
      const r = rSnap.data();
      const t = tSnap.data();
      if (r.sold?.[lot.id]) throw new Error("Already sold");
      if (t.cash < price) throw new Error("Insufficient funds");
      if ((t.sources?.length || 0) >= r.maxSources) throw new Error("Max sources reached");

      const sold = { ...(r.sold || {}), [lot.id]: { teamId: bidder, price } };
      tx.update(teamRef, { cash: t.cash - price, sources: arrayUnion(lot.id) });
      tx.update(roomRef, { sold, currentBid: 0, highestBidder: null });
    });
    triggerSold();
  } catch (e) {
    toast(e.message || "Could not complete sale.");
  }
}

function triggerSold() {
  const el = $("soldOverlay");
  el.classList.add("show");
  launchConfetti();
  setTimeout(() => el.classList.remove("show"), 900);
}

function launchConfetti() {
  const colors = ["#22d3ee", "#a78bfa", "#f472b6", "#facc15", "#34d399", "#60a5fa"];
  const holder = document.createElement("div");
  holder.className = "confetti-layer";
  holder.setAttribute("aria-hidden", "true");

  for (let i = 0; i < 42; i++) {
    const piece = document.createElement("i");
    piece.className = "confetti-piece";
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.background = colors[i % colors.length];
    piece.style.setProperty("--drift", `${(Math.random() * 180) - 90}px`);
    piece.style.setProperty("--spin", `${360 + Math.random() * 720}deg`);
    piece.style.animationDelay = `${Math.random() * 0.18}s`;
    piece.style.animationDuration = `${0.9 + Math.random() * 0.75}s`;
    holder.appendChild(piece);
  }

  document.body.appendChild(holder);
  setTimeout(() => holder.remove(), 1900);
}

function renderTeamCards(container) {
  if (!container) return;
  container.innerHTML = Object.keys(teams).sort().map(id => {
    const t = teams[id];
    return `<div class="team-card">
      <div class="team-row"><strong>${escapeHtml(t.name)}</strong><span class="cash">${money(t.cash)}</span></div>
      <div class="muted">Sources: ${(t.sources || []).join(", ") || "—"}</div>
    </div>`;
  }).join("");
}

function renderIntel() {
  if (!room) return;
  $("intelGrid").innerHTML = LOTS.map(lot => {
    let info = `<p class="muted">Hidden intelligence — not yet revealed.</p>`;
    if (room.updateLevel === 1) info = `<ul>${lot.update1.map(x => `<li>${escapeHtml(x)}</li>`).join("")}</ul>`;
    if (room.updateLevel >= 2) info = `<ul>${lot.final.map(x => `<li>${escapeHtml(x)}</li>`).join("")}</ul>`;
    const owner = room.sold?.[lot.id] ? teams[room.sold[lot.id].teamId]?.name : "Unsold";
    return `<article class="intel-card source-${lot.id} ${room.updateLevel ? "revealed" : ""}">
      <div class="team-row"><strong>Lot ${lot.id}</strong><span>${escapeHtml(owner || "Unsold")}</span></div>
      <h3>${escapeHtml(lot.title)}</h3>
      ${info}
    </article>`;
  }).join("");
}

async function setUpdateLevel(level) {
  await updateDoc(doc(db, "rooms", roomCode), { updateLevel: level });
}

function teamOptions(selected="") {
  return Object.keys(teams).sort().map(id =>
    `<option value="${id}" ${String(id) === String(selected) ? "selected" : ""}>${escapeHtml(teams[id].name)}</option>`
  ).join("");
}

function sourceOptions(teamId) {
  const arr = teams[teamId]?.sources || [];
  return arr.length ? arr.map(s => `<option value="${s}">Source ${s}</option>`).join("") : `<option value="">No sources</option>`;
}

function renderTrade() {
  if (!Object.keys(teams).length) return;

  const currentVals = {
    from: $("tradeFrom").value,
    to: $("tradeTo").value,
    a: $("swapA").value,
    b: $("swapB").value
  };

  $("tradeFrom").innerHTML = teamOptions(currentVals.from);
  $("tradeTo").innerHTML = teamOptions(currentVals.to);
  $("swapA").innerHTML = teamOptions(currentVals.a);
  $("swapB").innerHTML = teamOptions(currentVals.b);

  if (!$("tradeTo").value || $("tradeTo").value === $("tradeFrom").value) {
    $("tradeTo").value = Object.keys(teams).find(x => x !== $("tradeFrom").value) || $("tradeFrom").value;
  }
  if (!$("swapB").value || $("swapB").value === $("swapA").value) {
    $("swapB").value = Object.keys(teams).find(x => x !== $("swapA").value) || $("swapA").value;
  }

  updateTradeSourceSelects();
  renderTeamCards($("tradeTeamCards"));
}

function updateTradeSourceSelects() {
  $("tradeSource").innerHTML = sourceOptions($("tradeFrom").value);
  $("swapSourceA").innerHTML = sourceOptions($("swapA").value);
  $("swapSourceB").innerHTML = sourceOptions($("swapB").value);
}

async function transferSource() {
  const fromId = $("tradeFrom").value;
  const toId = $("tradeTo").value;
  const source = $("tradeSource").value;
  const price = clampInt($("tradePrice").value, 0, 100000, 0);
  if (!source) return toast("Selling team has no source selected.");
  if (fromId === toId) return toast("Choose two different teams.");

  const from = teams[fromId], to = teams[toId];
  if (to.cash < price) return toast("Receiving team cannot afford the deal.");
  if ((to.sources?.length || 0) >= room.maxSources) return toast("Receiving team already owns the maximum number of sources.");

  const batch = writeBatch(db);
  batch.update(doc(db, "rooms", roomCode, "teams", fromId), {
    cash: from.cash + price,
    sources: arrayRemove(source)
  });
  batch.update(doc(db, "rooms", roomCode, "teams", toId), {
    cash: to.cash - price,
    sources: arrayUnion(source)
  });

  const sold = { ...(room.sold || {}) };
  if (sold[source]) sold[source].teamId = toId;
  batch.update(doc(db, "rooms", roomCode), { sold });
  await batch.commit();
  toast(`Source ${source} transferred.`);
}

async function swapSources() {
  const aId = $("swapA").value, bId = $("swapB").value;
  const aSource = $("swapSourceA").value, bSource = $("swapSourceB").value;
  if (aId === bId) return toast("Choose two different teams.");
  if (!aSource || !bSource) return toast("Both teams need a source to swap.");

  const batch = writeBatch(db);
  batch.update(doc(db, "rooms", roomCode, "teams", aId), {
    sources: arrayRemove(aSource)
  });
  batch.update(doc(db, "rooms", roomCode, "teams", bId), {
    sources: arrayRemove(bSource)
  });
  await batch.commit();

  const batch2 = writeBatch(db);
  batch2.update(doc(db, "rooms", roomCode, "teams", aId), { sources: arrayUnion(bSource) });
  batch2.update(doc(db, "rooms", roomCode, "teams", bId), { sources: arrayUnion(aSource) });

  const sold = { ...(room.sold || {}) };
  if (sold[aSource]) sold[aSource].teamId = bId;
  if (sold[bSource]) sold[bSource].teamId = aId;
  batch2.update(doc(db, "rooms", roomCode), { sold });
  await batch2.commit();
  toast("Sources swapped.");
}

async function openRanking() {
  await updateDoc(doc(db, "rooms", roomCode), {
    status: "ranking",
    updateLevel: 2
  });
  toast("Ranking is now open on all joined team devices.");
}

async function closeRanking() {
  await updateDoc(doc(db, "rooms", roomCode), { status: "results" });
  toast("Ranking closed.");
}

function renderRankingHost() {
  if (!room) return;
  const statusText = room.status === "ranking"
    ? "🟢 Ranking is OPEN. Teams can submit from their devices."
    : room.status === "results"
      ? "🔒 Ranking is CLOSED."
      : "⏳ Ranking is not open yet.";
  $("rankingStatusBanner").textContent = statusText;

  $("submissionGrid").innerHTML = Object.keys(teams).sort().map(id => {
    const s = submissions[id];
    return `<div class="submission-card ${s ? "submitted" : ""}">
      <strong>${escapeHtml(teams[id].name)}</strong>
      <span>${s ? "✅ Submitted" : "Waiting…"}</span>
      <div class="submission-order">${s ? escapeHtml(s.ranking.split("").join(" → ")) : "—"}</div>
    </div>`;
  }).join("");
}

function rankingBonus(ranking) {
  if (!ranking || ranking.length !== 6 || new Set(ranking).size !== 6) return 0;
  let b = 0;
  if (ranking.slice(0,3) === "ABC") b += 3;
  if (ranking[0] === "A") b += 1;
  if (ranking[5] === "F") b += 1;
  return b;
}

function renderResults() {
  if (!Object.keys(teams).length) return;
  const rows = Object.keys(teams).map(id => {
    const t = teams[id];
    const sourcePts = (t.sources || []).reduce((sum, s) => sum + (SOURCE_POINTS[s] || 0), 0);
    const cashBonus = Math.min(5, Math.floor((t.cash || 0) / 100));
    const ranking = submissions[id]?.ranking || "";
    const rankBonus = rankingBonus(ranking);
    return { id, t, sourcePts, cashBonus, ranking, rankBonus, total: sourcePts + cashBonus + rankBonus };
  }).sort((a,b) => b.total - a.total || b.t.cash - a.t.cash);

  $("resultsWrap").innerHTML = `<div class="table-scroll"><table class="results-table">
    <thead><tr>
      <th>Place</th><th>Team</th><th>Sources</th><th>Cash</th><th>Ranking</th>
      <th>Source pts</th><th>Cash bonus</th><th>Rank bonus</th><th>Total</th>
    </tr></thead>
    <tbody>${rows.map((r,i) => `<tr>
      <td>${i+1}</td>
      <td><strong>${escapeHtml(r.t.name)}</strong></td>
      <td>${escapeHtml((r.t.sources || []).join(", ") || "—")}</td>
      <td>${money(r.t.cash)}</td>
      <td>${r.ranking ? escapeHtml(r.ranking.split("").join("→")) : "Not submitted"}</td>
      <td>${r.sourcePts}</td><td>${r.cashBonus}</td><td>${r.rankBonus}</td><td><strong>${r.total}</strong></td>
    </tr>`).join("")}</tbody>
  </table></div>`;

  const completed = rows.filter(r => r.ranking).length;
  if (!completed) {
    $("winnerBanner").textContent = "Waiting for team rankings…";
  } else {
    const max = rows[0].total;
    const winners = rows.filter(r => r.total === max).map(r => r.t.name);
    $("winnerBanner").textContent = winners.length === 1
      ? `🏆 ${winners[0]} lead with ${max} points`
      : `🏆 Tie: ${winners.join(" & ")} with ${max} points`;
  }
}

function setHostTab(name) {
  document.querySelectorAll(".host-tab-view").forEach(v => v.classList.remove("active"));
  document.querySelectorAll("[data-host-tab]").forEach(b => b.classList.remove("active"));
  $(`host-${name}`).classList.add("active");
  document.querySelector(`[data-host-tab="${name}"]`).classList.add("active");
}

function wireEvents() {
  $("createRoomBtn").addEventListener("click", createRoom);
  $("resumeRoomBtn").addEventListener("click", resumeRoom);
  $("prevLotBtn").addEventListener("click", () => changeLot(-1));
  $("nextLotBtn").addEventListener("click", () => changeLot(1));
  $("soldBtn").addEventListener("click", sellLot);
  $("update1Btn").addEventListener("click", () => setUpdateLevel(1));
  $("finalIntelBtn").addEventListener("click", () => setUpdateLevel(2));

  ["tradeFrom","swapA","swapB"].forEach(id => $(id).addEventListener("change", updateTradeSourceSelects));
  $("transferBtn").addEventListener("click", transferSource);
  $("swapBtn").addEventListener("click", swapSources);

  $("openRankingBtn").addEventListener("click", openRanking);
  $("closeRankingBtn").addEventListener("click", closeRanking);
  $("toggleSuggestedBtn").addEventListener("click", () => $("suggestedRankingHost").classList.toggle("hidden"));
  $("recalculateBtn").addEventListener("click", renderResults);

  document.querySelectorAll("[data-host-tab]").forEach(btn =>
    btn.addEventListener("click", () => setHostTab(btn.dataset.hostTab))
  );
}

renderTeamNameSetup();
wireEvents();

if (!firebaseConfigured()) {
  $("connectionBadge").textContent = "Firebase not configured";
  $("connectionBadge").classList.add("error");
  $("setupMessage").textContent = "Open firebase-config.js and paste your Firebase Web App config first. See README.md.";
  $("createRoomBtn").disabled = true;
  $("resumeRoomBtn").disabled = true;
} else {
  signInAnonymously(auth).catch(err => {
    $("connectionBadge").textContent = "Connection failed";
    $("setupMessage").textContent = err.message;
  });

  onAuthStateChanged(auth, user => {
    if (!user) return;
    currentUser = user;
    $("connectionBadge").textContent = "Firebase connected";
    $("connectionBadge").classList.add("success");
  });
}
