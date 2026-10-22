#include "PluginProcessor.h"
#include "PluginEditor.h"

namespace
{
    constexpr int timerHz = 30;
    constexpr juce::uint32 heartbeatMs = 1000;
}

MaestroCueProcessor::MaestroCueProcessor (const juce::PropertiesFile::Options& preferenceOptions)
    : AudioProcessor (BusesProperties()
                          .withInput ("Input", juce::AudioChannelSet::stereo(), true)
                          .withOutput ("Output", juce::AudioChannelSet::stereo(), true)),
      state (*this, nullptr, "MaestroCue", createLayout()), preferences (preferenceOptions)
{
    cueParam = state.getRawParameterValue (cueParamId);
    state.addParameterListener (cueParamId, this);
    const Destination saved { preferences.getValue ("destinationHost", defaultHost),
                              preferences.getIntValue ("destinationPort", defaultPort),
                              preferences.getIntValue ("webPort", defaultWebPort) };
    destination = isValidDestination (saved.host, saved.port) ? saved : Destination { defaultHost, defaultPort };
    if (! MusicianLink::isValidPort (destination.webPort)) destination.webPort = defaultWebPort;
    sender.connectToSocket (socket, destination.host, destination.port);
    startTimerHz (timerHz);
}

MaestroCueProcessor::~MaestroCueProcessor()
{
    stopTimer();
    state.removeParameterListener (cueParamId, this);
}

juce::AudioProcessorValueTreeState::ParameterLayout MaestroCueProcessor::createLayout()
{
    juce::AudioProcessorValueTreeState::ParameterLayout layout;
    static const juce::StringArray names { "Stop", "Ready to Play", "Play", "Ready to Stop" };
    layout.add (std::make_unique<juce::AudioParameterChoice> (juce::ParameterID { cueParamId, 2 }, "Cue", names, 0,
                                                              juce::AudioParameterChoiceAttributes()
                                                                  .withValueFromStringFunction ([] (const juce::String& text)
                                                                                                {
                                                                                                    const auto value = text.trim();
                                                                                                    if (const auto index = names.indexOf (value, true); index >= 0)
                                                                                                        return index;
                                                                                                    // Text accepted by the earlier Stop/Play parameter.
                                                                                                    if (value.equalsIgnoreCase ("Green") || value.equalsIgnoreCase ("true") || value.equalsIgnoreCase ("on"))
                                                                                                        return static_cast<int> (Cue::play);
                                                                                                    if (value.equalsIgnoreCase ("Red") || value.equalsIgnoreCase ("false") || value.equalsIgnoreCase ("off"))
                                                                                                        return static_cast<int> (Cue::stop);
                                                                                                    return juce::jlimit (0, names.size() - 1, value.getIntValue());
                                                                                                })));
    return layout;
}

void MaestroCueProcessor::prepareToPlay (double sampleRate, int)
{
    windowSamples = juce::jmax (1, juce::roundToInt (sampleRate * waveWindowSeconds));
    windowCount = 0;
    windowMin = windowMax = 0.0f;
}

void MaestroCueProcessor::processBlock (juce::AudioBuffer<float>& buffer, juce::MidiBuffer&)
{
    const auto channels = buffer.getNumChannels();
    if (channels == 0) return;
    const auto scale = 1.0f / static_cast<float> (channels);
    for (int i = 0; i < buffer.getNumSamples(); ++i)
    {
        float mono = 0.0f;
        for (int c = 0; c < channels; ++c) mono += buffer.getSample (c, i);
        mono *= scale;
        windowMin = windowCount == 0 ? mono : juce::jmin (windowMin, mono);
        windowMax = windowCount == 0 ? mono : juce::jmax (windowMax, mono);
        if (++windowCount < windowSamples) continue;
        // A full FIFO drops the window; seq still advances so the gap stays in time.
        const auto scope = waveFifo.write (1);
        if (scope.blockSize1 > 0)
            waveBuffer[static_cast<size_t> (scope.startIndex1)] = { waveSeq, juce::jlimit (-1.0f, 1.0f, windowMin), juce::jlimit (-1.0f, 1.0f, windowMax) };
        waveSeq = waveSeq == std::numeric_limits<int>::max() ? 0 : waveSeq + 1;
        windowCount = 0;
    }
}

int MaestroCueProcessor::drainWave (WavePoint* out, int maxPoints)
{
    const auto scope = waveFifo.read (juce::jmin (maxPoints, waveFifo.getNumReady()));
    int n = 0;
    scope.forEach ([&] (int index) { out[n++] = waveBuffer[static_cast<size_t> (index)]; });
    return n;
}

bool MaestroCueProcessor::isBusesLayoutSupported (const BusesLayout& layouts) const
{
    const auto& out = layouts.getMainOutputChannelSet();
    if (out != juce::AudioChannelSet::mono() && out != juce::AudioChannelSet::stereo())
        return false;
    return layouts.getMainInputChannelSet() == out;
}

void MaestroCueProcessor::timerCallback()
{
    const auto now = juce::Time::getMillisecondCounter();
    // Heartbeat resends the current cue so Maestro recovers from UDP loss or a restart.
    if (dirty.exchange (false) || now - lastSendMs >= heartbeatMs)
        sendCue();
    sendWave();
}

void MaestroCueProcessor::sendCue()
{
    lastSendMs = juce::Time::getMillisecondCounter();
    const auto target = getDestination();
    // DatagramSocket::write re-resolves the address whenever host or port changes.
    const auto cue = getCue();
    const auto ready = cue == Cue::readyToPlay || cue == Cue::readyToStop;
    juce::OSCMessage message ("/maestro/cue", juce::String (ready ? "amber" : cue == Cue::play ? "green" : "red"));
    if (ready)
        message.addString (cue == Cue::readyToPlay ? "green" : "red");
    connected = sender.sendToIPAddress (target.host, target.port, message);
}

void MaestroCueProcessor::sendWave()
{
    std::array<WavePoint, waveCapacity> points;
    const auto count = drainWave (points.data(), waveCapacity);
    if (count == 0) return;
    juce::OSCBundle bundle;
    for (const auto& point : juce::Span (points.data(), static_cast<size_t> (count)))
        bundle.addElement (juce::OSCMessage ("/maestro/wave", point.seq, point.min, point.max));
    const auto target = getDestination();
    sender.sendToIPAddress (target.host, target.port, bundle);
}

void MaestroCueProcessor::setCue (Cue cue)
{
    auto* param = state.getParameter (cueParamId);
    param->beginChangeGesture();
    param->setValueNotifyingHost (param->convertTo0to1 (static_cast<float> (cue)));
    param->endChangeGesture();
}

bool MaestroCueProcessor::isValidDestination (const juce::String& host, int port)
{
    return MusicianLink::isValidHost (host) && MusicianLink::isValidPort (port);
}

MaestroCueProcessor::Destination MaestroCueProcessor::getDestination() const
{
    const juce::SpinLock::ScopedLockType lock (destinationLock);
    return destination;
}

void MaestroCueProcessor::storeDestination (const Destination& next)
{
    {
        const juce::SpinLock::ScopedLockType lock (destinationLock);
        destination = next;
    }
    dirty = true;
}

bool MaestroCueProcessor::setDestination (const juce::String& host, int port, int webPort)
{
    const auto trimmed = host.trim();
    if (! isValidDestination (trimmed, port) || ! MusicianLink::isValidPort (webPort))
        return false;
    storeDestination ({ trimmed, port, webPort });
    preferences.reload();
    preferences.setValue ("destinationHost", trimmed);
    preferences.setValue ("destinationPort", port);
    preferences.setValue ("webPort", webPort);
    preferences.saveIfNeeded();
    return true;
}

void MaestroCueProcessor::getStateInformation (juce::MemoryBlock& destData)
{
    auto copy = state.copyState();
    const auto target = getDestination();
    copy.setProperty ("host", target.host, nullptr);
    copy.setProperty ("port", target.port, nullptr);
    copy.setProperty ("webPort", target.webPort, nullptr);
    if (auto xml = copy.createXml())
        copyXmlToBinary (*xml, destData);
}

void MaestroCueProcessor::setStateInformation (const void* data, int sizeInBytes)
{
    if (auto xml = getXmlFromBinary (data, sizeInBytes))
        if (xml->hasTagName (state.state.getType()))
        {
            // Sessions saved with the two-state Stop/Play parameter keep their cue.
            if (auto* legacy = xml->getChildByAttribute ("id", legacyCueParamId))
            {
                const auto play = legacy->getDoubleAttribute ("value") >= 0.5;
                legacy->setAttribute ("id", cueParamId);
                legacy->setAttribute ("value", static_cast<int> (play ? Cue::play : Cue::stop));
            }
            state.replaceState (juce::ValueTree::fromXml (*xml));
            // Sessions saved before the destination was configurable keep the current default.
            const juce::String host = state.state.getProperty ("host", getDestination().host);
            const int port = state.state.getProperty ("port", getDestination().port);
            const int webPort = state.state.getProperty ("webPort", defaultWebPort);
            if (isValidDestination (host, port))
                storeDestination ({ host, port, MusicianLink::isValidPort (webPort) ? webPort : defaultWebPort });
        }
}

juce::AudioProcessorEditor* MaestroCueProcessor::createEditor()
{
    return new MaestroCueEditor (*this);
}

juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter()
{
    return new MaestroCueProcessor();
}
