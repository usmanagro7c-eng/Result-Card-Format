/**
 * Client-side image downscaling for the student photo.
 *
 * Every student is serialised into a single localStorage key, so a raw phone
 * photo (2-5MB) becomes ~1.3x that once base64 encoded and would exhaust the
 * ~5MB origin quota within a handful of students. Downscaling to a long edge of
 * 480px at JPEG 0.8 lands around 30-60KB, which is still far more resolution
 * than the ~64x83px print box needs even at 2x rasterisation.
 */

/** Longest edge of the stored image, in CSS pixels. */
const MAX_EDGE = 480;
const JPEG_QUALITY = 0.8;
/** Reject absurd inputs before decoding, so a 40MB file cannot hang the tab. */
const MAX_INPUT_BYTES = 10 * 1024 * 1024;

export class ImageTooLargeError extends Error {
  constructor() {
    super("That image is larger than 10MB. Please pick a smaller photo.");
    this.name = "ImageTooLargeError";
  }
}

export class UnsupportedImageError extends Error {
  constructor() {
    super("That file is not an image. Please upload a PNG, JPEG or WebP photo.");
    this.name = "UnsupportedImageError";
  }
}

function loadBitmap(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new UnsupportedImageError());
    img.src = url;
  });
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new UnsupportedImageError());
    reader.readAsDataURL(file);
  });
}

/**
 * Resize and re-encode a photo, returning a JPEG data URL small enough to store.
 *
 * Aspect ratio is preserved rather than cropped, so the stored image keeps the
 * framing the photographer chose; the card crops at render time with
 * `object-cover` to keep every box the same size.
 */
export async function compressImage(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new UnsupportedImageError();
  if (file.size > MAX_INPUT_BYTES) throw new ImageTooLargeError();

  const source = await loadBitmap(await readAsDataUrl(file));

  const scale = Math.min(1, MAX_EDGE / Math.max(source.width, source.height));
  const width = Math.max(1, Math.round(source.width * scale));
  const height = Math.max(1, Math.round(source.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new UnsupportedImageError();

  // JPEG has no alpha channel; paint a white ground so transparent PNGs (e.g.
  // a cut-out portrait) do not come out with black backgrounds.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(source, 0, 0, width, height);

  return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
}
