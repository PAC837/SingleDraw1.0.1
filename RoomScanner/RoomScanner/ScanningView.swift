import SwiftUI
import RoomPlan

/// Wraps Apple's RoomCaptureView (UIKit) in SwiftUI.
/// The user scans the room by moving the device around; taps Done to finish.
struct ScanningView: UIViewControllerRepresentable {
    @Binding var capturedRoom: CapturedRoom?
    @Binding var isScanning: Bool
    var onDismiss: () -> Void

    func makeUIViewController(context: Context) -> ScanningViewController {
        let vc = ScanningViewController()
        vc.delegate = context.coordinator
        return vc
    }

    func updateUIViewController(_ vc: ScanningViewController, context: Context) {}

    func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }

    class Coordinator: NSObject, ScanningViewControllerDelegate {
        let parent: ScanningView

        init(_ parent: ScanningView) {
            self.parent = parent
        }

        func scanningDidFinish(room: CapturedRoom?) {
            parent.capturedRoom = room
            parent.isScanning = false
            parent.onDismiss()
        }
    }
}

protocol ScanningViewControllerDelegate: AnyObject {
    func scanningDidFinish(room: CapturedRoom?)
}

/// UIKit view controller hosting the RoomCaptureView with a Done button overlay.
class ScanningViewController: UIViewController, RoomCaptureViewDelegate, RoomCaptureSessionDelegate {
    weak var delegate: ScanningViewControllerDelegate?
    private var roomCaptureView: RoomCaptureView!
    private var capturedRoomData: CapturedRoomData?

    override func viewDidLoad() {
        super.viewDidLoad()
        roomCaptureView = RoomCaptureView(frame: view.bounds)
        roomCaptureView.captureSession.delegate = self
        roomCaptureView.delegate = self
        roomCaptureView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        view.addSubview(roomCaptureView)

        // Done button
        let doneButton = UIButton(type: .system)
        doneButton.setTitle("Done", for: .normal)
        doneButton.titleLabel?.font = .boldSystemFont(ofSize: 18)
        doneButton.backgroundColor = UIColor.systemBlue
        doneButton.setTitleColor(.white, for: .normal)
        doneButton.layer.cornerRadius = 10
        doneButton.translatesAutoresizingMaskIntoConstraints = false
        doneButton.addTarget(self, action: #selector(doneTapped), for: .touchUpInside)
        view.addSubview(doneButton)

        NSLayoutConstraint.activate([
            doneButton.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -20),
            doneButton.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            doneButton.widthAnchor.constraint(equalToConstant: 120),
            doneButton.heightAnchor.constraint(equalToConstant: 44),
        ])
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        let config = RoomCaptureSession.Configuration()
        roomCaptureView.captureSession.run(configuration: config)
    }

    @objc private func doneTapped() {
        roomCaptureView.captureSession.stop()
    }

    // MARK: - RoomCaptureSessionDelegate

    func captureSession(_ session: RoomCaptureSession, didEndWith data: CapturedRoomData, error: (any Error)?) {
        capturedRoomData = data
        if let data = capturedRoomData, let room = try? CapturedRoom(from: data) {
            delegate?.scanningDidFinish(room: room)
        } else {
            delegate?.scanningDidFinish(room: nil)
        }
    }

    func captureSession(_ session: RoomCaptureSession, didUpdate room: CapturedRoom) {
        // Real-time updates during scanning — no action needed
    }

    func captureSession(_ session: RoomCaptureSession, didProvide instruction: RoomCaptureSession.Instruction) {
        // Could show coaching overlays here
    }

    func captureSession(_ session: RoomCaptureSession, didStartWith configuration: RoomCaptureSession.Configuration) {}
    func captureSession(_ session: RoomCaptureSession, didAdd room: CapturedRoom) {}
    func captureSession(_ session: RoomCaptureSession, didChange room: CapturedRoom) {}
    func captureSession(_ session: RoomCaptureSession, didRemove room: CapturedRoom) {}
}
