import { config } from "@/src/config";

// R4/R5 (.agent/rules/upload-and-storage.md) — "the image passed the
// quality check... never spend AI cost on an image already failed at
// intake." Per AGENTS.md section 7 ("make the smallest change that
// satisfies the PRD"): this is a literal file-integrity floor, not a
// legibility/blur judgment — no ML dependency, no new imaging library. It
// exercises the schema's already-declared SourceImage.qualityScore /
// QUALITY_FAILED fields, which nothing wrote to before this.
// TODO: replace with real legibility/blur scoring once product defines what
// "quality" means beyond file integrity — R4 only requires *a* gate exists,
// not that it's sophisticated.

const ACCEPTED_FORMATS = new Set(["jpeg", "jpg", "png", "heic", "heif"]);

export interface ImageQualityCheck {
  passed: boolean;
  qualityScore: number;
  reason?: string;
}

export function checkImageQuality(input: { byteLength: number; format: string }): ImageQualityCheck {
  if (input.byteLength < config.caps.minImageBytes) {
    return { passed: false, qualityScore: 0, reason: "Image file is too small to be a valid photo (likely truncated or corrupt)." };
  }

  if (!ACCEPTED_FORMATS.has(input.format.toLowerCase())) {
    return { passed: false, qualityScore: 0, reason: `Unrecognized image format: ${input.format}` };
  }

  return { passed: true, qualityScore: 1.0 };
}
