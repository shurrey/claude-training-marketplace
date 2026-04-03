import { App } from "@modelcontextprotocol/ext-apps";

const app = new App({ name: "Progress", version: "1.0.0" });

const ringFill = document.getElementById("ring-fill");
const pctText = document.getElementById("pct-text");
const courseTitle = document.getElementById("course-title");
const detailEl = document.getElementById("detail");
const conceptsEl = document.getElementById("concepts");
const milestoneEl = document.getElementById("milestone");

const CIRCUMFERENCE = 2 * Math.PI * 24; // r=24

function render(data) {
  const pct = data.percentage || 0;
  const offset = CIRCUMFERENCE - (pct / 100) * CIRCUMFERENCE;

  ringFill.style.strokeDasharray = CIRCUMFERENCE;
  ringFill.style.strokeDashoffset = offset;
  if (pct === 100) ringFill.classList.add("complete");
  else ringFill.classList.remove("complete");

  pctText.textContent = `${pct}%`;
  courseTitle.textContent = data.title || "Course Progress";
  detailEl.textContent = `${data.concepts_completed} of ${data.concepts_total} concepts completed`;

  // Render concept dots
  if (data.concepts && data.concepts.length) {
    conceptsEl.innerHTML = data.concepts
      .map((c, i) => {
        const status = c.status || "not_started";
        const label = i + 1;
        const tooltip = c.title || c.concept_id;
        return `<div class="concept-dot ${status}" title="${tooltip}">${label}</div>`;
      })
      .join("");
  }

  // Milestone message
  if (pct === 100) {
    milestoneEl.textContent = "Course complete! Great work.";
    milestoneEl.classList.add("show");
  } else if (pct >= 75) {
    milestoneEl.textContent = "Almost there — just a few concepts left!";
    milestoneEl.classList.add("show");
  } else if (pct >= 50) {
    milestoneEl.textContent = "Halfway through — keep going!";
    milestoneEl.classList.add("show");
  } else {
    milestoneEl.classList.remove("show");
  }
}

// Receive data pushed from the server via tool results
app.ontoolresult = (result) => {
  const text = result.content?.find((c) => c.type === "text")?.text;
  if (text) {
    try {
      render(JSON.parse(text));
    } catch {}
  }
};

app.connect();
