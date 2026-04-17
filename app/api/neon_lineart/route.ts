import { execFile } from "child_process";
import { randomUUID } from "crypto";
import { unlink, writeFile, readFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { promisify } from "util";
import { NextRequest, NextResponse } from "next/server";

const execFileAsync = promisify(execFile);

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 12 * 1024 * 1024;

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
 * Local / Node fallback: shells out to `scripts/portrait_neon_lineart.py`.
 * On Vercel, the Python runtime serves the same path via `api/neon_lineart.py` when that wins routing.
 */
export async function POST(req: NextRequest) {
  let inPath: string | null = null;
  let outPath: string | null = null;
  try {
    const form = await req.formData();
    const file = form.get("image");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing image field" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "Image too large" }, { status: 413 });
    }

    const id = randomUUID();
    const ext = inputSuffix(file);
    inPath = join(tmpdir(), `neon-in-${id}.${ext}`);
    outPath = join(tmpdir(), `neon-out-${id}.png`);
    const buf = Buffer.from(await file.arrayBuffer());
    await writeFile(inPath, buf);

    const script = join(process.cwd(), "scripts", "portrait_neon_lineart.py");
    const py = process.env.PYTHON_PATH || "python3";
    await execFileAsync(py, [script, "-i", inPath, "-o", outPath], {
      timeout: 55_000,
      maxBuffer: 20 * 1024 * 1024,
    });

    const png = await readFile(outPath);
    return new NextResponse(new Uint8Array(png), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("[api/neon_lineart]", e);
    return NextResponse.json(
      {
        error:
          "OpenCV neon pipeline failed. On this machine run: pip install -r scripts/requirements-neon.txt " +
          "and ensure python3 runs portrait_neon_lineart.py. Set PYTHON_PATH if needed.",
      },
      { status: 503 },
    );
  } finally {
    await Promise.all([
      inPath ? unlink(inPath).catch(() => {}) : Promise.resolve(),
      outPath ? unlink(outPath).catch(() => {}) : Promise.resolve(),
    ]);
  }
}
