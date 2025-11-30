# No Meta Models: A Values-Based Technical Decision

**Date:** November 29, 2025

---

## The Decision

This project will not use any AI models from Meta/Facebook, including:
- Llama (all versions)
- BART
- Any other Meta-affiliated models

## Why This Matters

Technical decisions aren't made in a vacuum. The tools we choose reflect our values.

Meta has a documented history of:
- Privacy violations at massive scale
- Algorithmic amplification of harmful content
- Resistance to accountability and transparency
- Business models built on surveillance capitalism

Using their models—even open-source ones—normalizes the company and contributes to their ecosystem legitimacy. "Open source" doesn't wash away the source.

## The Alternatives

Cloudflare Workers AI offers excellent alternatives:

| Use Case | Model | Provider |
|----------|-------|----------|
| Primary summarization | mistral-small-3.1-24b-instruct | Mistral AI |
| Fast inference | gemma-3-12b-it | Google |
| Reasoning tasks | qwq-32b | Qwen |
| Code tasks | qwen2.5-coder-32b-instruct | Qwen |

These models are competitive with or superior to Meta's offerings for our use cases.

## The Trade-offs

**What we lose:**
- Llama 3.1 70B is arguably the best open model for some tasks
- BART is purpose-built for summarization
- Larger community and more tutorials

**What we gain:**
- Alignment between tools and values
- Supporting alternative AI ecosystems
- Cleaner conscience

## Implementation

The `CLAUDE.md` file now includes an AI Model Policy section that explicitly lists approved models. Any future AI integration must use models from this approved list.

This isn't about purity—it's about intentionality. We make thousands of small technical decisions. Some of them should reflect who we want to be, not just what's expedient.

---

## Practical Notes

For Phase 4 (Workers AI summarization):
- Primary: `@cf/mistral/mistral-small-3.1-24b-instruct`
- Fallback: `@cf/google/gemma-3-12b-it`

Both have 128k context windows, which is more than sufficient for article summarization.

---

*Some decisions are technical. Some are ethical. The best infrastructure reflects both.*
