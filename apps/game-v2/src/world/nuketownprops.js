import { PB } from './props.js';

/**
 * WORLD — Nuketown realistic prop set.
 *
 * The original version of this file intentionally authored a greybox: plain
 * cubes, a block barrel and a rectangular cover block. V2 now keeps the same
 * four-prototype draw-call budget but spends those draws on believable objects.
 *
 * Every prototype is still one merged geometry and chunking stays disabled for
 * this small 51 x 42 m map, so this pass improves silhouette/material realism
 * without multiplying draw submissions.
 */

function fieldCrate(size = 0.92) {
  const p = new PB();
  const s = size;

  // Recessed timber body.
  p.box(s * 0.9, s * 0.78, s * 0.86, 0, 0, 0, {
    bevel: 0.012,
    grime: 0.2,
  });

  // Corner posts.
  for (const sx of [-1, 1])
    for (const sz of [-1, 1])
      p.box(0.07, s * 0.9, 0.07, sx * s * 0.46, 0, sz * s * 0.43, {
        bevel: 0.006,
        wear: 1,
      });

  // Slats on all four visible sides.
  for (let i = 0; i < 4; i++) {
    const y = -s * 0.29 + i * s * 0.19;
    p.box(s * 0.96, 0.11, 0.025, 0, y, s * 0.44, {
      bevel: 0.004,
      grime: i === 0 ? 0.28 : 0.12,
    });
    p.box(s * 0.96, 0.11, 0.025, 0, y, -s * 0.44, {
      bevel: 0.004,
      grime: i === 0 ? 0.28 : 0.12,
    });
    p.box(0.025, 0.11, s * 0.88, s * 0.47, y, 0, { bevel: 0.004 });
    p.box(0.025, 0.11, s * 0.88, -s * 0.47, y, 0, { bevel: 0.004 });
  }

  // Lid boards with small gaps and one raised batten.
  for (let i = 0; i < 5; i++) {
    const z = -s * 0.42 + i * s * 0.21;
    p.box(s * 0.93, 0.028, s * 0.17, 0, s * 0.405, z, {
      bevel: 0.004,
      wear: 1,
    });
  }
  p.box(s * 0.98, 0.035, 0.07, 0, s * 0.435, s * 0.18, {
    bevel: 0.004,
    wear: 1,
  });

  return p.build();
}

function oilDrum(r = 0.30, h = 0.88) {
  const p = new PB();

  // Main shell.
  p.cyl(r, h, 0, 0, 0, { radial: 16, grime: 0.18 });

  // Rolled strengthening ribs.
  for (const y of [-h * 0.31, 0, h * 0.31])
    p.cyl(r * 1.045, 0.055, 0, y, 0, {
      radial: 16,
      wear: 1,
      grime: 0.25,
    });

  // Top/bottom rims and bung.
  for (const sy of [-1, 1])
    p.cyl(r * 1.02, 0.036, 0, sy * (h / 2 - 0.018), 0, {
      radial: 16,
      wear: 1,
      grime: sy < 0 ? 0.45 : 0.1,
    });
  p.cyl(0.045, 0.025, r * 0.42, h / 2 + 0.01, 0, {
    radial: 8,
    wear: 1,
  });

  return p.build();
}

/**
 * Jersey-style road barrier built from three chamfered sections. The stepped
 * profile is much cheaper than an extruded spline but still reads as poured
 * concrete rather than a grey rectangular cube.
 */
function roadBarrier(w = 1.5, h = 0.88, d = 0.72) {
  const p = new PB();

  p.box(w, h * 0.22, d, 0, -h * 0.39, 0, {
    bevel: 0.025,
    grime: 0.45,
  });
  p.box(w, h * 0.33, d * 0.7, 0, -h * 0.13, 0, {
    bevel: 0.025,
    grime: 0.25,
  });
  p.box(w, h * 0.52, d * 0.36, 0, h * 0.27, 0, {
    bevel: 0.025,
    wear: 1,
  });

  // Lifting slots / construction recesses represented as shallow dark relief.
  for (const x of [-w * 0.26, w * 0.26])
    p.box(w * 0.17, 0.11, 0.035, x, -h * 0.08, d * 0.36, {
      bevel: 0.006,
      grime: 0.8,
      ao: 0.45,
    });

  return p.build();
}

/**
 * Compact parked hatchback. One material, one merged geometry, one draw for all
 * instances. A dark graphite finish lets the tyres, glazing and body read from
 * geometry/value separation without adding another material bucket.
 */
function compactCar() {
  const p = new PB();

  // Chassis + lower body.
  p.box(1.72, 0.34, 3.85, 0, -0.15, 0, {
    bevel: 0.08,
    grime: 0.22,
  });
  p.box(1.66, 0.56, 3.35, 0, 0.20, -0.02, {
    bevel: 0.12,
    wear: 0.9,
  });

  // Hood, boot and cabin mass.
  p.box(1.54, 0.18, 1.05, 0, 0.53, -1.27, { bevel: 0.08 });
  p.box(1.52, 0.17, 0.78, 0, 0.51, 1.42, { bevel: 0.08 });
  p.box(1.42, 0.72, 1.80, 0, 0.82, 0.18, {
    bevel: 0.16,
    grime: 0.1,
  });

  // Bumpers.
  p.box(1.58, 0.16, 0.16, 0, -0.02, -2.0, {
    bevel: 0.035,
    grime: 0.35,
  });
  p.box(1.58, 0.16, 0.16, 0, -0.02, 2.0, {
    bevel: 0.035,
    grime: 0.35,
  });

  // Four low-poly wheels. Cylinders rotate from Y to X so the axle runs across
  // the car. Recessing them slightly into the arches keeps the silhouette clean.
  for (const x of [-0.86, 0.86])
    for (const z of [-1.28, 1.28])
      p.cyl(0.31, 0.18, x, -0.29, z, {
        radial: 10,
        rz: Math.PI / 2,
        grime: 0.65,
      });

  // Wheel-centre relief and simple side mirrors.
  for (const x of [-0.96, 0.96]) {
    p.box(0.14, 0.09, 0.20, x, 0.72, -0.56, {
      bevel: 0.025,
      grime: 0.22,
    });
  }

  return p.build();
}

export function registerNuketownProps(A, rng) {
  const P = (id, key, geo, opts = {}) => A.proto(id, { geo, key, ...opts });

  // Four prototypes, same cardinality as the old greybox set.
  P('gb_crate', 'gb_dark', fieldCrate(0.92), {
    chunk: false,
    skirt: 0.5,
    tilt: 0.045,
    sink: 0.016,
  });
  P('gb_barrel', 'gb_accent', oilDrum(), {
    chunk: false,
    skirt: 0.31,
    tilt: 0.05,
    sink: 0.012,
  });
  P('gb_block', 'gb_grid', roadBarrier(), {
    chunk: false,
    skirt: 0.62,
  });
  P('gb_car', 'metal_dark', compactCar(), {
    chunk: false,
    skirt: 1.0,
    maxDist: 85,
  });
}
