(() => {
  const puzzle = [
    [0, 0, 8, 5, 0, 6, 3, 0, 4],
    [0, 0, 0, 2, 4, 3, 6, 8, 7],
    [0, 6, 4, 8, 7, 0, 2, 5, 9],
    [8, 0, 5, 9, 0, 4, 7, 6, 2],
    [0, 0, 7, 6, 0, 2, 0, 0, 1],
    [9, 2, 6, 7, 1, 8, 5, 4, 0],
    [6, 0, 0, 4, 0, 7, 1, 3, 0],
    [1, 5, 2, 3, 6, 9, 0, 0, 8],
    [7, 4, 0, 1, 0, 0, 9, 2, 0],
  ];

  const solution = [
    [2, 7, 8, 5, 9, 6, 3, 1, 4],
    [5, 9, 1, 2, 4, 3, 6, 8, 7],
    [3, 6, 4, 8, 7, 1, 2, 5, 9],
    [8, 1, 5, 9, 3, 4, 7, 6, 2],
    [4, 3, 7, 6, 5, 2, 8, 9, 1],
    [9, 2, 6, 7, 1, 8, 5, 4, 3],
    [6, 8, 9, 4, 2, 7, 1, 3, 5],
    [1, 5, 2, 3, 6, 9, 4, 7, 8],
    [7, 4, 3, 1, 8, 5, 9, 2, 6],
  ];

  const boardElement = document.querySelector("[data-sudoku-board]");
  const startLayer = document.querySelector("[data-start-layer]");
  const startButton = document.querySelector("[data-start-game]");
  const numberPad = document.querySelector("[data-number-pad]");
  const eraseButton = document.querySelector("[data-erase]");
  const memoButton = document.querySelector("[data-memo]");
  const resetButton = document.querySelector("[data-reset]");
  const timeElement = document.querySelector("[data-game-time]");
  const mistakesElement = document.querySelector("[data-game-mistakes]");
  const completionLayer = document.querySelector("[data-completion-layer]");
  const replayButton = document.querySelector("[data-replay]");
  const bgm = document.querySelector("[data-game-bgm]");
  const bgmToggle = document.querySelector("[data-bgm-toggle]");
  const bgmIcon = document.querySelector("[data-bgm-icon]");
  const bgmState = bgmToggle?.querySelector("small");
  const demoSection = document.querySelector(".play-demo");

  if (!boardElement || !startButton || !numberPad) return;

  let board = puzzle.map((row) => [...row]);
  let notes = Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => new Set()));
  let selectedCell = null;
  let mistakes = 0;
  let started = false;
  let startedAt = 0;
  let timerId = 0;
  let bgmEnabled = false;
  let memoMode = false;
  let revealFrame = 0;

  function createStarField(container, count, seed) {
    let state = seed >>> 0;
    const random = () => {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 4294967296;
    };

    for (let index = 0; index < count; index += 1) {
      const star = document.createElement("i");
      star.className = `star-dot${index % 2 ? " is-alt" : ""}${index % 9 === 0 ? " is-cross" : ""}`;
      const lowerSky = random() < 0.64;
      const y = lowerSky ? 48 + random() * 50 : 2 + random() * 46;
      star.style.setProperty("--star-x", `${(1 + random() * 98).toFixed(2)}%`);
      star.style.setProperty("--star-y", `${y.toFixed(2)}%`);
      star.style.setProperty("--star-size", `${(0.8 + random() * 2.4).toFixed(2)}px`);
      star.style.setProperty("--star-duration", `${(2.8 + random() * 3.8).toFixed(2)}s`);
      star.style.setProperty("--star-delay", `${(-random() * 6).toFixed(2)}s`);
      star.setAttribute("aria-hidden", "true");
      container.append(star);
    }
  }

  function createStaticStarField(container, count, seed) {
    let state = seed >>> 0;
    const random = () => {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 4294967296;
    };

    for (let index = 0; index < count; index += 1) {
      const star = document.createElement("i");
      const lowerSky = random() < 0.68;
      const y = lowerSky ? 42 + random() * 56 : 2 + random() * 40;
      star.className = "star-dust";
      star.style.setProperty("--dust-x", `${(1 + random() * 98).toFixed(2)}%`);
      star.style.setProperty("--dust-y", `${y.toFixed(2)}%`);
      star.style.setProperty("--dust-size", `${(1 + random() * 1.8).toFixed(2)}px`);
      star.style.setProperty("--dust-opacity", `${(0.34 + random() * 0.54).toFixed(2)}`);
      star.setAttribute("aria-hidden", "true");
      container.append(star);
    }
  }

  document.querySelectorAll(".stars, .demo-stars").forEach((container, index) => {
    createStaticStarField(container, index === 0 ? 240 : 340, 20260904 + index * 3571);
    createStarField(container, index === 0 ? 160 : 230, 20260904 + index * 7919);
  });

  const cellElements = puzzle.flatMap((row, rowIndex) => row.map((value, colIndex) => {
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = `sudoku-cell${value ? " given" : ""}`;
    cell.dataset.row = String(rowIndex);
    cell.dataset.col = String(colIndex);
    cell.textContent = value || "";
    cell.setAttribute("aria-label", `${rowIndex + 1}행 ${colIndex + 1}열${value ? `, ${value}` : ", 빈칸"}`);
    cell.addEventListener("click", () => selectCell(rowIndex, colIndex));
    boardElement.append(cell);
    return cell;
  }));

  for (let number = 1; number <= 9; number += 1) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = String(number);
    button.dataset.number = String(number);
    button.disabled = true;
    button.setAttribute("aria-label", `숫자 ${number}`);
    button.addEventListener("click", () => enterNumber(number));
    numberPad.append(button);
  }

  function selectCell(row, col) {
    if (!started) return;
    selectedCell = { row, col };
    paintSelection();
  }

  function paintSelection() {
    const activeValue = selectedCell ? board[selectedCell.row][selectedCell.col] : 0;
    cellElements.forEach((cell) => {
      const row = Number(cell.dataset.row);
      const col = Number(cell.dataset.col);
      const sameBox = selectedCell && Math.floor(row / 3) === Math.floor(selectedCell.row / 3) && Math.floor(col / 3) === Math.floor(selectedCell.col / 3);
      const related = selectedCell && (row === selectedCell.row || col === selectedCell.col || sameBox);
      const sameNumber = activeValue > 0 && board[row][col] === activeValue;
      cell.classList.toggle("related", Boolean(related));
      cell.classList.toggle("same-number", sameNumber);
      cell.classList.toggle("selected", Boolean(selectedCell && row === selectedCell.row && col === selectedCell.col));
    });
  }

  function renderCell(row, col) {
    const cell = cellElements[row * 9 + col];
    const value = board[row][col];
    const cellNotes = notes[row][col];
    cell.replaceChildren();
    cell.classList.toggle("has-notes", value === 0 && cellNotes.size > 0);

    if (value !== 0) {
      cell.textContent = String(value);
      cell.setAttribute("aria-label", `${row + 1}행 ${col + 1}열, ${value}`);
      return;
    }

    if (cellNotes.size > 0) {
      for (let number = 1; number <= 9; number += 1) {
        const note = document.createElement("span");
        note.className = "cell-note";
        note.textContent = cellNotes.has(number) ? String(number) : "";
        cell.append(note);
      }
      cell.setAttribute("aria-label", `${row + 1}행 ${col + 1}열, 메모 ${[...cellNotes].sort().join(", ")}`);
    } else {
      cell.setAttribute("aria-label", `${row + 1}행 ${col + 1}열, 빈칸`);
    }
  }

  function removePeerNotes(row, col, number) {
    for (let index = 0; index < 9; index += 1) {
      const peers = [[row, index], [index, col]];
      peers.forEach(([peerRow, peerCol]) => {
        if (notes[peerRow][peerCol].delete(number)) renderCell(peerRow, peerCol);
      });
    }
    const blockRow = Math.floor(row / 3) * 3;
    const blockCol = Math.floor(col / 3) * 3;
    for (let peerRow = blockRow; peerRow < blockRow + 3; peerRow += 1) {
      for (let peerCol = blockCol; peerCol < blockCol + 3; peerCol += 1) {
        if (notes[peerRow][peerCol].delete(number)) renderCell(peerRow, peerCol);
      }
    }
  }

  function enterNumber(number) {
    if (!started || !selectedCell) return;
    const { row, col } = selectedCell;
    if (puzzle[row][col] !== 0) return;

    const cell = cellElements[row * 9 + col];

    if (memoMode) {
      if (board[row][col] !== 0) return;
      cell.classList.remove("invalid");
      if (number === 0) {
        notes[row][col].clear();
      } else if (notes[row][col].has(number)) {
        notes[row][col].delete(number);
      } else {
        notes[row][col].add(number);
      }
      renderCell(row, col);
      paintSelection();
      return;
    }

    cell.classList.remove("invalid");
    board[row][col] = number;
    notes[row][col].clear();
    renderCell(row, col);

    if (number !== 0 && number !== solution[row][col]) {
      mistakes += 1;
      mistakesElement.textContent = String(mistakes);
      requestAnimationFrame(() => cell.classList.add("invalid"));
    } else if (number !== 0) {
      removePeerNotes(row, col, number);
    }

    paintSelection();
    if (isComplete()) finishGame();
  }

  function isComplete() {
    return board.every((row, rowIndex) => row.every((value, colIndex) => value === solution[rowIndex][colIndex]));
  }

  function formatTime(totalSeconds) {
    const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
    const seconds = (totalSeconds % 60).toString().padStart(2, "0");
    return `${minutes}:${seconds}`;
  }

  function updateTimer() {
    if (!started) return;
    timeElement.textContent = formatTime(Math.floor((Date.now() - startedAt) / 1000));
  }

  function setControlsEnabled(enabled) {
    numberPad.querySelectorAll("button").forEach((button) => { button.disabled = !enabled; });
    eraseButton.disabled = !enabled;
    memoButton.disabled = !enabled;
    resetButton.disabled = !enabled;
  }

  function updateMemoUi() {
    memoButton?.setAttribute("aria-pressed", String(memoMode));
  }

  function toggleMemoMode() {
    memoMode = !memoMode;
    updateMemoUi();
  }

  function localeCopy() {
    const locale = document.documentElement.lang;
    return copy[locale] || copy.ko;
  }

  function updateBgmUi() {
    if (!bgmToggle) return;
    bgmToggle.setAttribute("aria-pressed", String(bgmEnabled));
    if (bgmIcon) bgmIcon.textContent = bgmEnabled ? "♫" : "♪";
    if (bgmState) bgmState.textContent = bgmEnabled ? localeCopy().soundOn : localeCopy().soundOff;
  }

  async function startBgm() {
    if (!bgm) return;
    bgm.volume = 0.28;
    try {
      await bgm.play();
      bgmEnabled = true;
    } catch {
      bgmEnabled = false;
    }
    updateBgmUi();
  }

  function pauseBgm() {
    bgm?.pause();
    bgmEnabled = false;
    updateBgmUi();
  }

  function updateScrollReveal() {
    revealFrame = 0;
    if (!demoSection) return;
    const top = demoSection.getBoundingClientRect().top;
    const start = window.innerHeight * 0.96;
    const end = window.innerHeight * 0.14;
    const progress = Math.max(0, Math.min(1, (start - top) / (start - end)));
    demoSection.style.setProperty("--reveal-progress", progress.toFixed(3));
  }

  function queueScrollReveal() {
    if (revealFrame) return;
    revealFrame = window.requestAnimationFrame(updateScrollReveal);
  }

  function startGame() {
    started = true;
    startedAt = Date.now();
    startLayer.classList.add("is-hidden");
    setControlsEnabled(true);
    clearInterval(timerId);
    timerId = window.setInterval(updateTimer, 1000);
    startBgm();
    const firstEmpty = cellElements.find((_, index) => puzzle[Math.floor(index / 9)][index % 9] === 0);
    firstEmpty?.focus();
  }

  function resetGame() {
    board = puzzle.map((row) => [...row]);
    notes = Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => new Set()));
    selectedCell = null;
    mistakes = 0;
    memoMode = false;
    startedAt = Date.now();
    timeElement.textContent = "00:00";
    mistakesElement.textContent = "0";
    cellElements.forEach((cell, index) => {
      const row = Math.floor(index / 9);
      const col = index % 9;
      cell.classList.remove("invalid", "related", "same-number", "selected");
      renderCell(row, col);
    });
    updateMemoUi();
    completionLayer.hidden = true;
  }

  function finishGame() {
    started = false;
    clearInterval(timerId);
    setControlsEnabled(false);
    completionLayer.hidden = false;
    replayButton.focus();
  }

  startButton.addEventListener("click", startGame);
  eraseButton.addEventListener("click", () => enterNumber(0));
  memoButton?.addEventListener("click", toggleMemoMode);
  resetButton.addEventListener("click", resetGame);
  replayButton.addEventListener("click", () => {
    resetGame();
    startGame();
  });
  bgmToggle?.addEventListener("click", () => {
    if (bgmEnabled) pauseBgm(); else startBgm();
  });
  document.addEventListener("starlight:locale", updateBgmUi);
  window.addEventListener("scroll", queueScrollReveal, { passive: true });
  window.addEventListener("resize", queueScrollReveal);
  updateBgmUi();
  updateScrollReveal();

  document.addEventListener("keydown", (event) => {
    if (!started) return;
    if (/^[1-9]$/.test(event.key)) {
      event.preventDefault();
      enterNumber(Number(event.key));
    } else if (event.key === "Backspace" || event.key === "Delete" || event.key === "0") {
      event.preventDefault();
      enterNumber(0);
    } else if (event.key.toLowerCase() === "m") {
      event.preventDefault();
      toggleMemoMode();
    }
  });
})();
