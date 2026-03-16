import Foundation
import RoomPlan

/// Encodes a CapturedRoom to JSON and writes to a temporary file for sharing.
enum RoomExporter {

    /// Exports the scanned room as a JSON file. Returns the file URL for sharing.
    static func exportRoomJSON(_ room: CapturedRoom) -> URL? {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]

        guard let data = try? encoder.encode(room) else {
            print("[RoomExporter] Failed to encode CapturedRoom")
            return nil
        }

        let filename = "room_scan_\(dateString()).json"
        let url = FileManager.default.temporaryDirectory.appendingPathComponent(filename)

        do {
            try data.write(to: url)
            let sizeMB = Double(data.count) / (1024 * 1024)
            print("[RoomExporter] Exported \(String(format: "%.2f", sizeMB)) MB → \(url.lastPathComponent)")
            return url
        } catch {
            print("[RoomExporter] Write failed: \(error)")
            return nil
        }
    }

    private static func dateString() -> String {
        let fmt = DateFormatter()
        fmt.dateFormat = "yyyy-MM-dd_HHmmss"
        return fmt.string(from: Date())
    }
}
