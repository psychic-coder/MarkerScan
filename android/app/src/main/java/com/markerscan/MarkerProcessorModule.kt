// android/app/src/main/java/com/markerscan/MarkerProcessorModule.kt
// Native Android module that performs all OpenCV-based marker detection.
// Exposed to React Native via the JSI bridge AND via NativeModules for async calls.

package com.markerscan

import com.facebook.react.bridge.*
import org.opencv.android.OpenCVLoader
import org.opencv.core.*
import org.opencv.imgproc.Imgproc
import kotlinx.coroutines.*
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.util.Base64
import java.io.ByteArrayOutputStream
import kotlin.math.*

// ─── Detection constants (mirror src/constants/detection.ts) ─────────────────

private object DetectionConstants {
    const val MIN_CONTOUR_AREA = 1000.0
    const val MAX_CONTOUR_AREA_RATIO = 0.8
    const val ASPECT_RATIO_MIN = 0.7
    const val ASPECT_RATIO_MAX = 1.3
    const val POLY_APPROX_EPSILON = 0.02

    const val BORDER_DARK_THRESHOLD = 0.7
    const val INNER_WHITE_THRESHOLD = 0.6

    // KEY DISCRIMINATOR: indicator must be < 8% of quadrant area
    const val INDICATOR_SIZE_MAX_RATIO = 0.08
    const val INDICATOR_DOMINANCE_RATIO = 3.0
    const val INNER_REGION_INSET = 0.15

    const val DARK_PIXEL_THRESHOLD = 80
    const val LIGHT_PIXEL_THRESHOLD = 180

    const val OUTPUT_SIZE = 300
    const val MIN_CONFIDENCE = 0.75
}

// ─── Data classes ─────────────────────────────────────────────────────────────

data class MarkerCorner(val x: Float, val y: Float)

data class MarkerDetection(
    val corners: List<MarkerCorner>,
    val confidence: Double,
    val orientationDegrees: Int,     // 0, 90, 180, 270
    val extractedImageBase64: String // 300x300 PNG
)

// ─── Module ───────────────────────────────────────────────────────────────────

class MarkerProcessorModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        private var isOpenCVInitialized = false

        fun initOpenCV(): Boolean {
            if (!isOpenCVInitialized) {
                isOpenCVInitialized = OpenCVLoader.initDebug()
            }
            return isOpenCVInitialized
        }
    }

    private val moduleScope = CoroutineScope(Dispatchers.Default + SupervisorJob())

    init {
        initOpenCV()
        // Fallback static load if OpenCVLoader fails
        try {
            System.loadLibrary("opencv_java4")
        } catch (e: UnsatisfiedLinkError) {
            // Ignore, handled by OpenCVLoader
        }
    }

    override fun getName(): String = "MarkerProcessorModule"

    // ── Public React Native method: processFrame ───────────────────────────────

    @ReactMethod
    fun processFrame(
        frameWidth: Int,
        frameHeight: Int,
        frameDataBase64: String,
        promise: Promise
    ) {
        moduleScope.launch {
            try {
                val frameBytes = Base64.decode(frameDataBase64, Base64.DEFAULT)
                val detections = MarkerPipeline.processFrameInternal(frameBytes, frameWidth, frameHeight)
                val json = MarkerPipeline.buildDetectionsJson(detections)
                promise.resolve(json)
            } catch (e: Exception) {
                promise.reject("PROCESS_FRAME_ERROR", e.message ?: "Unknown error", e)
            }
        }
    }

    // ── Public React Native method: extractMarker ─────────────────────────────

    @ReactMethod
    fun extractMarker(
        frameDataBase64: String,
        frameWidth: Int,
        frameHeight: Int,
        cornersJson: String,
        promise: Promise
    ) {
        moduleScope.launch {
            var srcMat: Mat? = null
            var warpedMat: Mat? = null
            try {
                val frameBytes = Base64.decode(frameDataBase64, Base64.DEFAULT)
                val corners = MarkerPipeline.parseCornersFromJson(cornersJson)

                srcMat = MarkerPipeline.bytesToGrayMat(frameBytes, frameWidth, frameHeight)
                warpedMat = MarkerPipeline.perspectiveWarp(srcMat, corners, DetectionConstants.OUTPUT_SIZE)

                val base64Png = MarkerPipeline.matToBase64Png(warpedMat)
                promise.resolve(base64Png)
            } catch (e: Exception) {
                promise.reject("EXTRACT_MARKER_ERROR", e.message ?: "Unknown error", e)
            } finally {
                srcMat?.release()
                warpedMat?.release()
            }
        }
    }

    // ── Public React Native method: releaseResources ───────────────────────────

    @ReactMethod
    fun releaseResources() {
        // Cancel any in-flight coroutines
        moduleScope.coroutineContext.cancelChildren()
    }
}

object MarkerPipeline {

    init {
        try {
            System.loadLibrary("opencv_java4")
        } catch (e: UnsatisfiedLinkError) {
            // Handled by MarkerProcessorModule if already loaded via OpenCVLoader
        }
    }

    // ─── Core detection pipeline ──────────────────────────────────────────────

    /**
     * Full detection pipeline for a single frame.
     * Returns a list of valid MarkerDetection objects (usually 0 or 1).
     */
    fun processFrameInternal(
        frameBytes: ByteArray,
        width: Int,
        height: Int
    ): List<MarkerDetection> {
        var grayMat: Mat? = null
        var blurMat: Mat? = null
        var threshMat: Mat? = null

        try {
            // ── Step 1: Preprocessing ─────────────────────────────────────────
            grayMat = bytesToGrayMat(frameBytes, width, height)

            blurMat = Mat()
            // Gaussian blur (5×5 kernel) to reduce noise
            Imgproc.GaussianBlur(grayMat, blurMat, Size(5.0, 5.0), 0.0)

            threshMat = Mat()
            // Adaptive threshold: converts to binary for contour detection
            Imgproc.adaptiveThreshold(
                blurMat, threshMat,
                255.0,
                Imgproc.ADAPTIVE_THRESH_GAUSSIAN_C,
                Imgproc.THRESH_BINARY_INV,
                11,   // blockSize
                2.0   // C
            )

            // ── Step 2: Contour detection ─────────────────────────────────────
            val contours = mutableListOf<MatOfPoint>()
            val hierarchy = Mat()
            try {
                Imgproc.findContours(
                    threshMat.clone(), // findContours modifies source
                    contours,
                    hierarchy,
                    Imgproc.RETR_EXTERNAL,
                    Imgproc.CHAIN_APPROX_SIMPLE
                )
            } finally {
                hierarchy.release()
            }

            val frameArea = (width * height).toDouble()
            val candidates = mutableListOf<MatOfPoint2f>()

            for (contour in contours) {
                try {
                    val area = Imgproc.contourArea(contour)

                    // Filter by area
                    if (area < DetectionConstants.MIN_CONTOUR_AREA) continue
                    if (area > frameArea * DetectionConstants.MAX_CONTOUR_AREA_RATIO) continue

                    // Approximate to polygon
                    val curve = MatOfPoint2f(*contour.toArray())
                    val approxCurve = MatOfPoint2f()
                    val epsilon = DetectionConstants.POLY_APPROX_EPSILON * Imgproc.arcLength(curve, true)
                    Imgproc.approxPolyDP(curve, approxCurve, epsilon, true)

                    // Must have exactly 4 vertices
                    if (approxCurve.rows() != 4) {
                        approxCurve.release()
                        curve.release()
                        continue
                    }

                    // Check aspect ratio
                    val rect = Imgproc.boundingRect(MatOfPoint(*approxCurve.toArray()))
                    val ar = if (rect.height > 0) rect.width.toDouble() / rect.height else 0.0
                    if (ar < DetectionConstants.ASPECT_RATIO_MIN ||
                        ar > DetectionConstants.ASPECT_RATIO_MAX) {
                        approxCurve.release()
                        curve.release()
                        continue
                    }

                    candidates.add(approxCurve)
                    curve.release()
                } finally {
                    contour.release()
                }
            }

            // ── Steps 3–5: Perspective warp + validation ──────────────────────
            val detections = mutableListOf<MarkerDetection>()

            for (candidate in candidates) {
                var warpedMat: Mat? = null
                try {
                    warpedMat = perspectiveWarp(grayMat, candidate, DetectionConstants.OUTPUT_SIZE)
                    val validationResult = validateMarker(warpedMat) ?: continue

                    // Apply orientation correction (rotate warpedMat so indicator → top-left)
                    val corrected = rotateMat(warpedMat, validationResult.first)
                    try {
                        val base64Png = matToBase64Png(corrected)
                        val corners = matOfPoint2fToCorners(candidate)
                        detections.add(
                            MarkerDetection(
                                corners = corners,
                                confidence = validationResult.second,
                                orientationDegrees = validationResult.first,
                                extractedImageBase64 = base64Png
                            )
                        )
                    } finally {
                        corrected.release()
                    }
                } catch (_: Exception) {
                    // Individual candidate failure is non-fatal
                } finally {
                    warpedMat?.release()
                    candidate.release()
                }
            }

            return detections

        } finally {
            grayMat?.release()
            blurMat?.release()
            threshMat?.release()
        }
    }

    // ─── Marker validation ────────────────────────────────────────────────────

    /**
     * Runs the 5-condition validation on a warped grayscale Mat.
     * Returns Pair(orientationDegrees, confidence) or null if invalid.
     *
     * Conditions:
     *   (a) Outer border ≥ 70% dark pixels
     *   (b) Inner region ≥ 60% light/white pixels   ← REJECTS animal emoji markers
     *   (c) Exactly one dominant quadrant
     *   (d) Dominant quadrant fill ≤ 8%             ← REJECTS large black squares
     */
    private fun validateMarker(warped: Mat): Pair<Int, Double>? {
        val size = warped.rows() // square: rows == cols
        val borderW = (size * 0.10).roundToInt()
        val inset   = (size * DetectionConstants.INNER_REGION_INSET).roundToInt()

        // (a) Outer border: must be predominantly dark ─────────────────────────
        val borderDarkRatio = measureBorderDarkRatio(warped, size, borderW)
        if (borderDarkRatio < DetectionConstants.BORDER_DARK_THRESHOLD) return null

        // (b) Inner region: must be predominantly white ────────────────────────
        // This check rejects frames where animals/images fill the inner area
        val innerX0 = inset; val innerY0 = inset
        val innerX1 = size - inset; val innerY1 = size - inset
        val innerRegion = warped.submat(innerY0, innerY1, innerX0, innerX1)
        val innerWhiteRatio = try {
            countLightPixels(innerRegion).toDouble() /
                ((innerX1 - innerX0) * (innerY1 - innerY0))
        } finally {
            innerRegion.release()
        }
        if (innerWhiteRatio < DetectionConstants.INNER_WHITE_THRESHOLD) return null

        // (c/d) Quadrant analysis ─────────────────────────────────────────────
        val innerSize = innerX1 - innerX0
        val half = innerSize / 2
        val quadArea = half * half

        // Count dark pixels in each inner quadrant
        val quadrantCounts = IntArray(4)
        val quadBounds = arrayOf(
            intArrayOf(innerX0,        innerY0,        innerX0 + half, innerY0 + half), // TL
            intArrayOf(innerX0 + half, innerY0,        innerX1,        innerY0 + half), // TR
            intArrayOf(innerX0 + half, innerY0 + half, innerX1,        innerY1        ), // BR
            intArrayOf(innerX0,        innerY0 + half, innerX0 + half, innerY1        )  // BL
        )

        for (i in 0..3) {
            val (x0, y0, x1, y1) = quadBounds[i]
            val q = warped.submat(y0, y1, x0, x1)
            quadrantCounts[i] = try { countDarkPixels(q) } finally { q.release() }
        }

        val maxCount = quadrantCounts.max()
        val dominantIndex = quadrantCounts.indexOfFirst { it == maxCount }
        val othersSum = quadrantCounts.mapIndexed { i, c -> if (i == dominantIndex) 0 else c }.sum()
        val othersAvg = othersSum / 3.0
        val dominanceRatio = if (othersAvg == 0.0) Double.MAX_VALUE else maxCount / othersAvg

        // (c) Must have one clearly dominant quadrant
        if (dominanceRatio < DetectionConstants.INDICATOR_DOMINANCE_RATIO) return null

        // (d) KEY CHECK: dominant quadrant must have SMALL fill (≤ 8%)
        //     This rejects large black squares (50% fill) while accepting
        //     the small 20×20 indicator (~14% relative, ~8% absolute of quadrant)
        val indicatorFillRatio = maxCount.toDouble() / quadArea
        if (indicatorFillRatio > DetectionConstants.INDICATOR_SIZE_MAX_RATIO) return null

        // Map quadrant index to rotation degrees
        val orientationDegrees = when (dominantIndex) {
            0 -> 0    // top-left     → no rotation
            1 -> 90   // top-right    → 90° CCW
            2 -> 180  // bottom-right → 180°
            3 -> 270  // bottom-left  → 90° CW
            else -> 0
        }

        // Compute confidence score
        val sizeScore = 1.0 - indicatorFillRatio / DetectionConstants.INDICATOR_SIZE_MAX_RATIO
        val dominanceScore = minOf(dominanceRatio / (DetectionConstants.INDICATOR_DOMINANCE_RATIO * 2), 1.0)
        val confidence = (borderDarkRatio + innerWhiteRatio + sizeScore + dominanceScore) / 4.0

        return if (confidence >= DetectionConstants.MIN_CONFIDENCE) {
            Pair(orientationDegrees, confidence)
        } else {
            null
        }
    }

    // ─── OpenCV helpers ───────────────────────────────────────────────────────

    /** Convert raw YUV/RGBA byte array to grayscale Mat */
    fun bytesToGrayMat(bytes: ByteArray, width: Int, height: Int): Mat {
        // Attempt to decode as Bitmap first (handles JPEG/PNG from extractMarker)
        val bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
        if (bitmap != null) {
            val rgba = Mat(bitmap.height, bitmap.width, CvType.CV_8UC4)
            // android.graphics → OpenCV Mat
            val bitmapBytes = ByteArray(bitmap.byteCount)
            val buffer = java.nio.ByteBuffer.wrap(bitmapBytes)
            bitmap.copyPixelsToBuffer(buffer)
            rgba.put(0, 0, bitmapBytes)
            val gray = Mat()
            Imgproc.cvtColor(rgba, gray, Imgproc.COLOR_RGBA2GRAY)
            rgba.release()
            return gray
        }

        // Fallback: treat as raw YUV NV21 (standard VisionCamera format)
        val yuv = Mat(height + height / 2, width, CvType.CV_8UC1)
        yuv.put(0, 0, bytes)
        val gray = Mat()
        Imgproc.cvtColor(yuv, gray, Imgproc.COLOR_YUV2GRAY_NV21)
        yuv.release()
        return gray
    }

    /** Perspective-warp a quadrilateral region to a square of `outputSize` × `outputSize` */
    fun perspectiveWarp(src: Mat, corners: MatOfPoint2f, outputSize: Int): Mat {
        val orderedCorners = orderCorners(corners.toArray().toList())
        val srcPoints = MatOfPoint2f(*orderedCorners.map { Point(it.x.toDouble(), it.y.toDouble()) }.toTypedArray())

        val s = (outputSize - 1).toDouble()
        val dstPoints = MatOfPoint2f(
            Point(0.0, 0.0),
            Point(s,   0.0),
            Point(s,   s  ),
            Point(0.0, s  )
        )

        val transform = Imgproc.getPerspectiveTransform(srcPoints, dstPoints)
        val warped = Mat()
        try {
            Imgproc.warpPerspective(
                src, warped, transform,
                Size(outputSize.toDouble(), outputSize.toDouble())
            )
        } finally {
            transform.release()
            srcPoints.release()
            dstPoints.release()
        }
        return warped
    }

    /**
     * Reorder corners to [TL, TR, BR, BL].
     * Uses sum/difference trick — same logic as perspectiveCorrection.ts.
     */
    private fun orderCorners(pts: List<org.opencv.core.Point>): List<org.opencv.core.Point> {
        val sortedBySum = pts.sortedBy { it.x + it.y }
        val topLeft = sortedBySum.first()
        val bottomRight = sortedBySum.last()
        val remaining = sortedBySum.subList(1, 3).sortedBy { it.x - it.y }
        val topRight = remaining.first()
        val bottomLeft = remaining.last()
        return listOf(topLeft, topRight, bottomRight, bottomLeft)
    }

    /** Rotate a Mat by 0/90/180/270 degrees */
    private fun rotateMat(src: Mat, degrees: Int): Mat {
        val dst = Mat()
        when (degrees) {
            0   -> src.copyTo(dst)
            90  -> Core.rotate(src, dst, Core.ROTATE_90_COUNTERCLOCKWISE)
            180 -> Core.rotate(src, dst, Core.ROTATE_180)
            270 -> Core.rotate(src, dst, Core.ROTATE_90_CLOCKWISE)
            else -> src.copyTo(dst)
        }
        return dst
    }

    /** Encode a Mat as a base64 PNG string */
    fun matToBase64Png(mat: Mat): String {
        // Convert grayscale to RGBA Bitmap for PNG encoding
        val rgbaMat = Mat()
        Imgproc.cvtColor(mat, rgbaMat, Imgproc.COLOR_GRAY2RGBA)
        val bitmap = Bitmap.createBitmap(rgbaMat.cols(), rgbaMat.rows(), Bitmap.Config.ARGB_8888)
        val bytes = ByteArray(rgbaMat.total().toInt() * rgbaMat.elemSize().toInt())
        rgbaMat.get(0, 0, bytes)
        bitmap.copyPixelsFromBuffer(java.nio.ByteBuffer.wrap(bytes))
        rgbaMat.release()

        val bos = ByteArrayOutputStream()
        bitmap.compress(Bitmap.CompressFormat.PNG, 100, bos)
        return Base64.encodeToString(bos.toByteArray(), Base64.NO_WRAP)
    }

    // ─── Pixel counting helpers ───────────────────────────────────────────────

    private fun countDarkPixels(mat: Mat): Int {
        var count = 0
        val buf = ByteArray(mat.total().toInt())
        mat.get(0, 0, buf)
        for (b in buf) {
            if ((b.toInt() and 0xFF) <= DetectionConstants.DARK_PIXEL_THRESHOLD) count++
        }
        return count
    }

    private fun countLightPixels(mat: Mat): Int {
        var count = 0
        val buf = ByteArray(mat.total().toInt())
        mat.get(0, 0, buf)
        for (b in buf) {
            if ((b.toInt() and 0xFF) >= DetectionConstants.LIGHT_PIXEL_THRESHOLD) count++
        }
        return count
    }

    /** Sample dark pixels in the outer border ring */
    private fun measureBorderDarkRatio(mat: Mat, size: Int, borderW: Int): Double {
        var totalPixels = 0
        var darkPixels = 0

        fun sample(x: Int, y: Int) {
            totalPixels++
            val v = mat.get(y, x)
            if (v != null && (v[0].toInt() and 0xFF) <= DetectionConstants.DARK_PIXEL_THRESHOLD) {
                darkPixels++
            }
        }

        // Top and bottom bands
        for (y in 0 until borderW) for (x in 0 until size) sample(x, y)
        for (y in (size - borderW) until size) for (x in 0 until size) sample(x, y)
        // Side bands (excluding corners)
        for (y in borderW until (size - borderW)) {
            for (x in 0 until borderW) sample(x, y)
            for (x in (size - borderW) until size) sample(x, y)
        }

        return if (totalPixels == 0) 0.0 else darkPixels.toDouble() / totalPixels
    }

    // ─── JSON serialisation ───────────────────────────────────────────────────

    fun buildDetectionsJson(detections: List<MarkerDetection>): String {
        val sb = StringBuilder("[")
        detections.forEachIndexed { idx, d ->
            if (idx > 0) sb.append(",")
            sb.append("""{"corners":[""")
            d.corners.forEachIndexed { ci, c ->
                if (ci > 0) sb.append(",")
                sb.append("""{"x":${c.x},"y":${c.y}}""")
            }
            sb.append("""],"confidence":${d.confidence},"orientationDegrees":${d.orientationDegrees},"extractedImageBase64":"${d.extractedImageBase64}"}""")
        }
        sb.append("]")
        return sb.toString()
    }

    fun parseCornersFromJson(json: String): MatOfPoint2f {
        // Simple regex-based parser to avoid requiring a JSON library in native
        val pattern = Regex(""""x":([\d.]+),"y":([\d.]+)""")
        val points = pattern.findAll(json).map { m ->
            Point(m.groupValues[1].toDouble(), m.groupValues[2].toDouble())
        }.toList()
        return MatOfPoint2f(*points.toTypedArray())
    }

    fun matOfPoint2fToCorners(mat: MatOfPoint2f): List<MarkerCorner> {
        return mat.toArray().map { pt -> MarkerCorner(pt.x.toFloat(), pt.y.toFloat()) }
    }
}

// ─── Extension ────────────────────────────────────────────────────────────────

private operator fun IntArray.component4(): Int = this[3]

private fun Double.roundToInt(): Int = kotlin.math.roundToInt(this)
