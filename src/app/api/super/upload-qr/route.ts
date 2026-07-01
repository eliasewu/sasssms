import { NextResponse } from "next/server";
import { getSuperAdminFromRequest } from "@/lib/auth";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export async function POST(request: Request) {
  const admin = getSuperAdminFromRequest(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const formData = await request.formData();
    const file = formData.get("qr_image") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: "Invalid file type. Allowed: PNG, JPEG, WebP, GIF" }, { status: 400 });
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json({ error: "File too large. Max 5MB" }, { status: 400 });
    }

    // Save to public/uploads/qr/
    const uploadDir = path.join(process.cwd(), "public", "uploads", "qr");
    await mkdir(uploadDir, { recursive: true });

    const ext = file.name.split(".").pop() || "png";
    const fileName = `qr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const filePath = path.join(uploadDir, fileName);

    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);

    const fileUrl = `/uploads/qr/${fileName}`;

    return NextResponse.json({
      success: true,
      url: fileUrl,
      fileName,
      size: file.size,
    });
  } catch (error) {
    console.error("QR upload error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
