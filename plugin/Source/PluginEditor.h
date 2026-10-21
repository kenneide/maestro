#pragma once

#include "PluginProcessor.h"

// One large red/green toggle bound to the "Cue" parameter.
class MaestroCueEditor final : public juce::AudioProcessorEditor,
                               private juce::Timer
{
public:
    explicit MaestroCueEditor (MaestroCueProcessor&);
    ~MaestroCueEditor() override;

    void paint (juce::Graphics&) override;
    void resized() override;
    bool keyPressed (const juce::KeyPress&) override;

private:
    void timerCallback() override;
    void refresh();

    MaestroCueProcessor& cueProcessor;
    juce::TextButton cueButton;
    juce::Label footer;
    juce::ButtonParameterAttachment attachment;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (MaestroCueEditor)
};
