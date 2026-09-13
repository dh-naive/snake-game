(() => {
  const COLS = 20;
  const ROWS = 20;
  const STORAGE_KEY = "snake-high-score";
  const params = new URLSearchParams(window.location.search);
  const tickOverride = Number(params.get("tick"));
  const INITIAL_TICK = Number.isFinite(tickOverride) && tickOverride >= 40 ? tickOverride : 140;
  const MIN_TICK = 72;

  const DIRS = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
  };

  const KEY_TO_DIR = {
    ArrowUp: "up",
    ArrowDown: "down",
    ArrowLeft: "left",
    ArrowRight: "right",
    w: "up",
    a: "left",
    s: "down",
    d: "right",
    W: "up",
    A: "left",
    S: "down",
    D: "right",
  };

  const canvas = document.getElementById("board");
  const overlay = document.getElementById("overlay");
  const overlayKicker = document.getElementById("overlay-kicker");
  const overlayTitle = document.getElementById("overlay-title");
  const overlayCopy = document.getElementById("overlay-copy");
  const scoreEl = document.getElementById("score");
  const highScoreEl = document.getElementById("high-score");
  const startBtn = document.getElementById("start-btn");
  const restartBtn = document.getElementById("restart-btn");
  const pauseBtn = document.getElementById("pause-btn");

  const ctx = canvas.getContext("2d");

  const state = {
    snake: [
      { x: 8, y: 10 },
      { x: 7, y: 10 },
      { x: 6, y: 10 },
    ],
    dir: DIRS.right,
    queued: [],
    food: { x: 12, y: 10 },
    score: 0,
    highScore: Number(localStorage.getItem(STORAGE_KEY) || 0),
    status: "ready",
    lastTick: 0,
    raf: 0,
  };

  highScoreEl.textContent = String(state.highScore);

  function opposite(a, b) {
    return a.x + b.x === 0 && a.y + b.y === 0;
  }

  function sameCell(a, b) {
    return a.x === b.x && a.y === b.y;
  }

  function randomEmptyCell() {
    const occupied = new Set(state.snake.map((p) => `${p.x},${p.y}`));
    const empty = [];
    for (let y = 0; y < ROWS; y += 1) {
      for (let x = 0; x < COLS; x += 1) {
        if (!occupied.has(`${x},${y}`)) empty.push({ x, y });
      }
    }
    return empty[Math.floor(Math.random() * empty.length)] || { x: 0, y: 0 };
  }

  function resetGame() {
    state.snake = [
      { x: 8, y: 10 },
      { x: 7, y: 10 },
      { x: 6, y: 10 },
    ];
    state.dir = DIRS.right;
    state.queued = [];
    state.food = { x: 12, y: 10 };
    if (state.snake.some((part) => sameCell(part, state.food))) {
      state.food = randomEmptyCell();
    }
    state.score = 0;
    state.status = "playing";
    state.lastTick = 0;
    scoreEl.textContent = "0";
    overlay.classList.add("hidden");
    pauseBtn.disabled = false;
    pauseBtn.textContent = "暂停";
  }

  function setPaused(paused) {
    if (state.status !== "playing" && state.status !== "paused") return;
    state.status = paused ? "paused" : "playing";
    pauseBtn.textContent = paused ? "继续" : "暂停";
    if (paused) {
      showOverlay("已暂停", "暂停", "按 P 或点击继续，空格可重新开始。", "继续");
    } else {
      overlay.classList.add("hidden");
    }
  }

  function showOverlay(kicker, title, copy, buttonLabel) {
    overlayKicker.textContent = kicker;
    overlayTitle.textContent = title;
    overlayCopy.textContent = copy;
    startBtn.textContent = buttonLabel;
    overlay.classList.remove("hidden");
  }

  function endGame() {
    state.status = "over";
    pauseBtn.disabled = true;
    pauseBtn.textContent = "暂停";
    if (state.score > state.highScore) {
      state.highScore = state.score;
      localStorage.setItem(STORAGE_KEY, String(state.highScore));
      highScoreEl.textContent = String(state.highScore);
      showOverlay("新纪录", "游戏结束", `本局得分 ${state.score}，已刷新最高分。按空格或点击重新开始。`, "重新开始");
    } else {
      showOverlay("再来一局", "游戏结束", `本局得分 ${state.score}。按空格或点击重新开始。`, "重新开始");
    }
  }

  function queueDirection(name) {
    const next = DIRS[name];
    if (!next || state.status !== "playing") return;
    const last = state.queued[state.queued.length - 1] || state.dir;
    if (opposite(last, next) || (last.x === next.x && last.y === next.y)) return;
    if (state.queued.length < 2) state.queued.push(next);
  }

  function tickMs() {
    return Math.max(MIN_TICK, INITIAL_TICK - state.score * 3);
  }

  function step() {
    if (state.queued.length) state.dir = state.queued.shift();
    const head = state.snake[0];
    const next = { x: head.x + state.dir.x, y: head.y + state.dir.y };

    if (next.x < 0 || next.y < 0 || next.x >= COLS || next.y >= ROWS) {
      endGame();
      return;
    }
    if (state.snake.some((part) => sameCell(part, next))) {
      endGame();
      return;
    }

    state.snake.unshift(next);
    if (sameCell(next, state.food)) {
      state.score += 1;
      scoreEl.textContent = String(state.score);
      state.food = randomEmptyCell();
    } else {
      state.snake.pop();
    }
  }

  function resizeCanvas() {
    const size = canvas.clientWidth * window.devicePixelRatio;
    canvas.width = size;
    canvas.height = size;
    draw();
  }

  function cellSize() {
    return canvas.width / COLS;
  }

  function roundRect(x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }

  function draw() {
    const size = cellSize();
    const pad = size * 0.12;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#071018";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = "rgba(148, 163, 184, 0.08)";
    ctx.lineWidth = Math.max(1, size * 0.03);
    for (let i = 1; i < COLS; i += 1) {
      ctx.beginPath();
      ctx.moveTo(i * size, 0);
      ctx.lineTo(i * size, canvas.height);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * size);
      ctx.lineTo(canvas.width, i * size);
      ctx.stroke();
    }

    const foodX = state.food.x * size + size / 2;
    const foodY = state.food.y * size + size / 2;
    const pulse = 1 + Math.sin(performance.now() / 180) * 0.08;
    ctx.shadowColor = "rgba(251, 113, 133, 0.7)";
    ctx.shadowBlur = size * 0.45;
    ctx.fillStyle = "#fb7185";
    ctx.beginPath();
    ctx.arc(foodX, foodY, (size * 0.28) * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    state.snake.forEach((part, index) => {
      const x = part.x * size + pad;
      const y = part.y * size + pad;
      const w = size - pad * 2;
      const t = index / Math.max(state.snake.length - 1, 1);
      ctx.fillStyle = index === 0 ? "#6ee7b7" : `rgba(16, 185, 129, ${1 - t * 0.45})`;
      if (index === 0) {
        ctx.shadowColor = "rgba(52, 211, 153, 0.55)";
        ctx.shadowBlur = size * 0.35;
      }
      roundRect(x, y, w, w, size * 0.28);
      ctx.fill();
      ctx.shadowBlur = 0;

      if (index === 0) {
        const eye = size * 0.08;
        const ox = state.dir.x * size * 0.12;
        const oy = state.dir.y * size * 0.12;
        ctx.fillStyle = "#062016";
        ctx.beginPath();
        ctx.arc(x + w * 0.35 + ox, y + w * 0.38 + oy, eye, 0, Math.PI * 2);
        ctx.arc(x + w * 0.65 + ox, y + w * 0.38 + oy, eye, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }

  function loop(now) {
    if (state.status === "playing") {
      if (!state.lastTick) state.lastTick = now;
      if (now - state.lastTick >= tickMs()) {
        step();
        state.lastTick = now;
      }
    }
    draw();
    state.raf = requestAnimationFrame(loop);
  }

  function startOrResume() {
    if (state.status === "ready" || state.status === "over") {
      resetGame();
      return;
    }
    if (state.status === "paused") setPaused(false);
  }

  startBtn.addEventListener("click", startOrResume);
  restartBtn.addEventListener("click", resetGame);
  pauseBtn.addEventListener("click", () => {
    if (state.status === "playing") setPaused(true);
    else if (state.status === "paused") setPaused(false);
  });

  document.querySelectorAll(".pad").forEach((btn) => {
    const press = (event) => {
      event.preventDefault();
      queueDirection(btn.dataset.dir);
    };
    btn.addEventListener("pointerdown", press);
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === " " || event.code === "Space") {
      event.preventDefault();
      resetGame();
      return;
    }
    if (event.key === "p" || event.key === "P") {
      if (state.status === "playing") setPaused(true);
      else if (state.status === "paused") setPaused(false);
      return;
    }
    const dir = KEY_TO_DIR[event.key];
    if (!dir) return;
    event.preventDefault();
    if (state.status === "ready" || state.status === "over") resetGame();
    queueDirection(dir);
  });

  let swipeStart = null;
  canvas.addEventListener("pointerdown", (event) => {
    swipeStart = { x: event.clientX, y: event.clientY };
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener("pointerup", (event) => {
    if (!swipeStart) return;
    const dx = event.clientX - swipeStart.x;
    const dy = event.clientY - swipeStart.y;
    swipeStart = null;
    if (Math.hypot(dx, dy) < 24) {
      if (state.status === "ready" || state.status === "over") startOrResume();
      return;
    }
    if (state.status === "ready" || state.status === "over") resetGame();
    if (Math.abs(dx) > Math.abs(dy)) queueDirection(dx > 0 ? "right" : "left");
    else queueDirection(dy > 0 ? "down" : "up");
  });

  window.addEventListener("resize", resizeCanvas);
  resizeCanvas();
  state.raf = requestAnimationFrame(loop);

  window.__SNAKE = {
    getState() {
      return {
        status: state.status,
        score: state.score,
        highScore: state.highScore,
        snake: state.snake.map((p) => ({ ...p })),
        food: { ...state.food },
        dir: { ...state.dir },
      };
    },
    start: startOrResume,
    reset: resetGame,
    pause: () => setPaused(true),
    resume: () => setPaused(false),
    queueDirection,
    setFood(x, y) {
      state.food = { x, y };
    },
  };
})();
