import SwiftUI
import RoomPlan

/// Shows a summary of the scanned room and an Export JSON button.
struct ReviewView: View {
    let room: CapturedRoom
    var onDismiss: () -> Void

    @State private var showShareSheet = false
    @State private var exportURL: URL?

    private var wallCount: Int { room.walls.count }
    private var doorCount: Int { room.doors.count }
    private var windowCount: Int { room.windows.count }
    private var openingCount: Int { room.openings.count }

    var body: some View {
        NavigationStack {
            VStack(spacing: 20) {
                // Room summary
                VStack(spacing: 12) {
                    HStack {
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundColor(.green)
                            .font(.title)
                        Text("Scan Complete")
                            .font(.title2.bold())
                    }

                    VStack(alignment: .leading, spacing: 6) {
                        SummaryRow(icon: "rectangle.portrait", label: "Walls", count: wallCount)
                        SummaryRow(icon: "door.left.hand.open", label: "Doors", count: doorCount)
                        SummaryRow(icon: "window.vertical.open", label: "Windows", count: windowCount)
                        SummaryRow(icon: "rectangle.dashed", label: "Openings", count: openingCount)
                    }
                    .padding()
                    .background(Color(.systemGray6))
                    .cornerRadius(12)
                }
                .padding(.horizontal)

                // Wall dimensions
                if !room.walls.isEmpty {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Wall Dimensions")
                            .font(.headline)
                        ForEach(Array(room.walls.enumerated()), id: \.offset) { i, wall in
                            let widthMM = wall.dimensions.x * 1000
                            let heightMM = wall.dimensions.y * 1000
                            let widthIn = widthMM / 25.4
                            let heightIn = heightMM / 25.4
                            Text("Wall \(i + 1): \(String(format: "%.0f", widthIn))\" x \(String(format: "%.0f", heightIn))\"")
                                .font(.system(.caption, design: .monospaced))
                                .foregroundColor(.secondary)
                        }
                    }
                    .padding(.horizontal)
                }

                Spacer()

                // Export button
                Button(action: exportJSON) {
                    Label("Export JSON", systemImage: "square.and.arrow.up")
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(Color.accentColor)
                        .foregroundColor(.white)
                        .cornerRadius(12)
                }
                .padding(.horizontal, 40)

                Button("Scan Again", action: onDismiss)
                    .padding(.bottom)
            }
            .navigationTitle("Room Scan")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Close", action: onDismiss)
                }
            }
            .sheet(isPresented: $showShareSheet) {
                if let url = exportURL {
                    ShareSheet(activityItems: [url])
                }
            }
        }
    }

    private func exportJSON() {
        if let url = RoomExporter.exportRoomJSON(room) {
            exportURL = url
            showShareSheet = true
        }
    }
}

struct SummaryRow: View {
    let icon: String
    let label: String
    let count: Int

    var body: some View {
        HStack {
            Image(systemName: icon)
                .frame(width: 24)
                .foregroundColor(.accentColor)
            Text(label)
            Spacer()
            Text("\(count)")
                .fontWeight(.semibold)
        }
    }
}

/// UIKit share sheet wrapper for SwiftUI.
struct ShareSheet: UIViewControllerRepresentable {
    let activityItems: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: activityItems, applicationActivities: nil)
    }

    func updateUIViewController(_ vc: UIActivityViewController, context: Context) {}
}
