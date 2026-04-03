import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { readFileSync, existsSync } from "fs";
import { writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { load, save, STORE_DIR } from "./store.js";
import {
  discoverCourses,
  fetchRegistrationDirective,
  getInstallCommand,
} from "./github.js";
import { execSync } from "child_process";
import {
  registerAppTool,
  registerAppResource,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";

// ── Course catalog cache ──
// Refreshed from GitHub on each list_courses / show_catalog call.
// Maps course_id -> { ...github metadata, folder }
let _catalogCache = null;
let _catalogFetchedAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function getCatalog() {
  const now = Date.now();
  if (_catalogCache && now - _catalogFetchedAt < CACHE_TTL_MS) return _catalogCache;
  try {
    const courses = await discoverCourses();
    _catalogCache = {};
    for (const c of courses) _catalogCache[c.course_id] = c;
    _catalogFetchedAt = now;
  } catch (err) {
    // If GitHub is unreachable, fall back to whatever is in the local store
    if (!_catalogCache) _catalogCache = {};
    console.error("GitHub discovery failed:", err.message);
  }
  return _catalogCache;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.join(__dirname, "apps", "dist");

// ── Helpers ──

const API_KEY_PATH = path.join(STORE_DIR, "api_key");

function loadApiKey() {
  try {
    if (existsSync(API_KEY_PATH)) return readFileSync(API_KEY_PATH, "utf-8").trim();
  } catch {}
  return null;
}

function saveApiKey(key) {
  writeFileSync(API_KEY_PATH, key, "utf-8");
}

function loadAppHtml(name) {
  const p = path.join(DIST_DIR, `${name}.html`);
  if (existsSync(p)) return readFileSync(p, "utf-8");
  return `<html><body>App "${name}" not built yet. Run: node apps/build.js</body></html>`;
}

// ── Server ──

const server = new McpServer({
  name: "claude-training-engine",
  version: "0.1.0",
});

// ════════════════════════════════════════════
//  MCP App Resources
// ════════════════════════════════════════════

registerAppResource(
  server,
  "Course Catalog",
  "ui://training/course-catalog.html",
  { description: "Browse and enroll in training courses" },
  async () => ({
    contents: [{
      uri: "ui://training/course-catalog.html",
      mimeType: RESOURCE_MIME_TYPE,
      text: loadAppHtml("course-catalog"),
    }],
  })
);

registerAppResource(
  server,
  "Progress Tracker",
  "ui://training/progress.html",
  { description: "Visual progress indicator for the current course" },
  async () => ({
    contents: [{
      uri: "ui://training/progress.html",
      mimeType: RESOURCE_MIME_TYPE,
      text: loadAppHtml("progress"),
    }],
  })
);

registerAppResource(
  server,
  "API Playground",
  "ui://training/code-editor.html",
  {
    description: "Write and execute live API calls against the Anthropic Messages API",
    _meta: {
      ui: {
        csp: {
          connectDomains: ["https://api.anthropic.com"],
        },
      },
    },
  },
  async () => ({
    contents: [{
      uri: "ui://training/code-editor.html",
      mimeType: RESOURCE_MIME_TYPE,
      text: loadAppHtml("code-editor"),
    }],
  })
);

registerAppResource(
  server,
  "API Key Setup",
  "ui://training/api-key-setup.html",
  { description: "Configure your Anthropic API key for live exercises" },
  async () => ({
    contents: [{
      uri: "ui://training/api-key-setup.html",
      mimeType: RESOURCE_MIME_TYPE,
      text: loadAppHtml("api-key-setup"),
    }],
  })
);

// ════════════════════════════════════════════
//  MCP App Tools (model-visible, open UI)
// ════════════════════════════════════════════

registerAppTool(
  server,
  "show_catalog",
  {
    title: "Show Course Catalog",
    description: "Display the interactive course catalog for browsing and enrollment",
    _meta: { ui: { resourceUri: "ui://training/course-catalog.html" } },
  },
  async () => {
    const catalog = await getCatalog();
    const data = load();

    const courses = Object.values(catalog).map((course) => {
      const id = course.course_id;
      const enrollment = data.enrollments[id];
      const progress = data.progress[id] || {};
      const totalConcepts = Object.keys(progress).length;
      const completedConcepts = Object.values(progress).filter(p => p.status === "completed").length;
      return {
        ...course,
        enrollment_status: enrollment ? enrollment.status : "available",
        progress: totalConcepts > 0
          ? { completed: completedConcepts, total: totalConcepts, percentage: Math.round((completedConcepts / totalConcepts) * 100) }
          : null,
      };
    });
    return { content: [{ type: "text", text: JSON.stringify(courses) }] };
  }
);

registerAppTool(
  server,
  "show_progress",
  {
    title: "Show Progress",
    description: "Display the visual progress tracker for the current course",
    inputSchema: { course_id: z.string().describe("Course ID to show progress for") },
    _meta: { ui: { resourceUri: "ui://training/progress.html" } },
  },
  async ({ course_id }) => {
    const data = load();
    const course = data.courses[course_id];
    if (!course) {
      return { content: [{ type: "text", text: JSON.stringify({ error: "Course not found" }) }], isError: true };
    }
    const progress = data.progress[course_id] || {};
    const concepts = Object.entries(progress).map(([id, p]) => ({ concept_id: id, ...p }));
    const completed = concepts.filter(c => c.status === "completed").length;
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          course_id,
          title: course.title,
          concepts_completed: completed,
          concepts_total: concepts.length,
          percentage: concepts.length ? Math.round((completed / concepts.length) * 100) : 0,
          concepts,
        }),
      }],
    };
  }
);

registerAppTool(
  server,
  "show_code_editor",
  {
    title: "Open API Playground",
    description: "Open the code editor for writing and executing live Anthropic API calls",
    _meta: { ui: { resourceUri: "ui://training/code-editor.html" } },
  },
  async () => {
    const hasKey = !!loadApiKey();
    return {
      content: [{
        type: "text",
        text: JSON.stringify({ api_key_configured: hasKey }),
      }],
    };
  }
);

registerAppTool(
  server,
  "show_api_key_setup",
  {
    title: "API Key Setup",
    description: "Open the API key configuration panel",
    _meta: { ui: { resourceUri: "ui://training/api-key-setup.html" } },
  },
  async () => {
    const hasKey = !!loadApiKey();
    return {
      content: [{
        type: "text",
        text: JSON.stringify({ configured: hasKey }),
      }],
    };
  }
);

// ════════════════════════════════════════════
//  API Key Management Tools
// ════════════════════════════════════════════

server.tool(
  "configure_api_key",
  "Validate and store an Anthropic API key for live API exercises",
  {
    api_key: z.string().describe("Anthropic API key (starts with sk-ant-)"),
  },
  async ({ api_key }) => {
    if (!api_key.startsWith("sk-ant-")) {
      return {
        content: [{ type: "text", text: "Error: Invalid key format. Anthropic API keys start with 'sk-ant-'." }],
        isError: true,
      };
    }

    // Validate by making a lightweight call
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": api_key,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1,
          messages: [{ role: "user", content: "hi" }],
        }),
      });

      if (res.status === 401) {
        return {
          content: [{ type: "text", text: "Error: API key is invalid or expired." }],
          isError: true,
        };
      }

      // Any non-401 means the key is recognized (even 400/429 are valid key responses)
      saveApiKey(api_key);
      return {
        content: [{ type: "text", text: "API key validated and saved. You're ready to make live API calls!" }],
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Error: Could not validate key — ${err.message}` }],
        isError: true,
      };
    }
  }
);

server.tool(
  "execute_api_call",
  "Execute a student's API request against the Anthropic Messages API and return the response",
  {
    request_body: z.string().describe("JSON string of the request body to send to /v1/messages"),
  },
  async ({ request_body }) => {
    const apiKey = loadApiKey();
    if (!apiKey) {
      return {
        content: [{ type: "text", text: "Error: No API key configured. Use the API Key Setup first." }],
        isError: true,
      };
    }

    let body;
    try {
      body = JSON.parse(request_body);
    } catch (err) {
      return {
        content: [{ type: "text", text: `Error: Invalid JSON — ${err.message}` }],
        isError: true,
      };
    }

    // Safety: enforce max_tokens ceiling for training
    if (!body.max_tokens || body.max_tokens > 1024) {
      body.max_tokens = 1024;
    }

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const responseText = await res.text();
      return {
        content: [{ type: "text", text: responseText }],
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Error: Request failed — ${err.message}` }],
        isError: true,
      };
    }
  }
);

// ════════════════════════════════════════════
//  Core Training Engine Tools
// ════════════════════════════════════════════

server.tool(
  "list_courses",
  "List all available courses from the course registry and their enrollment status",
  {},
  async () => {
    const catalog = await getCatalog();
    const data = load();

    const courses = Object.values(catalog).map((course) => {
      const id = course.course_id;
      const enrollment = data.enrollments[id];
      const progress = data.progress[id] || {};
      const totalConcepts = Object.keys(progress).length;
      const completedConcepts = Object.values(progress).filter(p => p.status === "completed").length;
      return {
        ...course,
        enrollment_status: enrollment ? enrollment.status : "available",
        progress: totalConcepts > 0
          ? { completed: completedConcepts, total: totalConcepts, percentage: Math.round((completedConcepts / totalConcepts) * 100) }
          : null,
      };
    });
    return { content: [{ type: "text", text: JSON.stringify(courses, null, 2) }] };
  }
);

server.tool(
  "register_course",
  "Register a new course in the catalog (called when a course skill is installed)",
  {
    course_id: z.string().describe("Unique course identifier"),
    title: z.string().describe("Human-readable course title"),
    description: z.string().describe("Course description"),
    difficulty: z.enum(["beginner", "intermediate", "advanced"]).describe("Course difficulty level"),
    estimated_duration: z.string().describe('Estimated completion time (e.g., "30-45 minutes")'),
    prerequisites: z.array(z.string()).default([]).describe("List of prerequisite course IDs"),
    version: z.string().default("1.0.0").describe("Curriculum version"),
    concepts: z.array(z.object({ id: z.string(), title: z.string() })).describe("Concept IDs and titles"),
    exercises: z.array(z.object({ id: z.string(), title: z.string(), linked_concepts: z.array(z.string()) })).default([]).describe("Exercise IDs"),
  },
  async (params) => {
    const data = load();
    data.courses[params.course_id] = {
      title: params.title,
      description: params.description,
      difficulty: params.difficulty,
      estimated_duration: params.estimated_duration,
      prerequisites: params.prerequisites,
      version: params.version,
      registered_at: new Date().toISOString(),
    };

    data.progress[params.course_id] = {};
    for (const concept of params.concepts) {
      data.progress[params.course_id][concept.id] = {
        title: concept.title,
        status: "not_started",
        knowledge_check_passed: false,
        hints_used: 0,
        completed_at: null,
      };
    }

    data.exercises[params.course_id] = {};
    for (const exercise of params.exercises) {
      data.exercises[params.course_id][exercise.id] = {
        title: exercise.title,
        linked_concepts: exercise.linked_concepts,
        status: "not_started",
        attempts: 0,
        last_attempt_at: null,
        passed: false,
      };
    }

    save(data);
    return {
      content: [{ type: "text", text: `Course "${params.title}" registered with ${params.concepts.length} concepts and ${params.exercises.length} exercises.` }],
    };
  }
);

server.tool(
  "enroll",
  "Enroll the student in a course: installs the course plugin and records enrollment",
  { course_id: z.string().describe("Course to enroll in") },
  async ({ course_id }) => {
    // 1. Find the course in the catalog
    const catalog = await getCatalog();
    const courseMeta = catalog[course_id];
    if (!courseMeta) {
      return { content: [{ type: "text", text: `Error: Course "${course_id}" not found in the course registry.` }], isError: true };
    }

    // 2. Install the course plugin via claude CLI
    const installCmd = getInstallCommand(courseMeta.plugin_name);
    try {
      execSync(installCmd, { timeout: 30000, stdio: "pipe" });
    } catch (err) {
      const stderr = err.stderr ? err.stderr.toString() : err.message;
      // If already installed, that's fine — continue
      if (!stderr.includes("already installed")) {
        return {
          content: [{
            type: "text",
            text: `Error: Could not install course plugin. Run manually: ${installCmd}\n\nDetails: ${stderr}`,
          }],
          isError: true,
        };
      }
    }

    // 3. Fetch the registration directive from GitHub and register the course
    const data = load();
    if (!data.courses[course_id]) {
      const regDirective = await fetchRegistrationDirective(courseMeta.plugin_name);
      if (regDirective) {
        data.courses[course_id] = {
          title: regDirective.title || courseMeta.title,
          description: regDirective.description || courseMeta.description,
          difficulty: regDirective.difficulty || courseMeta.difficulty,
          estimated_duration: regDirective.estimated_duration || courseMeta.estimated_duration,
          prerequisites: regDirective.prerequisites || courseMeta.prerequisites || [],
          version: regDirective.version || courseMeta.version || "1.0.0",
          registered_at: new Date().toISOString(),
        };

        data.progress[course_id] = {};
        if (regDirective.concepts) {
          for (const concept of regDirective.concepts) {
            data.progress[course_id][concept.id] = {
              title: concept.title,
              status: "not_started",
              knowledge_check_passed: false,
              hints_used: 0,
              completed_at: null,
            };
          }
        }

        data.exercises[course_id] = {};
        if (regDirective.exercises) {
          for (const exercise of regDirective.exercises) {
            data.exercises[course_id][exercise.id] = {
              title: exercise.title,
              linked_concepts: exercise.linked_concepts || [],
              status: "not_started",
              attempts: 0,
              last_attempt_at: null,
              passed: false,
            };
          }
        }
      } else {
        data.courses[course_id] = {
          title: courseMeta.title,
          description: courseMeta.description,
          difficulty: courseMeta.difficulty,
          estimated_duration: courseMeta.estimated_duration,
          prerequisites: courseMeta.prerequisites || [],
          version: courseMeta.version || "1.0.0",
          registered_at: new Date().toISOString(),
        };
        data.progress[course_id] = {};
        data.exercises[course_id] = {};
      }
    }

    // 4. Record enrollment
    data.enrollments[course_id] = {
      status: "enrolled",
      enrolled_at: new Date().toISOString(),
      last_active_at: new Date().toISOString(),
      completed_at: null,
    };

    save(data);
    const title = data.courses[course_id].title;
    return {
      content: [{
        type: "text",
        text: `Course "${title}" plugin installed and enrolled. The course skill is now available. Ready to begin learning!`,
      }],
    };
  }
);

server.tool(
  "get_progress",
  "Get detailed progress for a specific course or all enrolled courses",
  { course_id: z.string().optional().describe("Specific course ID, or omit for all courses") },
  async ({ course_id }) => {
    const data = load();
    if (course_id) {
      const course = data.courses[course_id];
      const enrollment = data.enrollments[course_id];
      const progress = data.progress[course_id] || {};
      const exercises = data.exercises[course_id] || {};
      if (!course) {
        return { content: [{ type: "text", text: `Error: Course "${course_id}" not found.` }], isError: true };
      }
      const concepts = Object.entries(progress).map(([id, p]) => ({ concept_id: id, ...p }));
      const exerciseList = Object.entries(exercises).map(([id, e]) => ({ exercise_id: id, ...e }));
      const completed = concepts.filter(c => c.status === "completed").length;
      const currentConcept = concepts.find(c => c.status === "in_progress");
      const nextConcept = !currentConcept ? concepts.find(c => c.status === "not_started") : null;
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            course_id,
            title: course.title,
            enrollment: enrollment || { status: "not_enrolled" },
            concepts_completed: completed,
            concepts_total: concepts.length,
            percentage: concepts.length ? Math.round((completed / concepts.length) * 100) : 0,
            current_concept: currentConcept || nextConcept || null,
            concepts,
            exercises: exerciseList,
          }, null, 2),
        }],
      };
    }
    // All enrolled courses summary
    const summary = Object.entries(data.enrollments).map(([cid, enrollment]) => {
      const course = data.courses[cid] || {};
      const progress = data.progress[cid] || {};
      const concepts = Object.values(progress);
      const completed = concepts.filter(c => c.status === "completed").length;
      return {
        course_id: cid,
        title: course.title,
        status: enrollment.status,
        last_active_at: enrollment.last_active_at,
        completed: completed,
        total: concepts.length,
        percentage: concepts.length ? Math.round((completed / concepts.length) * 100) : 0,
      };
    });
    return { content: [{ type: "text", text: JSON.stringify(summary, null, 2) }] };
  }
);

server.tool(
  "update_concept_status",
  "Update the status of a concept within a course",
  {
    course_id: z.string().describe("Course ID"),
    concept_id: z.string().describe("Concept ID"),
    status: z.enum(["not_started", "in_progress", "completed"]).describe("New status"),
    knowledge_check_passed: z.boolean().optional().describe("Whether the knowledge check was passed"),
  },
  async ({ course_id, concept_id, status, knowledge_check_passed }) => {
    const data = load();
    if (!data.progress[course_id]?.[concept_id]) {
      return { content: [{ type: "text", text: `Error: Concept "${concept_id}" not found in course "${course_id}".` }], isError: true };
    }
    data.progress[course_id][concept_id].status = status;
    if (status === "completed") data.progress[course_id][concept_id].completed_at = new Date().toISOString();
    if (knowledge_check_passed !== undefined) data.progress[course_id][concept_id].knowledge_check_passed = knowledge_check_passed;

    if (data.enrollments[course_id]) {
      data.enrollments[course_id].last_active_at = new Date().toISOString();
      if (status === "in_progress") data.enrollments[course_id].status = "in_progress";
      const allCompleted = Object.values(data.progress[course_id]).every(c => c.status === "completed");
      if (allCompleted) {
        data.enrollments[course_id].status = "completed";
        data.enrollments[course_id].completed_at = new Date().toISOString();
      }
    }
    save(data);
    return {
      content: [{ type: "text", text: `Concept "${concept_id}" updated to "${status}"${knowledge_check_passed ? " (knowledge check passed)" : ""}.` }],
    };
  }
);

server.tool(
  "record_hint",
  "Record that a hint was given for a concept (for adaptive scaffolding)",
  { course_id: z.string().describe("Course ID"), concept_id: z.string().describe("Concept ID") },
  async ({ course_id, concept_id }) => {
    const data = load();
    if (!data.progress[course_id]?.[concept_id]) {
      return { content: [{ type: "text", text: "Error: Concept not found." }], isError: true };
    }
    data.progress[course_id][concept_id].hints_used += 1;
    save(data);
    return { content: [{ type: "text", text: `Hint recorded for "${concept_id}". Total hints used: ${data.progress[course_id][concept_id].hints_used}.` }] };
  }
);

server.tool(
  "submit_exercise",
  "Record an exercise attempt and whether it passed",
  {
    course_id: z.string().describe("Course ID"),
    exercise_id: z.string().describe("Exercise ID"),
    passed: z.boolean().describe("Whether the attempt passed validation"),
    notes: z.string().optional().describe("Brief notes on the attempt"),
  },
  async ({ course_id, exercise_id, passed, notes }) => {
    const data = load();
    if (!data.exercises[course_id]?.[exercise_id]) {
      return { content: [{ type: "text", text: "Error: Exercise not found." }], isError: true };
    }
    const exercise = data.exercises[course_id][exercise_id];
    exercise.attempts += 1;
    exercise.last_attempt_at = new Date().toISOString();
    exercise.status = passed ? "completed" : "in_progress";
    if (passed) exercise.passed = true;
    if (data.enrollments[course_id]) data.enrollments[course_id].last_active_at = new Date().toISOString();
    save(data);
    return {
      content: [{
        type: "text",
        text: passed
          ? `Exercise "${exercise_id}" passed on attempt ${exercise.attempts}!`
          : `Exercise "${exercise_id}" attempt ${exercise.attempts} recorded. Keep trying!`,
      }],
    };
  }
);

server.tool(
  "reset_course",
  "Reset all progress for a course (start over)",
  { course_id: z.string().describe("Course ID to reset") },
  async ({ course_id }) => {
    const data = load();
    if (!data.courses[course_id]) {
      return { content: [{ type: "text", text: "Error: Course not found." }], isError: true };
    }
    if (data.progress[course_id]) {
      for (const concept of Object.values(data.progress[course_id])) {
        concept.status = "not_started";
        concept.knowledge_check_passed = false;
        concept.hints_used = 0;
        concept.completed_at = null;
      }
    }
    if (data.exercises[course_id]) {
      for (const exercise of Object.values(data.exercises[course_id])) {
        exercise.status = "not_started";
        exercise.attempts = 0;
        exercise.last_attempt_at = null;
        exercise.passed = false;
      }
    }
    if (data.enrollments[course_id]) {
      data.enrollments[course_id].status = "enrolled";
      data.enrollments[course_id].completed_at = null;
      data.enrollments[course_id].last_active_at = new Date().toISOString();
    }
    save(data);
    return { content: [{ type: "text", text: `Course "${data.courses[course_id].title}" progress has been reset.` }] };
  }
);

// ── Start server ──
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Server failed to start:", err);
  process.exit(1);
});
