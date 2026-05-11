if(NOT TARGET hermes-engine::libhermes)
add_library(hermes-engine::libhermes SHARED IMPORTED)
set_target_properties(hermes-engine::libhermes PROPERTIES
    IMPORTED_LOCATION "/Users/rohitganguly/.gradle/caches/transforms-3/bb105efc20a1c282b708860d62e596d2/transformed/jetified-hermes-android-0.73.6-release/prefab/modules/libhermes/libs/android.arm64-v8a/libhermes.so"
    INTERFACE_INCLUDE_DIRECTORIES "/Users/rohitganguly/.gradle/caches/transforms-3/bb105efc20a1c282b708860d62e596d2/transformed/jetified-hermes-android-0.73.6-release/prefab/modules/libhermes/include"
    INTERFACE_LINK_LIBRARIES ""
)
endif()

