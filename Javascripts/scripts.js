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


  // ---------- Слайд 3: гнев проявляется + линза pinch под курсором ----------
  (() => {
    const rage = document.querySelector('.rage');
    const tail = document.querySelector('.slides__tail');
    if (!rage || !tail) return;

    const slide = rage.closest('.slide');
    const canvas = rage.querySelector('.rage__canvas');
    const imgGrey = rage.querySelector('.rage__img--grey');
    const imgRed = rage.querySelector('.rage__img--red');
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Положение фото в макете 1920×1080 (из Figma): x, y, ширина, высота
    const RECT_GREY = [-30, -61, 2000.5, 1202];
    const RECT_RED = [-192, -61, 2215, 1202];
    const LENS_RADIUS = 210; // радиус линзы в px макета

    // Прогресс проявления: 0 — слайд только встал, 1 — прокручен запас под ним
    const readReveal = () => {
      const vh = window.innerHeight;
      return Math.min(1, Math.max(0, 1 - tail.getBoundingClientRect().top / vh));
    };

    const s = {
      reveal: 0, revealT: 0,
      mx: -1e4, my: -1e4, mxT: -1e4, myT: -1e4,   // линза
      lens: 0, lensT: 0,
      pinch: 0.55, pinchT: 0.55,
      speed: 0,
    };

    // ---------- Ввод ----------
    const toLocal = (e) => {
      const r = rage.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top];
    };

    rage.addEventListener('pointermove', (e) => {
      const [x, y] = toLocal(e);
      s.speed = Math.min(1, s.speed + Math.hypot(x - s.mxT, y - s.myT) / 400);
      if (s.lensT === 0) { s.mx = x; s.my = y; } // без «прилёта» из угла
      s.mxT = x; s.myT = y;
      s.lensT = 1;
    });
    rage.addEventListener('pointerleave', () => {
      s.lensT = 0;
      s.pinchT = 0.55;
    });
    rage.addEventListener('pointerdown', () => { s.pinchT = 1; });
    window.addEventListener('pointerup', () => { s.pinchT = 0.55; });

    // ---------- WebGL ----------
    const gl = canvas.getContext('webgl', { antialias: false, premultipliedAlpha: false });

    const VERT = `
      attribute vec2 aPos;
      void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
    `;

    const FRAG = `
      precision highp float;
      uniform vec2 uRes;        // размер canvas, px
      uniform float uScale;     // px canvas на 1 px макета
      uniform vec2 uOffset;     // где на canvas начало макета
      uniform vec4 uRectGrey;
      uniform vec4 uRectRed;
      uniform sampler2D uGrey;
      uniform sampler2D uRed;
      uniform vec2 uMouse;      // px canvas, отсчёт сверху
      uniform float uRadius;    // px canvas
      uniform float uLens;      // 0..1 — линза видна
      uniform float uPinch;     // сила сжатия
      uniform float uReveal;    // 0..1 — проявление
      uniform float uTime;

      const vec3 BG = vec3(0.0824);  // #151515

      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x),
                   mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
      }
      float fbm(vec2 p) {
        float v = 0.0, a = 0.5;
        for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
        return v;
      }

      vec3 sampleRect(sampler2D tex, vec4 rect, vec2 design) {
        vec2 uv = (design - rect.xy) / rect.zw;
        if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return BG;
        return texture2D(tex, uv).rgb;
      }

      // Цвет точки макета: серое фото, поверх — проявившееся красное.
      // lensMix — насколько точка внутри линзы (там всё наоборот).
      vec3 shade(vec2 design, float lensMix) {
        vec3 grey = sampleRect(uGrey, uRectGrey, design);
        vec3 red = sampleRect(uRed, uRectRed, design);
        // Проявление: сначала тёмные места (глаза, волосы), неровными пятнами
        float lum = dot(red, vec3(0.299, 0.587, 0.114));
        float n = fbm(design / 160.0 + vec2(0.0, uTime * 0.04));
        float field = n * 0.65 + (1.0 - lum) * 0.35;
        float t = uReveal * 1.25 - 0.1;
        float m = smoothstep(field - 0.08, field + 0.08, t);
        // Линза показывает обратное: пока лицо спокойно — гнев, когда гнев проявился — спокойствие
        m = mix(m, 1.0 - m, lensMix);
        return mix(grey, red, m);
      }

      void main() {
        vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);

        // Pinch: внутри линзы картинка стягивается к центру курсора
        vec2 d = p - uMouse;
        float r = length(d);
        float R = uRadius * uLens;
        float f = R > 1.0 ? r / R : 9.0;
        vec2 q = p;
        if (f < 1.0) {
          float k = 1.0 - 0.62 * uPinch * uLens;        // показатель < 1 → сжатие
          q = uMouse + (r > 0.0 ? d / r : vec2(0.0)) * R * pow(f, k);
        }
        float lensMix = (1.0 - smoothstep(0.45, 1.05, f)) * uLens;
        vec2 design = (q - uOffset) / uScale;

        // Вместо обводки — мягкий блюр по краю линзы
        float band = exp(-pow((f - 0.85) / 0.22, 2.0)) * uLens;
        vec3 col;
        if (band > 0.02) {
          float br = 9.0 * band;                     // радиус размытия, px макета
          col = shade(design, lensMix) * 0.2;
          for (int i = 0; i < 8; i++) {
            float a = float(i) * 0.7854;
            col += shade(design + vec2(cos(a), sin(a)) * br, lensMix) * 0.1;
          }
        } else {
          col = shade(design, lensMix);
        }

        gl_FragColor = vec4(col, 1.0);
      }
    `;

    const compile = (type, src) => {
      const sh = gl.createShader(type);
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
      return sh;
    };

    const loaded = (img) => (img.complete && img.naturalWidth
      ? Promise.resolve(img)
      : new Promise((res, rej) => { img.addEventListener('load', () => res(img), { once: true }); img.addEventListener('error', rej, { once: true }); }));

    let U = null;
    const setup = () => {
      const prog = gl.createProgram();
      gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
      gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
      gl.useProgram(prog);

      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, 'aPos');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

      const tex = (img, unit) => {
        const t = gl.createTexture();
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_2D, t);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
      };
      tex(imgGrey, 0);
      tex(imgRed, 1);

      U = {};
      ['uRes', 'uScale', 'uOffset', 'uRectGrey', 'uRectRed', 'uGrey', 'uRed', 'uMouse',
        'uRadius', 'uLens', 'uPinch', 'uReveal', 'uTime'].forEach((n) => { U[n] = gl.getUniformLocation(prog, n); });
      gl.uniform1i(U.uGrey, 0);
      gl.uniform1i(U.uRed, 1);
      gl.uniform4fv(U.uRectGrey, RECT_GREY);
      gl.uniform4fv(U.uRectRed, RECT_RED);
    };

    let dpr = 1, scaleCss = 1;
    const resize = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = rage.clientWidth, h = rage.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      scaleCss = Math.max(w / 1920, h / 1080);   // как --cu в CSS
      if (!U) return;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(U.uRes, canvas.width, canvas.height);
      gl.uniform1f(U.uScale, scaleCss * dpr);
      gl.uniform2f(U.uOffset, (w - 1920 * scaleCss) / 2 * dpr, (h - 1080 * scaleCss) / 2 * dpr);
      gl.uniform1f(U.uRadius, LENS_RADIUS * scaleCss * dpr);
    };

    // ---------- Цикл: работает, только пока слайд на экране ----------
    let visible = false, raf = 0;
    const start = performance.now();
    const lerp = (a, b, k) => a + (b - a) * k;

    const frame = (now) => {
      raf = 0;
      s.revealT = readReveal();
      s.reveal = reduce ? s.revealT : lerp(s.reveal, s.revealT, 0.08);
      s.mx = lerp(s.mx, s.mxT, 0.22);
      s.my = lerp(s.my, s.myT, 0.22);
      s.lens = lerp(s.lens, s.lensT, 0.12);
      s.speed *= 0.9;
      s.pinch = lerp(s.pinch, Math.min(1.2, s.pinchT + s.speed * 0.35), 0.12);

      slide.style.setProperty('--reveal', s.reveal.toFixed(4));
      rage.style.setProperty('--reveal', s.reveal.toFixed(4));

      if (U) {
        gl.uniform2f(U.uMouse, s.mx * dpr, s.my * dpr);
        gl.uniform1f(U.uLens, s.lens);
        gl.uniform1f(U.uPinch, s.pinch);
        gl.uniform1f(U.uReveal, s.reveal);
        gl.uniform1f(U.uTime, reduce ? 0 : (now - start) / 1000);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }
      if (visible) raf = requestAnimationFrame(frame);
    };

    const run = () => { if (!raf) raf = requestAnimationFrame(frame); };

    new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) run();
    }).observe(rage);

    window.addEventListener('resize', resize);
    resize();

    if (gl) {
      Promise.all([loaded(imgGrey), loaded(imgRed)])
        .then(() => {
          setup();
          resize();
          rage.classList.add('is-gl');
          run();
        })
        .catch(() => { /* без WebGL остаётся CSS-проявление картинкой */ });
    }
  })();

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
