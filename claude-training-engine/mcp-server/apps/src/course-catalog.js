import { App } from "@modelcontextprotocol/ext-apps";

const app = new App({ name: "Course Catalog", version: "1.0.0" });
const coursesEl = document.getElementById("courses");

function renderCourses(courses) {
  if (!courses.length) {
    coursesEl.innerHTML = `<div class="empty-state">No courses available yet. Check back soon!</div>`;
    return;
  }

  coursesEl.innerHTML = courses.map((c) => {
    const status = c.enrollment_status;
    const cardClass = status === "completed" ? "completed" : status !== "available" ? "enrolled" : "";
    const progress = c.progress;
    const pct = progress ? progress.percentage : 0;

    let badge = "";
    if (status === "completed") {
      badge = `<span class="badge badge-completed">Completed</span>`;
    } else if (status !== "available") {
      badge = `<span class="badge badge-enrolled">Enrolled</span>`;
    } else {
      const diffClass = `badge-${c.difficulty}`;
      badge = `<span class="badge ${diffClass}">${c.difficulty}</span>`;
    }

    let progressHtml = "";
    if (status !== "available" && progress) {
      progressHtml = `
        <div class="progress-bar">
          <div class="progress-fill ${pct === 100 ? "complete" : ""}" style="width:${pct}%"></div>
        </div>
        <div class="progress-text">${progress.completed} of ${progress.total} concepts completed</div>
      `;
    }

    let actions = "";
    if (status === "available") {
      actions = `<button class="btn-enroll" data-action="enroll" data-id="${c.course_id}">Register</button>`;
    } else if (status === "completed") {
      actions = `<button class="btn-review" data-action="review" data-id="${c.course_id}">Review</button>`;
    } else {
      actions = `<button class="btn-resume" data-action="resume" data-id="${c.course_id}">Continue Learning</button>`;
    }

    const prereqs = c.prerequisites?.length
      ? `<span class="meta-item">Prerequisites: ${c.prerequisites.join(", ")}</span>`
      : "";

    return `
      <div class="course-card ${cardClass}">
        <div class="card-header">
          <span class="card-title">${c.title}</span>
          ${badge}
        </div>
        <div class="card-desc">${c.description}</div>
        <div class="card-meta">
          <span class="meta-item">${c.estimated_duration}</span>
          ${prereqs}
        </div>
        ${progressHtml}
        <div class="card-actions">${actions}</div>
      </div>
    `;
  }).join("");
}

// Handle button clicks via delegation
coursesEl.addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;

  const action = btn.dataset.action;
  const courseId = btn.dataset.id;

  if (action === "enroll") {
    btn.disabled = true;
    btn.textContent = "Enrolling...";
    try {
      await app.callServerTool({ name: "enroll", arguments: { course_id: courseId } });
      // Send a message to the conversation so the engine can start teaching
      await app.sendMessage({
        role: "user",
        content: [{ type: "text", text: `I just enrolled in course "${courseId}". Let's begin!` }],
      });
    } catch (err) {
      btn.disabled = false;
      btn.textContent = "Register";
    }
  } else if (action === "resume" || action === "review") {
    await app.sendMessage({
      role: "user",
      content: [{ type: "text", text: `I'd like to ${action} course "${courseId}".` }],
    });
  }
});

// Load courses when tool result arrives
app.ontoolresult = (result) => {
  const text = result.content?.find((c) => c.type === "text")?.text;
  if (text) {
    try {
      renderCourses(JSON.parse(text));
    } catch {}
  }
};

// Also load on init by calling list_courses
app.connect().then(async () => {
  try {
    const result = await app.callServerTool({ name: "list_courses", arguments: {} });
    const text = result.content?.find((c) => c.type === "text")?.text;
    if (text) renderCourses(JSON.parse(text));
  } catch (err) {
    coursesEl.innerHTML = `<div class="empty-state">Failed to load courses: ${err.message}</div>`;
  }
});
