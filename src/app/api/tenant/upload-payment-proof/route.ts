import { NextResponse } from "next/server";
import { getTenantFromRequest } from "@/lib/auth";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export async function POST(request: Request) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const formData = await request.formData();
    const file = formData.get("proof") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif", "application/pdf"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: "Invalid file type. Allowed: PNG, JPEG, WebP, GIF, PDF" }, { status: 400 });
    }

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json({ error: "File too large. Max 10MB" }, { status: 400 });
    }

    // Save to public/uploads/payment-proofs/{tenantId}/
    const uploadDir = path.join(process.cwd(), "public", "uploads", "payment-proofs", String(tenant.tenantId));
    await mkdir(uploadDir, { recursive: true });

    const ext = file.name.split(".").pop() || "png";
    const fileName = `proof_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.${ext}`;
    const filePath = path.join(uploadDir, fileName);

    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);

    const fileUrl = `/uploads/payment-proofs/${tenant.tenantId}/${fileName}`;

    return NextResponse.json({
      success: true,
      url: fileUrl,
      fileName,
      size: file.size,
    });
  } catch (error) {
    console.error("Payment proof upload error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
