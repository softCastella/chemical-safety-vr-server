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
  const resetButton = document.querySelector("[data-reset]");
  const timeElement = document.querySelector("[data-game-time]");
  const mistakesElement = document.querySelector("[data-game-mistakes]");
  const completionLayer = document.querySelector("[data-completion-layer]");
  const replayButton = document.querySelector("[data-replay]");

  if (!boardElement || !startButton || !numberPad) return;

  let board = puzzle.map((row) => [...row]);
  let selectedCell = null;
  let mistakes = 0;
  let started = false;
  let startedAt = 0;
  let timerId = 0;

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

  function enterNumber(number) {
    if (!started || !selectedCell) return;
    const { row, col } = selectedCell;
    if (puzzle[row][col] !== 0) return;

    board[row][col] = number;
    const cell = cellElements[row * 9 + col];
    cell.textContent = number || "";
    cell.setAttribute("aria-label", `${row + 1}행 ${col + 1}열${number ? `, ${number}` : ", 빈칸"}`);
    cell.classList.remove("invalid");

    if (number !== 0 && number !== solution[row][col]) {
      mistakes += 1;
      mistakesElement.textContent = String(mistakes);
      requestAnimationFrame(() => cell.classList.add("invalid"));
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
    resetButton.disabled = !enabled;
  }

  function startGame() {
    started = true;
    startedAt = Date.now();
    startLayer.classList.add("is-hidden");
    setControlsEnabled(true);
    clearInterval(timerId);
    timerId = window.setInterval(updateTimer, 1000);
    const firstEmpty = cellElements.find((_, index) => puzzle[Math.floor(index / 9)][index % 9] === 0);
    firstEmpty?.focus();
  }

  function resetGame() {
    board = puzzle.map((row) => [...row]);
    selectedCell = null;
    mistakes = 0;
    startedAt = Date.now();
    timeElement.textContent = "00:00";
    mistakesElement.textContent = "0";
    cellElements.forEach((cell, index) => {
      const row = Math.floor(index / 9);
      const col = index % 9;
      const value = puzzle[row][col];
      cell.textContent = value || "";
      cell.classList.remove("invalid", "related", "same-number", "selected");
    });
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
  resetButton.addEventListener("click", resetGame);
  replayButton.addEventListener("click", () => {
    resetGame();
    startGame();
  });

  document.addEventListener("keydown", (event) => {
    if (!started) return;
    if (/^[1-9]$/.test(event.key)) {
      event.preventDefault();
      enterNumber(Number(event.key));
    } else if (event.key === "Backspace" || event.key === "Delete" || event.key === "0") {
      event.preventDefault();
      enterNumber(0);
    }
  });
})();
