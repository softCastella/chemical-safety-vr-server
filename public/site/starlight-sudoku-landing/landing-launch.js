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

  const burstLayer = playLink.querySelector(".cta-burst-layer");
  let lastBurstAt = 0;

  function createCtaBurst() {
    if (!burstLayer || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const now = performance.now();
    if (now - lastBurstAt < 240) return;
    lastBurstAt = now;
    burstLayer.replaceChildren();
    playLink.classList.remove("is-bursting");
    void playLink.offsetWidth;
    playLink.classList.add("is-bursting");

    for (let index = 0; index < 18; index += 1) {
      const particle = document.createElement("i");
      const angle = ((index * 360) / 18 + (index % 2 ? 7 : -5)) * (Math.PI / 180);
      const startRadius = 86 + (index % 4) * 8;
      const endRadius = 132 + (index % 5) * 11;
      particle.className = "cta-burst-particle";
      particle.style.setProperty("--burst-start-x", `${(Math.cos(angle) * startRadius).toFixed(1)}px`);
      particle.style.setProperty("--burst-start-y", `${(Math.sin(angle) * startRadius * 0.88).toFixed(1)}px`);
      particle.style.setProperty("--burst-end-x", `${(Math.cos(angle) * endRadius).toFixed(1)}px`);
      particle.style.setProperty("--burst-end-y", `${(Math.sin(angle) * endRadius * 0.92 - 12).toFixed(1)}px`);
      particle.style.setProperty("--burst-size", `${2 + (index % 3)}px`);
      particle.style.setProperty("--burst-delay", `${(index % 6) * 0.025}s`);
      particle.style.setProperty("--burst-color", index % 3 === 0 ? "#fffaf0" : "#ffd86a");
      burstLayer.append(particle);
    }

    window.setTimeout(() => {
      playLink.classList.remove("is-bursting");
      burstLayer.replaceChildren();
    }, 1050);
  }

  playLink.addEventListener("pointerdown", createCtaBurst);

  playLink.addEventListener("click", (event) => {
    createCtaBurst();
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
