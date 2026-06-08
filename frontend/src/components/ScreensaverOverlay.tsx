import { useEffect, useRef, useState } from "react";

type ScreensaverManifestItem = {
  id: string;
  city: string;
  dataset_id: string;
  pano_id: string;
  file: string;
};

type ScreensaverManifest = {
  count: number;
  items: ScreensaverManifestItem[];
};

type ScreensaverOverlayProps = {
  onClose: () => void;
};

type ActionKind = "idle" | "pan" | "zoom" | "switch";

type TileAction = {
  kind: ActionKind;
  startedAt: number;
  duration: number;
  fromYaw: number;
  toYaw: number;
  fromPitch: number;
  toPitch: number;
  fromFov: number;
  toFov: number;
  switchAt?: number;
  switched?: boolean;
};

type TileState = {
  itemIndex: number;
  yaw: number;
  pitch: number;
  fov: number;
  action: TileAction;
  lastAction: ActionKind;
  nextSwitchDeadline: number;
  browseActionsSinceSwitch: number;
};

type GlState = {
  gl: WebGLRenderingContext;
  program: WebGLProgram;
  buffer: WebGLBuffer;
  textures: Array<WebGLTexture | null>;
  attribPosition: number;
  uniformTexture: WebGLUniformLocation | null;
  uniformYaw: WebGLUniformLocation | null;
  uniformPitch: WebGLUniformLocation | null;
  uniformFovY: WebGLUniformLocation | null;
  uniformAspect: WebGLUniformLocation | null;
  uniformAlpha: WebGLUniformLocation | null;
};

const MANIFEST_URL = "/screensaver-panos/manifest.json";
const GRID_COLUMNS = 8;
const GRID_ROWS = 5;
const VISIBLE_TILE_COUNT = GRID_COLUMNS * GRID_ROWS;
const DEFAULT_FOV_RADIANS = degreesToRadians(45);
const MIN_FOV_RADIANS = degreesToRadians(34);
const MAX_FOV_RADIANS = degreesToRadians(66);
const ZOOM_STEP_DEGREES = 6;
const ZOOM_MAX_STEP_MULTIPLIER = 3;
const ZOOM_STEP_DURATION_MS = 1000;
const YAW_STEP_DEGREES = 45;
const YAW_MAX_STEP_MULTIPLIER = 3;
const YAW_STEP_DURATIONS_MS = [0, 2000, 3000, 4000];
const PITCH_MIN_DEGREES = -20;
const PITCH_MAX_DEGREES = 0;
const PITCH_STEP_DEGREES = 10;
const MIN_PITCH_RADIANS = degreesToRadians(PITCH_MIN_DEGREES);
const MAX_PITCH_RADIANS = degreesToRadians(PITCH_MAX_DEGREES);
const SWITCH_PROBABILITY_SCALE = 0.5;
const MIN_IDLE_DELAY_MS = 1000;
const MIN_BROWSE_ACTIONS_BEFORE_SWITCH = 2;
const CLOSE_GUARD_MS = 350;
const OVERLAY_FADE_OUT_MS = 900;

const VERTEX_SHADER = `
attribute vec2 a_position;
varying vec2 v_uv;

void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER = `
precision highp float;

varying vec2 v_uv;
uniform sampler2D u_texture;
uniform float u_yaw;
uniform float u_pitch;
uniform float u_fov_y;
uniform float u_aspect;
uniform float u_alpha;

const float PI = 3.14159265358979323846264;

void main() {
  float tan_half_fov = tan(u_fov_y * 0.5);
  vec2 screen = vec2(v_uv.x * 2.0 - 1.0, 1.0 - v_uv.y * 2.0);
  vec3 direction = normalize(vec3(screen.x * tan_half_fov * u_aspect, screen.y * tan_half_fov, 1.0));
  float pitch_cosine = cos(u_pitch);
  float pitch_sine = sin(u_pitch);
  vec3 pitched = vec3(
    direction.x,
    pitch_cosine * direction.y + pitch_sine * direction.z,
    -pitch_sine * direction.y + pitch_cosine * direction.z
  );
  float cosine = cos(u_yaw);
  float sine = sin(u_yaw);
  vec3 world = vec3(
    cosine * pitched.x + sine * pitched.z,
    pitched.y,
    -sine * pitched.x + cosine * pitched.z
  );
  float longitude = atan(world.x, world.z);
  float latitude = asin(clamp(world.y, -1.0, 1.0));
  vec2 pano_uv = vec2(longitude / (2.0 * PI) + 0.5, 0.5 - latitude / PI);
  vec4 color = texture2D(u_texture, pano_uv);
  gl_FragColor = vec4(color.rgb, color.a * u_alpha);
}
`;

export function ScreensaverOverlay({ onClose }: ScreensaverOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const closeReadyAtRef = useRef(performance.now() + CLOSE_GUARD_MS);
  const closingRef = useRef(false);
  const closeTimerRef = useRef<number | undefined>(undefined);
  const [manifest, setManifest] = useState<ScreensaverManifest | null>(null);
  const [status, setStatus] = useState("Loading screensaver panoramas");
  const [error, setError] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(MANIFEST_URL, { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error(`Screensaver manifest request failed (${response.status})`);
        return response.json() as Promise<ScreensaverManifest>;
      })
      .then((payload) => {
        if (cancelled) return;
        const items = Array.isArray(payload.items) ? payload.items.filter((item) => item.file && item.id) : [];
        if (items.length < VISIBLE_TILE_COUNT + 1) {
          throw new Error(`Screensaver needs at least ${VISIBLE_TILE_COUNT + 1} panoramas.`);
        }
        setManifest({ ...payload, items });
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load screensaver panoramas");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const beginClose = () => {
      if (performance.now() < closeReadyAtRef.current) return;
      if (closingRef.current) return;
      closingRef.current = true;
      setClosing(true);
      closeTimerRef.current = window.setTimeout(() => {
        onClose();
      }, OVERLAY_FADE_OUT_MS);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();
      beginClose();
    };
    const onPointerDown = (event: PointerEvent) => {
      event.preventDefault();
      event.stopPropagation();
      beginClose();
    };
    const onTouchStart = () => {
      beginClose();
    };

    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("touchstart", onTouchStart, { capture: true, passive: true });
    return () => {
      if (closeTimerRef.current !== undefined) {
        window.clearTimeout(closeTimerRef.current);
        closeTimerRef.current = undefined;
      }
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("touchstart", onTouchStart, true);
    };
  }, [onClose]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !manifest) return;

    const activeCanvas = canvas;
    const activeManifest = manifest;
    let cancelled = false;
    let frame = 0;
    let glState: GlState | null = null;
    const tileStates = initializeTiles(activeManifest.items.length);

    async function start() {
      try {
        const state = createGlState(activeCanvas);
        glState = state;
        setStatus(`Loading 0/${activeManifest.items.length}`);
        await loadTextures(state, activeManifest.items, (loaded, total) => {
          if (!cancelled) setStatus(`Loading ${loaded}/${total}`);
        });
        if (cancelled) return;
        setStatus("");
        render();
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Screensaver rendering failed");
      }
    }

    const render = () => {
      if (cancelled || !glState) return;
      drawScreensaver(glState, activeCanvas, tileStates, activeManifest.items.length);
      frame = window.requestAnimationFrame(render);
    };

    void start();

    return () => {
      cancelled = true;
      if (frame) window.cancelAnimationFrame(frame);
      if (glState) destroyGlState(glState);
    };
  }, [manifest]);

  return (
    <div className={`screensaver-overlay${closing ? " is-closing" : ""}`} role="dialog" aria-label="Street-view screensaver">
      <canvas className="screensaver-canvas" ref={canvasRef} />
      {status || error ? <div className="screensaver-loading">{error ?? status}</div> : null}
    </div>
  );
}

function initializeTiles(itemCount: number): TileState[] {
  const indices = shuffle(Array.from({ length: itemCount }, (_, index) => index)).slice(0, VISIBLE_TILE_COUNT);
  const now = performance.now();
  return indices.map((itemIndex) => createTileState(itemIndex, now));
}

function createTileState(itemIndex: number, now: number): TileState {
  const tile: TileState = {
    itemIndex,
    yaw: Math.random() * Math.PI * 2,
    pitch: randomPitch(),
    fov: DEFAULT_FOV_RADIANS,
    action: placeholderAction(now),
    lastAction: "idle",
    nextSwitchDeadline: now + randomBetween(14000, 34000),
    browseActionsSinceSwitch: 0
  };
  tile.action = createNextAction(tile, now - randomBetween(0, 3000), "switch");
  return tile;
}

function drawScreensaver(state: GlState, canvas: HTMLCanvasElement, tiles: TileState[], itemCount: number) {
  const { gl } = state;
  resizeCanvas(canvas, gl);
  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.useProgram(state.program);
  gl.bindBuffer(gl.ARRAY_BUFFER, state.buffer);
  gl.enableVertexAttribArray(state.attribPosition);
  gl.vertexAttribPointer(state.attribPosition, 2, gl.FLOAT, false, 0, 0);

  const now = performance.now();
  const cellWidth = Math.floor(canvas.width / GRID_COLUMNS);
  const cellHeight = Math.floor(canvas.height / GRID_ROWS);
  const widthRemainder = canvas.width - cellWidth * GRID_COLUMNS;
  const heightRemainder = canvas.height - cellHeight * GRID_ROWS;
  const activeItems = new Set(tiles.map((tile) => tile.itemIndex));

  for (let index = 0; index < tiles.length; index += 1) {
    advanceTileAction(tiles[index], itemCount, activeItems, now);
    const frame = tileFrame(tiles[index], now);
    const texture = state.textures[tiles[index].itemIndex];
    if (!texture) continue;

    const column = index % GRID_COLUMNS;
    const row = Math.floor(index / GRID_COLUMNS);
    const viewportWidth = cellWidth + (column === GRID_COLUMNS - 1 ? widthRemainder : 0);
    const viewportHeight = cellHeight + (row === GRID_ROWS - 1 ? heightRemainder : 0);
    const viewportX = column * cellWidth;
    const viewportY = canvas.height - (row + 1) * cellHeight - (row === GRID_ROWS - 1 ? heightRemainder : 0);

    gl.viewport(viewportX, viewportY, viewportWidth, viewportHeight);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(state.uniformTexture, 0);
    gl.uniform1f(state.uniformYaw, frame.yaw);
    gl.uniform1f(state.uniformPitch, frame.pitch);
    gl.uniform1f(state.uniformFovY, frame.fov);
    gl.uniform1f(state.uniformAspect, viewportWidth / Math.max(viewportHeight, 1));
    gl.uniform1f(state.uniformAlpha, frame.alpha);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
}

function advanceTileAction(tile: TileState, itemCount: number, activeItems: Set<number>, now: number) {
  const action = tile.action;
  const elapsed = now - action.startedAt;

  if (action.kind === "switch" && action.switchAt !== undefined && !action.switched && elapsed >= action.switchAt) {
    const previousItemIndex = tile.itemIndex;
    activeItems.delete(previousItemIndex);
    tile.itemIndex = pickHiddenItem(itemCount, activeItems, previousItemIndex);
    activeItems.add(tile.itemIndex);
    tile.yaw = Math.random() * Math.PI * 2;
    tile.pitch = randomPitch();
    tile.fov = DEFAULT_FOV_RADIANS;
    action.fromYaw = tile.yaw;
    action.toYaw = tile.yaw;
    action.fromPitch = tile.pitch;
    action.toPitch = tile.pitch;
    action.fromFov = tile.fov;
    action.toFov = tile.fov;
    action.switched = true;
  }

  if (elapsed < action.duration) return;

  const frame = tileFrame(tile, now);
  tile.yaw = frame.yaw;
  tile.pitch = frame.pitch;
  tile.fov = frame.fov;
  tile.lastAction = action.kind;
  if (action.kind === "switch") {
    tile.nextSwitchDeadline = now + randomBetween(16000, 44000);
    tile.browseActionsSinceSwitch = 0;
  } else if (action.kind === "pan" || action.kind === "zoom") {
    tile.browseActionsSinceSwitch += 1;
  }
  tile.action = createNextAction(tile, now, tile.lastAction);
}

function tileFrame(tile: TileState, now: number): { yaw: number; pitch: number; fov: number; alpha: number } {
  const action = tile.action;
  const elapsed = clampNumber(now - action.startedAt, 0, action.duration);
  const progress = action.duration > 0 ? elapsed / action.duration : 1;

  if (action.kind === "idle") {
    return { yaw: tile.yaw, pitch: tile.pitch, fov: tile.fov, alpha: 1 };
  }

  if (action.kind === "switch" && action.switchAt !== undefined) {
    if (elapsed < action.switchAt) {
      return {
        yaw: tile.yaw,
        pitch: tile.pitch,
        fov: tile.fov,
        alpha: 1 - easeInOutCubic(elapsed / Math.max(action.switchAt, 1))
      };
    }
    const fadeInProgress = (elapsed - action.switchAt) / Math.max(action.duration - action.switchAt, 1);
    return {
      yaw: tile.yaw,
      pitch: tile.pitch,
      fov: tile.fov,
      alpha: easeInOutCubic(fadeInProgress)
    };
  }

  const eased = easeInOutCubic(progress);
  const actionProgress = action.kind === "pan" || action.kind === "zoom" ? progress : eased;
  return {
    yaw: lerp(action.fromYaw, action.toYaw, actionProgress),
    pitch: lerp(action.fromPitch, action.toPitch, actionProgress),
    fov: lerp(action.fromFov, action.toFov, actionProgress),
    alpha: 1
  };
}

function createNextAction(tile: TileState, now: number, previousKind: ActionKind): TileAction {
  const canSwitch = tile.browseActionsSinceSwitch >= MIN_BROWSE_ACTIONS_BEFORE_SWITCH;
  const kind = now >= tile.nextSwitchDeadline && canSwitch ? "switch" : chooseNextAction(previousKind, canSwitch);
  if (kind === "switch") {
    const duration = randomBetween(1050, 1900);
    return {
      kind,
      startedAt: now,
      duration,
      fromYaw: tile.yaw,
      toYaw: tile.yaw,
      fromPitch: tile.pitch,
      toPitch: tile.pitch,
      fromFov: tile.fov,
      toFov: tile.fov,
      switchAt: duration * randomBetween(0.42, 0.58),
      switched: false
    };
  }

  if (kind === "pan") {
    const yawPan = randomYawPan();
    return {
      kind,
      startedAt: now,
      duration: yawPan.duration,
      fromYaw: tile.yaw,
      toYaw: tile.yaw + yawPan.delta,
      fromPitch: tile.pitch,
      toPitch: randomPitchTarget(tile.pitch),
      fromFov: tile.fov,
      toFov: tile.fov
    };
  }

  if (kind === "zoom") {
    const zoom = randomZoomTarget(tile.fov);
    return {
      kind,
      startedAt: now,
      duration: zoom.duration,
      fromYaw: tile.yaw,
      toYaw: tile.yaw,
      fromPitch: tile.pitch,
      toPitch: tile.pitch,
      fromFov: tile.fov,
      toFov: zoom.targetFov
    };
  }

  return {
    kind: "idle",
    startedAt: now,
    duration: randomBetween(MIN_IDLE_DELAY_MS, 2400),
    fromYaw: tile.yaw,
    toYaw: tile.yaw,
    fromPitch: tile.pitch,
    toPitch: tile.pitch,
    fromFov: tile.fov,
    toFov: tile.fov
  };
}

function chooseNextAction(previousKind: ActionKind, canSwitch: boolean): ActionKind {
  const chains: Record<ActionKind, Array<[ActionKind, number]>> = {
    idle: [
      ["pan", 0.44],
      ["zoom", 0.22],
      ["switch", 0.18 * SWITCH_PROBABILITY_SCALE],
      ["idle", 0.16]
    ],
    pan: [
      ["pan", 0.24],
      ["zoom", 0.24],
      ["idle", 0.3],
      ["switch", 0.22 * SWITCH_PROBABILITY_SCALE]
    ],
    zoom: [
      ["pan", 0.38],
      ["idle", 0.28],
      ["zoom", 0.14],
      ["switch", 0.2 * SWITCH_PROBABILITY_SCALE]
    ],
    switch: [
      ["idle", 0.46],
      ["pan", 0.34],
      ["zoom", 0.2]
    ]
  };
  const roll = Math.random();
  let total = 0;
  for (const [kind, probability] of chains[previousKind]) {
    if (kind === "switch" && !canSwitch) continue;
    total += probability;
    if (roll <= total) return kind;
  }
  return "idle";
}

function pickHiddenItem(itemCount: number, active: Set<number>, excludeIndex: number): number {
  const hidden: number[] = [];
  for (let index = 0; index < itemCount; index += 1) {
    if (index !== excludeIndex && !active.has(index)) hidden.push(index);
  }
  if (!hidden.length) return Math.floor(Math.random() * itemCount);
  return hidden[Math.floor(Math.random() * hidden.length)];
}

function placeholderAction(now: number): TileAction {
  return {
    kind: "idle",
    startedAt: now,
    duration: 1,
    fromYaw: 0,
    toYaw: 0,
    fromPitch: 0,
    toPitch: 0,
    fromFov: DEFAULT_FOV_RADIANS,
    toFov: DEFAULT_FOV_RADIANS
  };
}

function createGlState(canvas: HTMLCanvasElement): GlState {
  const gl = canvas.getContext("webgl", {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    preserveDrawingBuffer: false
  });
  if (!gl) throw new Error("WebGL is unavailable for the screensaver.");

  const program = createProgram(gl, VERTEX_SHADER, FRAGMENT_SHADER);
  const buffer = gl.createBuffer();
  if (!buffer) throw new Error("Could not create screensaver geometry buffer.");
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.disable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  return {
    gl,
    program,
    buffer,
    textures: [],
    attribPosition: gl.getAttribLocation(program, "a_position"),
    uniformTexture: gl.getUniformLocation(program, "u_texture"),
    uniformYaw: gl.getUniformLocation(program, "u_yaw"),
    uniformPitch: gl.getUniformLocation(program, "u_pitch"),
    uniformFovY: gl.getUniformLocation(program, "u_fov_y"),
    uniformAspect: gl.getUniformLocation(program, "u_aspect"),
    uniformAlpha: gl.getUniformLocation(program, "u_alpha")
  };
}

async function loadTextures(
  state: GlState,
  items: ScreensaverManifestItem[],
  onProgress: (loaded: number, total: number) => void
) {
  let loaded = 0;
  state.textures = new Array<WebGLTexture | null>(items.length).fill(null);
  await Promise.all(
    items.map(async (item, index) => {
      const image = await loadImage(item.file);
      state.textures[index] = createTexture(state.gl, image);
      loaded += 1;
      onProgress(loaded, items.length);
    })
  );
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load ${src}`));
    image.src = src;
  });
}

function createTexture(gl: WebGLRenderingContext, image: HTMLImageElement): WebGLTexture {
  const texture = gl.createTexture();
  if (!texture) throw new Error("Could not create screensaver texture.");
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
  return texture;
}

function createProgram(gl: WebGLRenderingContext, vertexSource: string, fragmentSource: string): WebGLProgram {
  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();
  if (!program) throw new Error("Could not create screensaver shader program.");
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(program) || "Unknown shader link error";
    gl.deleteProgram(program);
    throw new Error(message);
  }
  return program;
}

function createShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Could not create screensaver shader.");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) || "Unknown shader compile error";
    gl.deleteShader(shader);
    throw new Error(message);
  }
  return shader;
}

function resizeCanvas(canvas: HTMLCanvasElement, gl: WebGLRenderingContext) {
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  const width = Math.max(1, Math.floor(canvas.clientWidth * dpr));
  const height = Math.max(1, Math.floor(canvas.clientHeight * dpr));
  if (canvas.width === width && canvas.height === height) return;
  canvas.width = width;
  canvas.height = height;
  gl.viewport(0, 0, width, height);
}

function destroyGlState(state: GlState) {
  const { gl } = state;
  for (const texture of state.textures) {
    if (texture) gl.deleteTexture(texture);
  }
  gl.deleteBuffer(state.buffer);
  gl.deleteProgram(state.program);
}

function degreesToRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function radiansToDegrees(value: number): number {
  return (value * 180) / Math.PI;
}

function randomBetween(minimum: number, maximum: number): number {
  return minimum + Math.random() * (maximum - minimum);
}

function randomInteger(minimum: number, maximum: number): number {
  return Math.floor(randomBetween(minimum, maximum + 1));
}

function randomSign(): 1 | -1 {
  return Math.random() > 0.5 ? 1 : -1;
}

function randomYawPan(): { delta: number; duration: number; stepMultiplier: number } {
  const stepMultiplier = randomInteger(1, YAW_MAX_STEP_MULTIPLIER);
  return {
    delta: randomSign() * degreesToRadians(YAW_STEP_DEGREES * stepMultiplier),
    duration: YAW_STEP_DURATIONS_MS[stepMultiplier] ?? YAW_STEP_DURATIONS_MS[1],
    stepMultiplier
  };
}

function randomZoomTarget(currentFov: number): { targetFov: number; duration: number } {
  const candidates: Array<{ targetFov: number; stepMultiplier: number }> = [];
  for (const direction of [-1, 1] as const) {
    for (let stepMultiplier = 1; stepMultiplier <= ZOOM_MAX_STEP_MULTIPLIER; stepMultiplier += 1) {
      const targetFov = currentFov + direction * degreesToRadians(ZOOM_STEP_DEGREES * stepMultiplier);
      if (targetFov >= MIN_FOV_RADIANS && targetFov <= MAX_FOV_RADIANS) {
        candidates.push({ targetFov, stepMultiplier });
      }
    }
  }
  const candidate = candidates[randomInteger(0, candidates.length - 1)] ?? { targetFov: currentFov, stepMultiplier: 1 };
  return {
    targetFov: candidate.targetFov,
    duration: ZOOM_STEP_DURATION_MS * candidate.stepMultiplier
  };
}

function randomPitch(): number {
  const stepCount = Math.floor((PITCH_MAX_DEGREES - PITCH_MIN_DEGREES) / PITCH_STEP_DEGREES);
  return degreesToRadians(PITCH_MIN_DEGREES + randomInteger(0, stepCount) * PITCH_STEP_DEGREES);
}

function randomPitchTarget(currentPitch: number): number {
  const currentDegrees = clampNumber(
    Math.round(radiansToDegrees(currentPitch) / PITCH_STEP_DEGREES) * PITCH_STEP_DEGREES,
    PITCH_MIN_DEGREES,
    PITCH_MAX_DEGREES
  );
  const candidates: number[] = [];
  for (let degrees = PITCH_MIN_DEGREES; degrees <= PITCH_MAX_DEGREES; degrees += PITCH_STEP_DEGREES) {
    if (degrees !== currentDegrees) candidates.push(degrees);
  }
  const targetDegrees = candidates[randomInteger(0, candidates.length - 1)] ?? currentDegrees;
  return clampNumber(degreesToRadians(targetDegrees), MIN_PITCH_RADIANS, MAX_PITCH_RADIANS);
}

function clampNumber(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function lerp(start: number, end: number, progress: number): number {
  return start + (end - start) * progress;
}

function easeInOutCubic(value: number): number {
  const progress = clampNumber(value, 0, 1);
  return progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2;
}

function shuffle<T>(items: T[]): T[] {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
  }
  return items;
}
