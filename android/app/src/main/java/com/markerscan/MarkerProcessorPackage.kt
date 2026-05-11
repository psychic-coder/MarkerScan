// android/app/src/main/java/com/markerscan/MarkerProcessorPackage.kt
// Registers MarkerProcessorModule with React Native's package system.

package com.markerscan

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager
import com.mrousavy.camera.frameprocessor.FrameProcessorPluginRegistry

class MarkerProcessorPackage : ReactPackage {

    companion object {
        init {
            FrameProcessorPluginRegistry.addFrameProcessorPlugin("processMarker") { proxy, options ->
                MarkerFrameProcessorPlugin(proxy, options)
            }
        }
    }

    override fun createNativeModules(
        reactContext: ReactApplicationContext
    ): List<NativeModule> {
        // Ensure OpenCV is initialised when the module is first created
        MarkerProcessorModule.initOpenCV()
        return listOf(MarkerProcessorModule(reactContext))
    }

    override fun createViewManagers(
        reactContext: ReactApplicationContext
    ): List<ViewManager<*, *>> = emptyList()
}
