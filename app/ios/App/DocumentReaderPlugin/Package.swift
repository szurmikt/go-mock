// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "DocumentReaderPlugin",
    platforms: [.iOS(.v15)],
    products: [
        .library(name: "DocumentReaderPlugin", targets: ["DocumentReaderPlugin"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", from: "8.0.0"),
        .package(url: "https://github.com/regulaforensics/DocumentReader-Swift-Package", from: "7.0.0")
    ],
    targets: [
        .target(
            name: "DocumentReaderObjC",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm")
            ],
            path: "Sources/DocumentReaderObjC",
            publicHeadersPath: "."
        ),
        .target(
            name: "DocumentReaderPlugin",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm"),
                .product(name: "DocumentReader", package: "DocumentReader-Swift-Package"),
                .target(name: "DocumentReaderObjC")
            ],
            path: "Sources/DocumentReaderPlugin"
        )
    ]
)
