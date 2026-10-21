#include "PluginEditor.h"

namespace
{
    const juce::Colour background { 0xff0b1113 };
    const juce::Colour cueRed { 0xffd8443a };
    const juce::Colour cueGreen { 0xff2fbf71 };
    const juce::Colour muted { 0xff9cadab };
}

MaestroCueEditor::MaestroCueEditor (MaestroCueProcessor& p)
    : AudioProcessorEditor (p),
      cueProcessor (p),
      attachment (*p.getState().getParameter (MaestroCueProcessor::cueParamId), cueButton)
{
    cueButton.setClickingTogglesState (true);
    cueButton.onStateChange = [this] { refresh(); };
    addAndMakeVisible (cueButton);

    footer.setJustificationType (juce::Justification::centred);
    footer.setColour (juce::Label::textColourId, muted);
    footer.setFont (juce::FontOptions (12.0f));
    addAndMakeVisible (footer);

    setWantsKeyboardFocus (true);
    setSize (320, 220);
    refresh();
    startTimerHz (4);
}

MaestroCueEditor::~MaestroCueEditor()
{
    stopTimer();
}

void MaestroCueEditor::paint (juce::Graphics& g)
{
    g.fillAll (background);
}

void MaestroCueEditor::resized()
{
    auto area = getLocalBounds().reduced (12);
    footer.setBounds (area.removeFromBottom (20));
    area.removeFromBottom (8);
    cueButton.setBounds (area);
}

bool MaestroCueEditor::keyPressed (const juce::KeyPress& key)
{
    if (key != juce::KeyPress::spaceKey)
        return false;
    cueButton.triggerClick();
    return true;
}

void MaestroCueEditor::timerCallback()
{
    refresh();
}

void MaestroCueEditor::refresh()
{
    const auto green = cueButton.getToggleState();
    const auto colour = green ? cueGreen : cueRed;
    cueButton.setButtonText (green ? "PLAY" : "HOLD");
    cueButton.setColour (juce::TextButton::buttonColourId, colour);
    cueButton.setColour (juce::TextButton::buttonOnColourId, colour);
    cueButton.setColour (juce::TextButton::textColourOffId, juce::Colours::white);
    cueButton.setColour (juce::TextButton::textColourOnId, juce::Colours::white);
    footer.setText (juce::String ("OSC /maestro/cue -> ") + MaestroCueProcessor::oscHost + ":"
                        + juce::String (MaestroCueProcessor::oscPort)
                        + (cueProcessor.isConnected() ? "" : "  (not connected)"),
                    juce::dontSendNotification);
}
