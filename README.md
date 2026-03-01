# Xenario

A web-first point cloud experience player. Drop in a `.ply` file and be taken on a cinematic guided journey through the scene. The camera moves itself along a path while you look around freely — like an FPS game cutscene, but inside a point cloud.

## Features

- Load any `.ply` point cloud via drag-and-drop
- Cinematic rail camera with auto-generated path from scene bounds
- Limited look (yaw ±25°, pitch ±15°) with spring-back — desktop mouse and mobile touch
- Custom camera path via optional `path.json`
- Auto-downsampling for mobile performance
- Depth fog and attenuated point rendering for a cinematic look
- Play / pause, progress scrub, point size and speed controls

## Usage

```
npm install
npm run dev
```

Drop a `.ply` file onto the load screen to start. Optionally drop a `path.json` alongside it to define a custom camera route.

Click the canvas to enable mouse look. Press `Escape` to release. On mobile, drag to look.

### path.json format

```json
{
  "duration": 60,
  "waypoints": [
    { "x": -4, "y": 0.3, "z": 0 },
    { "x": 0,  "y": 0.3, "z": 2 },
    { "x": 4,  "y": 0.4, "z": 0 }
  ]
}
```

Waypoints are in normalised scene space (the scene is scaled so its longest axis spans 10 units).

## Tech

- [Vite](https://vite.dev) + [React 19](https://react.dev) + TypeScript
- [Three.js](https://threejs.org)
- [Tailwind CSS v4](https://tailwindcss.com)
- [Lucide React](https://lucide.dev)

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
