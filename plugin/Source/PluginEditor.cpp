#include "PluginEditor.h"
#include <BinaryData.h>

void MaestroCueEditor::Look::drawButtonBackground (juce::Graphics& g, juce::Button& b,
                                                  const juce::Colour& colour, bool hover, bool down)
{
    auto bounds = b.getLocalBounds().toFloat().reduced (1.0f);
    g.setColour (down ? colour.darker (0.12f) : hover ? colour.brighter (0.06f) : colour);
    g.fillRoundedRectangle (bounds, static_cast<float> (MaestroDesign::radius_control));
    g.setColour (b.hasKeyboardFocus (true) ? palette.focus : palette.line);
    g.drawRoundedRectangle (bounds, static_cast<float> (MaestroDesign::radius_control), b.hasKeyboardFocus (true) ? 2.0f : 1.0f);
}

void MaestroCueEditor::Look::fillTextEditorBackground (juce::Graphics& g, int width, int height, juce::TextEditor&)
{
    g.setColour (palette.surface);
    g.fillRoundedRectangle (juce::Rectangle<int> (width, height).toFloat().reduced (0.5f), static_cast<float> (MaestroDesign::radius_control));
}

void MaestroCueEditor::Look::drawTextEditorOutline (juce::Graphics& g, int width, int height, juce::TextEditor& editor)
{
    const auto invalid = static_cast<bool> (editor.getProperties()["invalid"]);
    const auto focused = editor.hasKeyboardFocus (true);
    g.setColour (invalid ? palette.cueRed : focused ? palette.focus : palette.line);
    g.drawRoundedRectangle (juce::Rectangle<int> (width, height).toFloat().reduced (0.5f),
                            static_cast<float> (MaestroDesign::radius_control), invalid || focused ? 2.0f : 1.0f);
}

juce::Font MaestroCueEditor::Look::getTextButtonFont (juce::TextButton& b, int)
{
    return juce::FontOptions (static_cast<float> (b.getComponentID() == "cue" ? MaestroDesign::type_cue : MaestroDesign::type_body), juce::Font::bold);
}

MaestroCueEditor::MaestroCueEditor (MaestroCueProcessor& p)
    : AudioProcessorEditor (p), cueProcessor (p), preferences (maestroPreferenceOptions()),
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
    const auto destination = p.getDestination();
    hostField.setText (destination.host, false);
    hostField.setTitle ("Destination IP address or hostname");
    portField.setText (juce::String (destination.port), false);
    portField.setInputRestrictions (5, "0123456789");
    portField.setTitle ("Destination port");
    for (auto* field : { &hostField, &portField })
    {
        field->setFont (juce::FontOptions (static_cast<float> (MaestroDesign::type_body)));
        field->setIndents (MaestroDesign::space_3, 0);
        field->setJustification (juce::Justification::centredLeft);
        field->onReturnKey = [this] { applyDestination(); };
        field->onTextChange = [this, field] { field->getProperties().set ("invalid", false); destinationInvalid = false; refresh(); };
        addAndMakeVisible (*field);
    }
    applyButton.setButtonText ("Apply");
    applyButton.setTitle ("Apply destination");
    applyButton.onClick = [this] { applyDestination(); };
    addAndMakeVisible (applyButton);
    footer.setJustificationType (juce::Justification::centred);
    footer.setFont (juce::FontOptions (static_cast<float> (MaestroDesign::type_caption)));
    addAndMakeVisible (footer);
    setWantsKeyboardFocus (true);
    setSize (400, 388);
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
    g.drawText ("Space or click to cue the musician", 24, 244, getWidth() - 48, 22, juce::Justification::centred);
    g.drawText ("SEND TO", 24, 276, getWidth() - 48, 16, juce::Justification::centredLeft);
}

void MaestroCueEditor::resized()
{
    themeButton.setBounds (getWidth() - 128, 24, 104, 36);
    cueButton.setBounds (24, 84, getWidth() - 48, 152);
    auto row = juce::Rectangle<int> (24, 296, getWidth() - 48, 36);
    applyButton.setBounds (row.removeFromRight (80));
    row.removeFromRight (MaestroDesign::space_2);
    portField.setBounds (row.removeFromRight (80));
    row.removeFromRight (MaestroDesign::space_2);
    hostField.setBounds (row);
    footer.setBounds (24, 348, getWidth() - 48, 20);
}

void MaestroCueEditor::applyDestination()
{
    const auto host = hostField.getText().trim();
    const auto port = portField.getText().getIntValue();
    const auto ok = cueProcessor.setDestination (host, port);
    hostField.getProperties().set ("invalid", ! MaestroCueProcessor::isValidDestination (host, 1));
    portField.getProperties().set ("invalid", ! MaestroCueProcessor::isValidDestination ("x", port));
    destinationInvalid = ! ok;
    if (ok)
    {
        hostField.setText (host, false);
        grabKeyboardFocus(); // so Space toggles the cue again
    }
    hostField.repaint();
    portField.repaint();
    refresh();
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
    applyButton.setColour (juce::TextButton::buttonColourId, palette.surface);
    applyButton.setColour (juce::TextButton::textColourOffId, palette.ink);
    for (auto* field : { &hostField, &portField })
    {
        field->setColour (juce::TextEditor::textColourId, palette.ink);
        field->setColour (juce::TextEditor::highlightColourId, palette.accent.withAlpha (0.35f));
        field->setColour (juce::CaretComponent::caretColourId, palette.ink);
        field->applyColourToAllText (palette.ink);
    }
    hostField.setTextToShowWhenEmpty ("IP address or hostname", palette.muted);
    portField.setTextToShowWhenEmpty ("Port", palette.muted);
    const auto destination = cueProcessor.getDestination();
    const auto target = destination.host + ":" + juce::String (destination.port);
    footer.setColour (juce::Label::textColourId, destinationInvalid || ! cueProcessor.isConnected() ? palette.cueRed : palette.muted);
    footer.setText (destinationInvalid ? juce::String ("Enter an IP or hostname and a port from 1 to 65535")
                    : cueProcessor.isConnected() ? "Sending to " + target : "Send failed: " + target,
                    juce::dontSendNotification);
    repaint();
}
