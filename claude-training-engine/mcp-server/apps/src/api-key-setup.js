import { App } from "@modelcontextprotocol/ext-apps";

const app = new App({ name: "API Key Setup", version: "1.0.0" });

const keyInput = document.getElementById("api-key");
const saveBtn = document.getElementById("save-btn");
const statusEl = document.getElementById("status");
const configuredEl = document.getElementById("configured");
const setupForm = document.getElementById("setup-form");
const consoleLink = document.getElementById("console-link");

function setStatus(type, message) {
  statusEl.className = `status ${type}`;
  statusEl.textContent = message;
}

// Check if key is already configured
app.ontoolresult = (result) => {
  const text = result.content?.find((c) => c.type === "text")?.text;
  if (text) {
    try {
      const data = JSON.parse(text);
      if (data.configured) {
        configuredEl.style.display = "block";
        setupForm.style.display = "none";
        setStatus("success", "Ready to make live API calls!");
      }
    } catch {}
  }
};

saveBtn.addEventListener("click", async () => {
  const key = keyInput.value.trim();
  if (!key) {
    setStatus("error", "Please enter an API key.");
    return;
  }
  if (!key.startsWith("sk-ant-")) {
    setStatus("error", "API keys start with 'sk-ant-'. Please check your key.");
    return;
  }

  setStatus("loading", "Validating your API key...");
  saveBtn.disabled = true;

  try {
    const result = await app.callServerTool({
      name: "configure_api_key",
      arguments: { api_key: key },
    });
    const text = result.content?.find((c) => c.type === "text")?.text || "";

    if (result.isError || text.toLowerCase().includes("error")) {
      setStatus("error", text);
    } else {
      setStatus("success", text);
      configuredEl.style.display = "block";
      setupForm.style.display = "none";
    }
  } catch (err) {
    setStatus("error", `Validation failed: ${err.message}`);
  } finally {
    saveBtn.disabled = false;
  }
});

consoleLink.addEventListener("click", () => {
  app.openLink({ url: "https://console.anthropic.com/settings/keys" });
});

app.connect();
