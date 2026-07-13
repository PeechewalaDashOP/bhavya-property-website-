// Client-side photo compression before upload — resizes to a sane max
// dimension and re-encodes as JPEG at a quality that keeps photos looking
// good on a phone screen while cutting upload size/time substantially.
// Videos are NOT compressed: real re-encoding needs a heavy decoder (e.g.
// ffmpeg.wasm, tens of MB) which conflicts with this site's mobile-first,
// no-heavy-libraries rule, so video files are uploaded as-is.

const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.72;

export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  // Compressing an already-small file rarely helps and risks a visible
  // quality drop for no size benefit.
  if (file.size < 300 * 1024) return file;

  try {
    const bitmap = await createImageBitmap(file);
    let { width, height } = bitmap;
    if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
      const scale = MAX_DIMENSION / Math.max(width, height);
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY)
    );
    if (!blob || blob.size >= file.size) return file;

    const newName = file.name.replace(/\.[^./\\]+$/, "") + ".jpg";
    return new File([blob], newName, { type: "image/jpeg" });
  } catch {
    // HEIC or any decode failure — fall back to the original file untouched.
    return file;
  }
}

export async function compressImages(files: File[]): Promise<File[]> {
  return Promise.all(files.map(compressImage));
}
