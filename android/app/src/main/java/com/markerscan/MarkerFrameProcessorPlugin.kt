package com.markerscan

import com.mrousavy.camera.frameprocessor.Frame
import com.mrousavy.camera.frameprocessor.FrameProcessorPlugin
import com.mrousavy.camera.frameprocessor.VisionCameraProxy

class MarkerFrameProcessorPlugin(proxy: VisionCameraProxy, options: Map<String, Any>?) : FrameProcessorPlugin() {

    override fun callback(frame: Frame, arguments: Map<String, Any>?): Any? {
        val image = frame.image
        val width = image.width
        val height = image.height

        // Convert YUV_420_888 to NV21 byte array
        val planes = image.planes
        val yBuffer = planes[0].buffer
        val uBuffer = planes[1].buffer
        val vBuffer = planes[2].buffer

        val ySize = yBuffer.remaining()
        val uSize = uBuffer.remaining()
        val vSize = vBuffer.remaining()

        val nv21 = ByteArray(ySize + uSize + vSize)

        yBuffer.get(nv21, 0, ySize)
        vBuffer.get(nv21, ySize, vSize)
        uBuffer.get(nv21, ySize + vSize, uSize)

        val detections = MarkerPipeline.processFrameInternal(nv21, width, height)

        if (detections.isEmpty()) {
            return emptyList<Any>()
        }

        val resultsArray = ArrayList<Map<String, Any>>()
        for (detection in detections) {
            val map = HashMap<String, Any>()
            map["confidence"] = detection.confidence
            map["orientationDegrees"] = detection.orientationDegrees
            map["extractedImageBase64"] = detection.extractedImageBase64

            val cornersArray = ArrayList<Map<String, Double>>()
            for (corner in detection.corners) {
                val cornerMap = HashMap<String, Double>()
                cornerMap["x"] = corner.x.toDouble()
                cornerMap["y"] = corner.y.toDouble()
                cornersArray.add(cornerMap)
            }
            map["corners"] = cornersArray
            
            resultsArray.add(map)
        }

        return resultsArray
    }
}
