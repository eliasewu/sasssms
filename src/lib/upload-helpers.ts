import { writeFile, mkdir } from "fs/promises";
import path from "path";
import crypto from "crypto";

/** Root directory for all uploaded files — served by nginx at /uploads/ */
export const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "tickets");

/** Maximum single-file upload size (10 MB) */
export const MAX_FILE_SIZE = 10 * 1024 * 1024;

/** Allowed MIME types for uploads */
const ALLOWED_MIME_TYPES = [
  "image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp", "image/bmp",
  "application/pdf",
  "text/plain", "text/csv",
  "application/json",
  "application/zip", "application/x-zip-compressed",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
  "application/msword", // .doc
];

/** Allowed file extensions (fallback check when MIME is generic) */
const ALLOWED_EXTENSIONS = [
  "png", "jpg", "jpeg", "gif", "webp", "bmp",
  "pdf",
  "txt", "csv", "log",
  "json",
  "zip",
  "xlsx", "docx", "doc",
];

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

export function isFileTypeAllowed(fileName: string, mimeType: string): boolean {
  if (ALLOWED_MIME_TYPES.includes(mimeType)) return true;
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  return ALLOWED_EXTENSIONS.includes(ext);
}

export async function saveUploadedFile(file: File): Promise<{
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
} | null> {
  if (file.size <= 0 || file.size > MAX_FILE_SIZE) return null;
  if (!isFileTypeAllowed(file.name, file.type)) return null;

  await mkdir(UPLOAD_DIR, { recursive: true });
  const ext = file.name.split(".").pop() || "bin";
  const uniqueName = `${Date.now()}_${crypto.randomBytes(6).toString("hex")}.${ext}`;
  const relativePath = `/uploads/tickets/${uniqueName}`;
  const fullPath = path.join(UPLOAD_DIR, uniqueName);
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(fullPath, buffer);
  return { fileName: file.name, filePath: relativePath, fileSize: buffer.length, mimeType: file.type };
}

export async function saveUploadedFiles(files: File[]): Promise<{
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
}[]> {
  const results = await Promise.all(files.map(f => saveUploadedFile(f)));
  return results.filter((r): r is NonNullable<typeof r> => r !== null);
}
