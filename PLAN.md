# Plan

## Current Direction

Build `7th Month Return` as a cinematic, limited-interaction walkthrough through
the nine Dajing Village scans. The app should feel like an interactive cutscene:
authored route, sequential scene transitions, limited look and movement.

## Next Priorities

1. Rerun preprocessing after the floor-sampling changes.
2. Test scenes 1 to 9 in order and note where camera height or scene alignment
   still feels wrong.
3. Tighten entry/exit stitching where a scene-to-scene handoff breaks the
   walking illusion.
4. Keep refining the landing screen without adding clutter.
5. Address the Vite large-chunk warning after the experience flow is stable.

## Recent Decisions

- Keep raw scans in `data/raw-scenes/`, not under `public/`.
- Keep only optimized runtime assets and the manifest in `public/scenes/`.
- Keep shaders as GLSL with Three.js/WebGL for now.
- Use Biome for linting and formatting.
- Keep README concise and avoid deep architecture notes there.
