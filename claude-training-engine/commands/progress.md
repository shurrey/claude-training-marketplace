---
description: View your progress across all enrolled courses or a specific course
argument-hint: "[course-id]"
---

# /progress

Show training progress.

## Behavior

1. Call `get_progress` from the training-engine MCP server to load progress data.
2. If a course-id is provided, call `show_progress` with that course_id to display the visual progress tracker, then also present:
   - Current concept in progress
   - Exercises completed and results
   - Knowledge checks passed
   - Hints used (for adaptive scaffolding context)
3. If no course-id, show a summary across all enrolled courses:
   - Each course with completion percentage
   - Most recently active course highlighted
   - Total concepts and exercises completed
