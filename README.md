# 7th Month Return

A cinematic, limited-interaction walkthrough through nine point-cloud scans of
Dajing Village.

The experience works like an interactive cutscene: the tour carries the viewer
forward along an authored route, while still allowing limited looking and
movement with mouse, touch, `WASD`, and arrow keys.

## Experience

- Start from a title screen
- Move sequentially through scenes 1 to 9
- Look around while the tour continues forward
- Drift within controlled bounds, but not free-roam
- Transition from one scan to the next as a continuous village walkthrough

## Getting Started

```sh
npm install
npm run dev
```

## Preprocessing

Raw PLY scans belong in `data/raw-scenes/scene_*/`.

```sh
npm run preprocess
```

The preprocess step writes optimized scene assets and the tour manifest into
`public/scenes/`.

## Controls

- Look: mouse drag or touch drag
- Drift left/right: `A` / `D`, or `Left` / `Right`
- Hold to speed up / slow down while touring: `W` / `S`, or `Up` / `Down`
- Pause/resume: `P`
- Step tour speed: `+` / `-`
- Start: click `Begin the walk`, press `Enter`, or press `Space`

## Tech

- Vite
- React 19
- TypeScript
- Three.js
- Tailwind CSS v4
- Biome

## License

MIT License

Copyright (c) 2026 William Sawyerr

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
