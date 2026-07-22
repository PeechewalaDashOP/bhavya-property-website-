// Shared direct-to-Supabase-Storage upload helper — was previously copy-
// pasted with minor drift across 4 files (post-property, StandardFlow,
// HostelFlow, dealer property edit). One copy now.

export function uploadFile(url: string, file: File, onProgress: (p: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total);
    });
    xhr.addEventListener("load", () =>
      xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`))
    );
    xhr.addEventListener("error", () => reject(new Error("Network error during upload")));
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.send(file);
  });
}

/* A Supabase Storage signed upload URL can stop working partway through a
   long upload — most commonly because the file exceeds the bucket's
   configured size limit, which Storage enforces by rejecting the upload
   once enough bytes have streamed in to detect the overage (surfacing as
   a 404 near 80-100% rather than a clean upfront rejection). Retrying the
   SAME url risks the identical failure (or a 404 from an already-consumed
   token), so on failure this re-requests a fresh signed URL for just this
   one file via refreshUrl() before trying once more. */
export async function uploadFileWithRetry(
  initialUrl: string,
  file: File,
  onProgress: (p: number) => void,
  refreshUrl: () => Promise<string>
): Promise<void> {
  try {
    await uploadFile(initialUrl, file, onProgress);
  } catch {
    const freshUrl = await refreshUrl();
    await uploadFile(freshUrl, file, onProgress);
  }
}
