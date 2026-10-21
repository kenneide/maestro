#include "PluginProcessor.h"
#include "../ThirdParty/qrcodegen/qrcodegen.hpp"
#include <iostream>
#include <cstring>
#include <stdexcept>

namespace
{
void require (bool condition, const char* message)
{
    if (! condition) throw std::runtime_error (message);
}

void testLinks()
{
    require (MusicianLink::url ("192.168.1.20", 4173, {}) == "http://192.168.1.20:4173/", "Remote link");
    require (MusicianLink::url ("studio-mac.local", 8080, {}) == "http://studio-mac.local:8080/", "DNS and custom web port");
    for (const auto& host : { "127.0.0.1", "127.0.0.2", "localhost", "LOCALHOST." })
    {
        require (MusicianLink::url (host, 4173, "192.168.1.2") == "http://192.168.1.2:4173/", "Loopback becomes LAN link");
        require (MusicianLink::url (host, 4173, {}).isEmpty(), "No LAN address means no QR");
    }
    require (MusicianLink::url ("127.music.local", 4173, {}) == "http://127.music.local:4173/", "Numeric DNS prefix is not loopback");
    require (MusicianLink::url ("host/path", 4173, {}).isEmpty(), "Reject URL delimiters");
    for (int port : { -1, 0, 65536 }) require (MusicianLink::url ("host.local", port, {}).isEmpty(), "Reject bad web port");
    const auto addresses = MusicianLink::usableAddresses ({ juce::IPAddress ("127.0.0.1"), juce::IPAddress ("0.0.0.0"),
        juce::IPAddress ("169.254.1.2"), juce::IPAddress ("224.1.2.3"), juce::IPAddress ("192.168.1.2"),
        juce::IPAddress ("10.0.0.2"), juce::IPAddress ("192.168.1.2"), juce::IPAddress::local (true) });
    require (addresses.size() == 2, "Filter unusable and duplicate interfaces");
    require (MusicianLink::selectedAddress (addresses, "192.168.1.2") == "192.168.1.2", "Remember selected address");
    require (MusicianLink::selectedAddress (addresses, "192.168.1.3") == addresses[0], "Revalidate selected address");
    require (MusicianLink::selectedAddress ({}, "192.168.1.2").isEmpty(), "No usable interfaces");
}

void testState (const juce::PropertiesFile::Options& options)
{
    MaestroCueProcessor processor (options);
    require (processor.getDestination().webPort == 4173, "Default web port");
    require (processor.setDestination ("studio-mac.local", 9010, 8080), "Apply connection");
    require (! processor.setDestination ("other.local", 9011, 0), "Invalid settings rejected atomically");
    require (! processor.setDestination ("host/path", 9011, 8080), "Unsafe hostname rejected");
    require (processor.getDestination().host == "studio-mac.local" && processor.getDestination().port == 9010
             && processor.getDestination().webPort == 8080, "Invalid settings retain applied configuration");
    auto* cue = processor.getState().getParameter (MaestroCueProcessor::cueParamId);
    using Cue = MaestroCueProcessor::Cue;
    require (cue != nullptr && cue->getText (0, 20) == "Stop" && cue->getText (cue->convertTo0to1 (1), 20) == "Ready to Play"
             && cue->getText (cue->convertTo0to1 (2), 20) == "Play" && cue->getText (1, 20) == "Ready to Stop", "Stable cue ID and host labels");
    require (cue->getValueForText ("Play") == cue->convertTo0to1 (2) && cue->getValueForText ("Stop") == 0
             && cue->getValueForText ("Green") == cue->convertTo0to1 (2) && cue->getValueForText ("Red") == 0, "Cue labels parse and retain legacy text compatibility");
    require (processor.getCue() == Cue::stop, "Default cue is Stop");
    const Cue cycle[] { Cue::readyToPlay, Cue::play, Cue::readyToStop, Cue::stop, Cue::readyToPlay, Cue::play, Cue::readyToStop };
    for (auto expected : cycle)
    {
        processor.advanceCue();
        require (processor.getCue() == expected, "Cue cycles Stop, Ready, Play, Ready, Stop");
    }
    juce::MemoryBlock data;
    processor.getStateInformation (data);
    MaestroCueProcessor restored (options);
    restored.setStateInformation (data.getData(), static_cast<int> (data.getSize()));
    require (restored.getDestination().host == "studio-mac.local" && restored.getDestination().port == 9010
             && restored.getDestination().webPort == 8080 && restored.getCue() == Cue::readyToStop, "Session round-trip");
    MaestroCueProcessor newInstance (options);
    require (newInstance.getDestination().webPort == 8080 && newInstance.getDestination().port == 9010, "New-instance defaults");
    const auto legacyXml = juce::parseXML ("<MaestroCue host=\"127.0.0.1\" port=\"9000\"><PARAM id=\"go\" value=\"0\"/></MaestroCue>");
    juce::AudioProcessor::copyXmlToBinary (*legacyXml, data);
    restored.setStateInformation (data.getData(), static_cast<int> (data.getSize()));
    require (restored.getDestination().webPort == 4173 && restored.getDestination().port == 9000 && restored.getCue() == Cue::stop, "Legacy sessions default to web port 4173");
    const auto legacyPlayXml = juce::parseXML ("<MaestroCue host=\"127.0.0.1\" port=\"9000\"><PARAM id=\"go\" value=\"1\"/></MaestroCue>");
    juce::AudioProcessor::copyXmlToBinary (*legacyPlayXml, data);
    restored.setStateInformation (data.getData(), static_cast<int> (data.getSize()));
    require (restored.getCue() == Cue::play, "Legacy Play cue migrates");
    const auto malformedXml = juce::parseXML ("<MaestroCue host=\"host.local\" port=\"9000\" webPort=\"65536\"/>");
    juce::AudioProcessor::copyXmlToBinary (*malformedXml, data);
    restored.setStateInformation (data.getData(), static_cast<int> (data.getSize()));
    require (restored.getDestination().webPort == 4173, "Invalid stored web port falls back");
    juce::AudioBuffer<float> audio (2, 64);
    for (int c = 0; c < 2; ++c) for (int i = 0; i < 64; ++i) audio.setSample (c, i, static_cast<float> (i + c) / 64.0f);
    const juce::AudioBuffer<float> original (audio);
    juce::MidiBuffer midi;
    processor.processBlock (audio, midi);
    for (int c = 0; c < 2; ++c)
        require (std::memcmp (audio.getReadPointer (c), original.getReadPointer (c), 64 * sizeof (float)) == 0, "Audio passthrough");
}

void writeQrFixture (const juce::File& file)
{
    const auto code = qrcodegen::QrCode::encodeText ("http://192.168.1.20:8080/", qrcodegen::QrCode::Ecc::MEDIUM);
    constexpr int cell = 6, border = 4;
    const auto side = (code.getSize() + 2 * border) * cell;
    juce::Image image (juce::Image::RGB, side, side, true);
    juce::Graphics graphics (image);
    graphics.fillAll (juce::Colours::white);
    graphics.setColour (juce::Colours::black);
    for (int y = 0; y < code.getSize(); ++y) for (int x = 0; x < code.getSize(); ++x)
        if (code.getModule (x, y)) graphics.fillRect ((x + border) * cell, (y + border) * cell, cell, cell);
    juce::FileOutputStream output (file);
    require (output.openedOk() && juce::PNGImageFormat().writeImageToStream (image, output), "QR fixture writes");
}
}

int main (int argc, char* argv[])
{
    const juce::ScopedJuceInitialiser_GUI gui;
    const auto temporary = juce::File::getSpecialLocation (juce::File::tempDirectory)
        .getChildFile ("maestro-tests-" + juce::Uuid().toString());
    auto options = maestroPreferenceOptions();
    options.folderName = temporary.getFullPathName();
    try
    {
        testLinks();
        testState (options);
        if (argc > 1) writeQrFixture (juce::File (argv[1]));
        temporary.deleteRecursively();
        std::cout << "PASS: musician links, interface selection, validation, state compatibility, cue labels and audio passthrough\n";
        return 0;
    }
    catch (const std::exception& error)
    {
        temporary.deleteRecursively();
        std::cerr << "FAIL: " << error.what() << '\n';
        return 1;
    }
}
