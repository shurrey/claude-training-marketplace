---
description: Open the course catalog to browse and enroll in training courses
argument-hint: "[course-id]"
---

# /train

Open the training course catalog. Browse available courses, check your progress, and enroll in new courses.

## Behavior

1. Call `show_catalog` to display the interactive course catalog MCP App.
2. If a course-id argument is provided, check if the student is enrolled:
   - If enrolled: call `get_progress` and `show_progress` to resume the course where they left off.
   - If not enrolled: show the course details and offer to register.
3. If no argument is provided, the catalog app handles browsing, enrollment, and resuming visually.
4. After registration (triggered by the student clicking Register in the catalog), begin the course by loading the course skill and starting the first concept.
