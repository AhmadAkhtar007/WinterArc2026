# Tracked Daily Challenge Variant

## Scope

Build a separate tracked-daily card for quantity and scheduled-occurrence challenges. Preserve the current card as the binary variant. Weekly and season variants remain out of scope.

## Card

The unlocked tracked card contains a 20px circular action with a 44px touch target, one-line title, current secured XP, current progress, and a thin progress rail. It contains no category label, pill, deadline, or normal-state timer.

## Recording

Quantity challenges accept only configured increments. Occurrence challenges record one eligible occurrence. Accepted entries are immutable timestamped records within the current device-local daily period. The backend accepts only local period keys within one day of its UTC date.

## Cooldown

After a valid entry, if further progress remains, the card is softly blurred and dimmed. A centred countdown is the only foreground content. The card keeps its dimensions and can still open its details. The action is unavailable until the server-derived cooldown ends. The visible timer has an accessible explanation that is not announced every second.

## Rewards

Reward tiers are explicit thresholds. The card shows XP secured at the current progress, including zero below the base threshold. Reaching the base tier does not stop entries while a higher tier remains. Reaching the highest tier completes the tracked card.

## Correction and reset

Current-day progress entries can be removed from the details sheet, which recalculates progress, reward, and cooldown. At device-local midnight, a fresh period appears; prior entries become read-only and prior XP remains. An app left open across midnight refreshes automatically.

## Seeded challenges

Populate representative daily challenges for hydration, 100 push-ups, nonfiction reading with tiered rewards, and five daily Salah occurrences with a minimum interval.

## Constraints

Use existing React, TypeScript, CSS, Supabase, repository, and preview-mode patterns. Add no dependencies. Keep binary completion behavior intact. Do not implement weekly, season, marketplace, penalties, or admin rule-building in this pass.