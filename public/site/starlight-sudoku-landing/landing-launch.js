(() => {
  const playUrl = "https://softcastella.github.io/Starlight-Sudoku/";

  function seededRandom(seed) {
    let state = seed >>> 0;
    return () => {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 4294967296;
    };
  }

  function createStarField(container, count, seed) {
    const random = seededRandom(seed);
    for (let index = 0; index < count; index += 1) {
      const star = document.createElement("i");
      star.className = `star-dot${index % 2 ? " is-alt" : ""}${index % 3 === 0 ? " is-white" : ""}${index % 9 === 0 ? " is-cross" : ""}`;
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
    const random = seededRandom(seed);
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

  const stars = document.querySelector(".stars");
  if (stars) {
    createStaticStarField(stars, 240, 20260904);
    createStarField(stars, 160, 20260904);
  }

  const playLink = document.querySelector("[data-play-launch]");
  if (!playLink) return;
  playLink.href = playUrl;

  playLink.addEventListener("click", (event) => {
    if (window.matchMedia("(max-width: 680px)").matches) return;

    event.preventDefault();
    const width = Math.max(360, Math.min(430, window.screen.availWidth - 32));
    const height = Math.max(480, Math.min(900, window.screen.availHeight - 48));
    const left = Math.max(0, Math.round((window.screen.availWidth - width) / 2));
    const top = Math.max(0, Math.round((window.screen.availHeight - height) / 2));
    const features = `popup=yes,width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`;
    const gameWindow = window.open(playUrl, "starlightSudokuMobile", features);

    if (gameWindow) {
      gameWindow.opener = null;
      gameWindow.focus();
    } else {
      window.location.assign(playUrl);
    }
  });
})();
