import Foundation
import Capacitor
import DocumentReader

@objc(DocumentReader) public class RegulaDocumentReaderPlugin: CAPPlugin {

    @objc func initialize(_ call: CAPPluginCall) {
        guard let licenseURL = Bundle.main.url(
                forResource: "regula", withExtension: "license",
                subdirectory: "public/assets"),
              let licenseData = try? Data(contentsOf: licenseURL) else {
            call.reject("regula.license not found in app bundle")
            return
        }
        let config = DocReader.Config(license: licenseData)
        DispatchQueue.main.async {
            DocReader.shared.initializeReader(config: config, completion: { success, error in
                if success {
                    call.resolve()
                } else {
                    call.reject(error?.localizedDescription ?? "Regula init failed")
                }
            })
        }
    }

    @objc func scan(_ call: CAPPluginCall) {
        guard let vc = self.bridge?.viewController else {
            call.reject("No view controller available")
            return
        }
        DispatchQueue.main.async {
            let scenario = DocReader.shared.availableScenarios.first?.identifier ?? "Mrz"
            DocReader.shared.processParams.scenario = scenario

            guard let cameraVC = DocReader.shared.prepareCameraViewController(cameraHandler: { action, results, error in
                switch action {
                case .complete:
                    guard let results = results else {
                        call.resolve(["cancelled": true])
                        return
                    }
                    var fields: [String: String] = [:]
                    for field in results.textResult.fields {
                        let value = field.value
                        if !value.isEmpty {
                            fields[String(field.fieldType.rawValue)] = value
                        }
                    }
                    call.resolve(["cancelled": false, "fields": fields])
                case .cancel:
                    call.resolve(["cancelled": true])
                case .error:
                    call.reject(error?.localizedDescription ?? "Scan error")
                default:
                    break
                }
            }) else {
                call.reject("Could not prepare camera view controller")
                return
            }
            vc.present(cameraVC, animated: true)
        }
    }
}
