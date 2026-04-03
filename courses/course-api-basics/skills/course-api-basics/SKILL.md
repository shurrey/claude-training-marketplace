---
name: course-api-basics
description: >
  Training course: Your First API Call. Teaches the fundamentals of the Anthropic
  Messages API — request structure, roles, model selection, and token counting.
  This is a training-course skill used by the training-engine. Activates when a student
  is enrolled in or asks about API basics, making an API call, the Messages API,
  or "Your First API Call" course.
type: training-course
course-id: api-basics
title: "Your First API Call"
estimated-duration: "30-45 minutes"
prerequisites: []
difficulty: beginner
version: "1.0.0"
---

# Your First API Call

This course teaches students to understand and construct calls to the Anthropic Messages API. By the end, students will be able to build a complete API request from scratch, understand the role system, choose appropriate models, and interpret the response including token usage.

## Registration Directive

When this skill is first activated for a student, register it with the training-engine MCP server by calling `register_course` with:

```json
{
  "course_id": "api-basics",
  "title": "Your First API Call",
  "description": "Learn to construct and understand calls to the Anthropic Messages API. Covers request structure, the role system, model selection, and token counting.",
  "difficulty": "beginner",
  "estimated_duration": "30-45 minutes",
  "prerequisites": [],
  "version": "1.0.0",
  "concepts": [
    { "id": "api-structure", "title": "API Request Structure" },
    { "id": "roles", "title": "The Role System" },
    { "id": "model-selection", "title": "Choosing a Model" },
    { "id": "response-anatomy", "title": "Anatomy of a Response" },
    { "id": "tokens", "title": "Understanding Tokens" }
  ],
  "exercises": [
    { "id": "ex-build-request", "title": "Build Your First Request", "linked_concepts": ["api-structure", "roles"] },
    { "id": "ex-model-choice", "title": "Pick the Right Model", "linked_concepts": ["model-selection"] },
    { "id": "ex-capstone", "title": "Capstone: Complete API Interaction", "linked_concepts": ["api-structure", "roles", "model-selection", "response-anatomy", "tokens"] }
  ]
}
```

Then call `enroll` with `course_id: "api-basics"` to enroll the student.

## Curriculum

The full curriculum with teaching notes, exercises, and knowledge checks is in [references/curriculum.md](references/curriculum.md).
