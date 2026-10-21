#pragma once

#include "PluginProcessor.h"
#include "../../design/generated/Tokens.h"

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
    class Look final : public juce::LookAndFeel_V4
    {
    public:
        MaestroDesign::Palette palette = MaestroDesign::dark;
        void drawButtonBackground (juce::Graphics&, juce::Button&, const juce::Colour&, bool, bool) override;
        juce::Font getTextButtonFont (juce::TextButton&, int) override;
    } look;
    bool light = false;
    juce::PropertiesFile preferences;
    std::unique_ptr<juce::Drawable> mark;
    juce::TextButton themeButton;
    juce::TextButton cueButton;
    juce::Label footer;
    juce::ButtonParameterAttachment attachment;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (MaestroCueEditor)
};
