#include "PluginEditor.h"
#include <BinaryData.h>

namespace
{
// Cue text and labels use Arial Bold like the web app; tracking is a fraction of the font height.
juce::Font arial (float size, float tracking = 0.0f)
{
    return juce::Font (juce::FontOptions ("Arial", size, juce::Font::bold)).withExtraKerningFactor (tracking);
}

float textWidth (const juce::Font& font, const juce::String& text)
{
    return juce::GlyphArrangement::getStringWidth (font, text);
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

juce::Font MaestroCueEditor::Look::getTextButtonFont (juce::TextButton&, int)
{
    return juce::FontOptions (static_cast<float> (MaestroDesign::type_body), juce::Font::bold);
}

void MaestroCueEditor::CueButton::setCue (const juce::String& nextWord, const juce::String& nextState, juce::Colour textColour,
                                          juce::Colour fillColour, const MaestroDesign::Palette& themePalette)
{
    word = nextWord;
    next = nextState;
    text = textColour;
    fill = fillColour;
    palette = themePalette;
    repaint();
}

void MaestroCueEditor::CueButton::paintButton (juce::Graphics& g, bool over, bool down)
{
    const auto radius = static_cast<float> (MaestroDesign::radius_panel);
    auto bounds = getLocalBounds().toFloat().reduced (1.5f);
    if (hasKeyboardFocus (true))
    {
        g.setColour (palette.focus);
        g.drawRoundedRectangle (bounds, radius + 1.0f, 2.0f);
        bounds = bounds.reduced (4.0f);
    }
    if (down) bounds = bounds.reduced (2.0f);
    g.setColour (over ? palette.raised.brighter (0.04f) : palette.raised);
    g.fillRoundedRectangle (bounds, radius);
    g.setColour (text);
    g.drawRoundedRectangle (bounds, radius, 3.0f);

    auto content = bounds.reduced (24.0f, 0.0f);
    const auto lamp = content.removeFromLeft (68.0f).withSizeKeepingCentre (68.0f, 68.0f);
    juce::Path disc;
    disc.addEllipse (lamp);
    juce::DropShadow (fill.withAlpha (0.7f), 30, {}).drawForPath (g, disc);
    g.setColour (fill);
    g.fillPath (disc);
    content.removeFromLeft (22.0f);

    // The Space hint chip mirrors the web mock-up's keycap.
    const auto hintFont = arial (11.0f, 0.14f);
    const auto hintWidth = textWidth (hintFont, "SPACE") + 18.0f;
    const auto hint = content.removeFromRight (hintWidth).withSizeKeepingCentre (hintWidth, 24.0f);
    g.setColour (palette.line.withAlpha (0.6f));
    g.drawRoundedRectangle (hint, static_cast<float> (MaestroDesign::radius_small), 1.0f);
    g.setColour (palette.muted);
    g.setFont (hintFont);
    g.drawText ("SPACE", hint, juce::Justification::centred);

    // The cue word stays centred in every state; Ready's Next line hangs below it without moving it,
    // like the musician app's cue.
    g.setColour (text);
    g.setFont (arial (64.0f));
    g.drawText (word, content, juce::Justification::centredLeft);
    if (next.isEmpty()) return;
    g.setFont (arial (13.0f, 0.08f));
    g.drawText ("NEXT: " + next.toUpperCase(), content.withTop (content.getCentreY() + 36.0f).withHeight (18.0f),
                juce::Justification::centredLeft);
}

void MaestroCueEditor::StepButton::setStyle (juce::Colour cueColour, juce::Colour focusColour)
{
    colour = cueColour;
    focus = focusColour;
    repaint();
}

void MaestroCueEditor::StepButton::paintButton (juce::Graphics& g, bool over, bool down)
{
    const auto on = getToggleState();
    const auto radius = static_cast<float> (MaestroDesign::radius_control);
    auto bounds = getLocalBounds().toFloat().reduced (1.0f);
    if (down) bounds = bounds.reduced (1.0f);
    if (on || over)
    {
        g.setColour (colour.withAlpha (on ? 0.12f : 0.06f));
        g.fillRoundedRectangle (bounds, radius);
    }
    g.setColour (hasKeyboardFocus (true) ? focus : colour.withAlpha (on ? 1.0f : over ? 0.7f : 0.4f));
    g.drawRoundedRectangle (bounds, radius, 2.0f);
    g.setColour (colour.withAlpha (on ? 1.0f : 0.8f));
    g.setFont (arial (13.0f, 0.14f));
    g.drawText (getName(), bounds, juce::Justification::centred);
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
    using Cue = MaestroCueProcessor::Cue;
    cueButton.onClick = [this] { cueProcessor.advanceCue(); refresh(); };
    addAndMakeVisible (cueButton);
    stopStep.onClick = [this] { cueProcessor.setCue (Cue::stop); refresh(); };
    readyStep.onClick = [this] { cueProcessor.setCue (MaestroCueProcessor::readyFrom (cueProcessor.getCue())); refresh(); };
    playStep.onClick = [this] { cueProcessor.setCue (Cue::play); refresh(); };
    for (auto [step, word] : { std::pair { &stopStep, "Stop" }, std::pair { &readyStep, "Ready" }, std::pair { &playStep, "Play" } })
    {
        step->setTitle ("Set cue to " + juce::String (word));
        step->setTooltip ("Set cue to " + juce::String (word));
        addAndMakeVisible (*step);
    }
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
    destinationLabel.setFont (juce::FontOptions (juce::Font::getDefaultMonospacedFontName(), 14.0f, juce::Font::plain));
    statusLabel.setFont (juce::FontOptions (static_cast<float> (MaestroDesign::type_caption)));
    statusLabel.setJustificationType (juce::Justification::centredRight);
    for (auto* component : { &destinationLabel, &statusLabel })
    {
        component->setBorderSize (juce::BorderSize<int> (0));
        addAndMakeVisible (*component);
    }
    setWantsKeyboardFocus (true);
    setSize (640, 430);
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
    // MAESTRO / CUE lockup, as in the musician app's header.
    if (mark)
    {
        auto icon = mark->createCopy();
        icon->replaceColour (juce::Colours::white, palette.accent);
        icon->drawWithin (g, { 24.0f, 32.0f, 20.0f, 20.0f }, juce::RectanglePlacement::centred, 1.0f);
    }
    const auto brand = arial (17.0f, 0.16f);
    const auto brandWidth = textWidth (brand, "MAESTRO");
    g.setColour (palette.ink);
    g.setFont (brand);
    g.drawText ("MAESTRO", juce::Rectangle<float> (54.0f, 30.0f, brandWidth + 4.0f, 24.0f), juce::Justification::centredLeft);
    g.setColour (palette.muted);
    g.setFont (juce::FontOptions (17.0f));
    g.drawText ("/", juce::Rectangle<float> (62.0f + brandWidth, 30.0f, 12.0f, 24.0f), juce::Justification::centred);
    g.setFont (arial (11.0f, 0.12f));
    g.drawText (settingsOpen ? "SETTINGS" : "CUE", juce::Rectangle<float> (82.0f + brandWidth, 32.0f, 120.0f, 22.0f),
                juce::Justification::centredLeft);

    g.setColour (palette.line.withAlpha (0.45f));
    g.drawHorizontalLine (76, 24.0f, static_cast<float> (getWidth() - 24));
    g.drawHorizontalLine (368, 24.0f, static_cast<float> (getWidth() - 24));
    if (settingsOpen)
        g.drawVerticalLine (getWidth() / 2, 92.0f, 352.0f);
    else
    {
        g.setColour (palette.muted);
        g.setFont (juce::FontOptions (static_cast<float> (MaestroDesign::type_body)));
        g.drawText ("Click or press Space to send the next cue", 24, 274, getWidth() - 48, 18, juce::Justification::centredLeft);
    }
    g.setColour (palette.muted);
    g.setFont (arial (12.0f, 0.12f));
    g.drawText ("SEND TO", 24, 386, 84, 20, juce::Justification::centredLeft);
}

void MaestroCueEditor::resized()
{
    settingsButton.setBounds (getWidth() - 68, 20, 44, 44);
    cueButton.setBounds (24, 96, getWidth() - 48, 170);
    const auto stepWidth = (getWidth() - 48 - 2 * 14) / 3;
    stopStep.setBounds (24, 304, stepWidth, 44);
    readyStep.setBounds (24 + stepWidth + 14, 304, stepWidth, 44);
    playStep.setBounds (getWidth() - 24 - stepWidth, 304, stepWidth, 44);
    destinationLabel.setBounds (108, 386, 280, 20);
    statusLabel.setBounds (388, 386, getWidth() - 412, 20);

    // Settings: connection and appearance on the left, the musician app's QR code on the right.
    settingsPanel.setBounds (24, 76, getWidth() - 48, 292);
    const auto column = (settingsPanel.getWidth() - 32) / 2, right = column + 32, half = (column - 12) / 2;
    connectionHeading.setBounds (0, 16, column, 16);
    hostLabel.setBounds (0, 40, column, 14);
    hostField.setBounds (0, 58, column, 40);
    portLabel.setBounds (0, 110, half, 14);
    webPortLabel.setBounds (half + 12, 110, half, 14);
    portField.setBounds (0, 128, half, 40);
    webPortField.setBounds (half + 12, 128, half, 40);
    applyButton.setBounds (0, 180, 90, 40);
    appearanceLabel.setBounds (0, 236, column - 56, 44);
    themeButton.setBounds (column - 44, 236, 44, 44);
    musicianHeading.setBounds (right, 16, column, 16);
    qrView.setBounds (right, 40, 136, 136);
    scanLabel.setBounds (right + 148, 40, column - 148, 16);
    urlLabel.setBounds (right + 148, 60, column - 148, 64);
    addressLabel.setBounds (right, 186, column, 16);
    addressSelector.setBounds (right, 206, column, 34);
    helpLabel.setBounds (right, 248, column, 40);
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
    for (auto* component : { static_cast<juce::Component*> (&cueButton), static_cast<juce::Component*> (&stopStep),
                             static_cast<juce::Component*> (&readyStep), static_cast<juce::Component*> (&playStep) })
        component->setVisible (! open);
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
    const auto fill = cue == Cue::play ? palette.cueGreenFill : ready ? palette.cueAmberFill : palette.cueRedFill;
    const juce::String text = cue == Cue::play ? "Play" : ready ? "Ready" : "Stop";
    const juce::String next = cue == Cue::readyToPlay ? "Play" : cue == Cue::readyToStop ? "Stop" : "";
    cueButton.setCue (text, next, colour, fill, palette);
    cueButton.setTitle ("Performance cue: " + text + (ready ? ", next " + next : juce::String()));
    cueButton.setTooltip ("Click or press Space to advance the cue");
    stopStep.setStyle (palette.cueRed, palette.focus);
    readyStep.setStyle (palette.cueAmber, palette.focus);
    playStep.setStyle (palette.cueGreen, palette.focus);
    stopStep.setToggleState (cue == Cue::stop, juce::dontSendNotification);
    readyStep.setToggleState (ready, juce::dontSendNotification);
    playStep.setToggleState (cue == Cue::play, juce::dontSendNotification);
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
    destinationLabel.setColour (juce::Label::textColourId, palette.ink);
    destinationLabel.setText (destination.host + " : " + juce::String (destination.port), juce::dontSendNotification);
    destinationLabel.setTitle ("Sending cues to " + target);
    statusLabel.setColour (juce::Label::textColourId, destinationInvalid || ! cueProcessor.isConnected() ? palette.cueRed : palette.muted);
    statusLabel.setText (destinationInvalid ? juce::String ("Enter a valid host and ports from 1 to 65535")
                         : cueProcessor.isConnected() ? "Sending" : "Send failed",
                         juce::dontSendNotification);
    if (settingsOpen) updateLink();
    repaint();
}
