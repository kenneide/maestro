#pragma once

#include <juce_audio_processors/juce_audio_processors.h>
#include <juce_osc/juce_osc.h>

// Pass-through audio effect that broadcasts the DJ's performance cue
// (red = hold, green = play) to the Horizon client as /maestro/cue over OSC.
class MaestroCueProcessor final : public juce::AudioProcessor,
                                  private juce::AudioProcessorValueTreeState::Listener,
                                  private juce::Timer
{
public:
    static constexpr const char* cueParamId = "go";
    static constexpr const char* oscHost = "127.0.0.1";
    static constexpr int oscPort = 9000;

    MaestroCueProcessor();
    ~MaestroCueProcessor() override;

    void prepareToPlay (double, int) override {}
    void releaseResources() override {}
    bool isBusesLayoutSupported (const BusesLayout& layouts) const override;
    void processBlock (juce::AudioBuffer<float>&, juce::MidiBuffer&) override {}
    using AudioProcessor::processBlock;

    juce::AudioProcessorEditor* createEditor() override;
    bool hasEditor() const override { return true; }

    const juce::String getName() const override { return JucePlugin_Name; }
    bool acceptsMidi() const override { return false; }
    bool producesMidi() const override { return false; }
    bool isMidiEffect() const override { return false; }
    double getTailLengthSeconds() const override { return 0.0; }

    int getNumPrograms() override { return 1; }
    int getCurrentProgram() override { return 0; }
    void setCurrentProgram (int) override {}
    const juce::String getProgramName (int) override { return {}; }
    void changeProgramName (int, const juce::String&) override {}

    void getStateInformation (juce::MemoryBlock& destData) override;
    void setStateInformation (const void* data, int sizeInBytes) override;

    juce::AudioProcessorValueTreeState& getState() { return state; }
    bool isGreen() const { return cueParam->load() >= 0.5f; }
    bool isConnected() const { return connected.load(); }

private:
    static juce::AudioProcessorValueTreeState::ParameterLayout createLayout();

    // May be called from the audio thread (automation), so it only flags a send.
    void parameterChanged (const juce::String&, float) override { dirty = true; }
    void timerCallback() override;
    void sendCue();

    juce::AudioProcessorValueTreeState state;
    std::atomic<float>* cueParam = nullptr;
    // Unbound socket: OSCSender::connect() binds a local port, which a sandbox
    // without the network.server entitlement denies. sendto() needs only network.client.
    juce::DatagramSocket socket { false };
    juce::OSCSender sender;
    std::atomic<bool> dirty { true };
    std::atomic<bool> connected { false };
    juce::uint32 lastSendMs = 0;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (MaestroCueProcessor)
};
