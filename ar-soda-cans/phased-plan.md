# AR Soda Cans — Phased Plan

## Context

`~/git/ben/ar-soda-cans` is empty (not a git repo yet). Goal: a production-grade prototype
web app — point a phone camera at a real soda can and a 3D soda can renders in AR locked
onto the real one, with an info card for that drink.

Locked-in decisions:

| Decision | Choice |
|---|---|
| Tracking | Image tracking on the can's label artwork (true 3D pose, no ML) |
| Library | MindAR (WASM image tracking) + Three.js |
| 3D asset | Procedural can built in Three.js — no binary assets to source |
| UX | Multi-can registry; on match → 3D can + floating info card |
| Target pipeline | In-repo `npm run compile:targets` Node script |
| Dev HTTPS | `vite-plugin-mkcert` so a phone on the same Wi-Fi gets camera access |
| Shell | Vite + React + TS, AR scene isolated in an imperative module |
| Scope | Hardened runtime + light tests; no CI, no e2e |
| Label images | Repo scaffolds empty; user supplies real can photos, README documents workflow |

Why MindAR over WebXR: iOS Safari has no WebXR AR. MindAR uses plain `getUserMedia` plus
its own pose solver, so it works on iOS Safari and Android Chrome alike.

## Dependencies to add

- **Runtime:** `react`, `react-dom`, `three`, `mind-ar`
- **Dev:** `vite`, `@vitejs/plugin-react`, `typescript`, `@types/react`, `@types/react-dom`,
  `@types/three`, `vite-plugin-mkcert`, `vitest`, `tsx`, `canvas` (Node image API for the
  compiler script), Storybook (`storybook`, `@storybook/react-vite`)

## Target structure

```
ar-soda-cans/
├─ assets/targets/            # user-supplied label photos (committed)
├─ public/targets.mind        # generated, committed
├─ scripts/compileTargets.ts  # npm run compile:targets
├─ src/
│  ├─ main.tsx
│  ├─ App.tsx                 # permission gate → AR view
│  ├─ data/cans.ts            # registry: targetIndex → label img + metadata + scale
│  ├─ ar/
│  │  ├─ arScene.ts           # imperative MindAR + Three lifecycle (start/stop/dispose)
│  │  ├─ buildCan.ts          # procedural can mesh
│  │  └─ useArScene.ts        # React hook: container ref → scene, exposes activeCan
│  ├─ components/
│  │  ├─ ArView.tsx           # full-bleed container + HUD overlay
│  │  ├─ CanInfoCard.tsx      # + CanInfoCard.stories.tsx
│  │  ├─ ScanHint.tsx
│  │  └─ CameraGate.tsx       # idle / prompting / denied / unsupported states
│  └─ styles/
├─ vite.config.ts             # react() + mkcert(), server.host = true
└─ README.md
```

---

## Phase 1 — Scaffold & dev environment

**Goal:** `npm run dev` serves an HTTPS page reachable from the phone.

1. Hand-author the Vite + React + TS scaffold (no interactive `npm create`): `package.json`,
   `tsconfig.json` (strict), `index.html`, `src/main.tsx`, `src/App.tsx`.
2. `vite.config.ts`: register `react()` and `mkcert()`, set `server.host: true` so the dev
   server binds the LAN IP over HTTPS.
3. Style per global rules: no semicolons, single quotes, arrow functions, camelCase, ESM.
4. Scripts: `dev`, `build`, `preview`, `typecheck`, `test`, `compile:targets`.

**Exit criteria:** `npm run dev` prints an `https://<lan-ip>:5173` URL; opening it on the
phone (accepting the mkcert warning once) shows a placeholder page.

---

## Phase 2 — Can registry

**Goal:** one source of truth for the drink lineup.

`src/data/cans.ts`:

```ts
export type Can = {
  id: string
  targetImage: string      // filename in assets/targets — defines compile order
  name: string
  flavour: string
  calories: number
  volumeMl: number
  labelTexture: string     // public/ path, wrapped around the 3D mesh
  bodyColor: string        // fallback tint / top-bottom accent
  scale: number            // model size relative to target width (tunable, ~1.0)
}
export const cans: Can[] = [...]
```

Array **index === MindAR target index**, because the compiler script consumes the same
array in order. That coupling is the one invariant worth a unit test.

**Exit criteria:** registry compiles, typed, with a placeholder entry documented as
awaiting a real photo.

---

## Phase 3 — Target compiler script

**Goal:** `npm run compile:targets` → `public/targets.mind`.

`scripts/compileTargets.ts` reads `cans[].targetImage` in order, loads each via the
`canvas` package's `loadImage`, feeds them to MindAR's `Compiler`
(`mind-ar/src/image-target/compiler.js`), and writes `exportData()` to `public/targets.mind`.
Fails loudly if a file is missing.

**Risk:** MindAR's compiler source touches browser globals. The script shims
`global.Image` / `global.HTMLCanvasElement` from `canvas` before importing it. If it still
fights back, fall back to the hosted compiler UI
(`hiukim.github.io/mind-ar-js-doc/tools/compile`) and reduce the script to a
validation-only step — README documents both paths.

**Exit criteria:** with at least one real photo present, the script emits a non-trivial
`targets.mind`.

---

## Phase 4 — Procedural 3D can

**Goal:** a convincing aluminium can mesh, independent of AR.

- `LatheGeometry` profile: straight body, tapered shoulder, recessed top, rolled rim,
  tapered base.
- Body material: `MeshStandardMaterial` with the label texture, `metalness ~0.6`,
  `roughness ~0.35`.
- Top/bottom: bare aluminium, `metalness 1.0`, `roughness 0.25`, plus a small pull-tab.
- Lighting: `HemisphereLight` + `DirectionalLight` + an environment map so metal reads
  as metal.
- Export `disposeCan()` freeing geometry, materials, textures.

**Exit criteria:** can be rendered in a throwaway non-AR Three scene and inspected.

---

## Phase 5 — AR scene wiring

**Goal:** tracking works end to end.

```ts
new MindARThree({ container, imageTargetSrc: '/targets.mind', uiScanning: false, uiLoading: false })
```

For each can: `addAnchor(i)`, add its mesh to `anchor.group`, wire `onTargetFound` /
`onTargetLost` → `onActiveCanChange` callback into React. MindAR anchor space normalises
target image width to 1 unit, so `can.scale` maps model size to label width. Render loop
via `renderer.setAnimationLoop`, spinning the found can on Y.

`stop()` must: `setAnimationLoop(null)`, `mindarThree.stop()`, stop all camera tracks,
dispose renderer and all can resources. React StrictMode double-mounts in dev — the hook
guards against double-start.

**Exit criteria:** pointing the phone at a real can locks the 3D can onto it.

---

## Phase 6 — React UI & hardening

**Goal:** the states around the happy path.

- `CameraGate.tsx` — checks `navigator.mediaDevices` exists (unsupported → message),
  requests permission, distinct copy for `NotAllowedError` / `NotFoundError` with a retry,
  warns on insecure context (`!window.isSecureContext`).
- `useArScene.ts` — owns the imperative scene's lifecycle against a container ref; returns
  `{ status, activeCan, error }`. React never re-renders into the 3D canvas.
- `ArView.tsx` — full-viewport container, absolutely-positioned HUD above the video.
- `ScanHint.tsx` — "Point at a can" while nothing is tracked.
- `CanInfoCard.tsx` — name / flavour / calories / volume; animates in on found, out on lost.

iOS specifics: video element needs `playsinline` + `muted` (MindAR sets these — verify in
teardown), and `100dvh` rather than `100vh` for layout under the Safari toolbar. Handle
`orientationchange` / `resize` by re-reading container size.

**Exit criteria:** permission-denied, no-camera, and insecure-context paths all render a
clear message with no crash; camera light goes off on unmount.

---

## Phase 7 — Tests, stories, README

- `cans.test.ts` (Vitest) — registry integrity: unique ids, no missing fields, every
  `targetImage` exists on disk, ordering invariant documented.
- `buildCan.test.ts` — mesh builds and `dispose` releases resources.
- `CanInfoCard.stories.tsx` — a story per can plus the empty state.
- `README.md` — how to shoot a good target (flat-on photo of the label, sharp, evenly lit,
  ~1000px wide; busy artwork tracks better than flat colour), where to drop it, how to add
  the matching `cans.ts` entry, then `npm run compile:targets`. Plus opening the HTTPS dev
  URL on a phone and accepting the mkcert warning.

---

## Verification

1. `npm install` → `npm run typecheck` → `npm test` → `npm run build` all clean.
2. Add 2–3 real can label photos to `assets/targets/` plus matching `cans.ts` entries.
3. `npm run compile:targets` → `public/targets.mind` written, size non-trivial.
4. `npm run dev`, open the printed `https://<lan-ip>:5173` on the phone, accept the cert.
5. Grant camera → point at a real can → 3D can locks on and rotates with it; info card
   shows the right drink. Repeat with a second can to confirm target indexing.
6. Deny camera permission → clear error and retry path, no crash.
7. Navigate away → camera light goes off (teardown check).
