// src/constants/detection.ts
// All tunable thresholds for marker detection — no magic numbers elsewhere.

export const DETECTION = {
  // ── Contour filtering ────────────────────────────────────────────────────
  /** Minimum contour area in pixels (rejects tiny noise blobs) */
  MIN_CONTOUR_AREA: 1000,
  /** Maximum contour area as a fraction of the full frame area */
  MAX_CONTOUR_AREA_RATIO: 0.8,
  /** Accepted range for width/height ratio (must be roughly square) */
  ASPECT_RATIO_MIN: 0.7,
  ASPECT_RATIO_MAX: 1.3,
  /** Epsilon multiplier for approxPolyDP: fraction of arc length */
  POLY_APPROX_EPSILON: 0.02,

  // ── Pixel-level marker validation ────────────────────────────────────────
  /** Fraction of border pixels that must be dark to confirm outer border */
  BORDER_DARK_THRESHOLD: 0.7,
  /** Fraction of inner-region pixels that must be white/light */
  INNER_WHITE_THRESHOLD: 0.6,
  /**
   * Maximum allowed ratio of black pixels in the dominant quadrant to the
   * quadrant's total area.  This is the KEY discriminator:
   *   - Valid marker:   ~20x20px indicator  → ~14% of inner quadrant
   *   - Large square:   ~50% fill           → rejected
   * Set conservatively at 0.25 (25%) but the spec's discriminating rule
   * uses 0.08 (8%) as the hard cutoff.
   */
  INDICATOR_SIZE_MAX_RATIO: 0.08,
  /**
   * The dominant quadrant's black-pixel count must exceed this multiple
   * of the average of the other three quadrants.
   */
  INDICATOR_DOMINANCE_RATIO: 3.0,
  /**
   * Inset percentage from each edge when isolating the inner region.
   * 15% means we skip the outer 15% (the border) on each side.
   */
  INNER_REGION_INSET: 0.15,
  /** Each orientation-quadrant covers this fraction of the inner region */
  QUADRANT_FRACTION: 0.5,

  // ── Pixel thresholds (grayscale 0-255) ───────────────────────────────────
  /** Pixels at or below this value are considered "dark/black" */
  DARK_PIXEL_THRESHOLD: 80,
  /** Pixels at or above this value are considered "light/white" */
  LIGHT_PIXEL_THRESHOLD: 180,

  // ── Deduplication & timing ───────────────────────────────────────────────
  /** Cooldown in ms before the same spatial region can be captured again */
  CAPTURE_COOLDOWN_MS: 2000,
  /** Structural similarity above this value → treat as duplicate */
  SIMILARITY_REJECT_THRESHOLD: 0.9,

  // ── Output ───────────────────────────────────────────────────────────────
  /** Side length (px) of the normalised, perspective-corrected output image */
  OUTPUT_SIZE: 300,

  // ── Camera resolution ────────────────────────────────────────────────────
  CAMERA_MIN_RESOLUTION: 2000,
  CAMERA_MAX_RESOLUTION: 3000,
  CAMERA_TARGET_WIDTH: 2560,
  CAMERA_TARGET_HEIGHT: 2560,

  // ── Frame processor ──────────────────────────────────────────────────────
  /** Target frame processing rate (frames per second) */
  FRAME_RATE: 30,
  /** Minimum confidence to accept a detection */
  MIN_CONFIDENCE: 0.75,
} as const;

/** Collection size before auto-navigating to Results */
export const MAX_CAPTURES = 20;
