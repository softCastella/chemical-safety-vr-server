(() => {
  const playUrl = "/play/";

  function localizedPlayUrl() {
    const url = new URL(playUrl, window.location.origin);
    url.searchParams.set("lang", document.documentElement.lang || "ko");
    return window.starlightAnalytics
      ? window.starlightAnalytics.decorateUrl(url.toString())
      : url.toString();
  }

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

  function setupCursorStardust() {
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!finePointer.matches || reducedMotion.matches) return;

    const layer = document.createElement("div");
    layer.className = "cursor-stardust";
    layer.setAttribute("aria-hidden", "true");
    const particles = Array.from({ length: 96 }, () => {
      const particle = document.createElement("i");
      particle.className = "cursor-stardust-particle";
      layer.append(particle);
      return particle;
    });
    document.body.append(layer);

    let particleIndex = 0;
    let animationFrame = 0;
    let lastPoint = null;
    let pendingPoint = null;

    function emitParticle(point, movementX, movementY, progress) {
      const particle = particles[particleIndex % particles.length];
      particleIndex += 1;
      const movementLength = Math.hypot(movementX, movementY);
      const directionX = movementLength ? movementX / movementLength : 0;
      const directionY = movementLength ? movementY / movementLength : 0;
      const normalX = -directionY;
      const normalY = directionX;
      const tailRatio = 1 - progress;
      const trailLength = 60 + Math.min(110, movementLength * 2.8);
      const backDistance = tailRatio * trailLength * (0.72 + Math.random() * 0.28);
      const halfWidth = 5 + tailRatio * (44 + Math.min(36, movementLength * 0.6));
      const sideDistance = (Math.random() * 2 - 1) * halfWidth;
      const driftBack = 8 + tailRatio * 20 + Math.random() * 12;
      const driftSide = (Math.random() - 0.5) * (18 + tailRatio * 32);
      const x = point.x - directionX * backDistance + normalX * sideDistance;
      const y = point.y - directionY * backDistance + normalY * sideDistance;
      const driftX = -directionX * driftBack + normalX * driftSide;
      const driftY = -directionY * driftBack + normalY * driftSide;

      particle.style.left = `${x.toFixed(1)}px`;
      particle.style.top = `${y.toFixed(1)}px`;
      particle.style.setProperty("--cursor-dust-size", `${(2.4 + Math.random() * 2.8).toFixed(1)}px`);
      particle.style.setProperty("--cursor-dust-opacity", `${(0.86 + Math.random() * 0.13).toFixed(2)}`);
      particle.style.setProperty("--cursor-dust-drift-x", `${driftX.toFixed(1)}px`);
      particle.style.setProperty("--cursor-dust-drift-y", `${driftY.toFixed(1)}px`);
      particle.style.setProperty("--cursor-dust-duration", `${Math.round(680 + tailRatio * 240 + Math.random() * 280)}ms`);
      particle.classList.remove("is-active");
      void particle.offsetWidth;
      particle.classList.add("is-active");
    }

    function drawCursorStardust(timestamp) {
      animationFrame = 0;
      if (!pendingPoint || !finePointer.matches || reducedMotion.matches) return;
      const point = pendingPoint;
      pendingPoint = null;
      const movementX = lastPoint ? point.x - lastPoint.x : 0;
      const movementY = lastPoint ? point.y - lastPoint.y : 0;
      const movementLength = Math.hypot(movementX, movementY);
      if (!lastPoint || movementLength >= 2) {
        const emissionCount = !lastPoint ? 1 : movementLength >= 20 ? 3 : 2;
        for (let index = 1; index <= emissionCount; index += 1) {
          const progress = index / emissionCount;
          emitParticle(point, movementX, movementY, progress);
        }
        lastPoint = point;
      }
    }

    document.addEventListener("pointermove", (event) => {
      if (event.pointerType && event.pointerType !== "mouse") return;
      pendingPoint = { x: event.clientX, y: event.clientY };
      if (!animationFrame) animationFrame = window.requestAnimationFrame(drawCursorStardust);
    }, { passive: true });
    document.addEventListener("pointerleave", () => {
      pendingPoint = null;
      lastPoint = null;
    });
  }

  setupCursorStardust();

  const playLink = document.querySelector("[data-play-launch]");
  if (!playLink) return;
  window.starlightAnalytics?.setScreen("landing", null, null);
  window.starlightAnalytics?.trackJson(JSON.stringify({ event_name: "landing_view" }));
  playLink.href = localizedPlayUrl();
  document.addEventListener("starlight:locale", () => {
    playLink.href = localizedPlayUrl();
  });

  const burstLayer = playLink.querySelector(".cta-burst-layer");
  const twinkles = [...playLink.querySelectorAll(".cta-twinkle")];
  let lastBurstAt = 0;

  function createCtaBurst() {
    if (!burstLayer || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const now = performance.now();
    if (now - lastBurstAt < 240) return;
    lastBurstAt = now;
    const buttonRect = playLink.getBoundingClientRect();
    const renderedScale = buttonRect.width / playLink.offsetWidth || 1;
    const particleStarts = twinkles.map((twinkle) => {
      const rect = twinkle.getBoundingClientRect();
      const x = (rect.left + rect.width / 2 - (buttonRect.left + buttonRect.width / 2)) / renderedScale;
      const y = (rect.top + rect.height / 2 - (buttonRect.top + buttonRect.height / 2)) / renderedScale;
      return { x, y };
    });
    burstLayer.replaceChildren();
    playLink.classList.remove("is-bursting");
    void playLink.offsetWidth;
    playLink.classList.add("is-bursting");

    for (const [index, start] of particleStarts.entries()) {
      const particle = document.createElement("i");
      particle.className = "cta-burst-particle";
      particle.style.setProperty("--burst-start-x", `${start.x.toFixed(1)}px`);
      particle.style.setProperty("--burst-start-y", `${start.y.toFixed(1)}px`);
      particle.style.setProperty("--burst-size", `${3 + (index % 2)}px`);
      particle.style.setProperty("--burst-delay", `${(index % 4) * 0.018}s`);
      particle.style.setProperty("--burst-color", "#ffffff");
      burstLayer.append(particle);
    }

    window.setTimeout(() => {
      playLink.classList.remove("is-bursting");
      burstLayer.replaceChildren();
    }, 1050);
  }

  playLink.addEventListener("pointerdown", createCtaBurst);

  playLink.addEventListener("click", () => {
    window.starlightAnalytics?.trackJson(JSON.stringify({
      event_name: "landing_cta_click",
      screen_id: "landing",
      target_id: "landing_cta",
      target_type: "link",
      is_interactive: true,
    }));
    createCtaBurst();
  });
})();
