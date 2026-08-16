import Foundation
import UIKit

/**
 iOS screen-capture protection, driven by Business Settings →
 Screen Capture Protection → "Mobile app".

 ── This is genuinely weaker than Android, and the UI says so ────────────────
 Android has FLAG_SECURE: the OS itself refuses to put the window into a
 screenshot, recording or screen-share. iOS has no equivalent — Apple has never
 shipped one for ordinary apps. What iOS does give is `UIScreen.isCaptured`,
 which is true while the screen is being recorded, mirrored or AirPlayed, plus
 a notification when that changes.

 So the best available behaviour is: watch that flag, and while capture is
 live, cover the app with an opaque black view. A screen recording or a Zoom
 share therefore captures a black rectangle. A *still screenshot* cannot be
 blocked this way — it is instantaneous and does not flip `isCaptured`. iOS can
 only tell us a screenshot happened, after the fact.

 The overlay is attached to the window, above every view controller, so it
 covers modals and native screens too. It is `isUserInteractionEnabled = false`
 so a capture starting mid-tap can't trap the user.
 */
@objc(ScreenGuard)
class ScreenGuard: NSObject {

  /// Set by JS from the admin setting. When false we tear everything down, so
  /// the owner can still record their own demo.
  private var enabled = false
  private var overlay: UIView?
  private var observers: [NSObjectProtocol] = []

  // React Native calls exported methods on a background queue by default;
  // every UIKit touch below has to be on main.
  @objc static func requiresMainQueueSetup() -> Bool { return true }

  @objc(setSecure:resolver:rejecter:)
  func setSecure(_ value: Bool,
                 resolver resolve: @escaping RCTPromiseResolveBlock,
                 rejecter reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.main.async {
      self.enabled = value
      if value {
        self.startObserving()
        self.applyOverlayIfCapturing()
      } else {
        self.stopObserving()
        self.removeOverlay()
      }
      resolve(true)
    }
  }

  /// Lets JS report accurately that iOS protection is best-effort, not enforced.
  @objc(isFullyEnforced)
  func isFullyEnforced() -> NSNumber { return NSNumber(value: false) }

  // MARK: - Capture observation

  private func startObserving() {
    guard observers.isEmpty else { return }
    let center = NotificationCenter.default

    observers.append(center.addObserver(
      forName: UIScreen.capturedDidChangeNotification,
      object: nil, queue: .main) { [weak self] _ in
        self?.applyOverlayIfCapturing()
      })

    // Re-check on foreground: capture can start while we're backgrounded, and
    // capturedDidChange doesn't always fire for a suspended app.
    observers.append(center.addObserver(
      forName: UIApplication.didBecomeActiveNotification,
      object: nil, queue: .main) { [weak self] _ in
        self?.applyOverlayIfCapturing()
      })
  }

  private func stopObserving() {
    observers.forEach { NotificationCenter.default.removeObserver($0) }
    observers.removeAll()
  }

  // MARK: - Overlay

  private func applyOverlayIfCapturing() {
    guard enabled else { removeOverlay(); return }
    // `isCaptured` covers screen recording, AirPlay mirroring and QuickTime
    // capture over USB — every path that produces a live video of the screen.
    if UIScreen.main.isCaptured { addOverlay() } else { removeOverlay() }
  }

  private func keyWindow() -> UIWindow? {
    return UIApplication.shared.connectedScenes
      .compactMap { $0 as? UIWindowScene }
      .flatMap { $0.windows }
      .first { $0.isKeyWindow }
  }

  private func addOverlay() {
    guard overlay == nil, let window = keyWindow() else { return }
    let view = UIView(frame: window.bounds)
    view.backgroundColor = .black
    view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    view.isUserInteractionEnabled = false

    let label = UILabel()
    label.text = "Screen recording detected"
    label.textColor = UIColor.white.withAlphaComponent(0.55)
    label.font = .systemFont(ofSize: 14, weight: .medium)
    label.textAlignment = .center
    label.translatesAutoresizingMaskIntoConstraints = false
    view.addSubview(label)
    NSLayoutConstraint.activate([
      label.centerXAnchor.constraint(equalTo: view.centerXAnchor),
      label.centerYAnchor.constraint(equalTo: view.centerYAnchor),
    ])

    window.addSubview(view)
    // Above anything the app or another library adds later.
    window.bringSubviewToFront(view)
    overlay = view
  }

  private func removeOverlay() {
    overlay?.removeFromSuperview()
    overlay = nil
  }

  deinit { stopObserving() }
}
