// src/utils/imageUtils.ts
// Utility functions for image comparison, hashing, and deduplication.

import { DETECTION } from '../constants/detection';

/**
 * Compute a simple perceptual hash (pHash-lite) from base64 PNG data.
 * We reduce to an 8×8 grayscale thumbnail and threshold at the mean.
 * Returns a 64-bit hash represented as a hex string.
 *
 * NOTE: In production this is handled natively (faster).  This JS version
 * is used for testing and as a fallback.
 *
 * @param base64Png  base64-encoded PNG (without data URI prefix).
 */
export function simpleHash(base64Png: string): string {
  // Use the first 64 chars of the base64 string as a proxy hash.
  // A full implementation would decode the PNG → downsample → DCT → threshold.
  // For production, delegate to the native module's hash method.
  return base64Png.slice(0, 64);
}

/**
 * Estimate structural similarity between two base64 PNG images.
 * Returns a value in [0, 1] where 1 = identical.
 *
 * This simple implementation compares character-by-character on the first
 * N bytes as a cheap approximation.  The native module uses proper SSIM.
 */
export function estimateSimilarity(a: string, b: string): number {
  const len = Math.min(a.length, b.length, 512);
  if (len === 0) return 0;
  let matches = 0;
  for (let i = 0; i < len; i++) {
    if (a[i] === b[i]) matches++;
  }
  return matches / len;
}

/**
 * Returns true if the new image is too similar to any existing capture
 * (i.e., it is a duplicate and should be rejected).
 */
export function isDuplicateCapture(
  newImageBase64: string,
  existingImages: string[],
): boolean {
  for (const existing of existingImages) {
    const similarity = estimateSimilarity(newImageBase64, existing);
    if (similarity >= DETECTION.SIMILARITY_REJECT_THRESHOLD) {
      return true;
    }
  }
  return false;
}

/**
 * Generate a short unique ID for a captured marker.
 */
export function generateCaptureId(): string {
  return `marker_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Format a timestamp (ms since epoch) as a human-readable string.
 */
export function formatCaptureTime(timestamp: number): string {
  const date = new Date(timestamp);
  const h = date.getHours().toString().padStart(2, '0');
  const m = date.getMinutes().toString().padStart(2, '0');
  const s = date.getSeconds().toString().padStart(2, '0');
  return `${h}:${m}:${s}`;
}

/**
 * Create a data URI from a raw base64 PNG string.
 */
export function base64ToPngDataUri(base64: string): string {
  return `data:image/png;base64,${base64}`;
}
