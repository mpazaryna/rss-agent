---
description: Stage, commit, and push the current branch following git governance rules.
---

1. Review and stage changes with `git add` (avoid staging generated or secret files).
2. Craft a Conventional Commit message (types: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert).
   - Use `commit-template.txt` and include Context / Testing / Reviewers blocks.
   - Never add AI attribution strings to commits.
3. Commit with `git commit` using the prepared message. If commitlint fails, fix the message and retry.
4. Push to origin: `git push origin $(git branch --show-current)`.

