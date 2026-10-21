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
    void applyDestination();

    MaestroCueProcessor& cueProcessor;
    class Look final : public juce::LookAndFeel_V4
    {
    public:
        MaestroDesign::Palette palette = MaestroDesign::dark;
        void drawButtonBackground (juce::Graphics&, juce::Button&, const juce::Colour&, bool, bool) override;
        juce::Font getTextButtonFont (juce::TextButton&, int) override;
        void fillTextEditorBackground (juce::Graphics&, int, int, juce::TextEditor&) override;
        void drawTextEditorOutline (juce::Graphics&, int, int, juce::TextEditor&) override;
    } look;
    bool light = false;
    juce::PropertiesFile preferences;
    std::unique_ptr<juce::Drawable> mark;
    juce::TextButton themeButton;
    juce::TextButton cueButton;
    juce::Label footer;
    juce::TextEditor hostField, portField;
    juce::TextButton applyButton;
    bool destinationInvalid = false;
    juce::ButtonParameterAttachment attachment;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (MaestroCueEditor)
};
