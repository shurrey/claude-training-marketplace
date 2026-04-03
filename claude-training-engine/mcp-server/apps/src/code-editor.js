import { App } from "@modelcontextprotocol/ext-apps";

const app = new App({ name: "API Playground", version: "1.0.0" });

const codeInput = document.getElementById("code-input");
const runBtn = document.getElementById("run-btn");
const templateBtn = document.getElementById("template-btn");
const clearBtn = document.getElementById("clear-btn");
const statusEl = document.getElementById("status");
const responseArea = document.getElementById("response-area");
const responseBody = document.getElementById("response-body");
const responseMeta = document.getElementById("response-meta");
const noKeyWarning = document.getElementById("no-key-warning");

const TEMPLATE = JSON.stringify(
  {
    model: "claude-sonnet-4-20250514",
    max_tokens: 256,
    messages: [{ role: "user", content: "Say hello and tell me one fun fact." }],
  },
  null,
  2
);

function setStatus(state, msg) {
  statusEl.className = `status-indicator ${state}`;
  statusEl.textContent = msg;
}

// Tab support in textarea
codeInput.addEventListener("keydown", (e) => {
  if (e.key === "Tab") {
    e.preventDefault();
    const start = codeInput.selectionStart;
    const end = codeInput.selectionEnd;
    codeInput.value =
      codeInput.value.substring(0, start) + "  " + codeInput.value.substring(end);
    codeInput.selectionStart = codeInput.selectionEnd = start + 2;
  }
});

templateBtn.addEventListener("click", () => {
  codeInput.value = TEMPLATE;
  responseArea.classList.remove("show");
  setStatus("", "");
});

clearBtn.addEventListener("click", () => {
  codeInput.value = "";
  responseArea.classList.remove("show");
  setStatus("", "");
});

runBtn.addEventListener("click", async () => {
  const raw = codeInput.value.trim();
  if (!raw) {
    setStatus("error", "Enter a request body first");
    return;
  }

  // Validate JSON
  let body;
  try {
    body = JSON.parse(raw);
  } catch (err) {
    setStatus("error", `Invalid JSON: ${err.message}`);
    return;
  }

  setStatus("running", "Sending...");
  runBtn.disabled = true;

  const startTime = Date.now();
  try {
    const result = await app.callServerTool({
      name: "execute_api_call",
      arguments: { request_body: raw },
    });

    const elapsed = Date.now() - startTime;
    const text = result.content?.find((c) => c.type === "text")?.text || "";

    if (result.isError || text.toLowerCase().startsWith("error")) {
      setStatus("error", `Failed (${elapsed}ms)`);
      responseBody.className = "response-body error-body";
      responseBody.textContent = text;
    } else {
      setStatus("success", `OK (${elapsed}ms)`);
      responseBody.className = "response-body";
      // Try to pretty-print the response
      try {
        responseBody.textContent = JSON.stringify(JSON.parse(text), null, 2);
      } catch {
        responseBody.textContent = text;
      }
    }

    responseMeta.textContent = `${elapsed}ms`;
    responseArea.classList.add("show");

    // Also send to the conversation so the engine can validate
    await app.sendMessage({
      role: "user",
      content: [
        {
          type: "text",
          text: `Here's my API request and the response I received:\n\n**Request:**\n\`\`\`json\n${raw}\n\`\`\`\n\n**Response:**\n\`\`\`json\n${text}\n\`\`\`\n\nPlease evaluate my work.`,
        },
      ],
    });
  } catch (err) {
    const elapsed = Date.now() - startTime;
    setStatus("error", `Error (${elapsed}ms)`);
    responseBody.className = "response-body error-body";
    responseBody.textContent = err.message;
    responseArea.classList.add("show");
    responseMeta.textContent = `${elapsed}ms`;
  } finally {
    runBtn.disabled = false;
  }
});

// Listen for tool results (e.g., key status check)
app.ontoolresult = (result) => {
  const text = result.content?.find((c) => c.type === "text")?.text;
  if (text) {
    try {
      const data = JSON.parse(text);
      if (data.api_key_configured === false) {
        noKeyWarning.classList.add("show");
      } else {
        noKeyWarning.classList.remove("show");
      }
    } catch {}
  }
};

app.connect();
