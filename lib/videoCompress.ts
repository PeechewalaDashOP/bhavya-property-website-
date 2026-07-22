// Client-side video compression — a lightweight, no-dependency alternative
// to a full transcoder like ffmpeg.wasm. Re-draws the video onto a canvas
// at a capped resolution and re-encodes it live via the browser's built-in
// MediaRecorder, instead of shipping a 25-30MB WASM decoder that risks
// hanging or crashing on the mid-range Android phones this site targets.
//
// Real trade-offs, by design — not hidden:
// - Real-time: a 60-second video takes roughly 60 seconds to process (it
//   plays through once while being re-recorded onto the canvas).
// - Output is WebM (VP8/VP9), because MediaRecorder cannot produce MP4
//   without a dependency. Android/Chrome/Firefox play WebM natively;
//   Safari (macOS/iOS) WebM support is inconsistent, so some visitors on
//   iPhone may not be able to play a compressed video. Accepted trade-off
//   given Supabase's free-tier 1GB storage cap — see lib/imageCompress.ts
//   for the equivalent photo-side reasoning.
// - Falls back to the ORIGINAL, untouched file on any failure (unsupported
//   browser, decode error, empty output) — a compression bug never blocks
//   a listing from being posted.

const MAX_HEIGHT = 720;
const TARGET_BITRATE = 1_500_000; // ~1.5 Mbps — a 60s clip lands roughly 8-12MB
const SKIP_BELOW_BYTES = 8 * 1024 * 1024; // already small — compressing rarely helps, adds risk for no gain

// Hard guardrail enforced at selection time, before any compression is
// attempted — prevents a student's phone from choking on an absurd source
// file and keeps worst-case Supabase Storage usage bounded per listing.
export const MAX_VIDEO_SOURCE_BYTES = 300 * 1024 * 1024; // 300MB

export function validateVideoSize(file: File): string | null {
  if (file.size > MAX_VIDEO_SOURCE_BYTES) {
    const mb = Math.round(file.size / (1024 * 1024));
    return `"${file.name}" is ${mb}MB — please trim it or record a shorter clip (max 300MB).`;
  }
  return null;
}

function pickMimeType(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  const candidates = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c)) return c;
  }
  return null;
}

function reencode(file: File, mimeType: string): Promise<File | null> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.src = URL.createObjectURL(file);

    let settled = false;
    const finish = (result: File | null) => {
      if (settled) return;
      settled = true;
      URL.revokeObjectURL(video.src);
      resolve(result);
    };

    video.onerror = () => finish(null);

    video.onloadedmetadata = async () => {
      const scale = Math.min(1, MAX_HEIGHT / (video.videoHeight || MAX_HEIGHT));
      const width = Math.max(2, Math.round((video.videoWidth || 0) * scale));
      const height = Math.max(2, Math.round((video.videoHeight || 0) * scale));

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) { finish(null); return; }

      const canvasStream = canvas.captureStream(30);
      let audioTracks: MediaStreamTrack[] = [];
      try {
        const withCapture = video as HTMLVideoElement & { captureStream?: () => MediaStream };
        audioTracks = withCapture.captureStream?.().getAudioTracks() ?? [];
      } catch {
        // no audio track available on this browser — proceed video-only
      }
      const combined = new MediaStream([...canvasStream.getVideoTracks(), ...audioTracks]);

      const chunks: Blob[] = [];
      let recorder: MediaRecorder;
      try {
        recorder = new MediaRecorder(combined, { mimeType, videoBitsPerSecond: TARGET_BITRATE });
      } catch {
        finish(null);
        return;
      }

      let raf = 0;
      let stopped = false;
      const stopDrawing = () => { stopped = true; cancelAnimationFrame(raf); };

      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      recorder.onerror = () => { stopDrawing(); finish(null); };
      recorder.onstop = () => {
        stopDrawing();
        clearTimeout(safetyTimer);
        const blob = new Blob(chunks, { type: mimeType });
        const newName = file.name.replace(/\.[^./\\]+$/, "") + ".webm";
        finish(new File([blob], newName, { type: mimeType }));
      };

      const stop = () => { if (recorder.state !== "inactive") recorder.stop(); };
      video.onended = stop;
      // Some mobile browsers don't reliably fire 'ended' — bound worst case.
      const safetyTimer = setTimeout(stop, (video.duration || 180) * 1000 + 5000);

      function draw() {
        if (stopped) return;
        ctx!.drawImage(video, 0, 0, width, height);
        raf = requestAnimationFrame(draw);
      }

      try {
        recorder.start();
        await video.play();
        draw();
      } catch {
        stopDrawing();
        clearTimeout(safetyTimer);
        finish(null);
      }
    };
  });
}

export async function compressVideo(file: File): Promise<File> {
  if (!file.type.startsWith("video/")) return file;
  if (file.size < SKIP_BELOW_BYTES) return file;
  if (typeof window === "undefined") return file;

  const mimeType = pickMimeType();
  if (!mimeType) return file;

  try {
    const result = await reencode(file, mimeType);
    if (!result || result.size === 0 || result.size >= file.size) return file;
    return result;
  } catch {
    return file;
  }
}

// Sequential, not parallel — canvas drawing + live encoding is CPU-heavy;
// running several at once risks starving a mid-range phone.
export async function compressVideos(files: File[]): Promise<File[]> {
  const out: File[] = [];
  for (const f of files) out.push(await compressVideo(f));
  return out;
}
