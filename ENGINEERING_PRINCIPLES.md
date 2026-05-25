# Engineering Principles

Selina is the product name. Vibe Hub is the development codename used in repository naming.

This repository is built for a real constraint set: limited hardware, limited API budget, free-rate-limit providers, and uneven access to strong models.

The goal is not to simulate infinite intelligence. The goal is to build a coding system that stays useful, safe, and testable under scarcity.

## North Star

`Deterministic core, optional intelligence.`

The system must remain helpful when the best model is unavailable, slow, rate-limited, or too expensive to use continuously.

## Primary Philosophy

`Trustworthy execution over theatrical intelligence.`

That means:

- prefer grounded behavior over confident guessing
- prefer explicit artifacts over invisible reasoning
- prefer narrow, verified changes over broad speculative edits
- prefer graceful degradation over hard failure when a provider is unavailable
- treat token spend as a product constraint, not an afterthought

## What Must Work Without An LLM

These capabilities are part of the deterministic core and should remain useful without live model access:

- auth, session, and approval boundaries
- VFS staging, review, and commit enforcement
- MCP tool registration, schema validation, and fail-closed execution
- content harnessing, normalization, chunking, and metadata generation
- retrieval heuristics, recall-term extraction, and context filtering
- diffs, patch application, and file targeting
- test, build, and sandbox execution
- parity scoring, artifact generation, and audit trails
- fallback classification, retry policy, and degraded-mode behavior

If a feature cannot provide value without a premium model, it is not a platform primitive. It is an optional accelerator.

## When To Use LLMs

LLMs should be used where synthesis is genuinely needed:

- code generation from incomplete specifications
- bug-fix reasoning across multiple files
- summarization of large imported content
- prompt interpretation when heuristics are insufficient
- final response shaping for clarity and brevity

LLMs should not be used for work that deterministic infrastructure can already do:

- schema enforcement
- permission checks
- command validation
- route or file discovery from local metadata
- test execution
- build execution
- scoring and pass/fail classification

## Model Tiering

Use models in tiers instead of treating every request as premium:

- `Tier 0`: no model
- `Tier 1`: cheapest or free model
- `Tier 2`: strongest available model

Expected use:

- `Tier 0` for routing heuristics, retrieval, safety checks, tool validation, artifacts, and verification loops
- `Tier 1` for classification, compression, summaries, and low-risk planning
- `Tier 2` for hard code edits, repair attempts, and high-value final synthesis only

Rule:

`Never spend a strong-model call on work that a script, test, or heuristic can do.`

## Token Budget Rules

Every prompt is a cost center. Spend tokens like cash.

- send only the retrieved slices needed for the current task
- compress context before escalating to a stronger model
- reuse prior summaries instead of re-sending raw source when possible
- prefer one good grounded call over several speculative calls
- stop retry loops when new evidence is not being produced
- capture enough artifacts that failed runs can be replayed without repeating model spend

## RAG Layers

This system should be designed as an evidence pipeline with an optional reasoning layer on top.

We are not building a chatbot with memory. We are building a grounded retrieval-and-execution system where the model is only the final transformer.

### 1. Source Capture Layer

This layer collects raw truth before any reasoning begins.

- uploads
- repository files
- tool outputs
- rollout artifacts
- test and build failures
- internal docs and integration surfaces

Principle:

`Capture evidence first. Reason second.`

### 2. Canonicalization Layer

Raw text must be normalized into a stable internal form before it becomes retrievable.

- preserve `sourcePath`, `sourceName`, `kind`, `tags`, and timestamps
- generate stable `contentHash` values
- split content into chunks with lineage back to the original artifact
- keep summaries source-aware instead of freeform

If chunks lose identity, retrieval quality collapses.

### 3. Memory Separation Layer

Not all memory is equal. Keep these categories distinct:

- `Source Memory`: imported or observed truth that should remain immutable
- `Working Memory`: run-local scratch context and intermediate notes
- `Learned Memory`: compact derived notes that earned reuse across runs

The default should be to trust source memory most, working memory second, and learned memory only when it stays attributable.

### 4. Retrieval Planning Layer

Before searching, decide what kind of question is being asked.

- code question
- documentation question
- auth or safety question
- tool or MCP question
- error diagnosis question
- workflow or planning question

Retrieval should begin with a policy, not a guess. The query type should determine which stores, paths, tags, and chunk classes are eligible.

### 5. Retrieval Layer

Default to cheap, deterministic retrieval before expensive ranking.

- stage 1: lexical or keyword retrieval
- stage 2: structural filters by path, type, tag, and recency
- stage 3: optional reranking only if the cheap stages are insufficient
- stage 4: assemble a small evidence pack instead of dumping broad context

Default rule:

`Lexical-first RAG, embeddings optional later.`

### 6. Grounding Layer

No model call should receive the whole world. It should receive an evidence packet.

Each evidence packet should contain:

- the selected chunks
- why each chunk was selected
- source references
- confidence or score signals
- a strict token budget

This is where context stops being raw memory and becomes usable evidence.

### 7. Reasoning And Action Layer

Only after grounding should the system invoke a model or choose a tool path.

Expected responsibilities:

- summarize evidence
- explain failures
- propose patches
- select next actions
- prepare tool calls against grounded context

The model should transform evidence, not invent the retrieval substrate.

### 8. Verification Layer

The answer is not complete until the system checks whether the grounded action actually worked.

- tests
- builds
- tool-call outcomes
- contradiction checks against imported source truth
- approval and auth boundary validation

Verification is part of RAG quality because retrieval is only useful if it leads to correct action.

### 9. RAG Evaluation Layer

RAG quality should be measured directly, not hidden inside vague model scores.

- retrieval hit rate
- context waste
- contradiction rate
- evidence-free answer rate
- chunk usefulness
- hallucination against imported source truth

If retrieval selects the wrong evidence, a better model is not the real fix.

### RAG Rules

- memory is a retrieval system, not a transcript dump
- evidence should be narrow, attributable, and replayable
- retrieval planning matters as much as retrieval scoring
- grounding should happen before synthesis
- hallucinated memory is a correctness failure
- stronger models should only see the smallest useful evidence pack

## Tooling Principles

Tools are contracts, not vibes.

- every tool should have a typed schema
- every tool should fail closed on malformed input
- risky tools should expose explicit metadata and approval expectations
- MCP degradation should be diagnosable without taking down healthy inventory
- tool selection should be observable in artifacts and reports

If a tool cannot be safely validated, it should not be part of the default agent path.

## Degraded Mode Requirements

The product must still help the user when providers are rate-limited, offline, or unaffordable.

In degraded mode, the system should still be able to:

- inspect relevant files
- retrieve harnessed project context
- propose constrained next steps
- run tests and builds
- identify likely edit targets
- explain what is blocked by missing model capacity
- preserve logs and artifacts for later continuation

Degraded mode is not a bug. It is a first-class operating condition.

## Verification Is Part Of The Answer

A response is not complete because it sounds plausible. It is complete when it is checked.

- run focused tests when code changes touch covered areas
- use builds as a reproducible frontend verification signal
- record failure reasons, not just pass/fail outcomes
- preserve rollout and eval artifacts for audit and replay
- prefer local evaluators by default
- use live external baselines sparingly and intentionally

`npm run eval:parity` exists to measure quality, not to decorate releases.

## Safety Is A Product Feature

Safety boundaries are not separate from product quality.

- auth checks must remain explicit
- approval-gated writes must remain enforceable
- action grants must remain scoped and non-forgeable
- schema validation must remain strict
- prompt-injected mutation paths must fail closed

A feature that works by weakening these boundaries is a regression, not a shortcut.

## Evaluation Policy

Parity with Claude Code or Codex should be measured, not claimed.

- local parity evaluation should be runnable without external credentials
- live Claude Code and Codex comparisons are optional spot checks
- regression signals should be auditable through JSON and Markdown artifacts
- category scores matter more than a single vanity number
- critical failures should downgrade the run automatically

The parity suite is useful even when the answer is "not there yet."

## Decision Checklist

Before adding a new feature or workflow, ask:

1. Can the core value be preserved without a premium model?
2. What part is deterministic, and what part truly needs synthesis?
3. How is token spend minimized or cached?
4. What happens when the provider is unavailable?
5. What artifact proves the system behaved correctly?
6. What test, build, or evaluator will catch regressions?
7. Does this strengthen or weaken trust boundaries?

If these questions do not have clear answers, the design is not ready.

## Implementation Priorities

When resources are tight, prioritize in this order:

1. deterministic routing and retrieval
2. strong harnessing, retrieval planning, and context compression
3. schema-safe tool execution
4. approval-gated file operations
5. local verification and artifact quality
6. caching and replayability
7. premium-model polish

## Final Principle

`Make intelligence optional, but make reliability mandatory.`

That is the standard for architecture, features, reviews, and evaluation in this repository.
