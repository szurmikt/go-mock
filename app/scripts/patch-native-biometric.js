const fs = require('fs');
const path = require('path');

const pluginRoot = path.join(__dirname, '..', 'node_modules', 'capacitor-native-biometric');
const objcDir = path.join(pluginRoot, 'ios', 'Plugin', 'objc');

// Create the ObjC-only subdirectory so SPM can have a pure-ObjC target for Plugin.m
// (SPM does not allow Swift + ObjC in the same target)
fs.mkdirSync(objcDir, { recursive: true });

fs.writeFileSync(path.join(objcDir, 'Plugin.m'), `\
#import <Foundation/Foundation.h>
#import <Capacitor/Capacitor.h>

// CAP_PLUGIN macro registers the plugin with Capacitor's bridge so it is
// discoverable at runtime. Without this, verifyIdentity() falls through to
// the web stub and FaceID is never triggered.
CAP_PLUGIN(NativeBiometric, "NativeBiometric",
           CAP_PLUGIN_METHOD(isAvailable, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(verifyIdentity, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(getCredentials, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(setCredentials, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(deleteCredentials, CAPPluginReturnPromise);
)
`);

fs.writeFileSync(path.join(objcDir, 'Plugin.h'), `\
#import <UIKit/UIKit.h>

FOUNDATION_EXPORT double PluginVersionNumber;
FOUNDATION_EXPORT const unsigned char PluginVersionString[];
`);

const packageSwift = `// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "CapacitorNativeBiometric",
    platforms: [.iOS(.v15)],
    products: [
        .library(name: "CapacitorNativeBiometric", targets: ["NativeBiometricPlugin"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", from: "8.0.0")
    ],
    targets: [
        // Pure ObjC target: provides CAP_PLUGIN registration so Capacitor's
        // bridge discovers the plugin at runtime.
        .target(
            name: "NativeBiometricObjC",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm")
            ],
            path: "ios/Plugin/objc",
            publicHeadersPath: "."
        ),
        // Pure Swift target: actual plugin implementation.
        // Depends on NativeBiometricObjC so both are linked into the binary.
        .target(
            name: "NativeBiometricPlugin",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm"),
                .target(name: "NativeBiometricObjC")
            ],
            path: "ios/Plugin",
            sources: ["Plugin.swift"]
        )
    ]
)
`;

fs.writeFileSync(path.join(pluginRoot, 'Package.swift'), packageSwift, 'utf8');
console.log('✔ Patched capacitor-native-biometric: Package.swift + objc/ registration target');
