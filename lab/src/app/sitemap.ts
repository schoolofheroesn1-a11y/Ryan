import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.APP_URL || "http://localhost:3000";
  const [materials, research] = await Promise.all([
    prisma.material.findMany({ where: { status: "PUBLISHED" }, select: { slug: true, updatedAt: true } }),
    prisma.research.findMany({ where: { status: "PUBLISHED" }, select: { slug: true, updatedAt: true } }),
  ]);
  return [
    ...["", "/library", "/practice", "/research", "/methodology"].map((p) => ({ url: `${base}${p}` })),
    ...materials.map((m) => ({ url: `${base}/m/${m.slug}`, lastModified: m.updatedAt })),
    ...research.map((r) => ({ url: `${base}/research/${r.slug}`, lastModified: r.updatedAt })),
  ];
}
