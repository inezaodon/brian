import { execFile } from "child_process";
import { randomUUID } from "crypto";
import { unlink, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { promisify } from "util";
import { NextRequest, NextResponse } from "next/server";

const execFileAsync = promisify(execFile);

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 12 * 1024 * 1024;

function numField(v: FormDataEntryValue | null, fallback: number, lo: number, hi: number): number {
  if (typeof v !== "string" || v.trim() === "") return fallback;
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(hi, Math.max(lo, n));
}

function inputSuffix(file: File): string {
  const t = (file.type || "").toLowerCase();
  if (t.includes("jpeg") || t.endsWith("jpg")) return "jpg";
  if (t.includes("png")) return "png";
  if (t.includes("webp")) return "webp";
  const n = file.name.toLowerCase();
  if (n.endsWith(".jpg") || n.endsWith(".jpeg")) return "jpg";
  if (n.endsWith(".png")) return "png";
  if (n.endsWith(".webp")) return "webp";
  return "png";
}

/**
 * Runs `scripts/export_portrait_bundle.py` (OpenCV): Canny edge mask, closed path for FFT, neon PNG — JSON stdout.
 */
export async function POST(req: NextRequest) {
  let inPath: string | null = null;
  try {
    const form = await req.formData();
    const file = form.get("image");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing image field" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "Image too large" }, { status: 413 });
    }
    const edgeRaw = form.get("edgeThreshold");
    const edgeThreshold =
      typeof edgeRaw === "string" && edgeRaw.trim() !== ""
        ? Math.min(255, Math.max(20, Math.round(Number(edgeRaw))))
        : 105;
    const maxSide = numField(form.get("maxSide"), 420, 64, 512);
    const samplePoints = numField(form.get("samplePoints"), 384, 32, 640);

    const id = randomUUID();
    const ext = inputSuffix(file);
    inPath = join(tmpdir(), `bundle-in-${id}.${ext}`);
    const buf = Buffer.from(await file.arrayBuffer());
    await writeFile(inPath, buf);

    const script = join(process.cwd(), "scripts", "export_portrait_bundle.py");
    const py = process.env.PYTHON_PATH || "python3";
    const { stdout } = await execFileAsync(
      py,
      [
        script,
        "-i",
        inPath,
        "--max-side",
        String(maxSide),
        "--sample-points",
        String(samplePoints),
        "--edge-threshold",
        String(edgeThreshold),
      ],
      {
        timeout: 55_000,
        maxBuffer: 32 * 1024 * 1024,
      },
    );

    const parsed = JSON.parse(stdout) as Record<string, unknown>;
    if (parsed.error && typeof parsed.error === "string") {
      return NextResponse.json({ error: parsed.error }, { status: 422 });
    }
    return NextResponse.json(parsed, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    console.error("[api/portrait_pipeline]", e);
    return NextResponse.json(
      {
        error:
          "Portrait pipeline failed. Install: pip install -r requirements.txt and ensure python3 runs export_portrait_bundle.py.",
      },
      { status: 503 },
    );
  } finally {
    if (inPath) await unlink(inPath).catch(() => {});
  }
}
