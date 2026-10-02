// Application Config (PRD Section 8 & R30)

export const config = {
  // Plan values are provisional pending v0 cost measurements
  plans: {
    FREE: {
      imagesPerMonth: 30,
      booksAllowance: 3,
      hasWatermark: true,
      // Show the "approaching your plan limits" dashboard banner once usage
      // of either monthly allowance crosses this percentage.
      usageWarningThresholdPercent: 80,
    },
    PRO: {
      imagesPerMonth: 150,
      priceMinorMonthly: 500000, // 5000 NGN in kobo
      priceMinorYearly: 5000000, // 50,000 NGN in kobo (2 months free vs. paying monthly)
      hasWatermark: false,
    }
  },
  
  caps: {
    // Technical ceiling per batch
    batchImageLimit: 50,
    // Per-book technical max
    bookImageLimitFree: 20,
    bookImageLimitPro: 300,

    // Per-book AI spend ceiling in kobo (ai-pipeline.md law 10/11, PRD
    // section 6 — "never let a book exceed the per-book AI cost ceiling").
    // Provisional until the v0 slice measures real per-image cost; sized off
    // the per-book image caps above at the assumed cost floor
    // (billing.assumedCostPerImageMinor) plus headroom, not a guess.
    bookAiCostCeilingMinorFree: 20 * 2000, // bookImageLimitFree * assumedCostPerImageMinor
    bookAiCostCeilingMinorPro: 300 * 2000, // bookImageLimitPro * assumedCostPerImageMinor

    // Minimum accepted object size for an uploaded image, in bytes
    // (ai-pipeline.md law 10's intake quality gate, R4/R5) — catches a
    // truncated/corrupt upload before it ever reaches the AI. Deliberately
    // not a legibility judgment, just a file-integrity floor; see
    // src/domain/imageQuality.ts.
    minImageBytes: 2048,
  },

  billing: {
    creditPackPriceMinor: 300000, // 3000 NGN in kobo
    creditPackImages: 100,
    assumedCostPerImageMinor: 2000, // 20 NGN in kobo

    // Flutterwave v3 (Bearer secret-key auth). Standard hosted checkout —
    // cards never touch our server — plus native Payment Plans for
    // recurring billing (money-and-billing.md rule 1: kobo everywhere on
    // our side; conversion to Flutterwave's major-unit amount happens once,
    // at the adapter boundary in src/services/billing).
    flutterwave: {
      apiBaseUrl: process.env.FLUTTERWAVE_API_BASE_URL ?? "https://api.flutterwave.com/v3",
      publicKey: process.env.FLUTTERWAVE_PUBLIC_KEY ?? "",
      secretKey: process.env.FLUTTERWAVE_SECRET_KEY ?? "",
      secretHash: process.env.FLUTTERWAVE_SECRET_HASH ?? "",
      redirectUrl: process.env.FLUTTERWAVE_REDIRECT_URL ?? "",
      // developer.flutterwave.com/v3.0.0/docs/payment-methods — NGN-eligible
      // methods. "card" is deliberately its own bucket: attaching a Payment
      // Plan (required for auto-renewal) forces Flutterwave to card-only, so
      // the two paths must never be offered in the same checkout request
      // (R32 — support card, bank transfer, and USSD).
      cardOnlyPaymentOptions: "card",
      manualPaymentOptions: "ussd,banktransfer,account,internetbanking,nqr,enaira,opay",
    },
  },

  ai: {
    // The active provider is locked here per ai-pipeline.md rule 4.
    // TEMPORARY: set to 'gemini' for local dev testing at the user's
    // explicit request, ahead of the rule 5 sign-offs (retention off,
    // vision + span-confidence verified) being formally recorded and dated
    // in src/services/ai/providers/gemini.ts. Do not ship this to
    // production, and do not treat this as the sign-off itself — flip back
    // to 'default' until those two lines are actually filled in for real.
    //
    // DeepSeek was tried first and rejected outright: deepseek-chat returned
    // "400 This model does not support image" — confirms DeepSeek fails the
    // law 5 capability sign-off for this product (no vision-capable model
    // exposed through this API), not just an unverified one. Don't re-try
    // 'deepseek' without a different, confirmed-vision-capable model id.
    activeProvider: 'gemini',
    // Separate from activeProvider (law 4 — provider selection lives here,
    // nowhere else): summarization is text-only, so DeepSeek's lack of
    // vision support (see the note above) doesn't apply to it. TEMPORARY
    // for local dev/testing, same caveat as activeProvider above — DeepSeek
    // still needs its own dated law 5 sign-offs (retention; text-summary
    // capability) before this is production-ready.
    summarizeProvider: 'deepseek',
    confidenceThreshold: 0.8,
    // Every changeable value per provider — model id, endpoint, sampling,
    // rate limits, retry policy, and measured cost (ai-pipeline.md rules 4,
    // 11, 15 / ai-provider-adapter skill step 2). An adapter reads this
    // object and never hardcodes any of it.
    providers: {
      deepseek: {
        apiKey: process.env.DEEPSEEK_API_KEY ?? '',
        // DeepSeek's API is OpenAI-compatible, so the official `openai`
        // SDK works against it unmodified once baseURL is repointed here.
        baseUrl: 'https://api.deepseek.com',
        model: 'deepseek-chat', // TODO: confirm the vision-capable model id once rule 5's capability sign-off is done
        temperature: 0.2, // low — transcription wants literal reproduction, not creative variance
        maxOutputTokens: 4096,
        rateLimit: {
          // Provisional ceilings (ai-pipeline.md rule 15) — tune against
          // DeepSeek's actual published limits once confirmed for this key's tier.
          requestsPerMinute: 60,
          maxConcurrency: 5,
        },
        retryLimit: 3, // exponential backoff attempts before a job is marked FAILED (rule 12)
        // Real cost-per-image in kobo, from measured per-call usage data
        // (rule 11) — 0 until the v0 slice actually measures it; never
        // guess a number here, and never confuse this with
        // billing.assumedCostPerImageMinor (that's the pricing-floor
        // assumption used for margin, not a provider's real observed cost).
        costPerImageMinor: 0,
      },
      gemini: {
        apiKey: process.env.GEMINI_API_KEY ?? '',
        // Only needed to redirect through a proxy/gateway — @google/genai
        // talks to Google's default endpoint when this is empty.
        baseUrl: '',
        // gemini-2.0-flash was retired by Google (API returned 404 telling
        // us to move to gemini-3.6-flash) — confirmed live against this key
        // on 2026-08-31. Still needs the rule 5 capability sign-off before
        // this can be treated as production-ready.
        model: 'gemini-3.6-flash',
        temperature: 0.2,
        maxOutputTokens: 4096,
        rateLimit: {
          // Provisional ceilings (ai-pipeline.md rule 15) — tune against
          // Gemini's actual published limits once confirmed for this key's tier.
          requestsPerMinute: 60,
          maxConcurrency: 5,
        },
        retryLimit: 3,
        // See the deepseek entry's comment above — same rule, same caveat.
        costPerImageMinor: 0,
      },
    },
  },

  storage: {
    // Cloudflare R2 (AGENTS.md section 2.2, section 4) — the only object
    // store this app is allowed to use. R2 is S3-compatible, reached here
    // through @aws-sdk/client-s3 against R2's own endpoint rather than AWS's.
    r2: {
      accountId: process.env.R2_ACCOUNT_ID ?? '',
      accessKeyId: process.env.R2_ACCESS_KEY_ID ?? '',
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
      bucket: process.env.R2_BUCKET_NAME ?? '',
      // How long a signed preview URL (book detail page thumbnails) stays
      // valid once generated — long enough to survive a normal dashboard
      // session without re-fetching, short enough that a leaked URL doesn't
      // stay usable indefinitely (security.md rule 8: buckets stay private,
      // signed URLs only).
      imagePreviewUrlTtlSeconds: 60 * 60,
    },
  },

  // security.md rule 3: per-IP and per-account throttles on sign-up, login,
  // and password endpoints; per-user throttles on upload endpoints. Fixed
  // windows, enforced by src/services/rateLimit.
  rateLimits: {
    signupPerIp: { limit: 5, windowMs: 60 * 60 * 1000 }, // 5 / hour
    loginPerIp: { limit: 10, windowMs: 15 * 60 * 1000 }, // 10 / 15 min
    loginPerAccount: { limit: 5, windowMs: 15 * 60 * 1000 }, // 5 / 15 min
    passwordResetRequestPerIp: { limit: 5, windowMs: 60 * 60 * 1000 },
    passwordResetRequestPerAccount: { limit: 5, windowMs: 60 * 60 * 1000 },
    passwordResetVerifyPerIp: { limit: 10, windowMs: 15 * 60 * 1000 },
    passwordResetCompletePerIp: { limit: 10, windowMs: 15 * 60 * 1000 },
    checkoutPerUser: { limit: 5, windowMs: 10 * 60 * 1000 },
    cancelPerUser: { limit: 5, windowMs: 10 * 60 * 1000 },
    uploadPerUser: { limit: 20, windowMs: 60 * 60 * 1000 },
    processPerUser: { limit: 10, windowMs: 10 * 60 * 1000 },
    summarizePerUser: { limit: 20, windowMs: 10 * 60 * 1000 },
    exportPerUser: { limit: 10, windowMs: 10 * 60 * 1000 },
    contactPerIp: { limit: 5, windowMs: 60 * 60 * 1000 }, // 5 / hour
  },
};
