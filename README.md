# MarkerScan

A React Native Android application for real-time detection and extraction of **Marker 1** — a custom visual square marker — via the device camera.

---

## 1. Project Overview

MarkerScan continuously analyses the live camera feed, detects instances of a specific custom marker design (see §5), extracts them with perspective correction and orientation normalisation, and stores up to 20 unique captures in a scrollable gallery.

### Key features
- Real-time frame processing at 30 fps via `react-native-vision-camera` + JSI bridge
- Native Android OpenCV pipeline (contour detection, perspective warp, pixel validation)
- Animated Skia overlay showing the detected marker boundary
- Automatic orientation correction — the indicator square is always output at the top-left
- Strict false-positive rejection: large black squares, centred squares, and animal images are all rejected
- 4-column results gallery with full-screen detail view
- Haptic feedback + flash on every successful capture

---

## 2. Setup Instructions

### Required tools
| Tool | Version |
|---|---|
| Node.js | ≥ 18 LTS |
| Java (JDK) | 17 (OpenJDK or Temurin) |
| Android SDK | API 34 (compileSdk) |
| Android Build Tools | 34.0.0 |
| NDK | 26.1.10909125 |
| Kotlin | 1.9.22 |
| React Native | 0.73.x |

### Install dependencies
```bash
# Clone the repository
git clone https://github.com/your-org/markerscan.git
cd markerscan

# Install JS dependencies
npm install

# Install pods (iOS — not required for Android-only build)
# cd ios && pod install && cd ..
```

### Android SDK setup
1. Install Android Studio (Hedgehog or later).
2. Open SDK Manager → install API 34, Build Tools 34.0.0, NDK 26.1.x.
3. Set `ANDROID_HOME` and add `$ANDROID_HOME/platform-tools` to `PATH`.

---

## 3. Running on Android

### On a physical device
```bash
# Enable Developer Options + USB Debugging on the device
adb devices  # confirm device is listed

npm run android
```

### On an emulator
```bash
# Start an AVD with API 34 (camera support required — use "Pixel 7 Pro" skin)
npm run android
```

> **Note:** Camera-based marker detection requires a physical device or an emulator with camera passthrough enabled.

---

## 4. Building the Release APK

```bash
cd android

# Generate a release keystore (first time only)
keytool -genkeypair -v -storetype PKCS12 \
  -keystore app/markerscan-release.keystore \
  -alias markerscan-key -keyalg RSA -keysize 2048 -validity 10000

# Add credentials to ~/.gradle/gradle.properties:
# MYAPP_UPLOAD_STORE_FILE=markerscan-release.keystore
# MYAPP_UPLOAD_KEY_ALIAS=markerscan-key
# MYAPP_UPLOAD_STORE_PASSWORD=yourpassword
# MYAPP_UPLOAD_KEY_PASSWORD=yourpassword

./gradlew assembleRelease
```

Output: `android/app/build/outputs/apk/release/app-release.apk`

---

## 5. Marker Design — Marker 1

### Physical dimensions
```
┌─────────────────────────────┐  ← total: 140 × 140 px
│█████████████████████████████│  ← outer black border: ~10 px stroke
│██ ┌─────────────────────┐ ██│
│██ │■                    │ ██│  ← small black square: 20 × 20 px
│██ │                     │ ██│     at top-left of inner area
│██ │   (white / empty)   │ ██│     touching inner boundary (~10 px inset)
│██ │                     │ ██│
│██ └─────────────────────┘ ██│  ← inner white region: ≥ 60% of total area
│█████████████████████████████│
└─────────────────────────────┘
```

### Critical measurements
| Feature | Value |
|---|---|
| Total outer size | 140 × 140 px |
| Border stroke | ~10 px |
| Inner white region | ~120 × 120 px (≈ 73% of total area) |
| Indicator (black square) | 20 × 20 px |
| Indicator position | Top-left corner of inner area, 10 px inset from inner boundary |
| Indicator area ratio | ≈ 2.8% of total, ≈ 3.5% of inner area, ≈ **8% of top-left quadrant** |

### Orientation indicator
The small black square tells the detection algorithm which way the marker is oriented. The app always outputs a normalised image with the indicator at the **top-left**, regardless of physical rotation.

| Indicator position (raw) | Meaning | Correction applied |
|---|---|---|
| Top-left | 0° (upright) | None |
| Top-right | Rotated 90° CW | Rotate output 90° CCW |
| Bottom-right | Rotated 180° | Rotate output 180° |
| Bottom-left | Rotated 270° CW | Rotate output 90° CW |

---

## 6. Detection Algorithm

The detection runs in a 6-step pipeline every camera frame (30 fps target):

### Step 1 — Preprocessing
Convert frame to grayscale → Gaussian blur (5×5) → adaptive threshold (blockSize=11, C=2).

### Step 2 — Contour detection
`findContours` (external only) → `approxPolyDP` (ε = 2% of arc length) → keep only 4-vertex polygons → filter by area (1000 px – 80% of frame) and aspect ratio (0.7 – 1.3).

### Step 3 — Perspective correction
`getPerspectiveTransform` + `warpPerspective` → 300 × 300 px normalised square.

### Step 4 — Marker validation (the discriminating logic)
On the warped image:

| Check | Condition | What it rejects |
|---|---|---|
| (a) Border | ≥ 70% of border pixels are dark | Non-marker rectangles |
| (b) Inner region | ≥ 60% of inner pixels are white | Animal/image content |
| (c) Dominance | One quadrant has ≥ 3× the dark pixels of the average of the other three | No clear indicator |
| **(d) Size** | **Dominant quadrant dark fill ≤ 8%** | **Large black squares (50% fill), medium squares (20–40% fill)** |

Check (d) is the key discriminator. The valid marker's 20×20 indicator fills ≈ 8% of its quadrant; all incorrect patterns fill ≥ 14% and are rejected.

### Step 5 — Orientation correction
Rotate the warped image so the indicator lands at top-left (0, 90, 180, or 270°).

### Step 6 — Deduplication
2-second spatial cooldown + base64 structural similarity check (reject if > 90% similar).

---

## 7. Test Case Compliance

| Test image | File | Expected | Reason |
|---|---|---|---|
| Small square top-left (upright) | TestImage1-Correct | ✅ DETECT | Valid marker, 0° |
| Small square top-left (upright) | TestImage2-Correct | ✅ DETECT | Valid marker, 0° |
| Small square at rotated position (45°) | TestImage3-Correct | ✅ DETECT | Valid marker, rotated |
| Medium square centre | TestImage4-Incorrect | ❌ REJECT | Check (d): fill ≈ 25% > 8% |
| Large square top-left quadrant | TestImage5-Incorrect | ❌ REJECT | Check (d): fill ≈ 50% > 8% |
| Monkey emoji (small square top-right, rotated) | TestImage6-Incorrect | ❌ REJECT | Check (b): inner not white |
| Pig emoji (small square top-left) | TestImage7-Incorrect | ❌ REJECT | Check (b): inner not white |

> **Why the emoji images are rejected:** Even though they have a small black indicator in the correct position, check (b) fails — the inner region contains colourful animal illustrations rather than a white/empty field, so the light-pixel ratio falls well below 60%.

---

## 8. File Structure

```
MarkerScan/
├── android/
│   └── app/
│       ├── build.gradle                          ← OpenCV + Kotlin deps
│       ├── proguard-rules.pro
│       └── src/main/
│           ├── AndroidManifest.xml
│           └── java/com/markerscan/
│               ├── MainActivity.kt
│               ├── MainApplication.kt
│               ├── MarkerProcessorModule.kt      ← OpenCV detection pipeline
│               └── MarkerProcessorPackage.kt
├── src/
│   ├── constants/
│   │   └── detection.ts                          ← All tunable thresholds
│   ├── types/
│   │   └── marker.ts                             ← Shared TypeScript types
│   ├── utils/
│   │   ├── markerValidator.ts                    ← JS-side validation (testing/fallback)
│   │   ├── perspectiveCorrection.ts              ← Corner ordering + geometry helpers
│   │   └── imageUtils.ts                         ← Hashing, deduplication, formatting
│   ├── native/
│   │   └── MarkerProcessor.ts                    ← Typed bridge to native module
│   ├── hooks/
│   │   ├── useMarkerDetection.ts                 ← VisionCamera frame processor
│   │   └── useMarkerCollection.ts                ← Capture state management
│   ├── components/
│   │   ├── MarkerOverlay.tsx                     ← Skia canvas overlay
│   │   ├── MarkerGrid.tsx                        ← 4-column FlatList grid
│   │   └── MarkerThumbnail.tsx                   ← Individual grid cell
│   ├── screens/
│   │   ├── CameraScreen.tsx                      ← Screen 1: live scanner
│   │   ├── ResultsScreen.tsx                     ← Screen 2: gallery
│   │   └── MarkerDetailScreen.tsx                ← Screen 3: full-screen viewer
│   └── navigation/
│       └── AppNavigator.tsx                      ← Stack navigator
├── App.tsx
├── index.js
├── package.json
├── tsconfig.json
└── babel.config.js
```

---

## 9. Known Limitations

1. **Android only.** The native module is Kotlin/OpenCV — no iOS support.
2. **Low-light performance.** Adaptive threshold struggles in very dim conditions; add a torch toggle if needed.
3. **Frame rate under load.** On older devices (< 4 cores), frame processing may drop below 30 fps. The worklet skips frames automatically (backpressure guard) to avoid lag.
4. **Very small markers.** Markers smaller than ~80 px in the camera frame fall below the `MIN_CONTOUR_AREA` threshold and will not be detected. Move closer to the marker.
5. **Glossy/reflective markers.** Specular reflections can wash out the black border and cause the border check (a) to fail. Use matte-finish prints.
6. **JS deduplication.** The JavaScript similarity check (`estimateSimilarity`) is a fast approximation. For production, delegate to a native SSIM implementation.
7. **No persistence.** Captured markers are held in React state only — they are lost when the app is killed. Add AsyncStorage or a SQLite layer to persist captures.
