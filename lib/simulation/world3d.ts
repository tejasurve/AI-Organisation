// lib/simulation/world3d.ts
//
// Maps the layout's normalised 2D floor coordinates (0..100 on both axes)
// into a real Three.js world coordinate system.
//
// Convention:
//   - World X grows to the right.
//   - World Z grows toward the camera (down in 2D layout space).
//   - World Y is vertical (height).
//
// The floor spans [-FLOOR_HALF, +FLOOR_HALF] on X and Z.

// Floor is intentionally smaller than the layout's 100×100 coord grid so the
// office feels compact and human-scaled. Layout coords (0..100) are mapped
// proportionally into world units of FLOOR_SIZE × FLOOR_SIZE.
export const FLOOR_SIZE = 65; // world units edge length
export const FLOOR_HALF = FLOOR_SIZE / 2;

/** Convert a 2D layout point (0..100 each axis) into (worldX, worldZ). */
export function layoutToWorld(x: number, y: number): [number, number] {
  return [
    (x - 50) * (FLOOR_SIZE / 100),
    (y - 50) * (FLOOR_SIZE / 100),
  ];
}

/** Convert a layout-space rectangle into (worldX, worldZ, worldW, worldD). */
export function rectToWorld(
  x: number,
  y: number,
  w: number,
  h: number,
): { cx: number; cz: number; w: number; d: number } {
  const [wx0, wz0] = layoutToWorld(x, y);
  const [wx1, wz1] = layoutToWorld(x + w, y + h);
  return {
    cx: (wx0 + wx1) / 2,
    cz: (wz0 + wz1) / 2,
    w: Math.abs(wx1 - wx0),
    d: Math.abs(wz1 - wz0),
  };
}

// ---------- height conventions ----------

export const HEIGHTS = {
  floor: 0.0,
  wall: 1.6,
  desk: 0.9,
  monitorBase: 1.05,
  monitorTop: 1.7,
  serverRackTop: 3.2,
  whiteboardBottom: 1.0,
  whiteboardTop: 3.0,
  vaultTop: 1.6,
  consoleTop: 1.0,
  agentBase: 0.0,
  agentHead: 1.6,
  agentTotal: 1.85,
};
