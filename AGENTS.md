# Winter Arc Development Principles

These instructions apply to all AI-assisted development in this repository.

## Infrastructure failures

- On the first `helper_sandbox_lock_failed` or `.codex\\.sandbox-bin` error, never retry the sandboxed path. Immediately use an approved elevated fallback if available; otherwise report the blocker once and continue without that capability.
- After the same infrastructure failure occurs twice, stop retrying. Use the known fallback or report the blocker.

## Product and interface design

- Treat every attached reference as a specification. Match its hierarchy, density, proportions, and restraint before introducing original styling.
- Before adding an element, justify its necessity. If the screen remains understandable without it, remove it.
- Keep mobile components visually compact while preserving invisible 44px touch targets.
- Put negative space between content groups, never inside oversized containers.
- Give every screen one focal point. Make secondary content visibly quieter.
- Never display duplicate information, navigation, or controls already available elsewhere unless explicitly requested.
- Use semantic color consistently for established meaning. Do not add pills or labels that merely repeat that meaning.

## Feature removal

When removing a feature, remove the complete surface: route, component, navigation entry, tests, imports, data fields, and feature-specific styles.

## Verification

- If visual inspection is unavailable, state that once. Never substitute tests or build success for visual QA.
- Do not claim visual quality from code inspection alone.
- Use the narrowest verification appropriate to the change.

## Test scope

- Questions and explanations: do not run tests.
- Tiny CSS or copy changes: usually do not run tests unless requested.
- Focused behavior changes: run the narrowest relevant test.
- Large refactors, commits, or release work: run the full suite once before finalizing.
- Do not run the full suite on every query or conversational follow-up.

## Change discipline

- Prefer deletion and the smallest change that satisfies the request.
- Preserve intentional user changes; do not restore older copy or behavior merely to satisfy stale tests.
- Update tests when product behavior changes, but do not make incidental display copy a test contract unless the copy itself is the requirement.
- Keep generated output, debug captures, local environment files, and temporary profiles out of Git.
