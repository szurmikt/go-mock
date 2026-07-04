/**
 * Minimal type declarations for jscanify — the package ships no .d.ts files.
 * Only the subset of the API actually used in this app is typed.
 */
declare module 'jscanify/client' {
  export interface CornerPoints {
    topLeftCorner: { x: number; y: number };
    topRightCorner: { x: number; y: number };
    bottomLeftCorner: { x: number; y: number };
    bottomRightCorner: { x: number; y: number };
  }

  class Jscanify {
    constructor();
    findPaperContour(img: any): any;
    getCornerPoints(contour: any, img?: any): CornerPoints | null;
    highlightPaper(img: any, contour: any, color?: { r: number; g: number; b: number; a: number }): any;
    extractPaper(img: any, resultWidth: number, resultHeight: number, cornerPoints?: CornerPoints | null): HTMLCanvasElement;
  }

  export default Jscanify;
}

// opencv.js exposes its module on window.cv
interface Window {
  cv: any;
}
