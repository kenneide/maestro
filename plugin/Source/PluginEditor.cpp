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
    // Match the web cue's Arial Bold with normal tracking; other controls keep the native font.
    if (b.getComponentID() == "cue")
        return juce::Font (juce::FontOptions ("Arial", 88.0f, juce::Font::bold)).withExtraKerningFactor (0.0f);
    return juce::FontOptions (static_cast<float> (MaestroDesign::type_body), juce::Font::bold);
}

void MaestroCueEditor::IconButton::setIcon (const void* data, size_t size, juce::Colour colour)
{
    image = juce::Drawable::createFromImageData (data, size);
    if (image) image->replaceColour (juce::Colours::white, colour);
    repaint();
}

void MaestroCueEditor::IconButton::paintButton (juce::Graphics& g, bool over, bool down)
{
    getLookAndFeel().drawButtonBackground (g, *this, findColour (juce::TextButton::buttonColourId), over, down);
    if (image) image->drawWithin (g, getLocalBounds().toFloat().reduced (11.0f), juce::RectanglePlacement::centred, 1.0f);
}

void MaestroCueEditor::QrView::setUrl (const juce::String& next)
{
    if (url == next) return;
    url = next;
    code.reset();
    if (url.isNotEmpty())
        code = std::make_unique<qrcodegen::QrCode> (qrcodegen::QrCode::encodeText (url.toRawUTF8(), qrcodegen::QrCode::Ecc::MEDIUM));
    setTitle (url.isNotEmpty() ? "Musician app QR code: " + url : "No musician app address available");
    repaint();
}

void MaestroCueEditor::QrView::paint (juce::Graphics& g)
{
    if (! code) return;
    // Integer modules and a four-module quiet zone remain sharp under either theme.
    const auto modules = code->getSize();
    const auto cell = juce::jmin (getWidth(), getHeight()) / (modules + 8);
    const auto side = cell * (modules + 8);
    const auto left = (getWidth() - side) / 2, top = (getHeight() - side) / 2;
    g.setColour (juce::Colours::white);
    g.fillRect (left, top, side, side);
    g.setColour (juce::Colours::black);
    for (int y = 0; y < modules; ++y)
        for (int x = 0; x < modules; ++x)
            if (code->getModule (x, y)) g.fillRect (left + (x + 4) * cell, top + (y + 4) * cell, cell, cell);
}

MaestroCueEditor::MaestroCueEditor (MaestroCueProcessor& p)
    : AudioProcessorEditor (p), cueProcessor (p), preferences (maestroPreferenceOptions())
{
    light = preferences.getBoolValue ("light", false);
    mark = juce::Drawable::createFromImageData (BinaryData::mark_svg, BinaryData::mark_svgSize);
    setLookAndFeel (&look);
    cueButton.setComponentID ("cue");
    cueButton.onClick = [this] { cueProcessor.advanceCue(); refresh(); };
    addAndMakeVisible (cueButton);
    // Shows where a Ready cue is heading; a child so it hides with the button.
    nextLabel.setJustificationType (juce::Justification::centred);
    nextLabel.setFont (juce::Font (juce::FontOptions ("Arial", static_cast<float> (MaestroDesign::type_heading), juce::Font::bold))
                          .withExtraKerningFactor (0.08f));
    nextLabel.setInterceptsMouseClicks (false, false);
    nextLabel.setAccessible (false);
    cueButton.addAndMakeVisible (nextLabel);
    settingsButton.onClick = [this] { showSettings (! settingsOpen); };
    addAndMakeVisible (settingsButton);
    addChildComponent (settingsPanel);
    themeButton.onClick = [this]
    {
        light = ! light;
        preferences.reload();
        preferences.setValue ("light", light);
        preferences.saveIfNeeded();
        updateIcons();
        refresh();
    };
    settingsPanel.addAndMakeVisible (themeButton);
    portField.setInputRestrictions (5, "0123456789");
    webPortField.setInputRestrictions (5, "0123456789");
    hostField.setTitle ("Destination IP address or hostname");
    portField.setTitle ("OSC port");
    webPortField.setTitle ("Musician app web port");
    for (auto* field : { &hostField, &portField, &webPortField })
    {
        field->setFont (juce::FontOptions (static_cast<float> (MaestroDesign::type_body)));
        field->setIndents (MaestroDesign::space_3, 0);
        field->setJustification (juce::Justification::centredLeft);
        field->onReturnKey = [this] { applyDestination(); };
        field->onEscapeKey = [this] { showSettings (false); };
        field->onTextChange = [this, field] { field->getProperties().set ("invalid", false); destinationInvalid = false; refresh(); };
        settingsPanel.addAndMakeVisible (*field);
    }
    applyButton.setButtonText ("Apply");
    applyButton.setTitle ("Apply connection settings");
    applyButton.onClick = [this] { applyDestination(); };
    settingsPanel.addAndMakeVisible (applyButton);
    addressSelector.setTitle ("Local address for musician app");
    addressSelector.onChange = [this]
    {
        localAddress = addressSelector.getText();
        preferences.reload();
        preferences.setValue ("qrLanAddress", localAddress);
        preferences.saveIfNeeded();
        updateLink();
    };
    settingsPanel.addAndMakeVisible (addressSelector);
    settingsPanel.addAndMakeVisible (qrView);
    auto label = [this] (juce::Label& component, const juce::String& text)
    {
        component.setText (text, juce::dontSendNotification);
        component.setFont (juce::FontOptions (static_cast<float> (MaestroDesign::type_caption)));
        component.setBorderSize (juce::BorderSize<int> (0));
        component.setJustificationType (juce::Justification::centredLeft);
        settingsPanel.addAndMakeVisible (component);
    };
    label (connectionHeading, "CONNECTION");
    label (hostLabel, "IP ADDRESS / HOSTNAME");
    label (portLabel, "OSC PORT");
    label (webPortLabel, "WEB PORT");
    label (appearanceLabel, "APPEARANCE");
    label (musicianHeading, "MUSICIAN APP");
    label (scanLabel, "SCAN TO OPEN");
    label (urlLabel, "");
    label (addressLabel, "LOCAL ADDRESS");
    label (helpLabel, "Run Maestro in LAN mode on the destination Mac.\nConnect the musician's device to the same network.");
    urlLabel.setMinimumHorizontalScale (1.0f);
    footer.setJustificationType (juce::Justification::centredLeft);
    footer.setFont (juce::FontOptions (static_cast<float> (MaestroDesign::type_caption)));
    addAndMakeVisible (footer);
    setWantsKeyboardFocus (true);
    setSize (480, 560);
    updateIcons();
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
    g.drawText ("MAESTRO", 62, 18, 240, 25, juce::Justification::centredLeft);
    g.setColour (palette.muted);
    g.setFont (juce::FontOptions (static_cast<float> (MaestroDesign::type_caption)));
    g.drawText (settingsOpen ? "SETTINGS" : "CUE / DJ COMPANION", 63, 43, 240, 16, juce::Justification::centredLeft);
    g.setColour (palette.line);
    g.drawHorizontalLine (82, 24.0f, static_cast<float> (getWidth() - 24));
    g.drawHorizontalLine (516, 24.0f, static_cast<float> (getWidth() - 24));
    if (settingsOpen)
        g.drawHorizontalLine (246, 24.0f, static_cast<float> (getWidth() - 24));
    else
    {
        g.setColour (palette.muted);
        g.drawText ("CUE", 24, 94, getWidth() - 48, 16, juce::Justification::centredLeft);
    }
}

void MaestroCueEditor::resized()
{
    settingsButton.setBounds (getWidth() - 68, 20, 44, 44);
    cueButton.setBounds (24, 130, getWidth() - 48, 362);
    nextLabel.setBounds (0, cueButton.getHeight() - 88, cueButton.getWidth(), 32);
    settingsPanel.setBounds (24, 82, getWidth() - 48, 430);
    connectionHeading.setBounds (0, 12, 432, 16);
    hostLabel.setBounds (0, 34, 224, 14);
    portLabel.setBounds (236, 34, 92, 14);
    webPortLabel.setBounds (340, 34, 92, 14);
    hostField.setBounds (0, 54, 224, 44);
    portField.setBounds (236, 54, 92, 44);
    webPortField.setBounds (340, 54, 92, 44);
    applyButton.setBounds (0, 110, 80, 44);
    appearanceLabel.setBounds (236, 110, 140, 44);
    themeButton.setBounds (388, 110, 44, 44);
    musicianHeading.setBounds (0, 176, 432, 16);
    qrView.setBounds (0, 202, 184, 184);
    scanLabel.setBounds (200, 202, 232, 20);
    urlLabel.setBounds (200, 226, 232, 48);
    addressLabel.setBounds (200, 292, 232, 16);
    addressSelector.setBounds (200, 314, 232, 36);
    helpLabel.setBounds (0, 388, 432, 40);
    footer.setBounds (24, 524, getWidth() - 48, 20);
}

void MaestroCueEditor::showSettings (bool open)
{
    settingsOpen = open;
    if (open)
    {
        const auto destination = cueProcessor.getDestination();
        hostField.setText (destination.host, false);
        portField.setText (juce::String (destination.port), false);
        webPortField.setText (juce::String (destination.webPort), false);
        destinationInvalid = false;
        for (auto* field : { &hostField, &portField, &webPortField }) field->getProperties().set ("invalid", false);
        addresses = MusicianLink::usableAddresses (juce::IPAddress::getAllAddresses());
        localAddress = MusicianLink::selectedAddress (addresses, preferences.getValue ("qrLanAddress"));
        addressSelector.clear (juce::dontSendNotification);
        addressSelector.addItemList (addresses, 1);
        addressSelector.setSelectedItemIndex (addresses.indexOf (localAddress), juce::dontSendNotification);
    }
    settingsPanel.setVisible (open);
    cueButton.setVisible (! open);
    settingsButton.setTitle (open ? "Close settings" : "Settings");
    settingsButton.setTooltip (open ? "Close settings" : "Settings");
    refresh();
    if (open) hostField.grabKeyboardFocus(); else settingsButton.grabKeyboardFocus();
}

void MaestroCueEditor::applyDestination()
{
    const auto host = hostField.getText().trim();
    const auto port = portField.getText().getIntValue();
    const auto webPort = webPortField.getText().getIntValue();
    const auto ok = cueProcessor.setDestination (host, port, webPort);
    hostField.getProperties().set ("invalid", ! MusicianLink::isValidHost (host));
    portField.getProperties().set ("invalid", ! MusicianLink::isValidPort (port));
    webPortField.getProperties().set ("invalid", ! MusicianLink::isValidPort (webPort));
    destinationInvalid = ! ok;
    if (ok) hostField.setText (host, false);
    refresh();
}

bool MaestroCueEditor::keyPressed (const juce::KeyPress& key)
{
    if (settingsOpen)
    {
        if (key == juce::KeyPress::escapeKey) { showSettings (false); return true; }
        return false;
    }
    if (key != juce::KeyPress::spaceKey) return false;
    cueButton.triggerClick();
    return true;
}

void MaestroCueEditor::timerCallback()
{
    preferences.reload();
    const auto nextLight = preferences.getBoolValue ("light", false);
    if (nextLight != light) { light = nextLight; updateIcons(); }
    refresh();
}

void MaestroCueEditor::updateIcons()
{
    const auto& palette = light ? MaestroDesign::light : MaestroDesign::dark;
    settingsButton.setIcon (BinaryData::settings_svg, BinaryData::settings_svgSize, palette.ink);
    themeButton.setIcon (light ? BinaryData::moon_svg : BinaryData::sun_svg,
                         static_cast<size_t> (light ? BinaryData::moon_svgSize : BinaryData::sun_svgSize), palette.ink);
}

void MaestroCueEditor::updateLink()
{
    const auto destination = cueProcessor.getDestination();
    const auto url = MusicianLink::url (destination.host, destination.webPort, localAddress);
    qrView.setUrl (url);
    urlLabel.setText (url.isEmpty() ? "Connect this Mac to a network to show a scan-ready address." : url,
                      juce::dontSendNotification);
    urlLabel.setTooltip (url);
    const auto chooseLocal = MusicianLink::isLoopback (destination.host) && addresses.size() > 1;
    addressSelector.setVisible (chooseLocal);
    addressLabel.setVisible (chooseLocal);
}

void MaestroCueEditor::refresh()
{
    look.palette = light ? MaestroDesign::light : MaestroDesign::dark;
    const auto& palette = look.palette;
    using Cue = MaestroCueProcessor::Cue;
    const auto cue = cueProcessor.getCue();
    const auto ready = cue == Cue::readyToPlay || cue == Cue::readyToStop;
    const auto colour = cue == Cue::play ? palette.cueGreen : ready ? palette.cueAmber : palette.cueRed;
    const juce::String text = cue == Cue::play ? "Play" : ready ? "Ready" : "Stop";
    const juce::String next = cue == Cue::readyToPlay ? "Play" : cue == Cue::readyToStop ? "Stop" : "";
    cueButton.setButtonText (text);
    cueButton.setTitle ("Performance cue: " + text + (ready ? ", next " + next : juce::String()));
    cueButton.setTooltip ("Click or press Space to advance the cue");
    nextLabel.setText (ready ? "NEXT: " + next.toUpperCase() : juce::String(), juce::dontSendNotification);
    nextLabel.setColour (juce::Label::textColourId, colour);
    cueButton.setColour (juce::TextButton::buttonColourId, palette.bg);
    cueButton.setColour (juce::TextButton::buttonOnColourId, palette.bg);
    cueButton.setColour (juce::TextButton::textColourOffId, colour);
    cueButton.setColour (juce::TextButton::textColourOnId, colour);
    const auto themeTitle = light ? "Switch to dark mode" : "Switch to light mode";
    themeButton.setTitle (themeTitle);
    themeButton.setTooltip (themeTitle);
    for (auto* button : { static_cast<juce::Button*> (&settingsButton), static_cast<juce::Button*> (&themeButton),
                          static_cast<juce::Button*> (&applyButton) })
        button->setColour (juce::TextButton::buttonColourId, palette.surface);
    applyButton.setColour (juce::TextButton::textColourOffId, palette.ink);
    for (auto* field : { &hostField, &portField, &webPortField })
    {
        field->setColour (juce::TextEditor::textColourId, palette.ink);
        field->setColour (juce::TextEditor::highlightColourId, palette.accent.withAlpha (0.35f));
        field->setColour (juce::CaretComponent::caretColourId, palette.ink);
        field->applyColourToAllText (palette.ink);
        field->repaint();
    }
    hostField.setTextToShowWhenEmpty ("IP address or hostname", palette.muted);
    portField.setTextToShowWhenEmpty ("OSC port", palette.muted);
    webPortField.setTextToShowWhenEmpty ("Web port", palette.muted);
    for (auto* label : { &connectionHeading, &hostLabel, &portLabel, &webPortLabel, &appearanceLabel,
                         &musicianHeading, &scanLabel, &urlLabel, &addressLabel, &helpLabel })
        label->setColour (juce::Label::textColourId, label == &urlLabel ? palette.ink : palette.muted);
    addressSelector.setColour (juce::ComboBox::backgroundColourId, palette.surface);
    addressSelector.setColour (juce::ComboBox::textColourId, palette.ink);
    addressSelector.setColour (juce::ComboBox::outlineColourId, palette.line);
    addressSelector.setColour (juce::ComboBox::arrowColourId, palette.muted);
    look.setColour (juce::PopupMenu::backgroundColourId, palette.surface);
    look.setColour (juce::PopupMenu::textColourId, palette.ink);
    look.setColour (juce::PopupMenu::highlightedBackgroundColourId, palette.raised);
    look.setColour (juce::PopupMenu::highlightedTextColourId, palette.ink);
    const auto destination = cueProcessor.getDestination();
    const auto target = destination.host + ":" + juce::String (destination.port);
    footer.setColour (juce::Label::textColourId, destinationInvalid || ! cueProcessor.isConnected() ? palette.cueRed : palette.muted);
    footer.setText (destinationInvalid ? juce::String ("Enter a valid host and ports from 1 to 65535")
                    : cueProcessor.isConnected() ? "Sending to " + target : "Send failed: " + target,
                    juce::dontSendNotification);
    if (settingsOpen) updateLink();
    repaint();
}
