---
name: log-decision
description: Record an architecture decision record (ADR) in docs/decisions/. Use when a non-obvious technical choice was made — picking between real alternatives, changing forecast behavior, adding a dependency, changing how data is stored or deployed — or when the user says "log this decision", "write an ADR", or "document why we did this".
---

# Log a decision

ADRs live in `docs/decisions/`. Read
[docs/decisions/README.md](../../../docs/decisions/README.md) for the
conventions; this skill is the procedure.

## First: is this actually a decision?

All three must be true. If not, stop — do not write the file.

- You chose between **real alternatives**, not "the only way that works".
- The choice is **not obvious** from reading the code it produced.
- **Reversing it later costs more than an afternoon.**

Renaming a variable, adding a form field, or fixing a bug with one correct answer
are not decisions. A log full of noise gets skipped, which defeats the purpose.

If the choice contradicts something in
[docs/constitution.md](../../../docs/constitution.md), that is not an ADR — stop
and raise it with the user. The constitution changes only by their deliberate
act.

## Steps

1. **Find the next number.**

   ```bash
   ls docs/decisions/
   ```

   Take the highest `NNNN` and add one. Never reuse a number, even if a file was
   deleted.

2. **Check nothing already covers it.** If an existing ADR decides this
   question, you are either reaffirming it (write nothing) or reversing it (go
   to *Superseding* below).

3. **Write `docs/decisions/NNNN-kebab-case-title.md`** from
   [`_template.md`](../../../docs/decisions/_template.md). Title is a short
   imperative — "Cap the pg pool at 3 connections", not "Pool sizing".

   The two sections that carry the weight:

   - **Consequences** — name what this makes *hard*, not just what it makes
     easy. The cost is why the next reader needs the document.
   - **Alternatives considered** — one line per option and why it lost. If you
     cannot fill this in, re-read step "is this actually a decision?".

   Write for someone with no memory of today. State the constraint that made the
   choice non-obvious — a platform limit, a property of bananas, an incident.

4. **Add a row to the index table** in `docs/decisions/README.md`. This is the
   step that gets forgotten and the one agents actually read.

5. **Cross-link.** If the decision constrains something described in
   `CLAUDE.md`, `docs/constitution.md`, or `docs/mcp.md`, link the ADR from
   there. Keep those files short — link, do not restate.

6. **Commit it with the change it describes**, so `git log` ties the two
   together. If the code already shipped, commit the ADR alone and note in the
   Date line that it is recorded retroactively.

## Superseding an existing decision

Never edit the substance of an accepted ADR and never delete one.

1. Write the new ADR. Add a `Supersedes: [NNNN](NNNN-....md)` line under Status.
2. In the old one, change Status to `Superseded by [NNNN](NNNN-....md)`. Change
   nothing else — the wrong turn is as useful to a future reader as the right
   one.
3. Update both rows in the index.

## Recording a decision the user made in conversation

If the user decided something in chat and asked you to log it, write it in their
terms, not yours. Where you are unsure of their reasoning, ask rather than
inventing a rationale — a plausible-sounding wrong "why" is worse than a missing
one, because nobody will question it later.
