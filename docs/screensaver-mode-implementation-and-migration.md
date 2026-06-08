# Street-View Screensaver Mode

Updated: 2026-06-08

This document records the special street-view screensaver feature added during the 2026-06-08 session and is written so the feature can be migrated into another project without damaging the existing UrbanFabric full mode or demo mode.

## Final Behavior

- The app now has three runtime modes: `full`, `demo`, and `screensaver`.
- Full mode is unchanged: normal editing UI, RunPod URL editable, no idle reset.
- Demo mode is unchanged: guided exhibit flow, idle reset, watchdog behavior.
- Screensaver mode is based on full mode and does not clear local project data.
- In screensaver mode, the top-right intro control becomes an icon-only button with `title` and `aria-label` set to `Start screensaver`.
- Pressing that button opens a full-window WebGL overlay.
- The overlay displays an 8 by 5 grid: 40 simultaneous street-view panes.
- The 40 visible panes are randomly selected from 80 packaged panoramas: 40 London and 40 Shanghai.
- Any keyboard, pointer, or touch input starts a fade-out exit. The overlay remains mounted during the 900 ms fade and then returns to the full app.
- The screensaver does not expose drag, pan, zoom, buttons, navbar controls, or guide controls to users.

## Packaged Panorama Set

The development asset folder is:

```text
frontend/public/screensaver-panos/
```

The portable packaged asset folder is:

```text
SemanticMapFrontendApp/www/screensaver-panos/
```

The asset manifest is:

```text
screensaver-panos/manifest.json
```

Current asset details:

- `count`: 80
- London: 40
- Shanghai: 40
- target size: `2048x1024`
- total JPG size: about `43.66 MiB`
- average JPG size: about `558.9 KiB`
- London processing: source `4096x2048`, resized to `2048x1024`, JPEG quality 95
- Shanghai processing: source `2048x1024`, copied as original JPEG bytes with no resampling or re-encoding

The source server used for this set was:

```text
https://bw558khk2yomio-8000.proxy.runpod.net
```

The selected panos came from the existing RunPod pano endpoints:

```text
GET /api/datasets/{dataset_id}/panos/{pano_id}
GET /api/datasets/{dataset_id}/panos/{pano_id}/image
```

Important: these image files are generated/demo payloads, not source code. The repo should ignore them in Git. For a portable handoff, keep them inside `SemanticMapFrontendApp/www/screensaver-panos/`.

## Animation Rules

Each tile has its own state machine. Actions are chosen by a small Markov chain:

- `idle`
- `pan`
- `zoom`
- `switch`

The chain creates the impression that separate users are inspecting different windows.

Current pan behavior:

- Horizontal yaw is always a multiple of 45 degrees.
- Possible yaw changes: `45`, `90`, or `135` degrees, in either direction.
- Pan is constant speed, with no ease-in or ease-out.
- `45°` takes `2s`.
- `90°` takes `3s`.
- `135°` takes `4s`.
- Vertical pitch targets use 10 degree steps.
- Current pitch range is `-20°` to `0°`, so possible targets are `-20`, `-10`, and `0`.

Current zoom behavior:

- Zoom changes the vertical FOV only.
- FOV step is 6 degrees.
- Possible FOV changes: `6`, `12`, or `18` degrees, in either direction when within bounds.
- FOV bounds are `34°` to `66°`.
- Zoom is constant speed, with no ease-in or ease-out.
- `6°` FOV change takes `1s`.
- `12°` FOV change takes `2s`.
- `18°` FOV change takes `3s`.

Current idle and switching behavior:

- Idle delay range starts at `1000ms`.
- Switch probability is scaled down to 50 percent of the original Markov switch probabilities.
- Forced switch deadlines are also lengthened compared with the first implementation.
- A tile must complete at least two non-idle browse actions (`pan` or `zoom`) before it is allowed to switch images.
- Switch actions still use eased fade-out/fade-in because they are image transitions, not camera movement.

## Files Added Or Changed

Core source files:

```text
frontend/src/components/ScreensaverOverlay.tsx
frontend/src/App.tsx
frontend/src/state/runtimeConfig.ts
frontend/src/styles/app.css
frontend/Start-FrontendDev.ps1
start_screensaver.bat
```

Portable package files:

```text
SemanticMapFrontendApp/start_demo.bat
SemanticMapFrontendApp/start_full.bat
SemanticMapFrontendApp/start_screensaver.bat
SemanticMapFrontendApp/launcher/Start-SemanticMap.ps1
SemanticMapFrontendApp/README.txt
SemanticMapFrontendApp/www/
```

Generated screensaver assets:

```text
frontend/public/screensaver-panos/
SemanticMapFrontendApp/www/screensaver-panos/
```

## Runtime Mode Integration

`frontend/src/state/runtimeConfig.ts` defines:

```ts
export type RuntimeMode = "demo" | "full" | "screensaver";
```

`runtime-config.js` writes:

```js
window.__SEMANTIC_MAP_RUNTIME_CONFIG__ = {
  mode: "screensaver"
};
```

`App.tsx` uses this mode to preserve the two existing modes:

- `runtimeConfig.mode !== "screensaver"` still opens the tutorial intro at startup.
- `runtimeConfig.mode === "screensaver"` does not auto-open the intro.
- The top-right button opens `ScreensaverOverlay` only in screensaver mode.
- Full/demo behavior remains separate.

This separation is the main guard against damaging existing project behavior.

## WebGL Rendering Design

`ScreensaverOverlay.tsx` uses one WebGL canvas for the whole overlay, not 40 separate viewers.

Reasons:

- One canvas is lighter than mounting 40 Photo Sphere Viewer instances.
- The component can render 40 grid viewports from one shader program.
- The overlay can fully block interaction and hide all controls.

Rendering flow:

1. Fetch `/screensaver-panos/manifest.json` with `cache: "no-store"`.
2. Load all listed images into WebGL textures.
3. Initialize 40 tile states from shuffled manifest item indices.
4. For each animation frame, compute each tile's current yaw, pitch, FOV, and alpha.
5. Render each tile through the equirectangular-to-perspective fragment shader.

Texture orientation:

```ts
gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
```

This is required for the current shader and source images so street views are not vertically inverted.

## Migrating Into Another Project

Use this order to avoid breaking existing behavior:

1. Copy `ScreensaverOverlay.tsx` into the target frontend.
2. Copy the CSS blocks for `.screensaver-overlay`, `.screensaver-overlay.is-closing`, `.screensaver-canvas`, and `.screensaver-loading`.
3. Add a runtime mode or feature flag equivalent to `screensaver`.
4. Mount the overlay only when the feature flag is active and the user clicks the screensaver button.
5. Do not change the target project's existing demo/full reset code. Screensaver should be an additional branch, not a replacement.
6. Add a manifest-driven asset folder under the target public/static root.
7. Keep generated pano images out of source control unless the deployment explicitly needs them versioned.
8. If packaging a static app, copy the public asset folder into the packaged web root after build.
9. Verify all paths are relative to the package root. Do not write machine-specific absolute paths into launchers.

Minimum manifest shape:

```json
{
  "count": 80,
  "target_size": { "width": 2048, "height": 1024 },
  "items": [
    {
      "id": "london:318357",
      "city": "london",
      "dataset_id": "london_224_8_45",
      "pano_id": "318357",
      "file": "/screensaver-panos/london_01_318357.jpg?v=2048q95-..."
    }
  ]
}
```

The renderer only requires each item to have:

- `id`
- `file`

The other fields are useful for auditability and future regeneration.

## Portable Package

The portable package lives in:

```text
SemanticMapFrontendApp/
```

It now includes three launchers:

```text
start_demo.bat
start_full.bat
start_screensaver.bat
```

All launchers use `%~dp0` and `Start-SemanticMap.ps1` derives paths from `$MyInvocation.MyCommand.Path`, so the package can be moved to another Windows device or USB drive without editing paths.

The packaged app does not require Node, npm, Python, or a local backend. Windows PowerShell serves the static `www/` folder over `127.0.0.1` and opens the default browser.

To refresh the portable package:

```powershell
cd frontend
npm.cmd run build
```

Then copy the contents of:

```text
frontend/dist/
```

into:

```text
SemanticMapFrontendApp/www/
```

Do not copy development-only absolute paths or local runtime configs into portable launchers.

## Git Hygiene

The screensaver image payload is large and generated. Ignore it:

```text
frontend/public/screensaver-panos/
```

The portable package is also a generated artifact and is already ignored:

```text
SemanticMapFrontendApp/
```

If another project wants the feature but not the exact UrbanFabric pano set, commit only the source files and docs, then generate or supply its own static `screensaver-panos` folder.

## Verification Checklist

Run:

```powershell
cd frontend
npm.cmd run build
```

Expected current warnings:

- `runtime-config.js` cannot be bundled without `type="module"`.
- The JS chunk is larger than Vite's 500 kB warning threshold.

Browser checks:

- Screensaver mode starts without showing the tutorial.
- The top-right button is icon-only but has accessible label/title.
- The overlay renders an 8 by 5 nonblank grid.
- No buttons or controls appear inside the overlay.
- Input fades the overlay out instead of instantly unmounting it.
- Full mode and demo mode still launch independently.

