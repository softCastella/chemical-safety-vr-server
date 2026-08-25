(() => {
  const root = document.querySelector('[data-carousel]');
  if (!root) return;
  const track = root.querySelector('.release-track');
  const originalSlides = [...root.querySelectorAll('.release-slide')];
  const count = root.querySelector('[data-count]');
  if (!track || originalSlides.length < 2) return;
  const total = originalSlides.length;
  track.style.transition = 'transform .7s cubic-bezier(.22,.61,.36,1)';
  const clone = originalSlides[0].cloneNode(true);
  clone.setAttribute('aria-hidden', 'true');
  track.appendChild(clone);
  const slides = [...track.querySelectorAll('.release-slide')];
  let index = 0;
  const render = () => {
    track.style.transform = 'translateX(-' + (index * 100) + '%)';
    slides.forEach((slide, i) => slide.classList.toggle('active', i === index));
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
  window.setInterval(() => next(), 5000);
  render();
})();