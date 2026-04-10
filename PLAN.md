# Plan

## Current Direction

Build `7th Month Return` as a cinematic, limited-interaction walkthrough through
the nine Dajing Village scans. The target feel is an interactive video-game
cutscene: authored route, authored pacing, sequential scene transitions, and
limited look/movement agency.

## Current State

- Raw scans live outside the web root in `data/raw-scenes/`.
- Optimized runtime assets and the tour manifest live in `public/scenes/`.
- Scenes play in manifest order, with the next scene preloaded while the current
  scene plays.
- The camera uses manifest entry/exit points to choose traversal direction.
- Runtime camera height follows floor samples and checks them against the
  detected floor plane to reduce sudden ground/camera jumps.
- Playback now supports pause and one bounded tour speed: `+/-` steps it, while
  held forward/back input continuously speeds it up or slows it down.
- Build targets are split for web, desktop webview, and XR web output.
- The landing and end screens are branded for `7th Month Return`.
- Tooling uses Biome for linting and formatting.

## Next Priorities

1. Rerun preprocessing so the improved floor-sampling logic is reflected in the
   generated scene metadata.
2. Walk through scenes 1 to 9 and note where camera height, ground alignment, or
   scene handoff still feels wrong.
3. Improve scene-to-scene stitching where entry/exit continuity breaks the
   illusion of moving through one village route.
4. Keep refining the landing and end screens without adding clutter.
5. Add the actual WebXR runtime path and validate whether PICO needs lower
   density assets.
6. Address the Vite large-chunk warning after the experience flow is stable.

## Decisions

- Keep the experience cinematic and guided, not free-roam.
- Keep raw source scans in `data/raw-scenes/`.
- Keep only optimized runtime files and the manifest in `public/scenes/`.
- Keep shaders as GLSL with Three.js/WebGL for now.
- Use Tauri for Windows/macOS desktop builds.
- Use Biome for linting and formatting.
- Keep README concise and put working notes here instead.

## Open Risks

- Some generated floor metadata has low confidence and needs validation after
  preprocessing is rerun.
- Scene alignment is still heuristic and may need stronger entry/exit matching.
- PICO WebXR may need a separate lower-density scene manifest.
- The current bundle is large enough to trigger Vite's chunk-size warning.
