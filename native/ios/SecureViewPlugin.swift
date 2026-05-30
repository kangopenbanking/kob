import Foundation
import Capacitor
import UIKit

/**
 * SecureViewPlugin — iOS counterpart for the SecureView Capacitor plugin.
 *
 * iOS does not expose an equivalent of Android's FLAG_SECURE, so we
 * implement the standard banking-app pattern:
 *   - On enable(): listen for `UIApplication.willResignActiveNotification`
 *     and `UIScreen.capturedDidChangeNotification`. When either fires,
 *     overlay the key window with a UIVisualEffectView (blur) until the
 *     app becomes active again or the capture ends.
 *   - Emits "captureStateChanged" events so the JS layer can clear
 *     sensitive state or log the attempt server-side.
 *
 * Drop this file (and SecureViewPlugin.m exporting it to Objective-C)
 * into:
 *   ios/App/App/plugins/SecureView/SecureViewPlugin.swift
 *
 * The accompanying SecureViewPlugin.m looks like:
 *
 *   #import <Capacitor/Capacitor.h>
 *   CAP_PLUGIN(SecureViewPlugin, "SecureView",
 *     CAP_PLUGIN_METHOD(enable, CAPPluginReturnPromise);
 *     CAP_PLUGIN_METHOD(disable, CAPPluginReturnPromise);
 *     CAP_PLUGIN_METHOD(isEnabled, CAPPluginReturnPromise);
 *   )
 */
@objc(SecureViewPlugin)
public class SecureViewPlugin: CAPPlugin {

    private var enabled = false
    private var blurView: UIVisualEffectView?

    @objc func enable(_ call: CAPPluginCall) {
        guard !enabled else { call.resolve(["ok": true]); return }
        enabled = true

        NotificationCenter.default.addObserver(
            self,
            selector: #selector(applyBlur),
            name: UIApplication.willResignActiveNotification,
            object: nil
        )
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(removeBlur),
            name: UIApplication.didBecomeActiveNotification,
            object: nil
        )
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(capturedChanged),
            name: UIScreen.capturedDidChangeNotification,
            object: nil
        )

        call.resolve(["ok": true])
    }

    @objc func disable(_ call: CAPPluginCall) {
        enabled = false
        NotificationCenter.default.removeObserver(self)
        DispatchQueue.main.async { [weak self] in self?.removeBlur() }
        call.resolve(["ok": true])
    }

    @objc func isEnabled(_ call: CAPPluginCall) {
        call.resolve(["enabled": enabled])
    }

    @objc private func applyBlur() {
        DispatchQueue.main.async {
            guard self.blurView == nil,
                  let window = UIApplication.shared.windows.first(where: { $0.isKeyWindow }) else { return }
            let blur = UIVisualEffectView(effect: UIBlurEffect(style: .systemMaterial))
            blur.frame = window.bounds
            blur.autoresizingMask = [.flexibleWidth, .flexibleHeight]
            blur.tag = 0xCAFEBABE
            window.addSubview(blur)
            self.blurView = blur
        }
    }

    @objc private func removeBlur() {
        DispatchQueue.main.async {
            self.blurView?.removeFromSuperview()
            self.blurView = nil
        }
    }

    @objc private func capturedChanged() {
        let captured = UIScreen.main.isCaptured
        if captured { applyBlur() } else { removeBlur() }
        notifyListeners("captureStateChanged", data: ["captured": captured])
    }
}
