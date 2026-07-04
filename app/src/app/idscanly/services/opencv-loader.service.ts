import { Injectable } from '@angular/core';
import Jscanify from 'jscanify/client';

/**
 * OpenCV.js is large and only needed once the user actually scans, so we load it lazily (on first
 * use) rather than bundling it. jscanify is a thin geometry wrapper over the global `cv` and is
 * dynamically imported only after OpenCV is ready.
 *
 * opencv.js is vendored locally (copied from the jscanify package into src/assets) and served by
 * the app itself — no CDN dependency, so it works identically on web and in a packaged build.
 */
const OPENCV_URL = 'assets/opencv/opencv.js';
const OPENCV_TIMEOUT_MS = 30_000;

@Injectable({ providedIn: 'root' })
export class OpenCvLoaderService {
  private cvReady?: Promise<any>;
  private scannerReady?: Promise<Jscanify>;

  /** Resolves with the ready OpenCV `cv` namespace (idempotent). */
  loadCv(onProgress?: (step: string) => void): Promise<any> {
    if (this.cvReady) {
      return this.cvReady;
    }
    const report = (step: string) => onProgress?.(step);
    this.cvReady = new Promise<any>((resolve, reject) => {
      const w = window as Window;
      let settled = false;

      const finalize = (instance: any) => {
        if (settled) {
          return;
        }
        settled = true;
        w.cv = instance;
        // Resolve with no value (NOT `instance`): opencv.js's MODULARIZE module keeps its own
        // `.then` method even after it's ready. Passing it to resolve() makes the native Promise
        // machinery treat it as a thenable and chain through that one-shot shim a second time —
        // which silently no-ops, leaving this promise permanently unsettled. Callers read the
        // ready module off `window.cv` (set above), so the resolved value is unused anyway.
        resolve(undefined);
        report('cv ready');
      };

      // The vendored opencv.js uses Emscripten's MODULARIZE pattern: after the <script> loads,
      // `window.cv` is a FACTORY FUNCTION, not the ready module. We must call it and wait for
      // `onRuntimeInitialized` before `cv.Mat` exists. This handles every shape opencv.js ships in.
      const initialise = () => {
        const candidate: any = w.cv;
        report(`init: cv is ${candidate === undefined ? 'undefined' : typeof candidate}`);
        if (!candidate) {
          return; // script hasn't assigned cv yet; the poll/onload will retry.
        }
        if (typeof candidate.Mat === 'function') {
          finalize(candidate); // already a ready module
          return;
        }
        if (typeof candidate === 'function') {
          // MODULARIZE factory — invoke with a Module carrying our ready callback.
          report('invoking opencv factory');
          const moduleObj: any = {};
          moduleObj.onRuntimeInitialized = () => {
            report('onRuntimeInitialized');
            finalize(moduleObj);
          };
          moduleObj.onAbort = (reason: unknown) => {
            if (!settled) {
              settled = true;
              reject(new Error(`OpenCV aborted: ${reason}`));
            }
          };
          moduleObj.printErr = (msg: string) => report(`cv printErr: ${String(msg).slice(0, 80)}`);
          try {
            candidate(moduleObj);
            report('factory returned, awaiting runtime…');
          } catch (error) {
            if (!settled) {
              settled = true;
              reject(error);
            }
          }
          return;
        }
        if (typeof candidate.then === 'function') {
          candidate.then(finalize); // promise-returning build
          return;
        }
        // Plain (not-yet-initialised) module object.
        candidate['onRuntimeInitialized'] = () => finalize(candidate);
      };

      // Backstop poll: also resolves if `cv.Mat` appears via a path we didn't hook, and enforces
      // the timeout.
      const startedAt = performance.now();
      const poll = () => {
        if (settled) {
          return;
        }
        if (w.cv && typeof w.cv.Mat === 'function') {
          finalize(w.cv);
        } else if (performance.now() - startedAt > OPENCV_TIMEOUT_MS) {
          settled = true;
          reject(new Error('OpenCV.js failed to initialise within timeout'));
        } else {
          setTimeout(poll, 100);
        }
      };

      const existing = document.getElementById('opencv-js') as HTMLScriptElement | null;
      if (existing) {
        report('opencv.js already present');
        initialise();
        poll();
        return;
      }

      report(`fetching ${OPENCV_URL}`);
      const script = document.createElement('script');
      script.id = 'opencv-js';
      script.src = OPENCV_URL;
      script.async = true;
      script.onload = () => {
        report('opencv.js downloaded');
        initialise();
        poll();
      };
      script.onerror = () => {
        if (!settled) {
          settled = true;
          reject(new Error(`Failed to load OpenCV.js from ${OPENCV_URL}`));
        }
      };
      document.body.appendChild(script);
    });
    return this.cvReady;
  }

  /** Resolves with a jscanify instance once OpenCV is ready (idempotent). */
  getScanner(onProgress?: (step: string) => void): Promise<Jscanify> {
    if (this.scannerReady) {
      return this.scannerReady;
    }
    this.scannerReady = this.loadCv(onProgress).then(() => {
      onProgress?.('creating scanner');
      // jscanify is imported statically (it only touches global `cv` inside its methods, which now
      // exists), so there is no second async load to stall on here.
      return new Jscanify();
    });
    return this.scannerReady;
  }
}
