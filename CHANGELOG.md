# Changelog



## 0.1.2 - 2026-09-22

### Fixed

- Add `@astrojs/check` required by the `npm run check` validation command.
- Add and commit `package-lock.json` for reproducible npm and Vercel installs.
- Remove an unused Three.js `Mesh` type import.
- Validate the project on Windows with all 16 tests passing, Astro check passing, and the production build completing successfully.

## 0.1.1 - 2026-09-22

### Fixed

- Pin `react` and `react-dom` to `19.2.8` so they satisfy `@react-three/fiber@9.7.0` peer requirements.
- Align `@types/react` and `@types/react-dom` with the React 19.2 runtime line.
- Keep the patch release semantically versioned as `0.1.1`; no gameplay behavior changes.

## 0.1.0 - 2026-09-22

### Added

- Initial Cube + Orbit Graph prototype.
