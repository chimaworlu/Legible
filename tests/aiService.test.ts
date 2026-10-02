import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

// vi.mock factories are hoisted above imports, so the mutable value they
// close over has to come from vi.hoisted (mirrors tests/storage.test.ts).
const { mockConfig } = vi.hoisted(() => ({
  mockConfig: {
    ai: {
      activeProvider: "default",
      confidenceThreshold: 0.8,
      providers: {
        deepseek: { apiKey: "", baseUrl: "", model: "", temperature: 0.2, maxOutputTokens: 100, rateLimit: { requestsPerMinute: 1, maxConcurrency: 1 }, retryLimit: 1, costPerImageMinor: 0 },
        gemini: { apiKey: "", baseUrl: "", model: "", temperature: 0.2, maxOutputTokens: 100, rateLimit: { requestsPerMinute: 1, maxConcurrency: 1 }, retryLimit: 1, costPerImageMinor: 0 },
      },
    },
  },
}));

vi.mock("@/src/config", () => ({ config: mockConfig }));

import { getAiService } from "@/src/services/ai";
import { deepseekAiService } from "@/src/services/ai/providers/deepseek";
import { geminiAiService } from "@/src/services/ai/providers/gemini";

describe("getAiService factory (ai-pipeline.md laws 1, 4, 5)", () => {
  it("throws when no provider is enabled ('default')", () => {
    mockConfig.ai.activeProvider = "default";
    expect(() => getAiService()).toThrow(/no ai provider is enabled/i);
  });

  it("returns the deepseek adapter when selected", () => {
    mockConfig.ai.activeProvider = "deepseek";
    expect(getAiService()).toBe(deepseekAiService);
  });

  it("returns the gemini adapter when selected", () => {
    mockConfig.ai.activeProvider = "gemini";
    expect(getAiService()).toBe(geminiAiService);
  });
});

// ai-pipeline.md law 1: no provider name, SDK import, or model string exists
// outside src/services/ai. A static scan is the only thing that actually
// enforces "even if the feature works, this is a failed task" — a runtime
// test can't catch a leaked import.
const FORBIDDEN_PATTERNS = [/deepseek/i, /gemini/i, /@google\/genai/, /from ["']openai["']/];
const SCAN_ROOTS = ["app", "worker", "src/domain", "src/components", "src/db"];
const ALLOWED_FILE = join("src", "services", "ai").replace(/\\/g, "/");

function collectFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      collectFiles(full, out);
    } else if (/\.(ts|tsx)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

describe("provider boundary (ai-pipeline.md law 1 — static scan)", () => {
  it("never references a provider name or SDK outside src/services/ai", () => {
    const projectRoot = join(__dirname, "..");
    const offenders: string[] = [];

    for (const root of SCAN_ROOTS) {
      let files: string[];
      try {
        files = collectFiles(join(projectRoot, root));
      } catch {
        continue;
      }
      for (const file of files) {
        const relative = file.slice(projectRoot.length + 1).replace(/\\/g, "/");
        if (relative.startsWith(ALLOWED_FILE)) continue;
        const content = readFileSync(file, "utf8");
        if (FORBIDDEN_PATTERNS.some((pattern) => pattern.test(content))) {
          offenders.push(relative);
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});
