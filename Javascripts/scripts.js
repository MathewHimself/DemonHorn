/* Рог Демона — скрипты страницы.
   Подключается в конце <body>, поэтому DOM уже готов.
   Парение и покачивание рога — на CSS (Stylesheets/animation.css). */
(() => {
  // ---------- Слайды: следующий наезжает на предыдущий ----------
  // Прогресс считается от прокрутки, но к нему подтягивается плавно
  // (с инерцией), поэтому движение мягкое даже при рывках колёсика.
  const slides = [...document.querySelectorAll('.slide')];
  const reduceMotionSlides = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const clamp01 = (n) => Math.min(1, Math.max(0, n));
  const smooth = (t) => t * t * (3 - 2 * t);           // плавный старт и финиш
  const SMOOTHING = 0.09;                               // меньше — плавнее и ленивее

  const state = slides.map(() => ({ target: 1, current: 1 }));
  let running = false;

  const readTargets = () => {
    const vh = window.innerHeight;
    slides.forEach((slide, i) => {
      if (i === 0) return;
      // 0 — верх слайда у нижнего края окна, 1 — слайд закрыл экран
      state[i].target = clamp01(1 - slide.getBoundingClientRect().top / vh);
    });
  };

  const render = () => {
    let moving = false;

    slides.forEach((slide, i) => {
      if (i === 0) return;
      const st = state[i];
      st.current += (st.target - st.current) * SMOOTHING;
      if (Math.abs(st.target - st.current) < 0.0005) st.current = st.target;
      else moving = true;

      const e = smooth(st.current);
      slide.style.setProperty('--enter', e.toFixed(4));
      slides[i - 1].style.setProperty('--cover', e.toFixed(4));

    });

    running = moving;
    if (moving) requestAnimationFrame(render);
    else hideRimSoon();
  };

  // Красная линия: видна, пока крутят колёсико и пока слайд догоняет прокрутку
  const container = document.querySelector('.slides');
  let rimTimer = 0;
  const hideRimSoon = () => {
    clearTimeout(rimTimer);
    rimTimer = setTimeout(() => {
      if (!running) container.classList.remove('is-scrolling');
    }, 120);
  };

  const kick = () => {
    container.classList.add('is-scrolling');
    clearTimeout(rimTimer);
    readTargets();
    if (!running) {
      running = true;
      requestAnimationFrame(render);
    }
  };

  if (reduceMotionSlides) {
    // без анимации: слайды просто наезжают ровно
    slides.forEach((slide) => slide.style.setProperty('--enter', '1'));
  } else {
    window.addEventListener('scroll', kick, { passive: true });
    window.addEventListener('resize', kick);
    readTargets();
    slides.forEach((_, i) => { state[i].current = state[i].target; });
    running = true;
    render();
  }

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
