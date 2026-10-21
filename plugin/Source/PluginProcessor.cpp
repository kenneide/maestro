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
    layout.add (std::make_unique<juce::AudioParameterBool> (juce::ParameterID { cueParamId, 1 }, "Cue", false,
                                                            juce::AudioParameterBoolAttributes()
                                                                .withStringFromValueFunction ([] (bool green, int)
                                                                                              { return juce::String (green ? "Play" : "Stop"); })
                                                                .withValueFromStringFunction ([] (const juce::String& text)
                                                                                              {
                                                                                                  const auto value = text.trim();
                                                                                                  return value.equalsIgnoreCase ("Play") || value.equalsIgnoreCase ("Green")
                                                                                                      || value.equalsIgnoreCase ("true") || value.equalsIgnoreCase ("on")
                                                                                                      || value.getIntValue() != 0;
                                                                                              })));
    return layout;
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
}

void MaestroCueProcessor::sendCue()
{
    lastSendMs = juce::Time::getMillisecondCounter();
    const auto target = getDestination();
    // DatagramSocket::write re-resolves the address whenever host or port changes.
    connected = sender.sendToIPAddress (target.host, target.port,
                                        juce::OSCMessage ("/maestro/cue", juce::String (isGreen() ? "green" : "red")));
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
