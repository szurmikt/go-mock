import { Injectable } from '@angular/core';
// import { Plugins } from '@capacitor/core';
import {
  NativeBiometric,
  BiometryType,
} from '@capgo/capacitor-native-biometric';

@Injectable({
  providedIn: 'root',
})
export class BiometricService {
  constructor() {}

  async checkBiometric() {
    const result = await NativeBiometric.isAvailable();

    console.log('result.isAvailable', result.isAvailable, result);

    return result.isAvailable;
  }
  // Perform biometric verification
  async verify() {
    const verified = await NativeBiometric.verifyIdentity({
      reason: 'For secure access to your account',
      title: 'Authentication',
      subtitle: 'Verify your identity',
      description: 'Place your finger on the sensor',
      maxAttempts: 2,
      useFallback: true,
    })
      .then(() => true)
      .catch(() => false);

    return verified;
  }

  // verifyIdentity() {
  //   return NativeBiometric.isAvailable()
  //     .then((isAvailable) => {
  //       if (isAvailable) {
  //         NativeBiometric.verifyIdentity({
  //           reason: 'For easy log in',
  //           title: 'Log in',
  //           subtitle: 'Authenticate',
  //           description: 'Please authenticate to proceed',
  //           maxAttempts: 2,
  //           useFallback: true,
  //         })
  //           .then((result) => {
  //             // alert('Biometric authentication successful');
  //             console.log('Biometric authentication successful result', result);
  //           })
  //           .catch((error) => {
  //             console.error('Error verifying identity:', error);
  //           });
  //       } else {
  //         console.log(
  //           'Biometric authentication is not available on this device.'
  //         );
  //       }
  //     })
  //     .catch((e) => {
  //       console.error(e);
  //       throw e;
  //     });
  // }
}
