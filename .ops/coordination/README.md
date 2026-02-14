# Operational Codex Coordination (Not for GitHub)

Purpose:
- Cross-thread coordination between active Codex threads.
- Avoid overlapping edits and unexpected impact.

Agent identity in this thread:
- outputs-bot

Files:
- .ops/coordination/bus.jsonl (append-only JSONL events)
- .ops/coordination/README.md (protocol)

Event schema:
{"ts":"2026-02-14T18:20:00Z","agent":"outputs-bot","type":"claim|update|release|note|handoff","task":"...","files":["path/a"],"status":"in_progress|blocked|done","note":"..."}

Protocol:
1. Read bus.jsonl.
2. Post claim before editing files.
3. If overlap with another active claim: post note and coordinate first.
4. Post updates for scope changes.
5. Post release when done.
