#pragma once

#include "PluginProcessor.h"
#include "../../design/generated/Tokens.h"
#include "../ThirdParty/qrcodegen/qrcodegen.hpp"

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
    void showSettings (bool);
    void updateLink();
    void updateIcons();

    class IconButton final : public juce::Button
    {
    public:
        explicit IconButton (const juce::String& name) : Button (name) {}
        void setIcon (const void*, size_t, juce::Colour);
        void paintButton (juce::Graphics&, bool, bool) override;
    private:
        std::unique_ptr<juce::Drawable> image;
    } settingsButton { "Settings" }, themeButton { "Appearance" };

    class QrView final : public juce::Component
    {
    public:
        void setUrl (const juce::String&);
        void paint (juce::Graphics&) override;
    private:
        juce::String url;
        std::unique_ptr<qrcodegen::QrCode> code;
    } qrView;

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
    bool light = false, settingsOpen = false;
    juce::PropertiesFile preferences;
    std::unique_ptr<juce::Drawable> mark;
    juce::TextButton cueButton;
    juce::Label footer;
    juce::Component settingsPanel;
    juce::TextEditor hostField, portField, webPortField;
    juce::TextButton applyButton;
    juce::ComboBox addressSelector;
    juce::StringArray addresses;
    juce::String localAddress;
    juce::Label connectionHeading, hostLabel, portLabel, webPortLabel, appearanceLabel;
    juce::Label musicianHeading, scanLabel, urlLabel, addressLabel, helpLabel;
    bool destinationInvalid = false;
    juce::ButtonParameterAttachment attachment;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (MaestroCueEditor)
};
