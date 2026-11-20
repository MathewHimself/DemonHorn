/* Рог Демона — скрипты страницы.
   Подключается в конце <body>, поэтому DOM уже готов.
   Парение и покачивание рога — на CSS (Stylesheets/animation.css). */
(() => {
  // ---------- Слайды: следующий наезжает на предыдущий ----------
  const slides = [...document.querySelectorAll('.slide')];
  let ticking = false;

  const clamp01 = (n) => Math.min(1, Math.max(0, n));

  const updateSlides = () => {
    ticking = false;
    const vh = window.innerHeight;
    slides.forEach((slide, i) => {
      if (i === 0) return;
      // 0 — верх слайда у нижнего края окна, 1 — слайд закрыл экран
      const enter = clamp01(1 - slide.getBoundingClientRect().top / vh);
      slide.style.setProperty('--enter', enter.toFixed(4));
      slides[i - 1].style.setProperty('--cover', enter.toFixed(4));
    });
  };

  const requestUpdate = () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(updateSlides);
    }
  };

  window.addEventListener('scroll', requestUpdate, { passive: true });
  window.addEventListener('resize', requestUpdate);
  updateSlides();

  // ---------- Печать строки «гнев вернется потом» ----------
  const ghost = document.querySelector('.whisper__ghost');
  const typed = document.querySelector('.whisper__typed');
  if (!ghost || !typed) return;

  const text = ghost.textContent;
  const TYPE_DELAY = 110;   // мс на букву при наборе
  const ERASE_DELAY = 45;   // мс на букву при стирании
  const HOLD_FULL = 2600;   // пауза, когда строка набрана
  const HOLD_EMPTY = 700;   // пауза перед новым набором

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) {
    typed.textContent = text;
    return;
  }

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const loop = async () => {
    await wait(900); // даём странице появиться
    for (;;) {
      for (let i = 1; i <= text.length; i++) {
        typed.textContent = text.slice(0, i);
        await wait(text[i - 1] === ' ' || text[i - 1] === '\u00a0' ? TYPE_DELAY / 2 : TYPE_DELAY);
      }
      await wait(HOLD_FULL);
      for (let i = text.length - 1; i >= 0; i--) {
        typed.textContent = text.slice(0, i);
        await wait(ERASE_DELAY);
      }
      await wait(HOLD_EMPTY);
    }
  };

  loop();
})();
