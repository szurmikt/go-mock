const fs = require('fs');
const path = require('path');

const pkgPath = path.join(__dirname, '../ios/App/CapApp-SPM/Package.swift');
let src = fs.readFileSync(pkgPath, 'utf8');

const depLine  = '        .package(name: "DocumentReaderPlugin", path: "../DocumentReaderPlugin")';
const prodLine = '                .product(name: "DocumentReaderPlugin", package: "DocumentReaderPlugin")';

if (!src.includes('DocumentReaderPlugin')) {
  src = src.replace(
    /(\.package\(name: "CapacitorNativeBiometric"[^\n]+\n)/,
    `$1${depLine}\n`
  );
  src = src.replace(
    /(\.product\(name: "CapacitorNativeBiometric"[^\n]+\n)/,
    `$1${prodLine}\n`
  );
  fs.writeFileSync(pkgPath, src, 'utf8');
  console.log('✔ DocumentReaderPlugin re-added to Package.swift');
} else {
  console.log('✔ Package.swift already contains DocumentReaderPlugin');
}
