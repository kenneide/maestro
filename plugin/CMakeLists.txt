cmake_minimum_required(VERSION 3.22)

project(MaestroCue VERSION 0.1.0)

set(CMAKE_OSX_DEPLOYMENT_TARGET "11.0" CACHE STRING "Minimum macOS version")
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

find_program(MAESTRO_NODE node REQUIRED)
execute_process(COMMAND "${MAESTRO_NODE}" "${CMAKE_CURRENT_SOURCE_DIR}/../design/generate.mjs" --check
    RESULT_VARIABLE MAESTRO_DESIGN_RESULT)
if(NOT MAESTRO_DESIGN_RESULT EQUAL 0)
    message(FATAL_ERROR "Shared design assets are stale. Run node design/generate.mjs")
endif()

include(FetchContent)
FetchContent_Declare(JUCE
    GIT_REPOSITORY https://github.com/juce-framework/JUCE.git
    GIT_TAG 8.0.15
    GIT_SHALLOW TRUE)
FetchContent_MakeAvailable(JUCE)

juce_add_plugin(MaestroCue
    COMPANY_NAME Kenneide
    BUNDLE_ID com.kenneide.maestro.cue
    PRODUCT_NAME "Maestro Cue"
    PLUGIN_MANUFACTURER_CODE Knde
    PLUGIN_CODE Mcue
    FORMATS AU AUv3 Standalone
    AU_MAIN_TYPE kAudioUnitType_Effect
    IS_SYNTH FALSE
    NEEDS_MIDI_INPUT FALSE
    NEEDS_MIDI_OUTPUT FALSE
    IS_MIDI_EFFECT FALSE
    EDITOR_WANTS_KEYBOARD_FOCUS TRUE
    COPY_PLUGIN_AFTER_BUILD TRUE
    APP_SANDBOX_ENABLED TRUE
    APP_SANDBOX_OPTIONS com.apple.security.network.client
    # Sending cues to another computer triggers macOS's Local Network permission prompt.
    PLIST_TO_MERGE "<plist><dict><key>NSLocalNetworkUsageDescription</key><string>Maestro Cue sends performance cues to the Maestro app on another computer.</string></dict></plist>")

juce_add_binary_data(MaestroBrand SOURCES ../design/mark.svg ../design/icons/settings.svg ../design/icons/sun.svg ../design/icons/moon.svg)
target_link_libraries(MaestroCue PRIVATE MaestroBrand)

target_sources(MaestroCue
    PRIVATE
        Source/PluginProcessor.cpp
        Source/PluginEditor.cpp
        ThirdParty/qrcodegen/qrcodegen.cpp)
# Keep upstream sources unmodified while limiting JUCE's extra shadow warning to our code.
set_source_files_properties(ThirdParty/qrcodegen/qrcodegen.cpp PROPERTIES
    COMPILE_OPTIONS "$<$<COMPILE_LANG_AND_ID:CXX,Clang,AppleClang>:-Wno-shadow-field-in-constructor>")

target_compile_definitions(MaestroCue
    PUBLIC
        JUCE_WEB_BROWSER=0
        JUCE_USE_CURL=0
        JUCE_VST3_CAN_REPLACE_VST2=0)

target_link_libraries(MaestroCue
    PRIVATE
        juce::juce_audio_utils
        juce::juce_osc
    PUBLIC
        juce::juce_recommended_config_flags
        juce::juce_recommended_lto_flags
        juce::juce_recommended_warning_flags)

include(CTest)
if(BUILD_TESTING)
    juce_add_console_app(MaestroCueTests PRODUCT_NAME "Maestro Cue Tests")
    # juce_add_console_app supplies =1; the plugin interface supplies the equivalent
    # JucePlugin_Build_Standalone expression. Keep a single definition for test builds.
    get_target_property(maestro_test_definitions MaestroCueTests COMPILE_DEFINITIONS)
    list(REMOVE_ITEM maestro_test_definitions "JUCE_STANDALONE_APPLICATION=1")
    set_property(TARGET MaestroCueTests PROPERTY COMPILE_DEFINITIONS "${maestro_test_definitions}")
    target_compile_definitions(MaestroCueTests PRIVATE JucePlugin_Build_Standalone=1)
    target_sources(MaestroCueTests PRIVATE Tests/PluginTests.cpp)
    target_include_directories(MaestroCueTests PRIVATE Source)
    target_link_libraries(MaestroCueTests PRIVATE MaestroCue juce::juce_audio_utils juce::juce_osc)
    set_target_properties(MaestroCueTests PROPERTIES EXCLUDE_FROM_ALL TRUE)
    add_test(NAME MaestroCueTests COMMAND MaestroCueTests "${CMAKE_CURRENT_BINARY_DIR}/musician-link.png")
    set_tests_properties(MaestroCueTests PROPERTIES FIXTURES_SETUP MusicianQrFixture)
    if(APPLE)
        add_test(NAME MaestroCueQrDecode COMMAND /usr/bin/xcrun swift
            -module-cache-path "${CMAKE_CURRENT_BINARY_DIR}/swift-cache"
            "${CMAKE_CURRENT_SOURCE_DIR}/Tests/DecodeQr.swift"
            "${CMAKE_CURRENT_BINARY_DIR}/musician-link.png" "http://192.168.1.20:8080/")
        set_tests_properties(MaestroCueQrDecode PROPERTIES FIXTURES_REQUIRED MusicianQrFixture)
    endif()
endif()
