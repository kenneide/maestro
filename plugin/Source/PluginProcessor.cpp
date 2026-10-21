#include "PluginProcessor.h"
#include "PluginEditor.h"

namespace
{
    constexpr int timerHz = 30;
    constexpr juce::uint32 heartbeatMs = 1000;
}

MaestroCueProcessor::MaestroCueProcessor()
    : AudioProcessor (BusesProperties()
                          .withInput ("Input", juce::AudioChannelSet::stereo(), true)
                          .withOutput ("Output", juce::AudioChannelSet::stereo(), true)),
      state (*this, nullptr, "MaestroCue", createLayout())
{
    cueParam = state.getRawParameterValue (cueParamId);
    state.addParameterListener (cueParamId, this);
    const Destination saved { preferences.getValue ("destinationHost", defaultHost),
                              preferences.getIntValue ("destinationPort", defaultPort) };
    destination = isValidDestination (saved.host, saved.port) ? saved : Destination { defaultHost, defaultPort };
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
                                                                                              { return juce::String (green ? "Green" : "Red"); })));
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
    return host.isNotEmpty() && host.length() <= 253 && ! host.containsAnyOf (" \t/:")
        && port >= 1 && port <= 65535;
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

bool MaestroCueProcessor::setDestination (const juce::String& host, int port)
{
    const auto trimmed = host.trim();
    if (! isValidDestination (trimmed, port))
        return false;
    storeDestination ({ trimmed, port });
    preferences.setValue ("destinationHost", trimmed);
    preferences.setValue ("destinationPort", port);
    preferences.saveIfNeeded();
    return true;
}

void MaestroCueProcessor::getStateInformation (juce::MemoryBlock& destData)
{
    auto copy = state.copyState();
    const auto target = getDestination();
    copy.setProperty ("host", target.host, nullptr);
    copy.setProperty ("port", target.port, nullptr);
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
            if (isValidDestination (host, port))
                storeDestination ({ host, port });
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
