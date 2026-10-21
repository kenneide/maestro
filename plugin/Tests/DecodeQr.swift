import Foundation
import CoreImage

// Independently decode the C++ encoder's PNG fixture using the system QR reader.
func fail(_ message: String) -> Never {
    FileHandle.standardError.write(Data((message + "\n").utf8))
    exit(1)
}
guard CommandLine.arguments.count == 3 else { fail("Usage: DecodeQr.swift image.png expected-url") }
let file = URL(fileURLWithPath: CommandLine.arguments[1])
guard let image = CIImage(contentsOf: file),
      let detector = CIDetector(ofType: CIDetectorTypeQRCode,
                               context: CIContext(options: [.useSoftwareRenderer: true]),
                               options: [CIDetectorAccuracy: CIDetectorAccuracyHigh]),
      let code = detector.features(in: image).first as? CIQRCodeFeature,
      let payload = code.messageString else { fail("No QR code decoded") }
guard payload == CommandLine.arguments[2] else { fail("Unexpected QR payload: " + payload) }
print("PASS: QR decodes to " + payload)
