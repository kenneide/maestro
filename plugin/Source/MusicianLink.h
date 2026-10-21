#pragma once

#include <juce_core/juce_core.h>

namespace MusicianLink
{
constexpr int defaultWebPort = 4173;

inline bool isValidPort (int port) { return port >= 1 && port <= 65535; }

inline bool isValidHost (const juce::String& host)
{
    // OSC currently supports IPv4 and DNS names. Exclude URL delimiters so the same
    // applied host can safely form the musician link without changing its authority.
    return host.isNotEmpty() && host.length() <= 253
        && host.containsOnly ("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_.");
}

inline bool isLoopback (const juce::String& host)
{
    const auto name = host.toLowerCase();
    if (name == "localhost" || name == "localhost.") return true;
    const auto parts = juce::StringArray::fromTokens (name, ".", "");
    if (parts.size() != 4 || parts[0] != "127") return false;
    for (const auto& part : parts)
        if (part.isEmpty() || ! part.containsOnly ("0123456789") || part.getIntValue() > 255) return false;
    return true;
}

inline juce::StringArray usableAddresses (const juce::Array<juce::IPAddress>& addresses)
{
    juce::StringArray result;
    for (const auto& ip : addresses)
        if (! ip.isIPv6 && ip.address[0] != 0 && ip.address[0] != 127 && ip.address[0] < 224
            && ! (ip.address[0] == 169 && ip.address[1] == 254))
            result.addIfNotAlreadyThere (ip.toString());
    result.sort (true);
    return result;
}

inline juce::String selectedAddress (const juce::StringArray& addresses, const juce::String& preferred)
{
    return addresses.contains (preferred) ? preferred : addresses.isEmpty() ? juce::String() : addresses[0];
}

inline juce::String url (const juce::String& destinationHost, int webPort, const juce::String& localAddress)
{
    const auto host = isLoopback (destinationHost) ? localAddress : destinationHost;
    if (! isValidHost (host) || ! isValidPort (webPort) || isLoopback (host))
        return {};
    return "http://" + host + ":" + juce::String (webPort) + "/";
}
}
