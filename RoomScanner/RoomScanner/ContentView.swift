import SwiftUI
import RoomPlan
import ARKit

/// Main navigation: checks LiDAR availability, then Start → Scan → Review → Export.
struct ContentView: View {
    @State private var capturedRoom: CapturedRoom?
    @State private var isScanning = false
    @State private var showScanner = false
    @State private var showReview = false

    private var hasLiDAR: Bool {
        ARWorldTrackingConfiguration.supportsSceneReconstruction(.mesh)
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 24) {
                Spacer()

                Image(systemName: "camera.viewfinder")
                    .font(.system(size: 64))
                    .foregroundColor(.accentColor)

                Text("Room Scanner")
                    .font(.largeTitle.bold())

                Text("Scan a room with LiDAR and export to Moz Importer")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 40)

                if hasLiDAR {
                    Button(action: { showScanner = true }) {
                        Label("Scan Room", systemImage: "viewfinder")
                            .font(.headline)
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(Color.accentColor)
                            .foregroundColor(.white)
                            .cornerRadius(12)
                    }
                    .padding(.horizontal, 40)
                } else {
                    Text("This device does not have LiDAR.\nRequires iPhone 12 Pro+ or iPad Pro (2020+).")
                        .font(.callout)
                        .foregroundColor(.red)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 40)
                }

                Spacer()
            }
            .fullScreenCover(isPresented: $showScanner) {
                ScanningView(capturedRoom: $capturedRoom, isScanning: $isScanning) {
                    showScanner = false
                    if capturedRoom != nil {
                        showReview = true
                    }
                }
            }
            .sheet(isPresented: $showReview) {
                if let room = capturedRoom {
                    ReviewView(room: room) {
                        showReview = false
                        capturedRoom = nil
                    }
                }
            }
        }
    }
}
