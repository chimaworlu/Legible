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
      // Reusable Payment Plan ids (Settings > Payment Plans). Left unset in
      // dev — the adapter lazily creates one per interval on first use and
      // logs the id so it can be pinned here.
      monthlyPlanId: process.env.FLUTTERWAVE_MONTHLY_PLAN_ID ?? "",
      yearlyPlanId: process.env.FLUTTERWAVE_YEARLY_PLAN_ID ?? "",
      // developer.flutterwave.com/v3.0.0/docs/payment-methods — NGN-eligible
      // methods. "card" is deliberately its own bucket: attaching a Payment
      // Plan (required for auto-renewal) forces Flutterwave to card-only, so
      // the two paths must never be offered in the same checkout request.
      cardOnlyPaymentOptions: "card",
      manualPaymentOptions: "ussd,banktransfer,account,internetbanking,nqr,enaira,opay",
    },
  },

  ai: {
    // The active provider is locked here per ai-pipeline.md rule 4
    activeProvider: 'default',
    confidenceThreshold: 0.8, 
  },

  storage: {
    // Local filesystem store is the v1 dev backend. Swapping to Cloudflare R2
    // must only touch the adapter in src/services/storage, never call sites.
    local: {
      baseDir: process.env.STORAGE_LOCAL_DIR ?? 'storage/local',
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
  },
};
