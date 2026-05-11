// src/utils/perspectiveCorrection.ts
// Pure-JS perspective transform helpers.
// The actual warpPerspective is done in native (OpenCV); this file provides
// the helper maths used on the JS/worklet side for corner ordering.

import type { Point } from '../types/marker';

/**
 * Reorder 4 detected corner points into a canonical [TL, TR, BR, BL] order
 * so that getPerspectiveTransform receives them consistently regardless of
 * which corner OpenCV's findContours returned first.
 */
export function orderCorners(corners: Point[]): [Point, Point, Point, Point] {
  if (corners.length !== 4) {
    throw new Error(`orderCorners: expected 4 corners, got ${corners.length}`);
  }

  // Sum of coordinates: top-left has smallest sum, bottom-right has largest
  const sortedBySum = [...corners].sort((a, b) => (a.x + a.y) - (b.x + b.y));
  const topLeft = sortedBySum[0];
  const bottomRight = sortedBySum[3];

  // Difference of coordinates: top-right has smallest diff, bottom-left largest
  const remaining = [sortedBySum[1], sortedBySum[2]];
  const sortedByDiff = remaining.sort((a, b) => (a.x - a.y) - (b.x - b.y));
  const topRight = sortedByDiff[0];
  const bottomLeft = sortedByDiff[1];

  return [topLeft, topRight, bottomRight, bottomLeft];
}

/**
 * Compute the distance between two points.
 */
export function pointDistance(a: Point, b: Point): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Compute the aspect ratio (width / height) of a quadrilateral defined by
 * four ordered corners [TL, TR, BR, BL].
 */
export function quadAspectRatio(corners: [Point, Point, Point, Point]): number {
  const [tl, tr, br, bl] = corners;
  const topWidth = pointDistance(tl, tr);
  const bottomWidth = pointDistance(bl, br);
  const leftHeight = pointDistance(tl, bl);
  const rightHeight = pointDistance(tr, br);
  const avgWidth = (topWidth + bottomWidth) / 2;
  const avgHeight = (leftHeight + rightHeight) / 2;
  return avgHeight === 0 ? 0 : avgWidth / avgHeight;
}

/**
 * Compute the area of a quadrilateral using the shoelace formula.
 */
export function quadArea(corners: Point[]): number {
  const n = corners.length;
  let area = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += corners[i].x * corners[j].y;
    area -= corners[j].x * corners[i].y;
  }
  return Math.abs(area) / 2;
}

/**
 * Check whether 4 corners form a roughly square quadrilateral:
 *   - aspect ratio between ASPECT_RATIO_MIN and ASPECT_RATIO_MAX
 *   - area within [minArea, maxArea]
 */
export function isRoughlySquare(
  corners: Point[],
  minArea: number,
  maxArea: number,
  aspectMin: number,
  aspectMax: number,
): boolean {
  const area = quadArea(corners);
  if (area < minArea || area > maxArea) return false;

  try {
    const ordered = orderCorners(corners);
    const ar = quadAspectRatio(ordered);
    return ar >= aspectMin && ar <= aspectMax;
  } catch {
    return false;
  }
}

/**
 * Apply a rotation to a 300x300 image by rotating the corner coordinates.
 * Returns the destination corner order for getPerspectiveTransform on the
 * output side so that the indicator ends up at top-left.
 *
 * degrees: 0 | 90 | 180 | 270
 *   0   → [TL, TR, BR, BL] (no change)
 *   90  → rotate 90° CCW: [TR, BR, BL, TL]
 *   180 → rotate 180°:    [BR, BL, TL, TR]
 *   270 → rotate 90° CW:  [BL, TL, TR, BR]
 */
export function rotatedDestCorners(
  size: number,
  degrees: 0 | 90 | 180 | 270,
): [Point, Point, Point, Point] {
  const s = size - 1;
  const tl: Point = { x: 0, y: 0 };
  const tr: Point = { x: s, y: 0 };
  const br: Point = { x: s, y: s };
  const bl: Point = { x: 0, y: s };

  switch (degrees) {
    case 0:   return [tl, tr, br, bl];
    case 90:  return [tr, br, bl, tl];
    case 180: return [br, bl, tl, tr];
    case 270: return [bl, tl, tr, br];
  }
}
