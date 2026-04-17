/**
 * POST the original image to the neon line-art endpoint.
 *
 * - **Vercel:** `api/neon_lineart.py` (Python + OpenCV serverless).
 * - **next dev / Node:** `app/api/neon_lineart/route.ts` shells out to `scripts/portrait_neon_lineart.py`.
 *
 * Override with `NEXT_PUBLIC_NEON_LINEART_API` if you deploy the Python handler elsewhere.
 */
export async function fetchOpenCvNeonLineartAsDataUrl(file: File): Promise<string | null> {
  const url = process.env.NEXT_PUBLIC_NEON_LINEART_API ?? "/api/neon_lineart";
  const form = new FormData();
  form.append("image", file);
  try {
    const res = await fetch(url, { method: "POST", body: form });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await blobToDataUrl(blob);
  } catch {
    return null;
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new Error("read failed"));
    r.readAsDataURL(blob);
  });
}
