/**
 * GitHub-based course registry.
 *
 * Scans the marketplace repo for course plugins under courses/,
 * parses SKILL.md frontmatter to build catalog metadata.
 * Installation is handled by `claude plugin install` (not by this module).
 *
 * Marketplace repo layout:
 *   claude-training-marketplace/
 *     .claude-plugin/marketplace.json
 *     claude-training-engine/          <- engine plugin
 *     courses/
 *       course-api-basics/             <- course plugin
 *         .claude-plugin/plugin.json
 *         skills/course-api-basics/
 *           SKILL.md
 *           references/curriculum.md
 */

// Configurable via env var; defaults to the marketplace repo
const COURSE_REPO =
  process.env.CLAUDE_COURSES_REPO || "shurrey/claude-training-marketplace";
const GITHUB_API = "https://api.github.com";
const GITHUB_RAW = "https://raw.githubusercontent.com";
const BRANCH = process.env.CLAUDE_COURSES_BRANCH || "main";
const MARKETPLACE_NAME = process.env.CLAUDE_MARKETPLACE_NAME || "claude-training-marketplace";

// Optional GitHub token for higher rate limits
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || null;

function headers() {
  const h = { Accept: "application/vnd.github.v3+json", "User-Agent": "claude-training-engine" };
  if (GITHUB_TOKEN) h.Authorization = `Bearer ${GITHUB_TOKEN}`;
  return h;
}

function rawHeaders() {
  const h = { "User-Agent": "claude-training-engine" };
  if (GITHUB_TOKEN) h.Authorization = `Bearer ${GITHUB_TOKEN}`;
  return h;
}

// ── Frontmatter parser ──

function parseFrontmatter(text) {
  const match = text.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const meta = {};
  let currentKey = null;
  let currentValue = "";

  for (const line of match[1].split("\n")) {
    if (/^\s+/.test(line) && currentKey) {
      currentValue += " " + line.trim();
      meta[currentKey] = currentValue;
      continue;
    }
    const kv = line.match(/^(\S[\w-]*)\s*:\s*(.*)$/);
    if (kv) {
      currentKey = kv[1];
      currentValue = kv[2].replace(/^["'>]\s*/, "").replace(/["']$/, "").trim();
      meta[currentKey] = currentValue;
    }
  }

  if (meta.prerequisites) {
    try {
      meta.prerequisites = JSON.parse(meta.prerequisites);
    } catch {
      meta.prerequisites = [];
    }
  }

  return meta;
}

// ── Discovery ──

/**
 * List available courses from the marketplace repo's courses/ directory.
 * Returns array of { course_id, plugin_name, title, description, difficulty, ... }
 */
export async function discoverCourses() {
  // List directories under courses/
  const res = await fetch(
    `${GITHUB_API}/repos/${COURSE_REPO}/contents/courses?ref=${BRANCH}`,
    { headers: headers() }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub API error (${res.status}): ${text}`);
  }

  const items = await res.json();
  const dirs = items.filter((i) => i.type === "dir");

  const courses = [];
  for (const dir of dirs) {
    try {
      // SKILL.md is now at courses/{name}/skills/{name}/SKILL.md
      const skillRes = await fetch(
        `${GITHUB_RAW}/${COURSE_REPO}/${BRANCH}/courses/${dir.name}/skills/${dir.name}/SKILL.md`,
        { headers: rawHeaders() }
      );
      if (!skillRes.ok) continue;

      const content = await skillRes.text();
      const meta = parseFrontmatter(content);
      if (meta.type !== "training-course") continue;

      courses.push({
        course_id: meta["course-id"] || dir.name,
        plugin_name: dir.name,
        title: meta.title || dir.name,
        description: meta.description || "",
        difficulty: meta.difficulty || "beginner",
        estimated_duration: meta["estimated-duration"] || "unknown",
        prerequisites: meta.prerequisites || [],
        version: meta.version || "1.0.0",
      });
    } catch {
      // Skip courses that fail to fetch
    }
  }

  return courses;
}

/**
 * Parse the registration directive from a course's SKILL.md on GitHub.
 * Returns the JSON object meant for the register_course tool, or null.
 */
export async function fetchRegistrationDirective(pluginName) {
  try {
    const res = await fetch(
      `${GITHUB_RAW}/${COURSE_REPO}/${BRANCH}/courses/${pluginName}/skills/${pluginName}/SKILL.md`,
      { headers: rawHeaders() }
    );
    if (!res.ok) return null;

    const content = await res.text();
    const match = content.match(/```json\s*\n(\{[\s\S]*?\})\s*\n```/);
    if (!match) return null;

    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

/**
 * Get the install command for a course plugin.
 */
export function getInstallCommand(pluginName) {
  return `claude plugin install ${pluginName}@${MARKETPLACE_NAME}`;
}

export { COURSE_REPO, MARKETPLACE_NAME };
