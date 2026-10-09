---
name: unslop
description: "AI-tell catalog: cut slop patterns so shipping prose reads human-written. Use when editing prose; technical-writing owns document structure."
---

This skill owns the catalog of AI tells. Document structure, mode and sentence rules belong to
[technical-writing](../technical-writing/SKILL.md), a user-only skill: apply it only when the user has
loaded it.

## What to cut

**Content.** Superficial `-ing` tails ("highlighting", "ensuring", "fostering"). Delete them or
replace them with the fact. Vague attributions ("experts believe", "industry reports suggest").
Name the source or cut the claim.

**Language.** Fancy ways to say "is" ("serves
as", "stands as", "boasts"). "Not just X, but Y". State the point. Ideas forced into threes. Use
the real number. Synonym cycling. Pick one word and repeat it. False ranges ("from X to Y" where
X and Y share no scale).

**Style.** Colons as mid-sentence connectors. Bold on every proper noun. Inline-header lists whose
bold label restates the line ("**Performance:** Performance improved"). A bold lead-in that
names the item and is followed by new detail is this repo's house style and stays. Title-case
headings (use sentence case), decorative emoji, curly quotes.

**Em dashes.** Avoid them. Replace an em dash with a comma, parentheses, or a new sentence. A
colon stays only before a list or example. The technical-writing and teach skills ban em dashes too.

**Residue.** Chatbot phrases and sycophancy.
Filler: "in order to" becomes "to", "due to the fact that" becomes "because", and a sentence
opening with a note about how important the next clause is loses that opening. Stacked hedging
("could potentially possibly be argued") becomes one modal. A closing paragraph that predicts a
bright future states a specific plan instead, or goes.

**Jargon.** Abstract metaphor nouns: substrate, wedge, vector, nexus, bedrock, modality,
paradigm, flywheel, "API surface", "evacuate" for moving code. Use the concrete word.

## What this repo keeps

- **Terms of art generally.** A rule that flags this repo's ordinary engineering vocabulary is wrong for this repo.

## Plain speech

Say what a thing does, not how it feels: "the database stays close at hand" names a feeling;
"`.toSQL()` returns the exact string sent to the database" names the mechanism. If a sentence
cannot be restated as an instruction, a fact or a number, cut it. If it could appear unchanged in
another project's documentation, it says nothing about this one.

Break a sentence the reader has to backtrack through. Name the actor instead of the passive
("queries are validated" → "the compiler validates queries"), unless the actor is genuinely
unknown. Cut adverbs or use a stronger verb ("runs quickly" → "is fast", or the number). Prefer
the plain word: use, not utilize; help, not facilitate; if, not in the event that.

## Rewriting someone else's text

Keep the meaning and the claims. If a sentence is vague because the fact behind it is missing,
ask for the fact rather than inventing a confident version of it.
