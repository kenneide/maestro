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
    sender.connectToSocket (socket, oscHost, oscPort);
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
    // Heartbeat resends the current cue so Horizon recovers from UDP loss or a restart.
    if (dirty.exchange (false) || now - lastSendMs >= heartbeatMs)
        sendCue();
}

void MaestroCueProcessor::sendCue()
{
    lastSendMs = juce::Time::getMillisecondCounter();
    connected = sender.send ("/maestro/cue", juce::String (isGreen() ? "green" : "red"));
}

void MaestroCueProcessor::getStateInformation (juce::MemoryBlock& destData)
{
    if (auto xml = state.copyState().createXml())
        copyXmlToBinary (*xml, destData);
}

void MaestroCueProcessor::setStateInformation (const void* data, int sizeInBytes)
{
    if (auto xml = getXmlFromBinary (data, sizeInBytes))
        if (xml->hasTagName (state.state.getType()))
            state.replaceState (juce::ValueTree::fromXml (*xml));
}

juce::AudioProcessorEditor* MaestroCueProcessor::createEditor()
{
    return new MaestroCueEditor (*this);
}

juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter()
{
    return new MaestroCueProcessor();
}
