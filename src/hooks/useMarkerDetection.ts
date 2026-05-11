// src/hooks/useMarkerDetection.ts
// Frame processor hook that wires VisionCamera frames into the native
// MarkerProcessorModule. Runs on a worklet thread via react-native-worklets-core.


import { useRunOnJS } from 'react-native-worklets-core';
import { useFrameProcessor, VisionCameraProxy } from 'react-native-vision-camera';
import type { Frame } from 'react-native-vision-camera';
import type { MarkerResult } from '../types/marker';

// Initialize the plugin
const plugin = VisionCameraProxy.initFrameProcessorPlugin('processMarker');

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DetectionCallbacks {
  /** Called on the JS thread when markers are detected in a frame */
  onMarkersDetected: (markers: MarkerResult[]) => void;
  /** Called on the JS thread when no markers are found */
  onNoMarkers: () => void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useMarkerDetection(callbacks: DetectionCallbacks) {
  // useRunOnJS creates a worklet-callable wrapper that hops back to the JS thread
  const dispatchMarkers = useRunOnJS(
    (markers: MarkerResult[]) => callbacks.onMarkersDetected(markers),
    [callbacks],
  );

  const dispatchNoMarkers = useRunOnJS(
    () => callbacks.onNoMarkers(),
    [callbacks],
  );

  const frameProcessor = useFrameProcessor(
    (frame: Frame) => {
      'worklet';

      if (!plugin) { return; }

      try {
        const rawResults = plugin.call(frame) as unknown;

        if (Array.isArray(rawResults) && rawResults.length > 0) {
          dispatchMarkers(rawResults as MarkerResult[]);
        } else {
          dispatchNoMarkers();
        }
      } catch (_err) {
        // Silently drop frames that error — don't crash the camera
        dispatchNoMarkers();
      }
    },
    [dispatchMarkers, dispatchNoMarkers],
  );

  return frameProcessor;
}

// ─── Helper: check if native module is available ──────────────────────────────

export function isNativeModuleAvailable(): boolean {
  return plugin != null;
}

