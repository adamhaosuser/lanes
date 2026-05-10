---
name: roadmap-populate
description: Interactively populate the Roadmap visualizer (Roadmap.html) by gathering meta, stage names, and features from the user, then writing a roadmap.json file the user can import via the upload button or drag-and-drop. TRIGGER when the user asks to "create a roadmap", "populate the roadmap", "set up the roadmap", "make a new roadmap", "draft a roadmap", or wants to seed a fresh timeline. SKIP if the user is asking to edit a single existing feature or just import an already-prepared file.
---

# Roadmap populate

Walk a user through creating a `roadmap.json` for the Roadmap visualizer in this folder. End by writing the file to disk and telling them how to import it.

## What you're producing

A single JSON file at `./roadmap.json` (or wherever you're invoked) matching this exact shape:

```json
{
  "meta": {
    "title": "string",
    "fy": "string",
    "eyebrow": "string",
    "owner": "string",
    "status": "string",
    "lastReviewed": "string",
    "show": { "title": true, "fy": true, "owner": true, "status": true, "lastReviewed": true, "stageNames": true }
  },
  "quarters": ["Stage 1", "Stage 2", "Stage 3", "Stage 4"],
  "features": [
    {
      "id": "f1",
      "title": "Short imperative title",
      "type": "major",
      "q": 0,
      "start": 0,
      "length": 4,
      "lane": 0,
      "description": "Two sentences. What it is and what it ships.",
      "jtbds": ["When I X, I want Y so that Z.", "When I A, I want B."],
      "value": "Outcome sentence. KR-aligned sentence.",
      "kr": "KR1 — Activation: ..."
    }
  ]
}
```

## Hard constraints (don't violate)

- `quarters` must have **exactly 4** entries.
- Each stage = **6 sprints**, so total timeline = **24 sprints**, indexed `0..23`.
  - Stage 0 covers sprints 0–5, stage 1 covers 6–11, stage 2 covers 12–17, stage 3 covers 18–23.
- For every feature: `start + length <= 24`, `length >= 1`, `lane >= 0`, `q ∈ {0,1,2,3}`.
- `type` is either `"major"` or `"minor"`.
- `id` must be unique. Use `f1, f2, f3, ...`.
- A feature *can* span across stages (e.g. start=4, length=4 spans stage 0 → 1). When it does, set `q` to the stage where it **starts**.

## How to gather input — flow

Adapt to the user. Don't grind through every step if they want speed; don't skip steps if they want depth. Start by asking which mode they want:

1. **Brief mode** — they give you a 2–3 sentence description of the initiative, you draft a full roadmap, then they iterate by editing.
2. **Guided mode** — you ask focused questions stage-by-stage, feature-by-feature.

Use `AskUserQuestion` for any choice with a small fixed option set. Use plain text questions for open-ended answers (titles, descriptions, JTBDs).

### Step 1 — Meta

Ask in one batch (free-text reply is fine):
- Roadmap title (e.g. "The SDK Roadmap")
- Fiscal year / period label (e.g. "FY26", "2026 H1")
- Owner (e.g. "Platform team", "Adam M.")
- Status (default: "Plan of record")
- Eyebrow / subheading (optional, e.g. "Platform · plan of record")

Set `lastReviewed` to today's date in `MMM D, YYYY` format. Default `show` flags to all `true`.

### Step 2 — Stage names

Use `AskUserQuestion` with these presets:
- **Quarters** — `Q1`, `Q2`, `Q3`, `Q4` (with optional themes you'll ask for next)
- **Maturity** — `Alpha`, `Beta`, `GA`, `Maintain`
- **Phases** — `Discover`, `Build`, `Launch`, `Scale`
- **Custom** — user provides 4 names

If they pick Quarters, optionally ask for a theme per stage to append: `Q1 — Foundation`, etc.

### Step 3 — Features per stage

For each stage, ask how many of each type:
- Default: **2–3 major** + **1–2 minor**
- Confirm or override.

Then for **each feature**, gather (you can batch fields per feature):
- **Title** — short, imperative, ≤ 60 chars.
- **Type** — major or minor.
- **Description** — exactly two sentences. The first names the thing; the second names the user-visible behavior.
- **JTBDs** — 1–2 statements in the form *"When I [situation], I want [motivation] so [outcome]."* Minor features usually only need one.
- **Value** — two sentences. Sentence 1: outcome. Sentence 2: KR alignment.
- **KR** — short label like `KR3 — Adoption: ...`. If the user has KRs, ask for them up front (Step 1.5) and reuse the labels.

Don't write more than the user gave you. If they say "just draft something", invent reasonable content and label your assumptions clearly so they can correct you.

### Step 4 — Sprint placement

Default each feature to a sensible span within its stage:
- **Major** features: 3–5 sprints.
- **Minor** features: 2–3 sprints.
- Stagger starts within the stage (e.g. major #1 at sprint 0, major #2 at sprint 1, major #3 at sprint 2 of the stage) so the timeline reads diagonally.

If the user wants a feature to span across stages, set its `start` accordingly and update `q` to the stage where it starts.

### Step 5 — Lane assignment (greedy)

Lanes prevent visual overlap. Algorithm:

1. Sort features by `start` ascending.
2. For each feature, assign the **lowest** lane index that has no other feature occupying any sprint in `[start, start+length)`.
3. Lanes are zero-indexed and grow as needed.

This usually packs a quarter's 3–4 features into lanes 0–3.

### Step 6 — Confirm

Before writing, summarize back:
- Title / FY / owner.
- Stage names.
- Per stage: count of majors + minors with their titles only.
- Total feature count and lane count.

Ask for confirmation. If they want changes, edit in memory and re-confirm.

### Step 7 — Write the file

- Output path: `./roadmap.json` in the current working directory (or `Redesign/roadmap.json` if invoked from the parent folder — match where `Roadmap.html` lives).
- Use `Write` (overwrites) and pretty-print with 2-space indent.
- After writing, tell the user:
  > Wrote `roadmap.json`. Open `Roadmap.html`, click the import (↓) icon top-right or drag the file onto the page to load it.

## Tips for good output

- **Titles** — verbs, not nouns. "Typed Client Generation" beats "Type System".
- **Descriptions** — say what ships, not what's "explored" or "investigated". Roadmaps are commitments.
- **JTBDs** — anchor in a real moment ("When I integrate the API for the first time…"), not a persona ("As a developer…").
- **Value** — quantify when you can ("cuts P1 incidents 30%"), and explicitly cite the KR it ladders to.
- **Minors** — a single tight JTBD and a one-sentence value is fine. Don't pad.
- **Variety** — across a quarter, mix infrastructure work, DX work, and customer-facing features. Don't ship four flavors of the same thing.

## Examples for shape (not content) reference

Major feature:

```json
{
  "id": "f3",
  "title": "Streaming Response Support",
  "type": "major",
  "q": 0,
  "start": 2,
  "length": 4,
  "lane": 2,
  "description": "First-class streaming for long-running endpoints, exposed as async iterators in TS and generators in Python. Includes automatic reconnection, resume tokens, and partial-response parsing.",
  "jtbds": [
    "When I render results to a user in real-time, I want tokens to arrive as they're produced — not all at once at the end.",
    "When a stream drops mid-response, I want to resume without re-running the request."
  ],
  "value": "Unlocks the real-time UX patterns customers are building today by hand, often incorrectly. Aligned to Adoption KR3.",
  "kr": "KR3 — Adoption: 25% of API calls go through streaming endpoints"
}
```

Minor feature:

```json
{
  "id": "f8",
  "title": "Per-Request Timeouts",
  "type": "minor",
  "q": 1,
  "start": 10,
  "length": 2,
  "lane": 3,
  "description": "Override timeout per call without rebuilding the client. Includes sensible defaults that differ for streaming vs. unary endpoints.",
  "jtbds": ["When one endpoint is slower than others, I want to set a longer timeout just for it."],
  "value": "Stops users from globally raising timeouts (and masking real issues) just to accommodate one slow call. Contributes to Reliability KR2.",
  "kr": "KR2 — Reliability"
}
```

## Things to avoid

- Don't write to `localStorage` or modify `Roadmap.html` / `app.js`. Just produce `roadmap.json`.
- Don't invent KRs the user didn't give you. If they didn't supply any, leave `kr` as a generic theme label or empty string.
- Don't ship a roadmap without confirming. Always summarize before writing.
- Don't overflow the timeline. If the user pushes 6 majors into one stage, push back or expand to multiple lanes.
