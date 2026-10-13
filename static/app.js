(() => {
  const NS = "http://www.w3.org/2000/svg";
  const CX = 360, CY = 285, R = 185, NR = 46;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $ = s => document.querySelector(s);
  const svg = $("#stage");
  let state = null, busy = false, timer = null, pos = {}, geometry = {}, idKey = "";

  const money = n => "$" + n;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"}[c]));

  function toast(msg) {
    const el = document.createElement("div");
    el.className = "toast align-items-center text-bg-dark border-0";
    el.setAttribute("role", "alert");
    el.innerHTML = `<div class="d-flex"><div class="toast-body">${esc(msg)}</div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button></div>`;
    $("#toasts").appendChild(el);
    new bootstrap.Toast(el, {delay: 3500}).show();
    el.addEventListener("hidden.bs.toast", () => el.remove());
  }

  async function api(path, body) {
    try {
      const res = await fetch(path, {
        method: body === undefined ? "GET" : "POST",
        headers: {"Content-Type": "application/json"},
        body: body === undefined ? undefined : JSON.stringify(body)
      });
      const data = await res.json();
      if (!data.ok) toast(data.error || "Something went wrong.");
      if (data.state) { state = data.state; render(); }
      return data;
    } catch (e) {
      toast("Could not reach the server. Is app.py still running?");
      stopAuto();
    }
  }

  /* ---------- geometry ---------- */
  function layout() {
    const n = state.processes.length;
    pos = {}; geometry = {};
    state.processes.forEach((p, i) => {
      const a = -Math.PI / 2 + i * 2 * Math.PI / n;
      pos[p.id] = {x: CX + R * Math.cos(a), y: CY + R * Math.sin(a), ux: Math.cos(a), uy: Math.sin(a)};
    });
    state.channels.forEach(c => { geometry[c.src + ">" + c.dst] = curve(pos[c.src], pos[c.dst]); });
  }
  function curve(A, B) {
    let dx = B.x - A.x, dy = B.y - A.y;
    const L = Math.hypot(dx, dy); dx /= L; dy /= L;
    const nx = -dy, ny = dx;
    return {
      p0: {x: A.x + dx * NR + nx * 14, y: A.y + dy * NR + ny * 14},
      p2: {x: B.x - dx * (NR + 8) + nx * 14, y: B.y - dy * (NR + 8) + ny * 14},
      c: {x: (A.x + B.x) / 2 + nx * 56, y: (A.y + B.y) / 2 + ny * 56}
    };
  }
  function bez(g, t) {
    const u = 1 - t;
    return {x: u * u * g.p0.x + 2 * u * t * g.c.x + t * t * g.p2.x,
            y: u * u * g.p0.y + 2 * u * t * g.c.y + t * t * g.p2.y};
  }

  /* ---------- stage ---------- */
  function tokenInner(m) {
    if (m.kind === "MARKER") {
      return `<circle class="flag-disc" r="15"/><path class="flag-pole" d="M-4.5 8V-7"/><path class="flag-cloth" d="M-4.5 -7L7 -3L-4.5 1Z"/>`;
    }
    return `<circle class="coin-disc" r="17"/><text class="coin-text" y="4.5" text-anchor="middle">$${m.amount}</text>`;
  }

  function renderStage() {
    layout();
    const defs = `<defs>
      <marker id="arrow-gray" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="#9AA6B8"/></marker>
      <marker id="arrow-frost" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="#3BA7D4"/></marker></defs>`;
    let chans = "", nodes = "", toks = "";

    state.channels.forEach(c => {
      const g = geometry[c.src + ">" + c.dst];
      chans += `<path class="chan ${c.recording ? "recording" : ""}" d="M${g.p0.x} ${g.p0.y}Q${g.c.x} ${g.c.y} ${g.p2.x} ${g.p2.y}" marker-end="url(#arrow-${c.recording ? "frost" : "gray"})"/>`;
      c.messages.slice(0, 3).forEach((m, i) => {
        const p = bez(g, [0.76, 0.46, 0.2][i]);
        const front = i === 0;
        const label = m.kind === "MARKER" ? "marker" : "$" + m.amount;
        toks += `<g class="token ${m.kind === "MARKER" ? "flag" : "coin"} ${front ? "front" : ""}" transform="translate(${p.x} ${p.y})" data-src="${c.src}" data-dst="${c.dst}"
          ${front ? `tabindex="0" role="button" aria-label="Deliver ${label} from ${c.src} to ${c.dst}"` : ""}>
          ${front ? `<circle class="ring" r="23"/>` : ""}<circle class="hit" r="22"/>${tokenInner(m)}
          <title>${front ? `Deliver ${label} from ${c.src} to ${c.dst}` : "Waiting behind the message ahead"}</title></g>`;
      });
      if (c.messages.length > 3) {
        const p = bez(g, 0.04);
        toks += `<text class="more" x="${p.x}" y="${p.y + 4}">+${c.messages.length - 3}</text>`;
      }
    });

    state.processes.forEach(p => {
      const q = pos[p.id];
      nodes += `<g class="node ${p.recorded ? "recorded" : ""}" transform="translate(${q.x} ${q.y})">
        ${p.recorded ? `<circle class="frost-ring" r="55"/>` : ""}
        <circle class="disc" r="${NR}"/>
        <text class="pid" y="-9" text-anchor="middle">${esc(p.id)}</text>
        <text class="bal" y="17" text-anchor="middle">${money(p.balance)}</text></g>`;
      if (p.recorded) {
        nodes += `<g class="saved" transform="translate(${q.x + q.ux * 78} ${q.y + q.uy * 72})">
          <rect x="-46" y="-12" width="92" height="24" rx="12"/>
          <text y="4.5" text-anchor="middle">saved ${money(p.recorded_balance)}</text></g>`;
      }
    });

    const idle = !state.started && state.channels.every(c => c.messages.length === 0);
    const hint = idle ? `<g class="empty-hint"><text x="${CX}" y="${CY - 6}">Send money between two processes,</text>
        <text x="${CX}" y="${CY + 16}">then start a snapshot.</text></g>` : "";

    svg.innerHTML = defs + chans + hint + nodes + toks;
  }

  function animate(src, dst, m) {
    return new Promise(resolve => {
      const g = geometry[src + ">" + dst];
      const el = document.createElementNS(NS, "g");
      el.setAttribute("class", "token");
      el.innerHTML = tokenInner(m);
      svg.appendChild(el);
      const start = performance.now(), dur = 520, t0 = 0.76;
      const frame = now => {
        const k = Math.min(1, (now - start) / dur), e = k * k * (3 - 2 * k);
        const p = bez(g, t0 + (1 - t0) * e);
        el.setAttribute("transform", `translate(${p.x} ${p.y})`);
        if (k < 1) requestAnimationFrame(frame); else { el.remove(); resolve(); }
      };
      requestAnimationFrame(frame);
    });
  }

  async function deliver(src, dst) {
    if (busy) return;
    busy = true;
    const ch = state.channels.find(c => c.src === src && c.dst === dst);
    if (ch && ch.messages.length && !reduced) {
      const orig = svg.querySelector(`.token.front[data-src="${src}"][data-dst="${dst}"]`);
      if (orig) orig.style.opacity = 0;
      await animate(src, dst, ch.messages[0]);
    }
    await api("/api/deliver", {src, dst});
    busy = false;
  }

  svg.addEventListener("click", e => {
    const t = e.target.closest(".token.front");
    if (t) deliver(t.dataset.src, t.dataset.dst);
  });
  svg.addEventListener("keydown", e => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const t = e.target.closest(".token.front");
    if (t) { e.preventDefault(); deliver(t.dataset.src, t.dataset.dst); }
  });

  /* ---------- side panels ---------- */
  function renderStatus() {
    const el = $("#status");
    if (!state.started) { el.className = "status status-idle"; el.textContent = "No snapshot yet"; }
    else if (state.snapshot.complete) { el.className = "status status-complete"; el.textContent = "Snapshot complete"; }
    else { el.className = "status status-running"; el.textContent = "Snapshot running"; }
  }

  function renderTotal() {
    $("#total").innerHTML = `<span>Total money in the system <strong>${money(state.total_now)}</strong></span>
      <small>${money(state.accounts)} in accounts</small><small>${money(state.in_transit)} travelling</small>`;
  }

  function renderSnapshot() {
    const body = $("#snapshot-body"), snap = state.snapshot;
    if (!state.started) {
      body.innerHTML = `<p class="hint">Try it in three steps:</p>
        <ol class="steps"><li>Send a few amounts between processes.</li>
        <li>Start a snapshot from any process.</li>
        <li>Click the glowing tokens to deliver messages until the status says complete.</li></ol>`;
      return;
    }
    const n = state.processes.length, C = state.channels.length;
    const byId = Object.fromEntries(state.processes.map(p => [p.id, p]));
    const saved = state.processes.filter(p => p.recorded).length;
    const closed = state.channels.filter(c => byId[c.dst].recorded && !c.recording).length;
    const pct = Math.round((saved + closed) / (n + C) * 100);
    const caught = Object.entries(snap.channels).filter(([, m]) => m.length);

    let verdict;
    if (!snap.complete) {
      verdict = `<div class="verdict pending">Counted so far: ${money(snap.total)} of ${money(snap.expected_total)}. Keep delivering messages until every channel finishes recording.</div>`;
    } else if (snap.total === snap.expected_total) {
      verdict = `<div class="verdict ok"><b>Consistent.</b> Saved balances plus money caught in channels add up to ${money(snap.total)}, exactly what the system started with.</div>`;
    } else {
      verdict = `<div class="verdict bad"><b>Inconsistent.</b> The snapshot adds up to ${money(snap.total)} but the system started with ${money(snap.expected_total)}.</div>`;
    }

    body.innerHTML = `
      <div class="progress mb-2" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><div class="progress-bar" style="width:${pct}%"></div></div>
      <p class="hint mb-0">${saved} of ${n} processes saved their balance. ${closed} of ${C} channels finished recording.</p>
      <h3>Saved balances</h3>
      <ul class="kv">${state.processes.map(p => `<li><span>${esc(p.id)}</span>${p.recorded ? `<b>${money(p.recorded_balance)}</b>` : `<span class="muted">waiting for a marker</span>`}</li>`).join("")}</ul>
      <h3>Money caught in channels</h3>
      <ul class="kv">${caught.length ? caught.map(([k, m]) => `<li><span>${esc(k.replace("->", " → "))}</span><b>${m.map(money).join(", ")}</b></li>`).join("") : `<li class="muted"><span>None so far</span></li>`}</ul>
      ${verdict}`;
  }

  function renderLog() {
    const items = state.log.slice().reverse().map(line => {
      const sep = line.startsWith("---");
      const text = line.replace(/^-+\s*|\s*-+$/g, "");
      const cls = sep ? "sep" : (line.includes("MARKER") ? "mk" : "");
      return `<li class="${cls}">${esc(text)}</li>`;
    });
    $("#events").innerHTML = items.length ? items.join("") : `<li class="muted">Nothing yet. Send some money to begin.</li>`;
  }

  function renderControls() {
    const key = state.processes.map(p => p.id).join(",");
    if (key !== idKey) {
      idKey = key;
      const opts = state.processes.map(p => `<option>${p.id}</option>`).join("");
      $("#src").innerHTML = opts; $("#dst").innerHTML = opts; $("#initiator").innerHTML = opts;
      $("#dst").selectedIndex = 1;
      $("#count").value = state.processes.length;
    }
    const btn = $("#snap-btn"), running = state.started && !state.snapshot.complete;
    btn.disabled = running;
    btn.textContent = state.started && state.snapshot.complete ? "Take another snapshot" : "Start snapshot";
    $("#next").disabled = state.channels.every(c => c.messages.length === 0);
  }

  function render() {
    renderStage(); renderStatus(); renderTotal(); renderSnapshot(); renderLog(); renderControls();
  }

  /* ---------- controls ---------- */
  $("#send-form").addEventListener("submit", e => {
    e.preventDefault();
    const src = $("#src").value, dst = $("#dst").value, amount = parseInt($("#amount").value, 10);
    if (src === dst) return toast("Choose two different processes.");
    if (!(amount > 0)) return toast("Enter an amount above $0.");
    api("/api/transfer", {src, dst, amount});
  });
  $("#snap-form").addEventListener("submit", e => {
    e.preventDefault();
    api("/api/snapshot", {pid: $("#initiator").value});
  });
  $("#next").addEventListener("click", () => { if (!busy) api("/api/deliver_random", {}); });
  $("#reset").addEventListener("click", () => {
    stopAuto();
    api("/api/reset", {n: parseInt($("#count").value, 10)});
  });

  function stopAuto() {
    clearInterval(timer); timer = null;
    $("#auto").checked = false;
    $("#auto-label").textContent = "Auto-play";
  }
  $("#auto").addEventListener("change", e => {
    if (e.target.checked) {
      $("#auto-label").textContent = "Pause";
      timer = setInterval(() => { if (!busy) api("/api/step", {}); }, 1100);
    } else stopAuto();
  });

  api("/api/state");
})();
