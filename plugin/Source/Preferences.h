#pragma once

#include <juce_data_structures/juce_data_structures.h>

// Machine-wide Maestro preferences (~/Library/Application Support/Maestro/Maestro.settings),
// shared by every plugin instance and the standalone app.
inline juce::PropertiesFile::Options maestroPreferenceOptions()
{
    juce::PropertiesFile::Options options;
    options.applicationName = "Maestro";
    options.filenameSuffix = ".settings";
    options.osxLibrarySubFolder = "Application Support";
    options.folderName = "Maestro";
    return options;
}
