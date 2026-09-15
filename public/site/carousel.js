(() => {
  const root = document.querySelector('[data-carousel]');
  if (!root) return;

  const track = root.querySelector('.featured-track');
  const originalSlides = [...root.querySelectorAll('.featured-slide')];
  const count = root.querySelector('[data-count]');
  if (!track || originalSlides.length < 2) return;

  const total = originalSlides.length;
  const clone = originalSlides[0].cloneNode(true);
  clone.setAttribute('aria-hidden', 'true');
  clone.inert = true;
  track.appendChild(clone);
  const slides = [...track.querySelectorAll('.featured-slide')];
  let index = 0;
  let paused = false;

  const render = () => {
    track.style.transform = 'translateX(-' + (index * 100) + '%)';
    slides.forEach((slide, position) => {
      const visible = position === index && position < total;
      slide.inert = !visible;
      slide.setAttribute('aria-hidden', String(!visible));
    });
    if (count) {
      const shown = index === total ? 0 : index;
      count.textContent = String(shown + 1).padStart(2, '0') + ' / ' + String(total).padStart(2, '0');
    }
  };

  const next = () => {
    index += 1;
    render();
    if (index === total) {
      window.setTimeout(() => {
        track.style.transition = 'none';
        index = 0;
        render();
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => { track.style.transition = ''; });
        });
      }, 720);
    }
  };

  const prev = () => {
    if (index === 0) {
      track.style.transition = 'none';
      index = total;
      render();
      window.requestAnimationFrame(() => {
        track.style.transition = '';
        index = total - 1;
        render();
      });
      return;
    }
    index -= 1;
    render();
  };

  root.querySelector('[data-prev]')?.addEventListener('click', prev);
  root.querySelector('[data-next]')?.addEventListener('click', next);
  root.addEventListener('mouseenter', () => { paused = true; });
  root.addEventListener('mouseleave', () => { paused = false; });
  root.addEventListener('focusin', () => { paused = true; });
  root.addEventListener('focusout', () => { paused = root.contains(document.activeElement); });
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    window.setInterval(() => { if (!paused && !document.hidden) next(); }, 5000);
  }
  render();
})();
