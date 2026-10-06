# Reranker colour calibration and scoring agreement

The GPU backend reranks 64 unique candidates nearest to equally spaced targets
across the complete finite retrieval z-score range. Sampling is deterministic;
it is uniform in score space, not in rank or percentile. Four-city queries use
64 candidates in total, with the existing per-city retrieval normalization.
Every candidate is represented by eight 512px perspective views.

The backend averages sampled logits within 0.5-sigma buckets and fits a
nondecreasing PAVA curve weighted by each bucket's total retrieval population.
The fitted zero-logit location is the colour-range centre. Without a zero
crossing, a negative fit uses the highest sampled retrieval z-score, and a
positive fit uses the lowest. This also covers mixed raw logits that become
one-sided after averaging and fitting. The lower and upper bounds are the
centre minus and plus two sigma. Empty evidence has no calibrated range.

Pearson r, Spearman rho with average ranks for ties, and biweight midcorrelation
with c=9 are computed from the same 64 raw (retrieval z-score, reranker logit)
pairs, before fitting. The displayed score is:

`Scoring agreement = 100 * clip((r + rho + bicor) / 3, 0, 1)`

Signed coefficients are retained in the audit result. A constant input or a
zero-MAD input can make a statistic undefined; the agreement then displays
N/A. This percentage summarizes score agreement and is not a calibrated
probability of retrieval correctness.

GPU text-query layers wait for calibration before applying the backend's
bounds to their map gradient. The layer row shows Scoring agreement; its
tooltip includes all three coefficients and the calibrated centre/range.
Endpoint fallback is labelled explicitly. Layer calibration survives page
reload and reset when the same source is reused. A fresh query clears stale
agreement metadata. CPU mode and a backend without CUDA never start reranking.

The production model stays on the GPU between reranker tasks. Existing
embedding code and score matrices are preserved. The four-city batch runner
is `scripts/runpod/reranker_combined_agreement.py`; it freezes source revisions
and stores the full API result for each of the 348 saved prompts. The complete
archive includes logits, source identities, sampled panoramas, bucket
populations, fitted curve, coefficients, bounds and GPU batch timing.

Validation: 34 backend reranker tests; 38 frontend calibration/map tests;
production build; headless browser checks at 1440px and 390px, including reload
persistence. Run the frontend calibration tests with `npm run test:rerank`.

The published runtime configuration connects to
`https://r2ixzxzpb54wkd-8000.proxy.runpod.net` and selects the four 8B/512 datasets.
The Pages finalization step preserves the checked-in public configuration;
it must not replace it with an empty object. No authentication secret is stored
in this configuration. A browser with a previously saved backend can select
this backend through the existing `?backend=` URL parameter. Completed combined
queries reuse the saved calibration, including bounds and scoring agreement.
