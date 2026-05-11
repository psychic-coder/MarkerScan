// src/hooks/useMarkerCollection.ts
// State management hook for the collection of up to MAX_CAPTURES captured markers.

import { useState, useCallback, useRef } from 'react';
import type { CapturedMarker, MarkerResult } from '../types/marker';
import { MAX_CAPTURES, DETECTION } from '../constants/detection';
import { generateCaptureId, isDuplicateCapture } from '../utils/imageUtils';

export interface MarkerCollection {
  /** All captured markers in capture order */
  markers: CapturedMarker[];
  /** Whether the maximum has been reached */
  isFull: boolean;
  /** Add a new marker; returns true if added, false if rejected (duplicate/full) */
  addMarker: (result: MarkerResult) => boolean;
  /** Clear all captured markers and reset state */
  reset: () => void;
  /** The total number captured so far */
  count: number;
}

/**
 * Manages the ordered collection of up to `MAX_CAPTURES` unique marker captures.
 *
 * Deduplication is performed using base64 structural similarity to prevent
 * the same physical marker being counted twice.
 */
export function useMarkerCollection(): MarkerCollection {
  const [markers, setMarkers] = useState<CapturedMarker[]>([]);
  // Keep a ref for cooldown tracking per spatial region (string key = rounded centroid)
  const cooldownMap = useRef<Map<string, number>>(new Map());

  const addMarker = useCallback((result: MarkerResult): boolean => {
    // Check if collection is full
    if (markers.length >= MAX_CAPTURES) return false;

    // ── Spatial cooldown check ────────────────────────────────────────────────
    // Compute centroid key from corner coordinates (rounded to nearest 50px bucket)
    const centroidX = Math.round(
      result.corners.reduce((s, p) => s + p.x, 0) / result.corners.length / 50,
    );
    const centroidY = Math.round(
      result.corners.reduce((s, p) => s + p.y, 0) / result.corners.length / 50,
    );
    const spatialKey = `${centroidX}_${centroidY}`;
    const lastCaptureTime = cooldownMap.current.get(spatialKey) ?? 0;
    const now = Date.now();

    if (now - lastCaptureTime < DETECTION.CAPTURE_COOLDOWN_MS) {
      return false; // Too soon since last capture from this region
    }

    // ── Duplicate image check ─────────────────────────────────────────────────
    const existingImages = markers.map(m => m.markerResult.extractedImageBase64);
    if (isDuplicateCapture(result.extractedImageBase64, existingImages)) {
      return false;
    }

    // ── Accept capture ────────────────────────────────────────────────────────
    cooldownMap.current.set(spatialKey, now);

    const newMarker: CapturedMarker = {
      id: generateCaptureId(),
      markerResult: result,
      capturedAt: now,
      index: markers.length + 1,
    };

    setMarkers(prev => {
      // Double-check in case of concurrent updates
      if (prev.length >= MAX_CAPTURES) return prev;
      return [...prev, newMarker];
    });

    return true;
  }, [markers]);

  const reset = useCallback(() => {
    setMarkers([]);
    cooldownMap.current.clear();
  }, []);

  return {
    markers,
    isFull: markers.length >= MAX_CAPTURES,
    addMarker,
    reset,
    count: markers.length,
  };
}
