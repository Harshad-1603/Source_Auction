(() => {
  const SOURCE_POINTS = { A: 12, B: 10, C: 8, D: 6, E: 3, F: 1 };
  const SUGGESTED = ["A", "B", "C", "D", "E", "F"];

  const lots = [
    {
      id: "A",
      title: "A recent study on your engineering topic",
      teaser: "A recently published study investigating a technology directly related to an engineering project.",
      update1: [
        "Peer-reviewed journal article",
        "Published in 2026",
        "Directly relevant to the research question"
      ],
      final: [
        "Peer reviewed",
        "Published in 2026",
        "Clear methodology and references",
        "Highly relevant to the research question"
      ]
    },
    {
      id: "B",
      title: "Australian technical data relevant to your project",
      teaser: "A technical source containing Australian data connected to your engineering research area.",
      update1: [
        "Produced by an Australian Government agency",
        "Published in 2025"
      ],
      final: [
        "Australian Government technical report",
        "Transparent data-collection method",
        "Published in 2025",
        "Relevant to the project"
      ]
    },
    {
      id: "C",
      title: "Research presented at a major engineering conference",
      teaser: "A recent technical paper presented to an academic engineering audience.",
      update1: [
        "Academic conference paper",
        "Published in 2026",
        "Findings are still preliminary"
      ],
      final: [
        "Recent academic conference paper",
        "Published in 2026",
        "Very recent research",
        "Findings are still preliminary"
      ]
    },
    {
      id: "D",
      title: "Detailed technical testing of a new technology",
      teaser: "A detailed report presenting test results for a new engineering technology.",
      update1: [
        "Includes detailed technical testing",
        "Uses external references"
      ],
      final: [
        "Company technical white paper",
        "Produced by the company selling the technology",
        "Contains detailed testing data",
        "Commercial interest may create bias"
      ]
    },
    {
      id: "E",
      title: "A detailed overview with dozens of references",
      teaser: "A broad overview of the topic containing links and references to many other sources.",
      update1: [
        "Recently updated",
        "Contains many academic and government references"
      ],
      final: [
        "Wikipedia article",
        "Recently updated",
        "Contains many academic and government references",
        "Can be edited by users"
      ]
    },
    {
      id: "F",
      title: "An article strongly supporting a new engineering solution",
      teaser: "An online article making confident claims about the benefits of a proposed engineering solution.",
      update1: [
        "Author qualifications are unclear"
      ],
      final: [
        "Personal blog",
        "No clear academic qualifications",
        "No references",
        "Strong claims are presented without evidence"
      ]
    }
  ];

  let state = {
    startingBudget: 1000,
    minimumBid: 50,
    bidIncrement: 50,
    maxSources: 2,
    currentLotIndex: 0,
    currentBid: 0,
    highestBidder: null,
    updateLevel: 0,
    teams: Array.from({ length: 6 }, (_, i) => ({
      id: i,
      name: `Group ${i + 1}`,
      cash: 1000,
      sources: [],
      ranking: ""
    })),
    sold: {}
  };

  const $ = (id) => document.getElementById(id);
  const money = (n) => `$${Math.max(0, Number(n) || 0).toLocaleString()}`;

  let timerSeconds = 60;
  let timerHandle = null;

  function toast(message) {
    const el = $("toast");
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove("show"), 2300);
  }

  function showScreen(id) {
    document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    $(id).classList.add("active");
    document.querySelector(`.tab[data-screen="${id}"]`).classList.add("active");
    if (id === "auction") renderAuction();
    if (id === "updates") renderIntel();
    if (id === "trading") renderTrading();
    if (id === "ranking") renderRankings();
    if (id === "results") renderResults();
  }

  document.querySelectorAll(".tab").forEach(btn => {
    btn.addEventListener("click", () => showScreen(btn.dataset.screen));
  });

  function renderSetup() {
    $("startingBudget").value = state.startingBudget;
    $("minimumBid").value = state.minimumBid;
    $("bidIncrement").value = state.bidIncrement;
    $("maxSources").value = state.maxSources;

    const wrap = $("teamSetup");
    wrap.innerHTML = "";
    state.teams.forEach(team => {
      const div = document.createElement("div");
      div.className = "team-input";
      div.innerHTML = `
        <label>Team ${team.id + 1} name
          <input data-team-name="${team.id}" value="${escapeHtml(team.name)}" />
        </label>
      `;
      wrap.appendChild(div);
    });
  }

  function saveSetup() {
    state.startingBudget = clampInt($("startingBudget").value, 100, 100000, 1000);
    state.minimumBid = clampInt($("minimumBid").value, 10, 10000, 50);
    state.bidIncrement = clampInt($("bidIncrement").value, 10, 10000, 50);
    state.maxSources = clampInt($("maxSources").value, 1, 6, 2);
    document.querySelectorAll("[data-team-name]").forEach(input => {
      const id = Number(input.dataset.teamName);
      state.teams[id].name = input.value.trim() || `Group ${id + 1}`;
      if (state.teams[id].sources.length === 0) state.teams[id].cash = state.startingBudget;
    });
    showScreen("auction");
    toast("Setup saved. Auction is ready.");
  }

  function clampInt(value, min, max, fallback) {
    const n = Math.floor(Number(value));
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
  }

  function currentLot() { return lots[state.currentLotIndex]; }

  function renderAuction() {
    const lot = currentLot();
    $("lotBadge").textContent = `LOT ${lot.id}`;
    $("lotTitle").textContent = lot.title;
    $("lotTeaser").textContent = lot.teaser;

    const soldInfo = state.sold[lot.id];
    const isSold = Boolean(soldInfo);
    $("lotStatus").textContent = isSold ? `SOLD TO ${state.teams[soldInfo.teamId].name}` : "AVAILABLE";
    $("lotStatus").classList.toggle("sold", isSold);

    $("currentBid").textContent = money(state.currentBid);
    $("highestBidder").textContent = state.highestBidder === null ? "—" : state.teams[state.highestBidder].name;

    $("soldBtn").disabled = isSold || state.highestBidder === null;
    $("plusBidBtn").disabled = isSold;
    $("minusBidBtn").disabled = isSold || state.currentBid <= 0;

    const bids = $("bidTeamButtons");
    bids.innerHTML = "";
    state.teams.forEach(team => {
      const btn = document.createElement("button");
      btn.className = "btn btn-secondary";
      const ownsMax = team.sources.length >= state.maxSources;
      const nextBid = state.currentBid === 0 ? state.minimumBid : state.currentBid + state.bidIncrement;
      const cannotAfford = team.cash < nextBid;
      btn.disabled = isSold || ownsMax || cannotAfford;
      btn.innerHTML = `${escapeHtml(team.name)}<span>${money(team.cash)} left · ${team.sources.length}/${state.maxSources} sources</span>`;
      btn.addEventListener("click", () => placeBid(team.id));
      bids.appendChild(btn);
    });

    $("prevLotBtn").disabled = state.currentLotIndex === 0;
    $("nextLotBtn").disabled = state.currentLotIndex === lots.length - 1;

    renderTeamCards($("auctionTeams"));
  }

  function placeBid(teamId) {
    const lot = currentLot();
    if (state.sold[lot.id]) return;

    const team = state.teams[teamId];
    if (team.sources.length >= state.maxSources) {
      toast(`${team.name} already owns the maximum number of sources.`);
      return;
    }

    const nextBid = state.currentBid === 0 ? state.minimumBid : state.currentBid + state.bidIncrement;
    if (team.cash < nextBid) {
      toast(`${team.name} cannot afford ${money(nextBid)}.`);
      return;
    }

    state.currentBid = nextBid;
    state.highestBidder = teamId;
    renderAuction();
  }

  function adjustBid(delta) {
    if (state.sold[currentLot().id]) return;
    const next = Math.max(0, state.currentBid + delta);
    state.currentBid = next;
    if (next === 0) state.highestBidder = null;
    renderAuction();
  }

  function sellCurrentLot() {
    const lot = currentLot();
    if (state.sold[lot.id] || state.highestBidder === null) return;
    const team = state.teams[state.highestBidder];
    if (team.cash < state.currentBid) {
      toast("Highest bidder no longer has enough cash.");
      return;
    }
    if (team.sources.length >= state.maxSources) {
      toast("Highest bidder already owns the maximum number of sources.");
      return;
    }

    team.cash -= state.currentBid;
    team.sources.push(lot.id);
    state.sold[lot.id] = { teamId: team.id, price: state.currentBid };
    triggerSold();
    toast(`${lot.id} sold to ${team.name} for ${money(state.currentBid)}.`);
    state.currentBid = 0;
    state.highestBidder = null;
    renderAuction();
  }

  function triggerSold() {
    const overlay = $("soldOverlay");
    overlay.classList.add("show");
    setTimeout(() => overlay.classList.remove("show"), 850);
  }

  function goLot(direction) {
    state.currentLotIndex = Math.min(lots.length - 1, Math.max(0, state.currentLotIndex + direction));
    state.currentBid = 0;
    state.highestBidder = null;
    renderAuction();
  }

  function renderTeamCards(container) {
    container.innerHTML = "";
    state.teams.forEach(team => {
      const div = document.createElement("div");
      div.className = "team-card";
      div.innerHTML = `
        <div class="team-card-row">
          <span class="team-name">${escapeHtml(team.name)}</span>
          <span class="cash">${money(team.cash)}</span>
        </div>
        <div class="owned">Sources: ${team.sources.length ? team.sources.join(", ") : "—"}</div>
      `;
      container.appendChild(div);
    });
  }

  function renderIntel() {
    const grid = $("sourceIntelGrid");
    grid.innerHTML = "";
    lots.forEach(lot => {
      const card = document.createElement("div");
      card.className = `intel-card ${state.updateLevel > 0 ? "revealed" : ""}`;
      let content = `<p class="locked">Hidden intelligence — not yet revealed.</p>`;
      if (state.updateLevel === 1) {
        content = `<ul>${lot.update1.map(x => `<li>${escapeHtml(x)}</li>`).join("")}</ul>`;
      }
      if (state.updateLevel >= 2) {
        content = `<ul>${lot.final.map(x => `<li>${escapeHtml(x)}</li>`).join("")}</ul>`;
      }
      const owner = state.sold[lot.id] ? state.teams[state.sold[lot.id].teamId].name : "Unsold";
      card.innerHTML = `
        <h3><span>Lot ${lot.id}</span><span>${escapeHtml(owner)}</span></h3>
        <p>${escapeHtml(lot.title)}</p>
        ${content}
      `;
      grid.appendChild(card);
    });

    $("marketBanner").textContent =
      state.updateLevel === 0 ? "MARKET OPEN — hidden information can change the value of a source." :
      state.updateLevel === 1 ? "MARKET UPDATE #1 — teams may regret earlier bids." :
      "FINAL INTELLIGENCE — all source identities and limitations are now visible.";
  }

  function revealUpdate(level) {
    state.updateLevel = Math.max(state.updateLevel, level);
    renderIntel();
    toast(level === 1 ? "Market Update #1 revealed." : "Final source intelligence revealed.");
  }

  function renderTrading() {
    populateTeamSelects();
    updateTradeSourceOptions();
    renderTeamCards($("tradingTeams"));
  }

  function populateTeamSelects() {
    ["tradeFromTeam", "tradeToTeam", "swapTeamA", "swapTeamB"].forEach(id => {
      const sel = $(id);
      const prev = sel.value;
      sel.innerHTML = state.teams.map(t => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join("");
      if ([...sel.options].some(o => o.value === prev)) sel.value = prev;
    });
    if ($("tradeToTeam").options.length > 1 && $("tradeToTeam").value === $("tradeFromTeam").value) {
      $("tradeToTeam").selectedIndex = 1;
    }
    if ($("swapTeamB").options.length > 1 && $("swapTeamB").value === $("swapTeamA").value) {
      $("swapTeamB").selectedIndex = 1;
    }
  }

  function sourceOptionsForTeam(teamId) {
    const team = state.teams[Number(teamId)];
    return team.sources.map(s => `<option value="${s}">Source ${s}</option>`).join("");
  }

  function updateTradeSourceOptions() {
    $("tradeSource").innerHTML = sourceOptionsForTeam($("tradeFromTeam").value) || `<option value="">No sources</option>`;
    $("swapSourceA").innerHTML = sourceOptionsForTeam($("swapTeamA").value) || `<option value="">No sources</option>`;
    $("swapSourceB").innerHTML = sourceOptionsForTeam($("swapTeamB").value) || `<option value="">No sources</option>`;
  }

  function executeTransfer() {
    const fromId = Number($("tradeFromTeam").value);
    const toId = Number($("tradeToTeam").value);
    const source = $("tradeSource").value;
    const price = Math.max(0, clampInt($("tradePrice").value, 0, 100000, 0));

    if (fromId === toId) return toast("Choose two different teams.");
    if (!source) return toast("The selling team does not own a source.");
    const from = state.teams[fromId], to = state.teams[toId];
    if (!from.sources.includes(source)) return toast("Source ownership changed. Refresh the trade selection.");
    if (to.sources.length >= state.maxSources) return toast(`${to.name} already owns the maximum number of sources.`);
    if (to.cash < price) return toast(`${to.name} cannot afford that trade.`);

    from.sources = from.sources.filter(s => s !== source);
    to.sources.push(source);
    to.cash -= price;
    from.cash += price;

    if (state.sold[source]) state.sold[source].teamId = toId;

    toast(`Source ${source} transferred from ${from.name} to ${to.name}${price ? ` for ${money(price)}` : ""}.`);
    renderTrading();
  }

  function executeSwap() {
    const aId = Number($("swapTeamA").value);
    const bId = Number($("swapTeamB").value);
    const aSource = $("swapSourceA").value;
    const bSource = $("swapSourceB").value;
    if (aId === bId) return toast("Choose two different teams.");
    if (!aSource || !bSource) return toast("Both teams need a source to swap.");
    const a = state.teams[aId], b = state.teams[bId];
    if (!a.sources.includes(aSource) || !b.sources.includes(bSource)) return toast("Source ownership changed. Refresh selections.");

    a.sources = a.sources.filter(s => s !== aSource);
    b.sources = b.sources.filter(s => s !== bSource);
    a.sources.push(bSource);
    b.sources.push(aSource);
    if (state.sold[aSource]) state.sold[aSource].teamId = bId;
    if (state.sold[bSource]) state.sold[bSource].teamId = aId;
    toast(`${a.name} and ${b.name} swapped Source ${aSource} and Source ${bSource}.`);
    renderTrading();
  }

  function renderRankings() {
    const wrap = $("rankingForms");
    wrap.innerHTML = "";
    state.teams.forEach(team => {
      const card = document.createElement("div");
      card.className = "ranking-card";
      card.innerHTML = `
        <h3>${escapeHtml(team.name)}</h3>
        <label>Strongest → weakest
          <input maxlength="6" data-rank-input="${team.id}" value="${escapeHtml(team.ranking)}" placeholder="ABCDEF" />
        </label>
        <div class="rank-feedback" id="rankFeedback-${team.id}"></div>
      `;
      wrap.appendChild(card);
    });

    document.querySelectorAll("[data-rank-input]").forEach(input => {
      input.addEventListener("input", () => {
        input.value = input.value.toUpperCase().replace(/[^A-F]/g, "").slice(0, 6);
        const teamId = Number(input.dataset.rankInput);
        state.teams[teamId].ranking = input.value;
        validateRankingInput(teamId);
      });
      validateRankingInput(Number(input.dataset.rankInput));
    });
  }

  function validateRankingInput(teamId) {
    const value = state.teams[teamId].ranking;
    const feedback = $(`rankFeedback-${teamId}`);
    if (!feedback) return;
    if (!value) { feedback.textContent = ""; return; }
    const chars = value.split("");
    const valid = value.length === 6 && new Set(chars).size === 6 && chars.every(c => SUGGESTED.includes(c));
    feedback.style.color = valid ? "#86efac" : "#fca5a5";
    feedback.textContent = valid ? "Ranking saved." : "Use A–F exactly once, e.g. ABCDEF.";
  }

  function rankingBonus(ranking) {
    if (!ranking || ranking.length !== 6 || new Set(ranking).size !== 6) return 0;
    let bonus = 0;
    if (ranking.slice(0, 3) === "ABC") bonus += 3;
    if (ranking[0] === "A") bonus += 1;
    if (ranking[5] === "F") bonus += 1;
    return bonus;
  }

  function renderResults() {
    const rows = state.teams.map(team => {
      const sourceScore = team.sources.reduce((sum, s) => sum + (SOURCE_POINTS[s] || 0), 0);
      const cashBonus = Math.min(5, Math.floor(team.cash / 100));
      const rankBonus = rankingBonus(team.ranking);
      const total = sourceScore + cashBonus + rankBonus;
      return { team, sourceScore, cashBonus, rankBonus, total };
    }).sort((a, b) => b.total - a.total || b.team.cash - a.team.cash);

    const wrap = $("resultsTableWrap");
    wrap.innerHTML = `
      <div style="overflow-x:auto">
        <table class="results-table">
          <thead>
            <tr>
              <th>Place</th>
              <th>Team</th>
              <th>Sources</th>
              <th>Cash left</th>
              <th>Source pts</th>
              <th>Cash bonus</th>
              <th>Ranking bonus</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((r, i) => `
              <tr>
                <td>${i + 1}</td>
                <td><strong>${escapeHtml(r.team.name)}</strong></td>
                <td>${r.team.sources.length ? r.team.sources.join(", ") : "—"}</td>
                <td>${money(r.team.cash)}</td>
                <td>${r.sourceScore}</td>
                <td>${r.cashBonus}</td>
                <td>${r.rankBonus}</td>
                <td><strong>${r.total}</strong></td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;

    if (rows.length) {
      const max = rows[0].total;
      const winners = rows.filter(r => r.total === max).map(r => r.team.name);
      $("winnerBanner").textContent = winners.length === 1
        ? `🏆 ${winners[0]} are the Research Investment Champions with ${max} points!`
        : `🏆 Tie: ${winners.join(" & ")} with ${max} points!`;
    }
  }

  function resetWholeGame() {
    const names = state.teams.map(t => t.name);
    state = {
      startingBudget: 1000,
      minimumBid: 50,
      bidIncrement: 50,
      maxSources: 2,
      currentLotIndex: 0,
      currentBid: 0,
      highestBidder: null,
      updateLevel: 0,
      teams: Array.from({ length: 6 }, (_, i) => ({
        id: i,
        name: names[i] || `Group ${i + 1}`,
        cash: 1000,
        sources: [],
        ranking: ""
      })),
      sold: {}
    };
    renderSetup();
    renderAuction();
    renderIntel();
    renderTrading();
    renderRankings();
    renderResults();
    toast("Game reset.");
  }

  function updateTimerDisplay() {
    const m = String(Math.floor(timerSeconds / 60)).padStart(2, "0");
    const s = String(timerSeconds % 60).padStart(2, "0");
    $("timerDisplay").textContent = `${m}:${s}`;
  }

  function startTimer(seconds = null) {
    if (Number.isFinite(seconds)) {
      timerSeconds = seconds;
      updateTimerDisplay();
    }
    if (timerHandle) return;
    timerHandle = setInterval(() => {
      timerSeconds = Math.max(0, timerSeconds - 1);
      updateTimerDisplay();
      if (timerSeconds <= 0) {
        clearInterval(timerHandle);
        timerHandle = null;
        toast("Time!");
      }
    }, 1000);
  }

  function pauseTimer() {
    clearInterval(timerHandle);
    timerHandle = null;
  }

  function resetTimer(seconds = 60) {
    pauseTimer();
    timerSeconds = seconds;
    updateTimerDisplay();
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  $("saveSetupBtn").addEventListener("click", saveSetup);
  $("resetGameBtn").addEventListener("click", () => {
    if (confirm("Reset all bids, ownership, trades, rankings and scores?")) resetWholeGame();
  });

  $("plusBidBtn").addEventListener("click", () => adjustBid(state.bidIncrement));
  $("minusBidBtn").addEventListener("click", () => adjustBid(-state.bidIncrement));
  $("soldBtn").addEventListener("click", sellCurrentLot);
  $("prevLotBtn").addEventListener("click", () => goLot(-1));
  $("nextLotBtn").addEventListener("click", () => goLot(1));

  $("revealUpdate1Btn").addEventListener("click", () => revealUpdate(1));
  $("revealFinalBtn").addEventListener("click", () => revealUpdate(2));

  ["tradeFromTeam", "swapTeamA", "swapTeamB"].forEach(id => {
    $(id).addEventListener("change", updateTradeSourceOptions);
  });
  $("executeTransferBtn").addEventListener("click", executeTransfer);
  $("executeSwapBtn").addEventListener("click", executeSwap);
  $("startTradingTimerBtn").addEventListener("click", () => startTimer(60));

  $("showSuggestedBtn").addEventListener("click", () => $("suggestedRanking").classList.toggle("hidden"));
  $("recalculateBtn").addEventListener("click", renderResults);

  $("timerStartBtn").addEventListener("click", () => startTimer());
  $("timerPauseBtn").addEventListener("click", pauseTimer);
  $("timerResetBtn").addEventListener("click", () => resetTimer(60));

  renderSetup();
  renderAuction();
  renderIntel();
  renderTrading();
  renderRankings();
  renderResults();
  updateTimerDisplay();
})();
