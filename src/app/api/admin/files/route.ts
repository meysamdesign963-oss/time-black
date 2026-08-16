/**
 * Admin Files API
 * ----------------
 * GET  /api/admin/files          — list all uploaded files (with pagination)
 * DELETE /api/admin/files?path=  — delete a specific file
 *
 * Files are stored on the filesystem in /public/uploads/{images,videos,avatars,covers}
 * NOT in the database. This API reads the directory listing.
 */
import { NextResponse } from "next/server";
import { readdir, stat, unlink } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { ok, fail } from "@/utils/api-response";
import { getAdminAuth, writeAudit, getClientIp } from "@/lib/route-helpers";

const UPLOAD_DIRS = ["images", "videos", "avatars", "covers"];
const UPLOAD_ROOT = path.join(process.cwd(), "public", "uploads");

type FileInfo = {
  name: string;
  url: string;
  folder: string;
  size: number;
  createdAt: string;
  mimeType: string;
};

export async function GET(request: Request) {
  const { user, applyRefresh, response } = await getAdminAuth(request);
  if (response) return response;

  const url = new URL(request.url);
  const folderFilter = url.searchParams.get("folder") || "all";
  const search = url.searchParams.get("q") || "";
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const limit = Math.min(
    100,
    Math.max(1, parseInt(url.searchParams.get("limit") || "50", 10)),
  );

  const dirsToList =
    folderFilter !== "all" && UPLOAD_DIRS.includes(folderFilter)
      ? [folderFilter]
      : UPLOAD_DIRS;

  const allFiles: FileInfo[] = [];

  for (const dir of dirsToList) {
    const dirPath = path.join(UPLOAD_ROOT, dir);
    if (!existsSync(dirPath)) continue;

    try {
      const entries = await readdir(dirPath);
      for (const name of entries) {
        const filePath = path.join(dirPath, name);
        const stats = await stat(filePath);

        // Determine MIME type from extension
        const ext = path.extname(name).toLowerCase();
        const mimeMap: Record<string, string> = {
          ".jpg": "image/jpeg",
          ".jpeg": "image/jpeg",
          ".png": "image/png",
          ".webp": "image/webp",
          ".gif": "image/gif",
          ".mp4": "video/mp4",
          ".webm": "video/webm",
        };

        allFiles.push({
          name,
          url: `/uploads/${dir}/${name}`,
          folder: dir,
          size: stats.size,
          createdAt: stats.mtime.toISOString(),
          mimeType: mimeMap[ext] || "application/octet-stream",
        });
      }
    } catch {
      // skip unreadable dirs
    }
  }

  // Filter by search query
  let filtered = allFiles;
  if (search) {
    const q = search.toLowerCase();
    filtered = allFiles.filter(
      (f) => f.name.toLowerCase().includes(q) || f.folder.includes(q),
    );
  }

  // Sort by date (newest first)
  filtered.sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  // Paginate
  const total = filtered.length;
  const start = (page - 1) * limit;
  const paginated = filtered.slice(start, start + limit);

  // Summary stats
  const totalSize = allFiles.reduce((sum, f) => sum + f.size, 0);
  const byFolder: Record<string, { count: number; size: number }> = {};
  for (const f of allFiles) {
    if (!byFolder[f.folder]) byFolder[f.folder] = { count: 0, size: 0 };
    byFolder[f.folder].count++;
    byFolder[f.folder].size += f.size;
  }

  return applyRefresh(
    ok({
      files: paginated,
      total,
      page,
      limit,
      stats: {
        totalFiles: allFiles.length,
        totalSize,
        totalSizeMB: Math.round((totalSize / (1024 * 1024)) * 100) / 100,
        byFolder,
      },
    }),
  );
}

export async function DELETE(request: Request) {
  const { user, applyRefresh, response } = await getAdminAuth(request);
  if (response) return response;

  const url = new URL(request.url);
  const fileUrl = url.searchParams.get("path");
  if (!fileUrl) return fail("مسیر فایل الزامی است", 400);

  // Security: only allow deleting files under /uploads/
  if (!fileUrl.startsWith("/uploads/")) {
    return fail("مسیر فایل نامعتبر است", 400);
  }

  // Prevent path traversal
  const normalized = path.normalize(fileUrl);
  if (normalized.includes("..")) {
    return fail("مسیر فایل نامعتبر است", 400);
  }

  const filePath = path.join(process.cwd(), "public", normalized);
  if (!existsSync(filePath)) {
    return fail("فایل یافت نشد", 404);
  }

  try {
    await unlink(filePath);
  } catch {
    return fail("خطا در حذف فایل", 500);
  }

  await writeAudit({
    userId: user.id,
    action: "DELETE_FILE",
    ip: getClientIp(request),
    meta: { path: fileUrl },
  });

  return applyRefresh(ok({ ok: true }));
}
