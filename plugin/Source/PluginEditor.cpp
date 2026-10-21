#include "PluginEditor.h"
#include <BinaryData.h>

namespace
{
juce::PropertiesFile::Options preferenceOptions()
{
    juce::PropertiesFile::Options options;
    options.applicationName = "Maestro";
    options.filenameSuffix = ".settings";
    options.osxLibrarySubFolder = "Application Support";
    options.folderName = "Maestro";
    return options;
}
}

void MaestroCueEditor::Look::drawButtonBackground (juce::Graphics& g, juce::Button& b,
                                                  const juce::Colour& colour, bool hover, bool down)
{
    auto bounds = b.getLocalBounds().toFloat().reduced (1.0f);
    g.setColour (down ? colour.darker (0.12f) : hover ? colour.brighter (0.06f) : colour);
    g.fillRoundedRectangle (bounds, static_cast<float> (MaestroDesign::radius_control));
    g.setColour (b.hasKeyboardFocus (true) ? palette.focus : palette.line);
    g.drawRoundedRectangle (bounds, static_cast<float> (MaestroDesign::radius_control), b.hasKeyboardFocus (true) ? 2.0f : 1.0f);
}

juce::Font MaestroCueEditor::Look::getTextButtonFont (juce::TextButton& b, int)
{
    return juce::FontOptions (static_cast<float> (b.getComponentID() == "cue" ? MaestroDesign::type_cue : MaestroDesign::type_body), juce::Font::bold);
}

MaestroCueEditor::MaestroCueEditor (MaestroCueProcessor& p)
    : AudioProcessorEditor (p), cueProcessor (p), preferences (preferenceOptions()),
      attachment (*p.getState().getParameter (MaestroCueProcessor::cueParamId), cueButton)
{
    light = preferences.getBoolValue ("light", false);
    mark = juce::Drawable::createFromImageData (BinaryData::mark_svg, BinaryData::mark_svgSize);
    setLookAndFeel (&look);
    cueButton.setComponentID ("cue");
    cueButton.setClickingTogglesState (true);
    cueButton.setTitle ("Performance cue");
    cueButton.onStateChange = [this] { refresh(); };
    addAndMakeVisible (cueButton);
    themeButton.onClick = [this]
    {
        light = ! light;
        preferences.setValue ("light", light);
        preferences.saveIfNeeded();
        refresh();
    };
    addAndMakeVisible (themeButton);
    footer.setJustificationType (juce::Justification::centred);
    footer.setFont (juce::FontOptions (static_cast<float> (MaestroDesign::type_caption)));
    addAndMakeVisible (footer);
    setWantsKeyboardFocus (true);
    setSize (400, 320);
    refresh();
    startTimerHz (4);
}

MaestroCueEditor::~MaestroCueEditor()
{
    stopTimer();
    setLookAndFeel (nullptr);
}

void MaestroCueEditor::paint (juce::Graphics& g)
{
    const auto& palette = look.palette;
    g.fillAll (palette.bg);
    if (mark)
    {
        auto icon = mark->createCopy();
        icon->replaceColour (juce::Colours::white, palette.accent);
        icon->drawWithin (g, { 24.0f, 22.0f, 28.0f, 28.0f }, juce::RectanglePlacement::centred, 1.0f);
    }
    g.setColour (palette.ink);
    g.setFont (juce::FontOptions (static_cast<float> (MaestroDesign::type_brand), juce::Font::bold));
    g.drawText ("MAESTRO", 62, 18, 154, 25, juce::Justification::centredLeft);
    g.setColour (palette.muted);
    g.setFont (juce::FontOptions (static_cast<float> (MaestroDesign::type_caption)));
    g.drawText ("CUE / DJ COMPANION", 63, 43, 170, 16, juce::Justification::centredLeft);
    g.drawText ("Space or click to cue the musician", 24, 248, getWidth() - 48, 22, juce::Justification::centred);
}

void MaestroCueEditor::resized()
{
    themeButton.setBounds (getWidth() - 128, 24, 104, 36);
    cueButton.setBounds (24, 84, getWidth() - 48, 152);
    footer.setBounds (24, 279, getWidth() - 48, 20);
}

bool MaestroCueEditor::keyPressed (const juce::KeyPress& key)
{
    if (key != juce::KeyPress::spaceKey) return false;
    cueButton.triggerClick();
    return true;
}

void MaestroCueEditor::timerCallback()
{
    preferences.reload();
    light = preferences.getBoolValue ("light", false);
    refresh();
}

void MaestroCueEditor::refresh()
{
    look.palette = light ? MaestroDesign::light : MaestroDesign::dark;
    const auto& palette = look.palette;
    const auto green = cueButton.getToggleState();
    const auto colour = green ? palette.cueGreen : palette.cueRed;
    cueButton.setButtonText (green ? "PLAY" : "HOLD");
    // The cue is a tinted surface, with accessible semantic text in either theme.
    const auto fill = colour.interpolatedWith (palette.surface, 0.88f);
    cueButton.setColour (juce::TextButton::buttonColourId, fill);
    cueButton.setColour (juce::TextButton::buttonOnColourId, fill);
    cueButton.setColour (juce::TextButton::textColourOffId, colour);
    cueButton.setColour (juce::TextButton::textColourOnId, colour);
    themeButton.setButtonText (light ? "Dark mode" : "Light mode");
    themeButton.setTitle (light ? "Switch to dark mode" : "Switch to light mode");
    themeButton.setColour (juce::TextButton::buttonColourId, palette.surface);
    themeButton.setColour (juce::TextButton::textColourOffId, palette.ink);
    footer.setColour (juce::Label::textColourId, palette.muted);
    footer.setText (juce::String (cueProcessor.isConnected() ? "Sending to " : "Send failed / ")
                       + MaestroCueProcessor::oscHost + ":" + juce::String (MaestroCueProcessor::oscPort),
                    juce::dontSendNotification);
    repaint();
}
