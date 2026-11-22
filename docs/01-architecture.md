# Step 1 (v2): Requirements and architecture

## Actors
Visitor (anonymous), Member (signed in, traceable), Owner (you), Agent (one per project).

## Requirements
Functional: host many projects; per-project open/sign-in; record every use; owner sees usage; usage drives actions on projects; agents continuously improve each project.
Non-functional: cheap, easy to extend, isolated, private, auditable, safe (agents cannot break live projects or overspend).

## Why v1 was weak
1 single process; 2 agents edit live code; 3 no project contract; 4 "take action" not designed; 5 usage = hit count only; 6 no abuse/cost control; 7 agents not observable.

## Architecture: five planes
- Data plane: edge gateway (auth, rate limit, event emit) -> project runtime
- Telemetry: event pipeline -> event store (SQLite) -> rollups (daily users, sessions, retention)
- Control plane: project registry (manifest + lifecycle) -> policy engine -> actions
- Agent plane: orchestrator -> sandboxed agent per project -> branch + preview -> review gate -> deploy -> rollback
- Observability: agent run ledger (changes, cost, outcome)

## Project lifecycle
idea -> live -> growing -> stale -> archived. Policy engine proposes transitions from usage rules.

## Decisions
- Planes are separate so agent failures cannot take down serving.
- Agents never edit live code; change flows branch -> preview -> review -> deploy -> rollback.
- All writes go through one record(event) function so storage can be swapped.
- Every agent has a cost cap, run limit and kill switch.

## Build order
1 manifest + lifecycle; 2 event store + rollups; 3 agent safety path; 4 policy engine.
