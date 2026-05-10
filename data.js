// Default roadmap data — same shape as the imported sdk-roadmap.json.
window.DEFAULT_META = {
  title: "The SDK Roadmap",
  fy: "FY26",
  eyebrow: "Platform · plan of record",
  owner: "Platform team",
  status: "Plan of record",
  lastReviewed: "May 8, 2026",
  show: {
    title: true,
    fy: true,
    owner: true,
    status: true,
    lastReviewed: true,
    stageNames: true
  }
};

window.DEFAULT_DATA = {
  meta: window.DEFAULT_META,
  quarters: [
    "Q1 — Foundation & Trust",
    "Q2 — Developer Velocity",
    "Q3 — Scale & Observability",
    "Q4 — Polish & Ecosystem"
  ],
  features: [
    { id: "f1", title: "Typed Client Generation (TS + Python)", type: "major", q: 0, start: 0, length: 4, lane: 0,
      description: "Auto-generate fully-typed SDK clients from the OpenAPI spec on every release, published to npm and PyPI. Types include request/response shapes, error unions, and inline JSDoc/docstrings sourced from the spec.",
      jtbds: [
        "When I integrate the API, I want autocomplete and compile-time errors so I don't ship broken calls to production.",
        "When the API changes, I want type breakage to surface in CI so I learn about it before my users do."
      ],
      value: "Eliminates the highest-volume class of integration bugs (wrong field names, wrong shapes) and shortens time-to-first-successful-call by ~40%. Aligned to Activation KR1.",
      kr: "KR1 — Activation: TTFHW < 10 min for 80% of new integrators" },
    { id: "f2", title: "Retry & Backoff with Idempotency Keys", type: "major", q: 0, start: 1, length: 4, lane: 1,
      description: "All mutating calls accept (and auto-generate) idempotency keys, with transparent exponential backoff on 429/5xx and a configurable retry budget. Retries are observable via callback hooks for logging.",
      jtbds: [
        "When the network blips during a payment call, I want the SDK to retry safely without double-charging the customer.",
        "When I'm debugging a flaky integration, I want to see what the SDK retried and why."
      ],
      value: "Cuts P1 incidents caused by transient failures and removes the most common reason teams write their own wrapper around our SDK. Aligned to Reliability KR2.",
      kr: "KR2 — Reliability: 30% QoQ reduction in SDK-related support tickets" },
    { id: "f3", title: "Streaming Response Support (SSE + chunked)", type: "major", q: 0, start: 2, length: 4, lane: 2,
      description: "First-class streaming for long-running endpoints, exposed as async iterators in TS and generators in Python. Includes automatic reconnection, resume tokens, and partial-response parsing.",
      jtbds: [
        "When I render results to a user in real-time, I want tokens to arrive as they're produced — not all at once at the end.",
        "When a stream drops mid-response, I want to resume without re-running the request."
      ],
      value: "Unlocks the real-time UX patterns customers are building today by hand, often incorrectly. Aligned to Adoption KR3.",
      kr: "KR3 — Adoption: 25% of API calls go through streaming endpoints by Q1 close" },
    { id: "f4", title: "Verbose Debug Logging Mode", type: "minor", q: 0, start: 3, length: 3, lane: 3,
      description: "A single env var (SDK_DEBUG=1) enables structured request/response logs with redacted secrets. Output is greppable JSON suitable for piping to log aggregators.",
      jtbds: ["When I'm stuck, I want to see exactly what the SDK sent and received without wiring up a proxy."],
      value: "Reduces back-and-forth in support tickets by giving users self-serve diagnostics. Aligned to Support KR4.",
      kr: "KR4 — Support: Median resolution time -20%" },
    { id: "f5", title: "Local Mock Server / Sandbox", type: "major", q: 1, start: 6, length: 5, lane: 0,
      description: "A `sdk mock` CLI command spins up a local server that mimics the production API with deterministic fixtures. Supports scenario flags (rate-limit, slow, error) for testing edge cases.",
      jtbds: [
        "When I write tests against the SDK, I want them to run offline and not flake.",
        "When I demo my integration, I want predictable responses regardless of upstream state."
      ],
      value: "Removes the dependency on shared staging environments and makes CI/CD reliable for SDK consumers. Aligned to Adoption KR3.",
      kr: "KR3 — Adoption: 50% of SDK users have at least one mock-backed test" },
    { id: "f6", title: "Pagination Helpers (Auto-Iterate)", type: "major", q: 1, start: 6, length: 4, lane: 1,
      description: "List endpoints return a paginator object that lazily fetches subsequent pages on iteration. Includes async iteration, cursor checkpointing, and a take(n) shortcut.",
      jtbds: [
        "When I list resources, I just want to loop through all of them — I don't want to manage cursors myself.",
        "When a long iteration crashes, I want to resume from where I left off."
      ],
      value: "Removes the most common piece of boilerplate every customer writes and gets wrong. Aligned to DevEx KR5.",
      kr: "KR5 — DevEx: Reduce average LOC for 'list all X' use cases by 60%" },
    { id: "f7", title: "Webhook Signature Verification", type: "major", q: 1, start: 8, length: 4, lane: 2,
      description: "A drop-in helper that validates webhook signatures, handles timestamp tolerance, and returns parsed, typed event payloads. Ships with framework adapters for Express, FastAPI, and Next.js route handlers.",
      jtbds: [
        "When I receive a webhook, I want to verify it's actually from you without copying crypto code from docs.",
        "When event schemas evolve, I want my handler to tell me which event type I got with full type safety."
      ],
      value: "Closes a security footgun (unverified webhooks) and a common integration pain point. Aligned to Security KR6.",
      kr: "KR6 — Security: 90% of webhook traffic from SDK customers signature-verified" },
    { id: "f8", title: "Per-Request Timeouts", type: "minor", q: 1, start: 10, length: 2, lane: 3,
      description: "Override timeout per call without rebuilding the client. Includes sensible defaults that differ for streaming vs. unary endpoints.",
      jtbds: ["When one endpoint is slower than others, I want to set a longer timeout just for it."],
      value: "Stops users from globally raising timeouts (and masking real issues) just to accommodate one slow call. Contributes to Reliability KR2.",
      kr: "KR2 — Reliability" },
    { id: "f9", title: "OpenTelemetry Integration", type: "major", q: 2, start: 12, length: 6, lane: 0,
      description: "SDK emits OTel spans for every request with attributes for endpoint, retry count, status, and latency. Auto-detects existing tracer providers and falls back to a no-op when none is configured.",
      jtbds: [
        "When I trace a slow user request, I want to see where time was spent inside the SDK call.",
        "When I'm investigating an outage, I want SDK calls correlated with the rest of my distributed trace."
      ],
      value: "Makes the SDK a first-class citizen in modern observability stacks; turns 'SDK black box' complaints into solved problems. Aligned to Enterprise KR7.",
      kr: "KR7 — Enterprise: Top-10 customers have OTel data flowing through SDK" },
    { id: "f10", title: "Connection Pooling & Keepalive", type: "major", q: 2, start: 12, length: 4, lane: 1,
      description: "Configurable HTTP/2 connection pooling with sane defaults per language runtime. Surfaces pool metrics (in-use, idle, wait time) via the observability hooks.",
      jtbds: [
        "When my service makes 1000s of API calls per second, I don't want connection setup to dominate latency.",
        "When I'm capacity-planning, I want to know if the SDK is the bottleneck."
      ],
      value: "Unlocks high-throughput use cases without forcing customers to drop the SDK and write raw HTTP. Aligned to Performance KR8.",
      kr: "KR8 — Performance: P99 SDK overhead < 5ms at 1k RPS" },
    { id: "f11", title: "Bulk / Batch Operation Helpers", type: "major", q: 2, start: 13, length: 4, lane: 2,
      description: "A batch() helper accumulates calls and dispatches them as efficient multi-resource requests where the API supports it; falls back to concurrent-with-limit otherwise. Returns per-item success/failure results.",
      jtbds: [
        "When I need to update 10,000 records, I want to do it efficiently without writing my own concurrency limiter.",
        "When part of a batch fails, I want to know exactly which items failed and why."
      ],
      value: "Replaces customers' bespoke (often-buggy) batching code with a tested, ergonomic primitive. Aligned to Efficiency KR9.",
      kr: "KR9 — Efficiency: 20% API call volume reduction from batch users" },
    { id: "f12", title: "Region Pinning", type: "minor", q: 2, start: 14, length: 3, lane: 3,
      description: "Specify the API region at client construction so requests are routed to the closest data plane. Defaults follow account configuration if unset.",
      jtbds: ["When my service runs in EU, I want SDK calls to stay in EU for compliance and latency."],
      value: "Removes a manual base-URL configuration step for multi-region customers. Contributes to Enterprise KR7.",
      kr: "KR7 — Enterprise" },
    { id: "f13", title: "Structured Error Hierarchy", type: "minor", q: 2, start: 16, length: 2, lane: 4,
      description: "All thrown errors extend a common base class with discriminated subtypes (RateLimitError, AuthError, ValidationError, etc.). Each carries the request ID and a documentation link.",
      jtbds: ["When I catch an error, I want to handle different failure modes differently without parsing strings."],
      value: "Makes resilient error handling ergonomic and reduces 'what does this error mean' support load. Contributes to Support KR4.",
      kr: "KR4 — Support" },
    { id: "f14", title: "Plugin / Middleware API", type: "major", q: 3, start: 18, length: 5, lane: 1,
      description: "Public middleware API lets users intercept requests and responses for custom auth, logging, caching, or transformation. Plugins are composable and shipped as separate packages.",
      jtbds: [
        "When my org has custom auth, I want to inject it once at the SDK layer instead of at every call site.",
        "When I want to cache idempotent reads, I want to do it without forking the SDK."
      ],
      value: "Turns the SDK into an extensible platform and unblocks edge cases we'd otherwise have to ship native support for. Aligned to Ecosystem KR10.",
      kr: "KR10 — Ecosystem: ≥3 community plugins published by Q4 close" },
    { id: "f15", title: "Go and Ruby SDKs (GA)", type: "major", q: 3, start: 18, length: 6, lane: 0,
      description: "Production-ready clients for Go and Ruby with parity on the Q1–Q3 feature set (typing, retries, streaming, pagination, OTel). Both ship from the same OpenAPI generator pipeline.",
      jtbds: ["When my team's stack is Go or Ruby, I want a first-party SDK so I don't have to use raw HTTP or community packages."],
      value: "Opens two large ecosystems we currently lose deals in; expands TAM without splintering the spec. Aligned to Adoption KR3.",
      kr: "KR3 — Adoption: 15% of new integrations in Go or Ruby within one quarter of GA" },
    { id: "f16", title: "CLI Companion (sdk init / sdk doctor)", type: "minor", q: 3, start: 20, length: 3, lane: 2,
      description: "A small CLI that scaffolds a starter project and diagnoses common config issues (bad keys, network blocks, version mismatches). Output is human-readable and machine-parseable.",
      jtbds: [
        "When I start a new project, I want the SDK set up correctly in one command.",
        "When something's wrong, I want the SDK to tell me what to fix."
      ],
      value: "Compresses the first-30-minutes experience and shifts trivial support load to self-serve. Contributes to Activation KR1 and Support KR4.",
      kr: "KR1 + KR4" },
    { id: "f17", title: "Versioned Migration Guides + Codemods", type: "minor", q: 3, start: 22, length: 2, lane: 3,
      description: "Each SDK major release ships a published codemod (jscodeshift / libcst) that auto-rewrites breaking changes. Migration guides link directly to the codemod command.",
      jtbds: ["When I upgrade across a major version, I want the boring rewrites done for me."],
      value: "Keeps customers on supported versions, reducing the long tail of legacy SDK calls we have to keep alive. Aligned to Maintenance KR11.",
      kr: "KR11 — Maintenance: ≥70% on latest major within 90 days of release" }
  ]
};
