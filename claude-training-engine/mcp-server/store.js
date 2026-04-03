import fs from "fs";
import path from "path";

// Data store: a single JSON file in the user's home directory
const STORE_DIR = path.join(
  process.env.HOME || process.env.USERPROFILE || "/tmp",
  ".claude-training"
);
const STORE_PATH = path.join(STORE_DIR, "data.json");

const DEFAULT_DATA = {
  courses: {},      // course_id -> { title, description, difficulty, duration, prerequisites, version, registered_at }
  enrollments: {},  // course_id -> { status, enrolled_at, last_active_at, completed_at }
  progress: {},     // course_id -> { concept_id -> { status, knowledge_check_passed, hints_used, completed_at } }
  exercises: {},    // course_id -> { exercise_id -> { status, attempts, last_attempt_at, passed } }
};

function ensureDir() {
  if (!fs.existsSync(STORE_DIR)) {
    fs.mkdirSync(STORE_DIR, { recursive: true });
  }
}

export function load() {
  ensureDir();
  if (!fs.existsSync(STORE_PATH)) {
    return JSON.parse(JSON.stringify(DEFAULT_DATA));
  }
  try {
    return JSON.parse(fs.readFileSync(STORE_PATH, "utf-8"));
  } catch {
    return JSON.parse(JSON.stringify(DEFAULT_DATA));
  }
}

export function save(data) {
  ensureDir();
  fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2), "utf-8");
}

export { STORE_DIR };
