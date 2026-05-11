// src/utils/markerValidator.ts
// JS-side marker validation — used as a fallback when the native module
// is unavailable and for unit-testing the algorithm logic.
//
// The pipeline mirrors the native Kotlin implementation so both stay in sync.

import { DETECTION } from '../constants/detection';
import type { IndicatorQuadrant, OrientationDegrees } from '../types/marker';

/**
 * Pixel accessor type: returns grayscale [0-255] at (x, y).
 * Callers must construct this from whatever pixel buffer they have.
 */
export type GrayscalePixelFn = (x: number, y: number) => number;

// ─── Internal helpers ────────────────────────────────────────────────────────

function isDark(value: number): boolean {
  return value <= DETECTION.DARK_PIXEL_THRESHOLD;
}

function isLight(value: number): boolean {
  return value >= DETECTION.LIGHT_PIXEL_THRESHOLD;
}

/**
 * Count dark pixels in a rectangular region.
 */
function countDarkPixels(
  getPixel: GrayscalePixelFn,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): number {
  let count = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      if (isDark(getPixel(x, y))) {
        count++;
      }
    }
  }
  return count;
}

/**
 * Count light pixels in a rectangular region.
 */
function countLightPixels(
  getPixel: GrayscalePixelFn,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): number {
  let count = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      if (isLight(getPixel(x, y))) {
        count++;
      }
    }
  }
  return count;
}

// ─── Step A — Border check ────────────────────────────────────────────────────

/**
 * Validates that the outer border of the warped image is predominantly dark.
 * We sample a 1-border-width ring around the perimeter.
 *
 * @param getPixel  Pixel accessor for the warped 300x300 image.
 * @param size      Width == height of the warped image (typically 300).
 * @param borderW   Estimated border width in pixels (default: 10% of size).
 */
export function checkOuterBorder(
  getPixel: GrayscalePixelFn,
  size: number,
  borderW: number = Math.round(size * 0.1),
): boolean {
  let totalBorderPixels = 0;
  let darkBorderPixels = 0;

  // Top band
  for (let y = 0; y < borderW; y++) {
    for (let x = 0; x < size; x++) {
      totalBorderPixels++;
      if (isDark(getPixel(x, y))) darkBorderPixels++;
    }
  }
  // Bottom band
  for (let y = size - borderW; y < size; y++) {
    for (let x = 0; x < size; x++) {
      totalBorderPixels++;
      if (isDark(getPixel(x, y))) darkBorderPixels++;
    }
  }
  // Left band (excluding corners already counted)
  for (let y = borderW; y < size - borderW; y++) {
    for (let x = 0; x < borderW; x++) {
      totalBorderPixels++;
      if (isDark(getPixel(x, y))) darkBorderPixels++;
    }
  }
  // Right band (excluding corners already counted)
  for (let y = borderW; y < size - borderW; y++) {
    for (let x = size - borderW; x < size; x++) {
      totalBorderPixels++;
      if (isDark(getPixel(x, y))) darkBorderPixels++;
    }
  }

  if (totalBorderPixels === 0) return false;
  return darkBorderPixels / totalBorderPixels >= DETECTION.BORDER_DARK_THRESHOLD;
}

// ─── Step B — Inner white region check ───────────────────────────────────────

/**
 * Validates that the inner region is predominantly white/empty.
 * "Inner region" = the area inset by INNER_REGION_INSET on each side.
 */
export function checkInnerWhiteRegion(
  getPixel: GrayscalePixelFn,
  size: number,
): boolean {
  const inset = Math.round(size * DETECTION.INNER_REGION_INSET);
  const x0 = inset;
  const y0 = inset;
  const x1 = size - inset;
  const y1 = size - inset;
  const totalInnerPixels = (x1 - x0) * (y1 - y0);
  if (totalInnerPixels <= 0) return false;

  const lightPixels = countLightPixels(getPixel, x0, y0, x1, y1);
  return lightPixels / totalInnerPixels >= DETECTION.INNER_WHITE_THRESHOLD;
}

// ─── Step C/D/E — Orientation indicator detection ────────────────────────────

export interface QuadrantAnalysis {
  /** Dark pixel counts for [topLeft, topRight, bottomRight, bottomLeft] */
  counts: [number, number, number, number];
  /** Index of the dominant quadrant (0–3) */
  dominantIndex: number;
  /** Ratio: dominant count / average of others */
  dominanceRatio: number;
  /** Ratio: dominant dark pixel count / quadrant area */
  indicatorFillRatio: number;
  /** Whether this satisfies the small-indicator requirement */
  isSmallIndicator: boolean;
  /** Whether one quadrant is clearly dominant */
  hasDominantQuadrant: boolean;
}

/**
 * Analyses the four inner quadrants to find and validate the orientation indicator.
 *
 * Layout of the inner region (after inset):
 *   ┌─────────┬─────────┐
 *   │  TL (0) │  TR (1) │
 *   ├─────────┼─────────┤
 *   │  BR (2) │  BL (3) │  ← note: index 2=bottom-right, 3=bottom-left
 *   └─────────┴─────────┘
 * (matches IndicatorQuadrant ordering below)
 */
export function analyseQuadrants(
  getPixel: GrayscalePixelFn,
  size: number,
): QuadrantAnalysis {
  const inset = Math.round(size * DETECTION.INNER_REGION_INSET);
  const innerStart = inset;
  const innerEnd = size - inset;
  const innerSize = innerEnd - innerStart;
  const half = Math.round(innerSize / 2);

  // Quadrant boundaries
  const qx0 = innerStart;
  const qy0 = innerStart;
  const qxM = innerStart + half;
  const qyM = innerStart + half;
  const qx1 = innerEnd;
  const qy1 = innerEnd;

  const quadrantArea = half * half;

  const counts: [number, number, number, number] = [
    countDarkPixels(getPixel, qx0, qy0, qxM, qyM), // top-left
    countDarkPixels(getPixel, qxM, qy0, qx1, qyM), // top-right
    countDarkPixels(getPixel, qxM, qyM, qx1, qy1), // bottom-right
    countDarkPixels(getPixel, qx0, qyM, qxM, qy1), // bottom-left
  ];

  // Find dominant quadrant
  let dominantIndex = 0;
  let maxCount = counts[0];
  for (let i = 1; i < 4; i++) {
    if (counts[i] > maxCount) {
      maxCount = counts[i];
      dominantIndex = i;
    }
  }

  // Average of the other three
  const othersSum = counts.reduce((s, c, i) => (i === dominantIndex ? s : s + c), 0);
  const othersAvg = othersSum / 3;
  const dominanceRatio = othersAvg === 0 ? Infinity : maxCount / othersAvg;

  // Fill ratio of the dominant quadrant
  const indicatorFillRatio = quadrantArea === 0 ? 0 : maxCount / quadrantArea;

  return {
    counts,
    dominantIndex,
    dominanceRatio,
    indicatorFillRatio,
    isSmallIndicator: indicatorFillRatio <= DETECTION.INDICATOR_SIZE_MAX_RATIO,
    hasDominantQuadrant: dominanceRatio >= DETECTION.INDICATOR_DOMINANCE_RATIO,
  };
}

// ─── Step G — Quadrant → orientation mapping ────────────────────────────────

const QUADRANT_TO_ROTATION: readonly OrientationDegrees[] = [
  0,   // index 0 = top-left     → indicator already at top-left, no rotation
  90,  // index 1 = top-right    → rotate 90° CCW
  180, // index 2 = bottom-right → rotate 180°
  270, // index 3 = bottom-left  → rotate 90° CW
];

const QUADRANT_NAMES: readonly IndicatorQuadrant[] = [
  'top-left',
  'top-right',
  'bottom-right',
  'bottom-left',
];

export function quadrantToOrientation(quadrantIndex: number): OrientationDegrees {
  return QUADRANT_TO_ROTATION[quadrantIndex] ?? 0;
}

export function quadrantToName(quadrantIndex: number): IndicatorQuadrant {
  return QUADRANT_NAMES[quadrantIndex] ?? 'top-left';
}

// ─── Full JS-side validation pipeline ────────────────────────────────────────

export interface ValidationResult {
  isValid: boolean;
  /** Rotation needed to place indicator at top-left */
  orientationDegrees: OrientationDegrees;
  confidence: number;
  /** Diagnostic detail (useful for debugging rejected frames) */
  rejectReason?: string;
}

/**
 * Full marker validation pipeline (JS fallback implementation).
 *
 * Expects `getPixel` to address a warped/perspective-corrected square image
 * of dimensions `size × size` pixels.
 *
 * Returns a ValidationResult with isValid=true only when ALL of these hold:
 *   (a) Outer border is ≥70% dark
 *   (b) Inner region is ≥60% white
 *   (c) Exactly one quadrant is dominant (ratio ≥ 3×)
 *   (d) That dominant quadrant fills ≤8% of its area (small indicator)
 */
export function validateMarker(
  getPixel: GrayscalePixelFn,
  size: number,
): ValidationResult {
  // (a) Border check
  if (!checkOuterBorder(getPixel, size)) {
    return {
      isValid: false,
      orientationDegrees: 0,
      confidence: 0,
      rejectReason: 'outer-border-not-dark',
    };
  }

  // (b) Inner white region — this also rejects markers with animal/image content
  if (!checkInnerWhiteRegion(getPixel, size)) {
    return {
      isValid: false,
      orientationDegrees: 0,
      confidence: 0,
      rejectReason: 'inner-region-not-white',
    };
  }

  // (c/d/e) Quadrant analysis
  const qa = analyseQuadrants(getPixel, size);

  if (!qa.hasDominantQuadrant) {
    return {
      isValid: false,
      orientationDegrees: 0,
      confidence: 0,
      rejectReason: `no-dominant-quadrant (ratio=${qa.dominanceRatio.toFixed(2)})`,
    };
  }

  if (!qa.isSmallIndicator) {
    return {
      isValid: false,
      orientationDegrees: 0,
      confidence: 0,
      rejectReason: `indicator-too-large (fill=${qa.indicatorFillRatio.toFixed(3)})`,
    };
  }

  // All checks passed — compute confidence from how strongly each condition was met
  const borderScore = 1.0; // passed
  const whiteScore = 1.0;  // passed
  const dominanceScore = Math.min(qa.dominanceRatio / (DETECTION.INDICATOR_DOMINANCE_RATIO * 2), 1.0);
  const sizeScore = 1.0 - qa.indicatorFillRatio / DETECTION.INDICATOR_SIZE_MAX_RATIO;
  const confidence = (borderScore + whiteScore + dominanceScore + sizeScore) / 4;

  return {
    isValid: true,
    orientationDegrees: quadrantToOrientation(qa.dominantIndex),
    confidence: Math.max(0, Math.min(1, confidence)),
  };
}
