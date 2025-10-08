# MDsrv / Mol* Viewer (src/apps/viewer)

This folder contains the “Viewer” application used to run the Mol* Plugin UI with a ready‑made web page and a thin convenience API. It’s the simplest way to spin up a full-featured molecular visualization UI (panels + 3D canvas) and load data by ID or URL.

- What it is: a small host app that bootstraps the Mol* Plugin UI in the browser and exposes a high-level `Viewer` API for common tasks (load PDB/EMDB/AlphaFold/ModelArchive, load sessions/snapshots, load structures and volumes from URLs, load MD trajectories, etc.).
- When to use it: if you want an out‑of‑the‑box Mol* UI with minimal wiring, or need an embeddable page/iframe you can control via URL parameters.
- What it produces: a static bundle in `build/viewer/` with `index.html`, `embedded.html`, `molstar.js`, and `molstar.css` that you can serve from any static web server.


## Folder contents

- `index.html` — Full viewer page intended as the default landing page. It reads URL parameters (e.g., `?pdb=1cbs`) and calls into the viewer API. All UI (panels/toolbars/canvas) is rendered dynamically into the `#app` element.
- `embedded.html` — Minimal page tailored for embedding (e.g., inside an iframe). Hides some controls by default and demonstrates loading a few entries.
- `index.ts` — Entry point for bundling. Pulls in static assets (HTML, favicon, styles), applies the Mol* UI skin, and re‑exports the public API from `app.ts`.
- `app.ts` — The Viewer API implementation. Creates the Mol* Plugin UI, registers useful extensions, and provides convenience loaders like `loadPdb`, `loadEmdb`, `loadStructureFromUrl`, `loadTrajectory`, `loadSnapshotFromUrl`, etc.
- `favicon.ico` — Browser tab icon included in the build output.


## The idea and architecture

The viewer is intentionally thin:

1. HTML hosts the app — The page only provides a container (`<div id="app"></div>`) and includes the built scripts/styles. The rest of the UI is created at runtime.
2. One line to create the app — `molstar.Viewer.create('app', { ...options })` bootstraps the Mol* Plugin, renders the React UI, and returns a `Viewer` instance.
3. Pragmatic defaults — The Viewer wires up useful extensions (e.g., PDBe/RCSB validation & symmetry, ANVIL membrane, model/geometry/mp4 export, measurement plot, sequence alignment, XTC streaming, Zenodo import) and custom formats (`g3d`, `clustal`).
4. Convenience loaders — High-level methods handle fetching, parsing, presets, and representation setup.

Under the hood, `app.ts` builds a `PluginUISpec` from defaults plus selected extensions and config options (layout, rendering quality, servers/providers). The `Viewer` class then exposes task‑oriented helpers that orchestrate Mol* builders and commands.


## Build and run

The root `package.json` includes scripts for building and serving the viewer bundle.

- Development (watch):
  - `npm run watch-viewer` — TypeScript + asset copy + webpack in watch mode. Outputs to `build/viewer/`.
  - In a separate terminal, `npm run serve` — serves `./` at <http://localhost:1338>. Open <http://localhost:1338/build/viewer/index.html>.

- Production (single build):
  - `npm run build-viewer` — builds the viewer bundle into `build/viewer/`.
  - Serve the `build/` directory with any static server, then open `build/viewer/index.html` or `embedded.html`.

Optional example commands (copy/paste):

```bash
# Dev workflow
npm run watch-viewer
# in another terminal
npm run serve
# then open
open "http://localhost:1338/build/viewer/index.html?pdb=1cbs"

# Production build
npm run build-viewer
# serve build/ with your favorite static file server
```


## Using the viewer via URL parameters (index.html)

`index.html` reads query parameters and calls the appropriate `Viewer` methods. Common options:

- Data loaders
  - `?pdb=1cbs` — Load a PDB entry.
  - `?emdb=EMD-30210` — Load an EMDB map.
  - `?afdb=AF-Qxxxx` — Load an AlphaFold DB model.
  - `?model-archive=MA-xxxx` — Load from ModelArchive.
  - `?structure-url=...&structure-url-format=mmcif&structure-url-is-binary=1` — Load a structure file from your URL.
  - `?session-url=...` — Restore a saved session (full state).
  - `?snapshot-id=...` or `?snapshot-url=...&snapshot-url-type=molj|json|zip` — Restore a saved snapshot.

- Providers / servers
  - `?pdb-provider=pdbe|rcsb`
  - `?emdb-provider=pdbe|rcsb`
  - `?map-provider=pdbe|rcsb` — Selects default volume server.

- Layout and rendering
  - `?hide-controls=1` — Hide the top/side controls (3D canvas only).
  - `?collapse-left-panel=1` — Start with the data tree collapsed.
  - `?pixel-scale=2` — Increase rendering scale (sharper but slower).
  - `?pick-scale=0.25` — Offscreen picking buffer scale (perf vs precision).
  - `?pick-padding=2` — Selection padding in pixels.
  - `?disable-wboit=1` — Disable order‑independent transparency.
  - `?prefer-webgl1=1` — Force WebGL1 for compatibility.
  - `?debug-mode=1` — Enable verbose debug mode.

Combine parameters as needed, e.g.: `index.html?pdb=1cbs&hide-controls=1&pixel-scale=2`.


## Embedding options

You have three straightforward ways to embed the viewer:

1. Use `embedded.html` directly inside an iframe

```html
<iframe
  src="/build/viewer/embedded.html?pdb=1cbs"
  width="900"
  height="650"
  style="border: 0;"
  loading="lazy"
></iframe>
```

1. Use `index.html` inside an iframe (more controls, URL‑driven)

```html
<iframe
  src="/build/viewer/index.html?pdb=1cbs&collapse-left-panel=1"
  width="1000"
  height="700"
  style="border: 0;"
></iframe>
```

1. Programmatic initialization in your own page

```html
<link rel="stylesheet" href="/build/viewer/molstar.css">
<div id="app" style="width: 800px; height: 600px;"></div>
<script src="/build/viewer/molstar.js"></script>
<script>
  molstar.Viewer.create('app', {
    pdbProvider: 'rcsb',
    emdbProvider: 'rcsb',
    layoutShowControls: true
  }).then(v => {
    v.loadPdb('1cbs');
  });
  // Optional: handle container resizes
  // new ResizeObserver(() => v.handleResize()).observe(document.getElementById('app'))
</script>
```


## Viewer API (high level)

The `Viewer` instance returned by `Viewer.create(...)` exposes helpers that take care of fetching, parsing, and applying useful representation presets:

- `loadPdb(id)` / `loadPdbDev(id)` — Load structures by ID.
- `loadEmdb(id, { detail? })` — Load an EM map from the configured provider.
- `loadAlphaFoldDb(id)` — Load from AlphaFold DB with pLDDT coloring preset.
- `loadModelArchive(id)` — Load models from ModelArchive.
- `loadStructureFromUrl(url, format, isBinary, { representationParams? })` — Load from your URL.
- `loadAllModelsOrAssemblyFromUrl(url, format, isBinary, { representationParams? })` — Multiple models/assemblies.
- `loadTrajectory({ model, coordinates, preset? })` — Build a trajectory from topology/coordinates.
- `loadVolumeFromUrl({ url, format, isBinary }, isovalues, { entryId?, isLazy? })` — Show density as isosurfaces.
- `loadSnapshotFromUrl(url, type)` / `setRemoteSnapshot(id)` / `loadSessionFromUrl(url)` — Restore saved state.
- `handleResize()` — Notify the layout about container size changes (if you resize the host element).


## Notes and limits

- Build output lives in `build/viewer/`. You’ll need a static server for local testing because browsers block `file://` XHRs.
- The viewer registers several extensions by default (quality assessments, symmetry, exports, membrane orientation, sequence alignment, XTC streaming, etc.). You can customize what’s enabled by editing `app.ts`.
- For heavy datasets or low‑end GPUs, lower `pixel-scale` and/or `pick-scale` for smoother interaction.


## See also

- Root README for repository‑wide information.
- `docs/state/` for saved state/session details.
- `docs/model-server/` and `docs/volume-server/` for server components referenced by some features.
