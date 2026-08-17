# Workspace Rules

## Core Documentation Requirement
Always consult the `.core` folder in this workspace before planning or executing tasks.

1. Review `d:\MMbroliers\.core\ARCHITECTURE.md` to understand the folder structure and architectural design. Log any significant structural changes there (append-only).
2. Review `d:\MMbroliers\.core\DATA_MODELS.md` to understand the database operations and module models (append-only on changes).
3. Review `d:\MMbroliers\.core\RULES.md` for coding constraints and styling conventions.
4. Review `d:\MMbroliers\.core\ADMIN_PLAN.md` for phase/status of implementation.
5. Product brief: `d:\MMbroliers\Broiler_Wholesale_App_Proposal.md`.
6. Reference implementation for stack/structure: `D:\POS\Duro_POS` (do not modify unless asked).

## Product (current)
**Broiler Wholesale Management App** — multi-tenant, mobile-first wholesaler delivery + billing, patterned on Duro_POS.

| Layer | Planned path | Stack |
|-------|--------------|-------|
| API | `backend/` | FastAPI, SQLAlchemy async, PostgreSQL schema-per-tenant, Alembic, `uv` |
| App | `frontend/` | Expo 54, React Native, TypeScript, Zustand, NativeWind, BLE, thermal print |
| Edge | `caddy/` | TLS, rate limit, reverse proxy |
| Docs harness | `.core/` | Architecture, models, rules, session/chat/idea logs |

## 🚨 MANDATORY ACTION: SESSION HISTORY
**CRITICAL RULE: YOU MUST ALWAYS WITHOUT EXCEPTION update `d:\MMbroliers\.core\SESSION_HISTORY.md` BEFORE ending your turn.**
Every single action you take must be logged in the history file with the current timestamp, the user's request, and the action taken. Do NOT wait for the user to remind you. If you perform an action (like installing a plugin, modifying a file, or running a command), your final step MUST be to update the session history file.

## 🚨 MANDATORY ACTION: CHAT AND COMMAND LOGGING
**CRITICAL RULE: YOU MUST ALWAYS WITHOUT EXCEPTION log the chat conversation and the exact terminal commands you run into `d:\MMbroliers\.core\CHAT_LOG.md`.**
This ensures that the user can read the exact commands you ran and your technical reasoning in a human-readable file, providing complete transparency and a reference for future agent invocations.

## 🚨 MANDATORY ACTION: IDEA LOGGING
**CRITICAL RULE: YOU MUST ALWAYS WITHOUT EXCEPTION log every new idea, feature request, or conceptual thought the user shares into `d:\MMbroliers\.core\IDEA.md`.**
Do not just acknowledge ideas in chat; they must be persistently recorded in the chronological log in the IDEA file for future analysis. You must act as the scribe for the project's vision.

## 🚨 MANDATORY ACTION: DOCUMENTATION PRESERVATION
**CRITICAL RULE: NEVER OVERWRITE HISTORICAL DOCUMENTATION.**
When making architectural pivots or massive changes to the data models, do NOT overwrite `.core/ARCHITECTURE.md` or `.core/DATA_MODELS.md`. Instead, you MUST **APPEND** your new structures under a timestamped header (e.g. `### [2026-06-30 13:25:54] New Architecture`). The original, historical structures must remain intact above it so the project can be rewound to previous states if necessary.

## 🚨 MANDATORY ACTION: PACKAGE MANAGER
**CRITICAL RULE: USE BUN INSTEAD OF NPM OR NODE.**
Always use `bun` as the package manager and runtime for JS/TS tasks. Do not use `npm`, `npx` or `node` unless explicitly required by a tool that does not support bun.
