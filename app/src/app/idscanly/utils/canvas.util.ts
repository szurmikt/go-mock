import { DETECTION_TUNING } from '../capture-tuning';

/**
 * Produces a small downscaled JPEG data URL of a captured canvas, for the tray thumbnail only.
 * The full-resolution canvas is kept separately as the real capture output.
 */
export function makeThumbnail(source: HTMLCanvasElement): string {
  const { thumbnailMaxEdge, jpegQuality } = DETECTION_TUNING;
  const scale = Math.min(1, thumbnailMaxEdge / Math.max(source.width, source.height));
  const thumb = document.createElement('canvas');
  thumb.width = Math.max(1, Math.round(source.width * scale));
  thumb.height = Math.max(1, Math.round(source.height * scale));
  const ctx = thumb.getContext('2d');
  if (ctx) {
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source, 0, 0, thumb.width, thumb.height);
  }
  return thumb.toDataURL('image/jpeg', jpegQuality);
}

/** Serialises a full-resolution canvas to a JPEG data URL for display / hand-off. */
export function toDataUrl(source: HTMLCanvasElement): string {
  return source.toDataURL('image/jpeg', DETECTION_TUNING.jpegQuality);
}
