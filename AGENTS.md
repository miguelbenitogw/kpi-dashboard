<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:context-management -->
## Context window discipline

**Always use sub-agents** for tasks that would inflate the main context:
- Reading 4+ files to understand the codebase → delegate exploration
- Writing features that touch multiple files → delegate the whole thing
- Running scripts, builds, or tests → delegate
- Executing batched DB operations (e.g. 40+ SQL calls) → delegate
- Any task that produces large output (logs, SQL dumps, API responses)

The main agent coordinates. Sub-agents do the work and return concise summaries.
Never read large files inline when a sub-agent can do it and report back.
<!-- END:context-management -->
