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

  // Зубчатый край: случайные, но постоянные зубцы, наклонённые вправо, как рога
  const rand = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
  const TEETH = 11;
  const teeth = Array.from({ length: TEETH }, () => ({
    depth: 0.55 + rand() * 0.45,   // глубина впадины, доля от амплитуды
    lean: 0.62 + rand() * 0.2,     // где внутри зубца остриё (сдвиг вправо)
    tip: rand() * 0.18,            // остриё не всегда доходит до самого верха
  }));

  // Точки верхнего края: x в %, y в px от верха слайда.
  // Каждый зубец — изогнутый рог: пологий вогнутый подъём к острию
  // и крутой спуск к следующей впадине.
  const edgePoints = (amp, lift) => {
    const w = 100 / TEETH;
    const sag = (x) => amp * 0.35 * Math.sin(Math.PI * x / 100); // середина края провисает
    const y = (x, depth) => amp * depth + sag(x) - lift;
    const pts = [];
    for (let i = 0; i < TEETH; i++) {
      const t = teeth[i];
      const next = teeth[(i + 1) % TEETH];
      const vx = i * w;
      const tx = vx + w * t.lean;
      const nx = vx + w;
      for (let k = 0; k < 6; k++) {            // подъём: вогнутая дуга
        const u = k / 6;
        const x = vx + (tx - vx) * u;
        pts.push([x, y(x, t.depth + (t.tip - t.depth) * Math.pow(u, 2.2))]);
      }
      for (let k = 0; k < 3; k++) {            // спуск: крутой, чуть выпуклый
        const u = k / 3;
        const x = tx + (nx - tx) * u;
        pts.push([x, y(x, t.tip + (next.depth - t.tip) * Math.pow(u, 0.55))]);
      }
    }
    pts.push([100, y(100, teeth[0].depth)]);
    return pts;
  };

  const toClip = (pts) =>
    'polygon(' +
    pts.map(([x, y]) => `${x.toFixed(2)}% ${Math.max(0, y).toFixed(1)}px`).join(', ') +
    ', 100% 100%, 0% 100%)';

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
    const vh = window.innerHeight;
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

      const panel = slide.querySelector('.slide__panel');
      const rim = slide.querySelector('.slide__rim');
      if (!panel || !rim) return;

      const rest = 1 - e;
      const amp = vh * 0.22 * rest;          // высота зубцов
      const rimWidth = vh * 0.018 * Math.sqrt(rest);
      panel.style.clipPath = toClip(edgePoints(amp, 0));
      rim.style.clipPath = toClip(edgePoints(amp, rimWidth));
    });

    running = moving;
    if (moving) requestAnimationFrame(render);
  };

  const kick = () => {
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
