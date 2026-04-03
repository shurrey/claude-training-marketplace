---
description: Resume your most recent training course where you left off
argument-hint: "[course-id]"
---

# /resume

Pick up where you left off in a training course.

## Behavior

1. Call `get_progress` from the training-engine MCP server to find the most recently active course (or use the provided course-id).
2. Load the course skill for that course.
3. Determine the current concept and any in-progress exercise from the progress data.
4. Provide a brief "welcome back" summary: what was covered last, where the student is now, and what's next.
5. If the student was last active more than 24 hours ago, offer a quick review of the most recently completed concept before advancing.
6. Begin teaching from the current position using the Socratic engine.
