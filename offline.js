(function () {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function initNavigation() {
    const button = document.querySelector('.nav__hamburger');
    const menu = document.querySelector('.nav__mobile');
    if (button && menu) {
      button.setAttribute('aria-expanded', 'false');
      button.addEventListener('click', function () {
        const open = menu.classList.toggle('nav__mobile--open');
        button.classList.toggle('nav__hamburger--active', open);
        button.setAttribute('aria-expanded', String(open));
        document.body.style.overflow = open ? 'hidden' : '';
      });
      menu.querySelectorAll('a').forEach(function (link) {
        link.addEventListener('click', function () {
          menu.classList.remove('nav__mobile--open');
          button.classList.remove('nav__hamburger--active');
          button.setAttribute('aria-expanded', 'false');
          document.body.style.overflow = '';
        });
      });
    }
    document.querySelectorAll('.nav__locale').forEach(function (locale) {
      locale.addEventListener('click', function () { window.location.href = 'https://qeen.ai/en'; });
    });
    document.querySelectorAll('button.cta').forEach(function (cta) {
      cta.addEventListener('click', function () {
        const contact = document.getElementById('contact');
        if (contact) contact.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
      });
    });
  }

  function initTypewriter() {
    const target = document.querySelector('.hero__typed');
    if (!target) return;
    const phrases = ['صُممت لزيادة المبيعات', 'تعمل بالذكاء الاصطناعي', 'تدار بخبرة بشرية'];
    if (reduceMotion) { target.textContent = phrases[0]; return; }
    let phrase = 0, letter = 0, deleting = false;
    function tick() {
      const text = phrases[phrase];
      letter += deleting ? -1 : 1;
      target.textContent = text.slice(0, Math.max(0, letter));
      let delay = deleting ? 62 : 75;
      if (!deleting && letter >= text.length) { deleting = true; delay = 900; }
      else if (deleting && letter <= 0) { deleting = false; phrase = (phrase + 1) % phrases.length; delay = 260; }
      window.setTimeout(tick, delay);
    }
    target.textContent = '';
    tick();
  }

  function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source); gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) { gl.deleteShader(shader); return null; }
    return shader;
  }

  function initMaskedVideo(canvasSelector, wrapperSelector, flipY) {
    const canvas = document.querySelector(canvasSelector);
    const wrapper = document.querySelector(wrapperSelector);
    if (!canvas || !wrapper) return;
    const videos = wrapper.querySelectorAll('video');
    if (videos.length < 2) return;
    const colorVideo = videos[0], maskVideo = videos[1];
    const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true });
    if (!gl) { colorVideo.style.cssText += ';display:block!important;opacity:1!important;width:100%;height:100%;object-fit:cover'; return; }
    const vertex = createShader(gl, gl.VERTEX_SHADER,
      'attribute vec2 a_position;attribute vec2 a_texCoord;varying vec2 v_texCoord;void main(){gl_Position=vec4(a_position,0.0,1.0);v_texCoord=' + (flipY ? 'vec2(a_texCoord.x,1.0-a_texCoord.y)' : 'a_texCoord') + ';}');
    const fragment = createShader(gl, gl.FRAGMENT_SHADER,
      'precision mediump float;uniform sampler2D u_color;uniform sampler2D u_mask;varying vec2 v_texCoord;void main(){vec4 c=texture2D(u_color,v_texCoord);vec4 m=texture2D(u_mask,v_texCoord);float a=dot(m.rgb,vec3(.299,.587,.114));float green=max(0.0,c.g-max(c.r,c.b));float greenMask=smoothstep(.045,.28,green);float light=max(max(c.r,c.g),c.b);vec3 redTone=vec3(light,.035*light,.035*light);vec3 themed=mix(c.rgb,redTone,greenMask);gl_FragColor=vec4(themed,a*c.a);}');
    if (!vertex || !fragment) return;
    const program = gl.createProgram(); gl.attachShader(program, vertex); gl.attachShader(program, fragment); gl.linkProgram(program); gl.useProgram(program);
    const buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    const coordinates = flipY
      ? [-1,-1,0,0, 1,-1,1,0, -1,1,0,1, 1,1,1,1]
      : [-1,-1,0,1, 1,-1,1,1, -1,1,0,0, 1,1,1,0];
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(coordinates), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, 'a_position');
    const texCoord = gl.getAttribLocation(program, 'a_texCoord');
    gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(texCoord); gl.vertexAttribPointer(texCoord, 2, gl.FLOAT, false, 16, 8);
    function texture(unit, uniform) {
      const value = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, value);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.uniform1i(gl.getUniformLocation(program, uniform), unit); return value;
    }
    const colorTexture = texture(0, 'u_color'), maskTexture = texture(1, 'u_mask');
    function resize() {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.round(canvas.clientWidth * ratio));
      const height = Math.max(1, Math.round(canvas.clientHeight * ratio));
      if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; gl.viewport(0, 0, width, height); }
    }
    function upload(unit, textureValue, video) {
      gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, textureValue);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
    }
    function render() {
      resize();
      if (colorVideo.readyState >= 2 && maskVideo.readyState >= 2) {
        try { upload(0, colorTexture, colorVideo); upload(1, maskTexture, maskVideo); gl.clearColor(0,0,0,0); gl.clear(gl.COLOR_BUFFER_BIT); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); } catch (_) {}
      }
      window.requestAnimationFrame(render);
    }
    colorVideo.addEventListener('timeupdate', function () { if (Math.abs(maskVideo.currentTime - colorVideo.currentTime) > .12) maskVideo.currentTime = colorVideo.currentTime; });
    Promise.all([colorVideo.play(), maskVideo.play()].map(function (p) { return p && p.catch(function () {}); }));
    render();
  }

  function initLoopSlider(sliderSelector, groupSelector, speed) {
    const slider = document.querySelector(sliderSelector);
    if (!slider) return;
    const group = slider.querySelector(groupSelector);
    if (!group) return;
    let offset = 0, dragging = false, startX = 0, startOffset = 0, previous = performance.now();
    slider.style.touchAction = 'pan-y'; slider.style.cursor = 'grab';
    function width() { return group.scrollWidth || group.getBoundingClientRect().width; }
    function frame(now) {
      const total = width();
      if (!dragging && !reduceMotion && total) offset += speed * Math.min((now - previous) / 1000, .05);
      previous = now;
      if (total) slider.style.transform = 'translate3d(' + (-(offset % total)) + 'px,0,0)';
      window.requestAnimationFrame(frame);
    }
    slider.addEventListener('pointerdown', function (event) { dragging = true; startX = event.clientX; startOffset = offset; slider.style.cursor = 'grabbing'; slider.setPointerCapture(event.pointerId); });
    slider.addEventListener('pointermove', function (event) { if (dragging) offset = startOffset - (event.clientX - startX); });
    function stop() { dragging = false; slider.style.cursor = 'grab'; }
    slider.addEventListener('pointerup', stop); slider.addEventListener('pointercancel', stop); slider.addEventListener('lostpointercapture', stop);
    window.requestAnimationFrame(frame);
  }

  function initComparison() {
    document.querySelectorAll('.compare').forEach(function (compare) {
      const handle = compare.querySelector('.handle');
      if (!handle) return;
      let dragging = false;
      function setPosition(clientX) {
        const rect = compare.getBoundingClientRect();
        const value = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
        compare.style.setProperty('--pos', value + '%'); handle.setAttribute('aria-valuenow', String(Math.round(value)));
      }
      handle.setAttribute('tabindex', '0'); handle.setAttribute('role', 'slider'); handle.setAttribute('aria-valuemin', '0'); handle.setAttribute('aria-valuemax', '100');
      handle.addEventListener('pointerdown', function (event) { dragging = true; handle.setPointerCapture(event.pointerId); setPosition(event.clientX); });
      handle.addEventListener('pointermove', function (event) { if (dragging) setPosition(event.clientX); });
      handle.addEventListener('pointerup', function () { dragging = false; });
      handle.addEventListener('keydown', function (event) {
        let value = Number(handle.getAttribute('aria-valuenow') || 50);
        if (event.key === 'ArrowLeft') value -= 2; else if (event.key === 'ArrowRight') value += 2; else if (event.key === 'Home') value = 0; else if (event.key === 'End') value = 100; else return;
        event.preventDefault(); value = Math.max(0, Math.min(100, value)); compare.style.setProperty('--pos', value + '%'); handle.setAttribute('aria-valuenow', String(value));
      });
    });
  }

  function initScrollEffects() {
    const stage = document.querySelector('.stage');
    const large = document.querySelector('.system__gear--large');
    const small = document.querySelector('.system__gear--small');
    let scheduled = false;
    function update() {
      scheduled = false;
      if (stage) { const rect = stage.getBoundingClientRect(); stage.style.setProperty('--scroll-y', Math.max(-120, Math.min(120, -rect.top * .09)) + 'px'); }
      if (large || small) {
        const section = document.querySelector('.system');
        if (section) { const rect = section.getBoundingClientRect(); const progress = Math.max(0, Math.min(1, (innerHeight - rect.top) / (innerHeight + rect.height))); const angle = progress * 90; if (large) large.style.transform = 'rotate(' + angle + 'deg)'; if (small) small.style.transform = 'rotate(' + (-angle * 1.3) + 'deg)'; }
      }
    }
    window.addEventListener('scroll', function () { if (!scheduled) { scheduled = true; requestAnimationFrame(update); } }, { passive: true }); update();
  }

  initNavigation();
  initTypewriter();
  initMaskedVideo('.hero__canvas', '.hero__video-container', false);
  initMaskedVideo('.client-results__canvas', '.client-results__video-wrapper', true);
  initMaskedVideo('.cta-section__canvas', '.cta-section__video-wrapper', true);
  initLoopSlider('.system__slider', '.system__group', 30);
  initLoopSlider('.client-results__slider', '.client-results__group', 24);
  initComparison();
  initScrollEffects();
})();
