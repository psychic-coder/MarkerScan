// src/types/marker.ts
// Core type definitions for the MarkerScan application

export interface Point {
  x: number;
  y: number;
}

export interface MarkerResult {
  /** Four corner points of the detected marker in frame coordinates */
  corners: Point[];
  /** Detection confidence score between 0 and 1 */
  confidence: number;
  /** Rotation needed to normalize orientation: 0, 90, 180, or 270 degrees */
  orientationDegrees: 0 | 90 | 180 | 270;
  /** Base64-encoded PNG of the 300x300 extracted, orientation-corrected marker */
  extractedImageBase64: string;
}

export interface CapturedMarker {
  /** Unique identifier for this capture */
  id: string;
  /** The processed marker result from the native module */
  markerResult: MarkerResult;
  /** Timestamp (ms since epoch) when this marker was captured */
  capturedAt: number;
  /** Sequential capture index (1-based) */
  index: number;
}

/**
 * Quadrant identifiers for the orientation indicator.
 * Maps to which corner of the inner region contains the black indicator square.
 */
export type IndicatorQuadrant = 'top-left' | 'top-right' | 'bottom-right' | 'bottom-left';

/** Maps quadrant to the rotation needed to normalize it to top-left */
export type OrientationDegrees = 0 | 90 | 180 | 270;

export interface FrameProcessorResult {
  markers: MarkerResult[];
  processingTimeMs: number;
}

export interface NativeMarkerProcessor {
  processFrame(
    frameData: ArrayBuffer,
    width: number,
    height: number,
  ): Promise<MarkerResult[]>;
  extractMarker(
    frameData: ArrayBuffer,
    corners: Point[],
  ): Promise<string>;
  releaseResources(): void;
}
