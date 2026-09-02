const TONE_RE = /[ˊˇˋ]/;
const app = document.getElementById("app");
const lessonCache = new Map();
let catalog = null;
let route = { view: "home" };
const matchState = {};
const quizState = {};
const flashState = {};

function esc(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function decomposeBpmf(bpmf) {
  let raw = String(bpmf || "").trim();
  const isLight = raw.includes("˙");
  raw = raw.replace(/˙/g, "");
  const toneMatch = raw.match(TONE_RE);
  const tone = toneMatch ? toneMatch[0] : "";
  raw = raw.replace(TONE_RE, "");
  return { symbols: [...raw], tone, isLight };
}

function bpmfStackHtml(bpmf) {
  const { symbols, tone, isLight } = decomposeBpmf(bpmf);
  if (!symbols.length && !tone && !isLight) return "";
  let col = "";
  if (isLight) col += '<span class="sym" aria-hidden="true">˙</span>';
  for (const sym of symbols) col += `<span class="sym" aria-hidden="true">${esc(sym)}</span>`;
  const toneHtml = tone ? `<span class="tone" aria-hidden="true">${esc(tone)}</span>` : "";
  return `<span class="bpmf-card" role="img" aria-label="${esc(bpmf)}"><span class="col">${col}</span>${toneHtml}</span>`;
}

function phraseZhuyinHtml(word, zhuyin) {
  const syllables = String(zhuyin || "").split(/\s+/).filter(Boolean);
  const cards = [...String(word || "")].map((ch, i) => bpmfStackHtml(syllables[i] || ""));
  return `<span class="phrase-zhuyin">${cards.join("")}</span>`;
}

function prepareItems(lesson) {
  const chars = (lesson.vocab || []).map((item) => ({
    ...item,
    kind: "char",
    zhuyinHtml: bpmfStackHtml(item.zhuyin),
  }));
  const phrases = (lesson.phrases || []).map((item) => ({
    ...item,
    kind: "phrase",
    zhuyinHtml: phraseZhuyinHtml(item.word, item.zhuyin),
  }));
  return chars.concat(phrases);
}

function parseHash() {
  const raw = (location.hash || "#/").replace(/^#/, "");
  const parts = raw.split("/").filter(Boolean);
  if (parts[0] === "print") return { view: "print" };
  if (!parts.length) return { view: "home" };
  if (parts.length === 1) return { view: "hub", id: parts[0] };
  return { view: parts[1], id: parts[0] };
}

async function loadCatalog() {
  if (catalog) return catalog;
  const res = await fetch("data/catalog.json", { cache: "no-store" });
  if (!res.ok) throw new Error("讀不到課表");
  catalog = await res.json();
  return catalog;
}

async function loadLesson(id) {
  if (lessonCache.has(id)) return lessonCache.get(id);
  const book = catalog.books[0];
  const meta = book.lessons.find((item) => item.id === id);
  if (!meta || !meta.ready || !meta.file) throw new Error("這一課還沒做好");
  const res = await fetch(meta.file, { cache: "no-store" });
  if (!res.ok) throw new Error("讀不到這一課");
  const lesson = await res.json();
  lesson.items = prepareItems(lesson);
  lessonCache.set(id, lesson);
  return lesson;
}

function findLessonMeta(id) {
  for (const book of catalog.books) {
    const hit = book.lessons.find((item) => item.id === id);
    if (hit) return { book, lesson: hit };
  }
  return null;
}

function speak(text) {
  if (!window.speechSynthesis || !text) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = "zh-TW";
  utter.rate = 0.88;
  window.speechSynthesis.speak(utter);
}

function playSfx(kind) {
  const node = document.getElementById(`sfx-${kind}`);
  if (!node) return;
  try {
    node.currentTime = 0;
    node.play().catch(() => {});
  } catch (err) { /* ignore */ }
}

function shuffle(list) {
  const arr = list.slice();
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function topBar(title, sub, backHash) {
  const back = backHash
    ? `<a class="ghost" href="${backHash}">回上一頁</a>`
    : `<a class="ghost" href="#/print">列印 QR</a>`;
  return `<header class="top">
    <div class="brand"><h1>${esc(title)}</h1><p class="sub">${esc(sub)}</p></div>
    ${back}
  </header>`;
}

function renderHome() {
  const book = catalog.books[0];
  const rows = book.lessons.map((lesson) => {
    if (lesson.ready) {
      return `<article class="row ready">
        <span class="no">第${lesson.no}課</span>
        <div><strong>${esc(lesson.title)}</strong><span class="meta">${esc(lesson.author || "南一國語")}</span></div>
        <a class="play" href="#/${esc(lesson.id)}">開始練習</a>
      </article>`;
    }
    return `<article class="row wait">
      <span class="no">第${lesson.no}課</span>
      <div><strong>${esc(lesson.title)}</strong><span class="meta">即將加入</span></div>
      <span class="ghost" aria-disabled="true">還沒開放</span>
    </article>`;
  }).join("");
  app.innerHTML = `${topBar(catalog.title, `${catalog.year}學年度　${catalog.publisher}　${book.label}`)}
    <section class="hero">
      <img src="assets/cover.jpg" alt="開學第一天，同學互相打招呼">
      <div class="hero-copy">
        <p>先認字、再配對、最後小考。字大、有注音、可以聽。錯了沒關係，再試一次就好。</p>
        <p>現在開放第一課〈你好，新朋友〉。其他課之後會一課一課加上去。</p>
      </div>
    </section>
    <div class="list">${rows}</div>
    <p class="credit">公開頁只放生字與語詞練習，不放課文。朗讀用裝置內建中文語音。</p>`;
}

function renderHub(lesson, meta) {
  app.innerHTML = `${topBar(lesson.title, `${meta.book.label}　第${meta.lesson.no}課　${lesson.author || ""}`, "#/")}
    <section class="hero">
      <img src="assets/cover.jpg" alt="">
      <div class="hero-copy">
        <p>生字 ${lesson.vocab.length} 個　語詞 ${lesson.phrases.length} 個。選一種玩法開始。</p>
      </div>
    </section>
    <div class="modes">
      <a class="mode" href="#/${lesson.id}/flash">認一認<small>看字、聽讀、看意思</small></a>
      <a class="mode" href="#/${lesson.id}/zhuyin">注音配對<small>左邊注音，右邊字詞</small></a>
      <a class="mode" href="#/${lesson.id}/audio">聽音配對<small>聽到讀音，再找出字</small></a>
      <a class="mode" href="#/${lesson.id}/char-quiz">識字小考<small>生字意思四選一</small></a>
      <a class="mode" href="#/${lesson.id}/phrase-quiz">語詞小考<small>語詞意思四選一</small></a>
    </div>`;
}

function poolFor(lesson, scope) {
  if (scope === "char") return lesson.items.filter((item) => item.kind === "char");
  if (scope === "phrase") return lesson.items.filter((item) => item.kind === "phrase");
  return lesson.items.slice();
}

function ensureMatch(lesson, mode) {
  const key = `${lesson.id}:${mode}`;
  if (!matchState[key]) {
    matchState[key] = {
      scope: "all",
      batch: "4",
      order: "random",
      seen: [],
      current: [],
      picked: null,
      stats: { total: 0, correct: 0 },
      swapped: false,
      done: false,
    };
  }
  return matchState[key];
}

function nextMatchBatch(lesson, state) {
  const pool = poolFor(lesson, state.scope);
  const want = state.batch === "all" ? pool.length : Math.min(Number(state.batch) || 4, pool.length);
  const prev = new Set(state.current.map((item) => item.key));
  let remaining = pool.filter((item) => !state.seen.includes(item.key));
  if (!remaining.length) {
    remaining = pool.filter((item) => !prev.has(item.key));
    state.seen = [];
    if (!remaining.length) remaining = pool.slice();
  }
  const take = state.order === "sequential" ? remaining.slice(0, want) : shuffle(remaining).slice(0, want);
  take.forEach((item) => { if (!state.seen.includes(item.key)) state.seen.push(item.key); });
  state.current = take;
  state.picked = null;
  state.done = false;
}

function accuracyText(stats) {
  if (!stats.total) return "已答 0　答對 0　正確率 尚無";
  const pct = Math.round((stats.correct / stats.total) * 100);
  return `已答 ${stats.total}　答對 ${stats.correct}　正確率 ${pct}%`;
}

function renderMatch(lesson, meta, mode) {
  const state = ensureMatch(lesson, mode);
  if (!state.current.length) nextMatchBatch(lesson, state);
  const leftTitle = mode === "audio" ? "聽一聽" : "注音";
  const rightTitle = state.scope === "phrase" ? "語詞" : state.scope === "char" ? "生字" : "字詞";
  const cueItems = shuffle(state.current);
  const wordItems = shuffle(state.current);
  const leftCol = (state.swapped ? wordItems : cueItems).map((item) => matchTile(item, mode, state.swapped ? "word" : "cue")).join("");
  const rightCol = (state.swapped ? cueItems : wordItems).map((item) => matchTile(item, mode, state.swapped ? "cue" : "word")).join("");
  app.innerHTML = `${topBar(mode === "audio" ? "聽音配對" : "注音配對", lesson.title, `#/${lesson.id}`)}
    <section class="panel">
      <div class="toolbar">
        <span class="label">範圍</span>
        <select data-match="scope">
          <option value="all"${state.scope === "all" ? " selected" : ""}>生字＋語詞</option>
          <option value="char"${state.scope === "char" ? " selected" : ""}>只生字</option>
          <option value="phrase"${state.scope === "phrase" ? " selected" : ""}>只語詞</option>
        </select>
        <span class="label">一次</span>
        <select data-match="batch">
          <option value="2"${state.batch === "2" ? " selected" : ""}>2題</option>
          <option value="3"${state.batch === "3" ? " selected" : ""}>3題</option>
          <option value="4"${state.batch === "4" ? " selected" : ""}>4題</option>
          <option value="all"${state.batch === "all" ? " selected" : ""}>全部</option>
        </select>
        <span class="label">出題</span>
        <select data-match="order">
          <option value="random"${state.order === "random" ? " selected" : ""}>亂數</option>
          <option value="sequential"${state.order === "sequential" ? " selected" : ""}>照順序</option>
        </select>
        <button class="chip" type="button" data-match="swap">對調左右</button>
      </div>
      <p class="score" id="matchScore">${accuracyText(state.stats)}</p>
      <div class="board">
        <div><p class="col-title">${leftTitle}</p><div id="matchLeft">${leftCol}</div></div>
        <div><p class="col-title">${rightTitle}</p><div id="matchRight">${rightCol}</div></div>
      </div>
      <p class="msg" id="matchMsg">${state.done ? "這一局都配好了。" : "先點左邊一張，再點右邊配對。"}</p>
      <div class="replay"><button class="next" type="button" data-match="again">再一局</button></div>
    </section>`;
  app.querySelectorAll("[data-match]").forEach((el) => {
    el.addEventListener("change", (event) => {
      const field = event.currentTarget.getAttribute("data-match");
      if (field === "scope" || field === "batch" || field === "order") {
        state[field] = event.currentTarget.value;
        state.seen = [];
        nextMatchBatch(lesson, state);
        renderMatch(lesson, meta, mode);
      }
    });
    el.addEventListener("click", (event) => {
      const field = event.currentTarget.getAttribute("data-match");
      if (field === "swap") {
        state.swapped = !state.swapped;
        state.picked = null;
        renderMatch(lesson, meta, mode);
      }
      if (field === "again") {
        nextMatchBatch(lesson, state);
        renderMatch(lesson, meta, mode);
      }
    });
  });
  app.querySelectorAll(".tile").forEach((tile) => {
    tile.addEventListener("click", () => onMatchClick(tile, lesson, meta, mode, state));
  });
}

function matchTile(item, mode, side) {
  let html = `<span class="han">${esc(item.word)}</span>`;
  if (side === "cue") {
    html = mode === "audio" ? "▶ 聽一聽" : item.zhuyinHtml;
  }
  return `<button type="button" class="tile" data-key="${esc(item.key)}" data-side="${side}" data-word="${esc(item.word)}">${html}</button>`;
}

function onMatchClick(tile, lesson, meta, mode, state) {
  if (tile.classList.contains("matched")) return;
  const item = state.current.find((entry) => entry.key === tile.dataset.key);
  if (mode === "audio" && tile.dataset.side === "cue") speak(item.word);
  if (!state.picked) {
    app.querySelectorAll(".tile.picked").forEach((node) => node.classList.remove("picked"));
    tile.classList.add("picked");
    state.picked = tile;
    return;
  }
  if (state.picked === tile) {
    tile.classList.remove("picked");
    state.picked = null;
    return;
  }
  if (state.picked.dataset.side === tile.dataset.side) {
    state.picked.classList.remove("picked");
    tile.classList.add("picked");
    state.picked = tile;
    return;
  }
  const ok = state.picked.dataset.key === tile.dataset.key;
  state.stats.total += 1;
  if (ok) {
    state.stats.correct += 1;
    playSfx("correct");
    [state.picked, tile].forEach((node) => {
      node.classList.add("matched", "flash-ok");
      node.classList.remove("picked");
    });
    speak(item.word);
    state.picked = null;
    const left = app.querySelectorAll(".tile:not(.matched)");
    if (!left.length) {
      state.done = true;
      playSfx("win");
      document.getElementById("matchMsg").textContent = "這一局都配好了。真好。";
    }
  } else {
    playSfx("wrong");
    const first = state.picked;
    first.classList.add("flash-no");
    tile.classList.add("flash-no");
    setTimeout(() => {
      first.classList.remove("flash-no", "picked");
      tile.classList.remove("flash-no");
    }, 420);
    state.picked = null;
    document.getElementById("matchMsg").textContent = "再看一次，沒關係。";
  }
  document.getElementById("matchScore").textContent = accuracyText(state.stats);
}

function ensureFlash(lesson) {
  const key = lesson.id;
  if (!flashState[key]) flashState[key] = { index: 0, scope: "all" };
  return flashState[key];
}

function renderFlash(lesson, meta) {
  const state = ensureFlash(lesson);
  const pool = poolFor(lesson, state.scope);
  if (state.index >= pool.length) state.index = 0;
  const item = pool[state.index];
  app.innerHTML = `${topBar("認一認", lesson.title, `#/${lesson.id}`)}
    <section class="panel">
      <div class="toolbar">
        <span class="label">範圍</span>
        <select data-flash="scope">
          <option value="all"${state.scope === "all" ? " selected" : ""}>生字＋語詞</option>
          <option value="char"${state.scope === "char" ? " selected" : ""}>只生字</option>
          <option value="phrase"${state.scope === "phrase" ? " selected" : ""}>只語詞</option>
        </select>
        <span class="score">${state.index + 1}／${pool.length}</span>
      </div>
      <div class="flash-card">
        <div>${item.kind === "phrase" ? item.zhuyinHtml : bpmfStackHtml(item.zhuyin)}</div>
        <p class="flash-word">${esc(item.word)}</p>
        <p class="flash-mean">${esc(item.mean)}</p>
        <button class="listen" type="button" data-flash="speak">聽一聽</button>
      </div>
      <div class="nav-row">
        <button class="ghost" type="button" data-flash="prev"${state.index === 0 ? " disabled" : ""}>上一張</button>
        <button class="next" type="button" data-flash="next"${state.index >= pool.length - 1 ? " disabled" : ""}>下一張</button>
      </div>
    </section>`;
  app.querySelector("[data-flash='scope']").addEventListener("change", (event) => {
    state.scope = event.currentTarget.value;
    state.index = 0;
    renderFlash(lesson, meta);
  });
  app.querySelector("[data-flash='speak']").addEventListener("click", (event) => {
    event.currentTarget.classList.add("playing");
    speak(item.word);
    setTimeout(() => event.currentTarget.classList.remove("playing"), 800);
  });
  app.querySelector("[data-flash='prev']").addEventListener("click", () => {
    state.index = Math.max(0, state.index - 1);
    renderFlash(lesson, meta);
  });
  app.querySelector("[data-flash='next']").addEventListener("click", () => {
    state.index = Math.min(pool.length - 1, state.index + 1);
    renderFlash(lesson, meta);
  });
}

function ensureQuiz(lesson, mode) {
  const key = `${lesson.id}:${mode}`;
  if (!quizState[key]) {
    quizState[key] = { limit: 6, cursor: 0, queue: [], stats: { total: 0, correct: 0, events: [] }, startedAt: 0, done: false, celebrated: false };
  }
  return quizState[key];
}

function makeQuizQueue(lesson, mode, limit) {
  const pool = poolFor(lesson, mode === "char-quiz" ? "char" : "phrase");
  const want = Math.min(limit === "all" ? pool.length : Number(limit) || 6, pool.length);
  return shuffle(pool).slice(0, want).map((item) => {
    const others = shuffle(pool.filter((entry) => entry.key !== item.key)).slice(0, 3);
    const choices = shuffle([item, ...others]);
    return { item, choices, kind: Math.random() < 0.5 ? "mean" : "word" };
  });
}

function renderQuiz(lesson, meta, mode) {
  const state = ensureQuiz(lesson, mode);
  const title = mode === "char-quiz" ? "識字小考" : "語詞小考";
  if (state.done) {
    const pct = state.stats.total ? Math.round((state.stats.correct / state.stats.total) * 100) : 0;
    const perfect = state.stats.total && state.stats.correct === state.stats.total;
    if (perfect && !state.celebrated) {
      playSfx("win");
      state.celebrated = true;
    }
    const wrong = state.stats.events.filter((event) => !event.ok);
    const wrongHtml = wrong.length
      ? `<ul class="wrong-list">${wrong.map((event) => `<li>${esc(event.word)}：${esc(event.mean)}（你選了 ${esc(event.chosen)}）</li>`).join("")}</ul>`
      : `<p>每一題都答對了。</p>`;
    app.innerHTML = `${topBar(title, lesson.title, `#/${lesson.id}`)}
      <section class="panel result">
        ${perfect ? `<div class="seal">全對</div><h2>${mode === "char-quiz" ? "識字高手" : "語詞高手"}</h2>` : `<h2>這一趟走完了</h2>`}
        <p>答對 ${state.stats.correct}／${state.stats.total}　正確率 ${pct}%</p>
        ${wrongHtml}
        <p class="sub">學生代號選填，不要填真名。</p>
        <p><input id="studentCode" maxlength="24" placeholder="例如 S03" aria-label="學生代號"></p>
        <div class="nav-row">
          <button class="ghost" type="button" data-quiz="retry">再測一次</button>
          <a class="play" href="#/${lesson.id}">回這一課</a>
        </div>
      </section>`;
    app.querySelector("[data-quiz='retry']").addEventListener("click", () => {
      state.done = false;
      state.celebrated = false;
      state.queue = [];
      state.cursor = 0;
      state.stats = { total: 0, correct: 0, events: [] };
      renderQuiz(lesson, meta, mode);
    });
    return;
  }
  if (!state.queue.length) {
    state.queue = makeQuizQueue(lesson, mode, state.limit);
    state.cursor = 0;
    state.startedAt = Date.now();
    state.stats = { total: 0, correct: 0, events: [] };
  }
  const current = state.queue[state.cursor];
  const prompt = current.kind === "mean" ? current.item.mean : current.item.word;
  const hint = current.kind === "mean" ? "選出對的字詞" : "這是什麼意思？";
  app.innerHTML = `${topBar(title, lesson.title, `#/${lesson.id}`)}
    <section class="panel">
      <div class="toolbar">
        <span class="label">題數</span>
        <select data-quiz="limit">
          <option value="4"${Number(state.limit) === 4 ? " selected" : ""}>4題</option>
          <option value="6"${Number(state.limit) === 6 ? " selected" : ""}>6題</option>
          <option value="8"${Number(state.limit) === 8 ? " selected" : ""}>8題</option>
          <option value="all"${state.limit === "all" ? " selected" : ""}>全部</option>
        </select>
        <button class="listen" type="button" data-quiz="speak">聽一聽</button>
      </div>
      <p class="score">第 ${state.cursor + 1}／${state.queue.length} 題</p>
      <div class="quiz-stem">
        <p class="quiz-prompt">${esc(prompt)}</p>
        <p class="sub">${hint}</p>
      </div>
      <div class="choices">
        ${current.choices.map((choice, index) => {
          const label = current.kind === "mean" ? choice.word : choice.mean;
          return `<button class="pick pick-${index}" type="button" data-key="${esc(choice.key)}">${esc(label)}</button>`;
        }).join("")}
      </div>
      <p class="msg" id="quizMsg">想一想再選。選錯了還可以看正確答案。</p>
    </section>`;
  app.querySelector("[data-quiz='limit']").addEventListener("change", (event) => {
    state.limit = event.currentTarget.value === "all" ? "all" : Number(event.currentTarget.value);
    state.queue = [];
    renderQuiz(lesson, meta, mode);
  });
  app.querySelector("[data-quiz='speak']").addEventListener("click", () => speak(current.item.word));
  app.querySelectorAll(".pick").forEach((btn) => {
    btn.addEventListener("click", () => onQuizPick(btn, lesson, meta, mode, state, current));
  });
}

function onQuizPick(btn, lesson, meta, mode, state, current) {
  if (btn.disabled) return;
  const ok = btn.dataset.key === current.item.key;
  const chosen = current.choices.find((choice) => choice.key === btn.dataset.key);
  state.stats.total += 1;
  if (ok) state.stats.correct += 1;
  state.stats.events.push({
    word: current.item.word,
    mean: current.item.mean,
    chosen: current.kind === "mean" ? chosen.word : chosen.mean,
    ok,
  });
  playSfx(ok ? "correct" : "wrong");
  btn.classList.add(ok ? "flash-ok" : "flash-no");
  app.querySelectorAll(".pick").forEach((node) => { node.disabled = true; });
  document.getElementById("quizMsg").textContent = ok
    ? `對了。${current.item.word}：${current.item.mean}`
    : `這題是「${current.item.word}」。${current.item.mean}`;
  if (!ok) speak(current.item.word);
  setTimeout(() => {
    state.cursor += 1;
    if (state.cursor >= state.queue.length) state.done = true;
    renderQuiz(lesson, meta, mode);
  }, ok ? 700 : 1400);
}

function renderPrint() {
  const url = `${location.origin}${location.pathname.replace(/index\.html$/, "")}`;
  app.innerHTML = `${topBar("掃 QR 開始玩", `${catalog.title}　${catalog.year} 南一三上`, "#/")}
    <section class="print-card">
      <p>用手機相機掃下面的圖，就會打開練習網頁。</p>
      <canvas id="qr" width="280" height="280" aria-label="練習網頁 QR"></canvas>
      <p><a href="${esc(url)}">${esc(url)}</a></p>
      <p class="sub">第一課〈你好，新朋友〉已經可以玩。其他課之後會打開。</p>
    </section>`;
  drawQr(document.getElementById("qr"), url);
}

async function drawQr(canvas, text) {
  if (!window.qrcode) {
    await loadQrLib();
  }
  const qr = window.qrcode(0, "M");
  qr.addData(text);
  qr.make();
  const count = qr.getModuleCount();
  const ctx = canvas.getContext("2d");
  const size = canvas.width;
  const scale = size / count;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = "#134e4a";
  for (let row = 0; row < count; row += 1) {
    for (let col = 0; col < count; col += 1) {
      if (qr.isDark(row, col)) ctx.fillRect(col * scale, row * scale, scale, scale);
    }
  }
}

function loadQrLib() {
  return new Promise((resolve, reject) => {
    if (window.qrcode) { resolve(); return; }
    const script = document.createElement("script");
    script.src = "vendor/qrcode.js";
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

async function render() {
  try {
    await loadCatalog();
    route = parseHash();
    if (route.view === "home") { renderHome(); return; }
    if (route.view === "print") { renderPrint(); return; }
    const meta = findLessonMeta(route.id);
    if (!meta) { location.hash = "#/"; return; }
    const lesson = await loadLesson(route.id);
    if (route.view === "hub") renderHub(lesson, meta);
    else if (route.view === "flash") renderFlash(lesson, meta);
    else if (route.view === "zhuyin" || route.view === "audio") renderMatch(lesson, meta, route.view);
    else if (route.view === "char-quiz" || route.view === "phrase-quiz") renderQuiz(lesson, meta, route.view);
    else renderHub(lesson, meta);
  } catch (err) {
    app.innerHTML = `${topBar("打不開", "請用網址打開，不要直接雙擊檔案")}
      <section class="panel"><p>${esc(err.message)}</p><a class="play" href="#/">回第一頁</a></section>`;
  }
}

window.addEventListener("hashchange", render);
render();
