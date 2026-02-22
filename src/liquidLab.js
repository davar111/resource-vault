const VERTEX_SHADER = `
attribute vec2 a_pos;
varying vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

const UPDATE_SHADER = `
precision mediump float;
varying vec2 v_uv;
uniform sampler2D u_prev;
uniform vec2 u_resolution;
uniform vec2 u_point;
uniform float u_radius;
uniform float u_force;
uniform float u_has_point;
void main() {
  vec2 px = 1.0 / u_resolution;
  float center = texture2D(u_prev, v_uv).r;
  float sum = center * 0.56;
  sum += texture2D(u_prev, v_uv + vec2(px.x, 0.0)).r * 0.11;
  sum += texture2D(u_prev, v_uv - vec2(px.x, 0.0)).r * 0.11;
  sum += texture2D(u_prev, v_uv + vec2(0.0, px.y)).r * 0.11;
  sum += texture2D(u_prev, v_uv - vec2(0.0, px.y)).r * 0.11;
  float base = sum * 0.989;
  float splat = 0.0;
  if (u_has_point > 0.5) {
    vec2 d = v_uv - u_point;
    float d2 = dot(d, d);
    splat = exp(-d2 / max(0.0001, u_radius * u_radius)) * u_force;
  }
  float next = clamp(base + splat, 0.0, 1.0);
  gl_FragColor = vec4(next, next, next, 1.0);
}
`;

const FINAL_SHADER = `
precision mediump float;
varying vec2 v_uv;
uniform sampler2D u_text;
uniform sampler2D u_trail;
uniform sampler2D u_blob;
uniform vec2 u_resolution;
uniform float u_time;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 345.45));
  p += dot(p, p + 34.345);
  return fract(p.x * p.y);
}

float sampleCombined(vec2 uv) {
  float t = texture2D(u_text, uv).r;
  float b = texture2D(u_blob, uv).r;
  return max(t, b);
}

void main() {
  vec2 px = 1.0 / u_resolution;
  float textBase = sampleCombined(v_uv);
  float trail = texture2D(u_trail, v_uv).r;
  float dotMask = texture2D(u_blob, v_uv).r;
  float txp = texture2D(u_trail, v_uv + vec2(px.x, 0.0)).r;
  float txm = texture2D(u_trail, v_uv - vec2(px.x, 0.0)).r;
  float typ = texture2D(u_trail, v_uv + vec2(0.0, px.y)).r;
  float tym = texture2D(u_trail, v_uv - vec2(0.0, px.y)).r;
  vec2 flow = vec2(txp - txm, typ - tym);
  float flowLen = max(length(flow), 0.0001);
  vec2 dir = flow / flowLen;

  float brush = smoothstep(0.06, 0.82, trail) * dotMask;
  float grain = hash21(v_uv * u_resolution * 0.52 + vec2(trail * 71.0, trail * 19.0));
  float edgeBreak = smoothstep(0.20, 0.95, brush) * (grain - 0.5) * 0.52;
  brush = clamp(brush + edgeBreak, 0.0, 1.0);
  float pulse = (sin(u_time * 2.2) * 0.5 + 0.5) * dotMask;
  vec2 liveJitter = vec2(
    sin(u_time * 1.8 + v_uv.y * 35.0),
    cos(u_time * 1.5 + v_uv.x * 31.0)
  ) * (0.0016 + pulse * 0.0012);
  vec2 brushShift = dir * (0.007 + brush * 0.044) + liveJitter;
  vec2 uvBrush = clamp(v_uv + brushShift, 0.0, 1.0);

  float smear = 0.0;
  smear += sampleCombined(uvBrush) * 0.55;
  smear += sampleCombined(clamp(uvBrush + dir * 0.014, 0.0, 1.0)) * 0.25;
  smear += sampleCombined(clamp(uvBrush - dir * 0.012, 0.0, 1.0)) * 0.20;
  smear *= 0.88 + (grain - 0.5) * 0.20;
  smear = clamp(smear, 0.0, 1.0);

  float text = mix(textBase, smear, brush * 0.95);
  float darkSmudge = brush * text;
  vec3 bg = vec3(0.0, 0.0, 0.0);
  vec3 whiteText = vec3(1.0, 1.0, 1.0);
  vec3 darkInk = vec3(0.10, 0.10, 0.10);
  vec3 textColor = mix(whiteText, darkInk, darkSmudge);
  vec3 color = mix(bg, textColor, text);
  gl_FragColor = vec4(color, 1.0);
}
`;

function computeTypographyLayout(width, height, text) {
  const maxChars = Math.max(8, String(text || "").length);
  const size = Math.max(70, Math.min(width / maxChars * 1.55, height * 0.34));
  const centerX = width * 0.5;
  const textY = height * 0.56;
  const dotY = textY - size * 0.95;
  const dotR = Math.max(22, size * 0.24);
  return { size, centerX, textY, dotY, dotR };
}

class Jelly {
  constructor(n = 18, radius = 0.04) {
    this.n = n;
    this.radius = radius;
    this.center = { x: 0.5, y: 0.5 };
    this.cVel = { x: 0, y: 0 };
    this.drag = false;
    this.target = { x: 0.5, y: 0.5 };
    this.p = [];
    this.resetPoints();
  }

  reset(centerX = this.center.x, centerY = this.center.y, radius = this.radius) {
    this.center.x = centerX;
    this.center.y = centerY;
    this.target.x = centerX;
    this.target.y = centerY;
    this.radius = radius;
    this.cVel.x = 0;
    this.cVel.y = 0;
    this.resetPoints();
  }

  resetPoints() {
    this.p = Array.from({ length: this.n }, (_, i) => {
      const a = (i / this.n) * Math.PI * 2;
      return {
        x: this.center.x + Math.cos(a) * this.radius,
        y: this.center.y + Math.sin(a) * this.radius,
        vx: 0,
        vy: 0,
        a
      };
    });
  }

  step(dt) {
    const kCenter = 80;
    const kNeighbor = 60;
    const damping = 0.92;
    const kDrag = 120;
    const mass = 1;

    if (this.drag) {
      const fx = (this.target.x - this.center.x) * kDrag;
      const fy = (this.target.y - this.center.y) * kDrag;
      this.cVel.x += (fx / mass) * dt;
      this.cVel.y += (fy / mass) * dt;
    }

    this.cVel.x *= damping;
    this.cVel.y *= damping;
    this.center.x += this.cVel.x * dt;
    this.center.y += this.cVel.y * dt;

    for (let i = 0; i < this.n; i += 1) {
      const pt = this.p[i];
      const idealX = this.center.x + Math.cos(pt.a) * this.radius;
      const idealY = this.center.y + Math.sin(pt.a) * this.radius;

      let fx = (idealX - pt.x) * kCenter;
      let fy = (idealY - pt.y) * kCenter;

      const prev = this.p[(i - 1 + this.n) % this.n];
      const next = this.p[(i + 1) % this.n];
      const midX = (prev.x + next.x) * 0.5;
      const midY = (prev.y + next.y) * 0.5;
      fx += (midX - pt.x) * kNeighbor;
      fy += (midY - pt.y) * kNeighbor;

      pt.vx += (fx / mass) * dt;
      pt.vy += (fy / mass) * dt;
      pt.vx *= damping;
      pt.vy *= damping;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
    }
  }

  hitTest(x, y) {
    const dx = x - this.center.x;
    const dy = y - this.center.y;
    return (dx * dx + dy * dy) <= ((this.radius * 1.22) ** 2);
  }

  onPointerDown(x, y) {
    if (!this.hitTest(x, y)) return false;
    this.drag = true;
    this.target.x = x;
    this.target.y = y;
    return true;
  }

  onPointerMove(x, y) {
    this.target.x = x;
    this.target.y = y;
  }

  onPointerUp() {
    this.drag = false;
    this.target.x = this.center.x;
    this.target.y = this.center.y;
  }
}

function makeShader(gl, type, src) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.warn("Shader compile failed", gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function makeProgram(gl, vertexSrc, fragmentSrc) {
  const vs = makeShader(gl, gl.VERTEX_SHADER, vertexSrc);
  const fs = makeShader(gl, gl.FRAGMENT_SHADER, fragmentSrc);
  if (!vs || !fs) return null;
  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.warn("Program link failed", gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }
  return program;
}

function makeTexture(gl, width, height) {
  const tex = gl.createTexture();
  if (!tex) return null;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  return tex;
}

function makeFramebuffer(gl, texture) {
  const fb = gl.createFramebuffer();
  if (!fb) return null;
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
  return fb;
}

function drawTextToCanvas(canvas, text) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, width, height);
  const { size, centerX, textY, dotY, dotR } = computeTypographyLayout(width, height, text);
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `700 ${size.toFixed(0)}px Inter, Segoe UI, Arial, sans-serif`;
  ctx.letterSpacing = "2px";
  ctx.fillText(String(text || "LIQUID PAINT").toUpperCase(), centerX, textY);
}

function drawBlobToCanvas(canvas, jelly) {
  const ctx = canvas.getContext("2d");
  if (!ctx || !jelly) return;
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, width, height);

  if (!jelly.p.length) return;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.moveTo(jelly.p[0].x * width, jelly.p[0].y * height);
  for (let i = 1; i < jelly.p.length; i += 1) {
    ctx.lineTo(jelly.p[i].x * width, jelly.p[i].y * height);
  }
  ctx.closePath();
  ctx.fill();
}

export function createLiquidLab({ canvas, fallback, getText }) {
  const state = {
    running: false,
    ready: false,
    rafId: 0,
    dpr: 1,
    width: 1,
    height: 1,
    gl: null,
    programs: null,
    quad: null,
    textTexture: null,
    blobTexture: null,
    textCanvas: null,
    blobCanvas: null,
    textDirty: true,
    ping: null,
    pong: null,
    pointerUv: [0.5, 0.5],
    pointerForce: 0,
    pointerActive: false,
    pointerInsideBlob: false,
    pointerPrev: null,
    resizeObserver: null,
    jelly: null,
    lastFrameTs: 0
  };

  function cleanupFramebuffers() {
    if (!state.gl) return;
    for (const item of [state.ping, state.pong]) {
      if (!item) continue;
      if (item.fb) state.gl.deleteFramebuffer(item.fb);
      if (item.tex) state.gl.deleteTexture(item.tex);
    }
    state.ping = null;
    state.pong = null;
  }

  function buildBuffers() {
    if (!state.gl) return false;
    cleanupFramebuffers();
    const texA = makeTexture(state.gl, state.width, state.height);
    const texB = makeTexture(state.gl, state.width, state.height);
    if (!texA || !texB) return false;
    const fbA = makeFramebuffer(state.gl, texA);
    const fbB = makeFramebuffer(state.gl, texB);
    if (!fbA || !fbB) return false;
    state.ping = { tex: texA, fb: fbA };
    state.pong = { tex: texB, fb: fbB };
    state.gl.bindFramebuffer(state.gl.FRAMEBUFFER, state.ping.fb);
    state.gl.clearColor(0, 0, 0, 1);
    state.gl.clear(state.gl.COLOR_BUFFER_BIT);
    state.gl.bindFramebuffer(state.gl.FRAMEBUFFER, state.pong.fb);
    state.gl.clearColor(0, 0, 0, 1);
    state.gl.clear(state.gl.COLOR_BUFFER_BIT);
    state.gl.bindFramebuffer(state.gl.FRAMEBUFFER, null);
    return true;
  }

  function ensureTextTexture() {
    if (!state.gl) return;
    if (!state.textCanvas) {
      state.textCanvas = document.createElement("canvas");
      state.textCanvas.width = state.width;
      state.textCanvas.height = state.height;
    }
    if (state.textCanvas.width !== state.width || state.textCanvas.height !== state.height) {
      state.textCanvas.width = state.width;
      state.textCanvas.height = state.height;
      if (state.blobCanvas) {
        state.blobCanvas.width = state.width;
        state.blobCanvas.height = state.height;
      }
      state.textDirty = true;
    }
    if (!state.blobCanvas) {
      state.blobCanvas = document.createElement("canvas");
      state.blobCanvas.width = state.width;
      state.blobCanvas.height = state.height;
    }
    if (!state.textTexture) {
      state.textTexture = state.gl.createTexture();
      state.gl.bindTexture(state.gl.TEXTURE_2D, state.textTexture);
      state.gl.texParameteri(state.gl.TEXTURE_2D, state.gl.TEXTURE_MIN_FILTER, state.gl.LINEAR);
      state.gl.texParameteri(state.gl.TEXTURE_2D, state.gl.TEXTURE_MAG_FILTER, state.gl.LINEAR);
      state.gl.texParameteri(state.gl.TEXTURE_2D, state.gl.TEXTURE_WRAP_S, state.gl.CLAMP_TO_EDGE);
      state.gl.texParameteri(state.gl.TEXTURE_2D, state.gl.TEXTURE_WRAP_T, state.gl.CLAMP_TO_EDGE);
      state.textDirty = true;
    }
    if (!state.blobTexture) {
      state.blobTexture = state.gl.createTexture();
      state.gl.bindTexture(state.gl.TEXTURE_2D, state.blobTexture);
      state.gl.texParameteri(state.gl.TEXTURE_2D, state.gl.TEXTURE_MIN_FILTER, state.gl.LINEAR);
      state.gl.texParameteri(state.gl.TEXTURE_2D, state.gl.TEXTURE_MAG_FILTER, state.gl.LINEAR);
      state.gl.texParameteri(state.gl.TEXTURE_2D, state.gl.TEXTURE_WRAP_S, state.gl.CLAMP_TO_EDGE);
      state.gl.texParameteri(state.gl.TEXTURE_2D, state.gl.TEXTURE_WRAP_T, state.gl.CLAMP_TO_EDGE);
      state.textDirty = true;
    }
    if (!state.textDirty) return;
    const text = getText?.() || "LIQUID PAINT";
    drawTextToCanvas(state.textCanvas, text);
    const layout = computeTypographyLayout(state.width, state.height, text);
    const cx = layout.centerX / state.width;
    const cy = layout.dotY / state.height;
    const r = (layout.dotR / Math.min(state.width, state.height)) * 1.06;
    if (!state.jelly) state.jelly = new Jelly(20, r);
    state.jelly.reset(cx, cy, r);
    drawBlobToCanvas(state.blobCanvas, state.jelly);
    state.gl.bindTexture(state.gl.TEXTURE_2D, state.textTexture);
    state.gl.texImage2D(state.gl.TEXTURE_2D, 0, state.gl.RGBA, state.gl.RGBA, state.gl.UNSIGNED_BYTE, state.textCanvas);
    state.gl.bindTexture(state.gl.TEXTURE_2D, state.blobTexture);
    state.gl.texImage2D(state.gl.TEXTURE_2D, 0, state.gl.RGBA, state.gl.RGBA, state.gl.UNSIGNED_BYTE, state.blobCanvas);
    state.textDirty = false;
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width * state.dpr));
    const height = Math.max(1, Math.floor(rect.height * state.dpr));
    if (width === state.width && height === state.height) return;
    state.width = width;
    state.height = height;
    canvas.width = width;
    canvas.height = height;
    if (state.gl) state.gl.viewport(0, 0, width, height);
    state.textDirty = true;
    buildBuffers();
  }

  function init() {
    state.dpr = Math.min(window.devicePixelRatio || 1, 2);
    const gl = canvas.getContext("webgl", { alpha: false, antialias: true, premultipliedAlpha: false });
    if (!gl) return false;
    const updateProgram = makeProgram(gl, VERTEX_SHADER, UPDATE_SHADER);
    const finalProgram = makeProgram(gl, VERTEX_SHADER, FINAL_SHADER);
    if (!updateProgram || !finalProgram) return false;
    const quad = gl.createBuffer();
    if (!quad) return false;
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1,
      1, -1,
      -1, 1,
      1, 1
    ]), gl.STATIC_DRAW);
    state.gl = gl;
    state.programs = { updateProgram, finalProgram };
    state.quad = quad;
    resize();
    ensureTextTexture();
    state.ready = true;
    return true;
  }

  function bindQuad(program) {
    if (!state.gl || !state.quad) return;
    const loc = state.gl.getAttribLocation(program, "a_pos");
    if (loc < 0) return;
    state.gl.bindBuffer(state.gl.ARRAY_BUFFER, state.quad);
    state.gl.enableVertexAttribArray(loc);
    state.gl.vertexAttribPointer(loc, 2, state.gl.FLOAT, false, 0, 0);
  }

  function frame() {
    if (!state.running || !state.gl || !state.ready || !state.ping || !state.pong) return;
    const gl = state.gl;
    const now = performance.now();
    const dt = Math.min(0.05, Math.max(0.001, (now - (state.lastFrameTs || now)) / 1000));
    state.lastFrameTs = now;
    ensureTextTexture();
    if (state.jelly) {
      state.jelly.step(dt);
      drawBlobToCanvas(state.blobCanvas, state.jelly);
      gl.bindTexture(gl.TEXTURE_2D, state.blobTexture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, state.blobCanvas);
    }

    gl.disable(gl.BLEND);
    gl.useProgram(state.programs.updateProgram);
    bindQuad(state.programs.updateProgram);
    gl.bindFramebuffer(gl.FRAMEBUFFER, state.pong.fb);
    gl.viewport(0, 0, state.width, state.height);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, state.ping.tex);
    gl.uniform1i(gl.getUniformLocation(state.programs.updateProgram, "u_prev"), 0);
    gl.uniform2f(gl.getUniformLocation(state.programs.updateProgram, "u_resolution"), state.width, state.height);
    const jx = state.jelly?.center?.x ?? 0.5;
    const jy = state.jelly?.center?.y ?? 0.5;
    gl.uniform2f(gl.getUniformLocation(state.programs.updateProgram, "u_point"), jx, jy);
    gl.uniform1f(gl.getUniformLocation(state.programs.updateProgram, "u_radius"), 0.028);
    gl.uniform1f(gl.getUniformLocation(state.programs.updateProgram, "u_force"), state.pointerForce);
    gl.uniform1f(gl.getUniformLocation(state.programs.updateProgram, "u_has_point"), state.pointerActive ? 1 : 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    gl.useProgram(state.programs.finalProgram);
    bindQuad(state.programs.finalProgram);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, state.width, state.height);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, state.textTexture);
    gl.uniform1i(gl.getUniformLocation(state.programs.finalProgram, "u_text"), 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, state.pong.tex);
    gl.uniform1i(gl.getUniformLocation(state.programs.finalProgram, "u_trail"), 1);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, state.blobTexture);
    gl.uniform1i(gl.getUniformLocation(state.programs.finalProgram, "u_blob"), 2);
    gl.uniform2f(gl.getUniformLocation(state.programs.finalProgram, "u_resolution"), state.width, state.height);
    gl.uniform1f(gl.getUniformLocation(state.programs.finalProgram, "u_time"), performance.now() * 0.001);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    const swap = state.ping;
    state.ping = state.pong;
    state.pong = swap;
    const speed = Math.sqrt((state.jelly?.cVel?.x || 0) ** 2 + (state.jelly?.cVel?.y || 0) ** 2);
    state.pointerForce = state.pointerActive ? Math.min(1.15, 0.16 + speed * 3.1) : state.pointerForce * 0.9;
    if (state.pointerForce < 0.001) state.pointerForce = 0;
    state.rafId = window.requestAnimationFrame(frame);
  }

  function updatePointer(e) {
    if (!state.jelly) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const x = (e.clientX - rect.left) / rect.width;
    const y = 1 - ((e.clientY - rect.top) / rect.height);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const nx = Math.max(0, Math.min(1, x));
    const ny = Math.max(0, Math.min(1, y));
    const inside = state.jelly.hitTest(nx, ny);
    state.pointerInsideBlob = inside;
    state.pointerActive = inside;

    if (inside) {
      if (!state.jelly.drag) state.jelly.drag = true;
      state.jelly.onPointerMove(nx, ny);
    } else if (state.jelly.drag) {
      state.jelly.onPointerUp();
    }

    state.pointerUv = [nx, ny];
    state.pointerPrev = [nx, ny];
  }

  function onPointerDown(e) {
    if (!state.jelly) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const x = (e.clientX - rect.left) / rect.width;
    const y = 1 - ((e.clientY - rect.top) / rect.height);
    const nx = Math.max(0, Math.min(1, x));
    const ny = Math.max(0, Math.min(1, y));
    const engaged = state.jelly.onPointerDown(nx, ny);
    state.pointerActive = engaged;
    if (!engaged) return;
    canvas.setPointerCapture?.(e.pointerId);
  }

  function onPointerUp(e) {
    state.pointerActive = state.pointerInsideBlob;
    if (!state.pointerInsideBlob) state.jelly?.onPointerUp();
    if (e && canvas.hasPointerCapture?.(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
  }

  function onPointerLeave() {
    state.pointerActive = false;
    state.pointerInsideBlob = false;
    state.pointerForce = 0;
    state.jelly?.onPointerUp();
    state.pointerPrev = null;
  }

  function start() {
    if (state.running) return;
    if (!state.ready) {
      if (!init()) {
        if (fallback) fallback.hidden = false;
        return;
      }
    } else {
      resize();
    }
    if (fallback) fallback.hidden = true;
    state.running = true;
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", updatePointer);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);
    canvas.addEventListener("pointerleave", onPointerLeave);
    state.resizeObserver = new ResizeObserver(() => resize());
    state.resizeObserver.observe(canvas);
    state.lastFrameTs = performance.now();
    state.rafId = window.requestAnimationFrame(frame);
  }

  function stop() {
    if (!state.running) return;
    state.running = false;
    window.cancelAnimationFrame(state.rafId);
    state.rafId = 0;
    canvas.removeEventListener("pointerdown", onPointerDown);
    canvas.removeEventListener("pointermove", updatePointer);
    canvas.removeEventListener("pointerup", onPointerUp);
    canvas.removeEventListener("pointercancel", onPointerUp);
    canvas.removeEventListener("pointerleave", onPointerLeave);
    state.resizeObserver?.disconnect();
    state.resizeObserver = null;
    onPointerLeave();
  }

  function markTextDirty() {
    state.textDirty = true;
  }

  return { start, stop, markTextDirty };
}
