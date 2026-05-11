// src/native/MarkerProcessor.ts
// TypeScript bridge to the native Android MarkerProcessorModule.
// Wraps NativeModules with typed interfaces and error handling.

import { NativeModules, Platform } from 'react-native';
import type { MarkerResult, Point } from '../types/marker';

// ─── Type declaration for the raw native module ───────────────────────────────

interface RawMarkerProcessorModule {
  processFrame(
    frameData: ArrayBuffer,
    width: number,
    height: number,
  ): Promise<string>; // JSON-serialised MarkerResult[]

  extractMarker(
    frameData: ArrayBuffer,
    corners: string, // JSON-serialised Point[]
  ): Promise<string>; // base64 PNG

  releaseResources(): void;
}

// ─── Module retrieval ─────────────────────────────────────────────────────────

function getNativeModule(): RawMarkerProcessorModule | null {
  if (Platform.OS !== 'android') {
    console.warn('[MarkerProcessor] Native module is Android-only');
    return null;
  }

  const mod = NativeModules.MarkerProcessorModule as RawMarkerProcessorModule | undefined;
  if (!mod) {
    console.error(
      '[MarkerProcessor] Native module not found. ' +
      'Ensure MarkerProcessorPackage is registered in MainApplication.',
    );
    return null;
  }
  return mod;
}

// ─── Public typed API ─────────────────────────────────────────────────────────

/**
 * Process a raw camera frame buffer through the OpenCV pipeline.
 * Returns an array of detected MarkerResult objects (may be empty).
 */
export async function processFrame(
  frameData: ArrayBuffer,
  width: number,
  height: number,
): Promise<MarkerResult[]> {
  const mod = getNativeModule();
  if (!mod) return [];

  try {
    const json = await mod.processFrame(frameData, width, height);
    const parsed = JSON.parse(json) as MarkerResult[];
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('[MarkerProcessor] processFrame error:', err);
    return [];
  }
}

/**
 * Extract and perspective-correct a marker region from a frame.
 * Returns a base64-encoded PNG string of the 300×300 output, or null on error.
 */
export async function extractMarker(
  frameData: ArrayBuffer,
  corners: Point[],
): Promise<string | null> {
  const mod = getNativeModule();
  if (!mod) return null;

  try {
    const cornersJson = JSON.stringify(corners);
    const base64 = await mod.extractMarker(frameData, cornersJson);
    return base64 ?? null;
  } catch (err) {
    console.error('[MarkerProcessor] extractMarker error:', err);
    return null;
  }
}

/**
 * Release any OpenCV Mat objects or other resources held by the native module.
 * Call this when the camera screen is unmounted.
 */
export function releaseResources(): void {
  const mod = getNativeModule();
  if (!mod) return;
  try {
    mod.releaseResources();
  } catch (err) {
    console.error('[MarkerProcessor] releaseResources error:', err);
  }
}
