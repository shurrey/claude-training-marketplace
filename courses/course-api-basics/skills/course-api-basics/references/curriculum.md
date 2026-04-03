# Your First API Call — Curriculum

## Learning Objectives

After completing this course, the student will be able to:
1. Explain the structure of an Anthropic Messages API request
2. Describe the role system (user, assistant) and the purpose of system prompts
3. Choose an appropriate model for a given use case
4. Read and interpret an API response, including content blocks and stop reasons
5. Understand token usage and its relationship to cost and context windows

---

## Concept 1: API Request Structure

**concept_id:** api-structure

### Teaching Notes

The Anthropic Messages API uses a single endpoint: `POST https://api.anthropic.com/v1/messages`. Every request requires three things: the `model` parameter (which Claude model to use), the `messages` array (the conversation), and the `max_tokens` parameter (the maximum length of Claude's response).

Authentication uses the `x-api-key` header with an API key, plus `anthropic-version` header (currently `2023-06-01`). The content type is `application/json`.

A minimal valid request looks like:

```json
{
  "model": "claude-sonnet-4-20250514",
  "max_tokens": 1024,
  "messages": [
    { "role": "user", "content": "Hello, Claude" }
  ]
}
```

The `messages` array is the conversation history. Each message has a `role` (either `"user"` or `"assistant"`) and `content` (either a string or an array of content blocks). Messages must alternate between user and assistant roles, and the first message must be from the user.

The `max_tokens` parameter is required and sets the upper limit on how many tokens Claude will generate in its response. It does not guarantee that many tokens — Claude may stop earlier if it completes its thought.

### Common Misconceptions

- **"max_tokens controls the input length."** No — max_tokens limits the *output* only. Input length is bounded by the model's context window.
- **"You need a system prompt."** The system prompt is optional. A valid request only requires model, messages, and max_tokens.
- **"Messages can be in any order."** Messages must alternate user/assistant, starting with user.

### Knowledge Check

"If I gave you just a model name and a question I wanted to ask Claude, what else would you need to include to make a valid API request? And why is that piece required?"

*Expected understanding: max_tokens is required because Claude needs to know its response budget. The messages array needs role and content. Student should mention the alternating role requirement.*

---

## Concept 2: The Role System

**concept_id:** roles

### Teaching Notes

The Messages API has three role contexts:

1. **System prompt** — Set via the top-level `system` parameter (not inside the messages array). This is persistent context that shapes Claude's behavior for the entire conversation. It's like giving Claude its job description before the conversation starts. The system prompt is optional.

2. **User messages** (`"role": "user"`) — What the human says. These are the inputs, questions, or instructions.

3. **Assistant messages** (`"role": "assistant"`) — What Claude says. In a multi-turn conversation, you include Claude's previous responses so it has context. You can also pre-fill an assistant message to steer Claude's response format.

The system prompt is powerful because it persists across the entire conversation and Claude treats it as high-priority context. Common uses: setting a persona, defining output format, establishing rules or constraints.

Pre-filling assistant messages is an advanced technique: by including an assistant message at the end of the messages array (before Claude responds), you can guide Claude to continue from that point. For example, starting with `{"role": "assistant", "content": "{"}` nudges Claude to respond in JSON.

### Common Misconceptions

- **"The system prompt goes in the messages array."** No — it's a separate top-level `system` parameter.
- **"Assistant messages are only Claude's past responses."** They can also be pre-filled to guide output format.
- **"You always need a system prompt."** It's optional. For simple queries, messages alone are sufficient.

### Knowledge Check

"In your own words, what's the difference between putting instructions in a system prompt versus putting them in the first user message? When would you choose one over the other?"

*Expected understanding: The system prompt persists as high-priority context and shapes behavior across the whole conversation. User messages are individual turns. System prompts are better for persistent behavioral instructions; user messages are better for specific requests.*

---

## Concept 3: Choosing a Model

**concept_id:** model-selection

### Teaching Notes

Anthropic offers three model tiers, each with different capability and cost tradeoffs:

- **Claude Opus 4** (`claude-opus-4-20250514`) — The most capable model. Best for complex analysis, nuanced writing, multi-step reasoning, and tasks requiring deep understanding. Highest cost per token.
- **Claude Sonnet 4** (`claude-sonnet-4-20250514`) — The balanced model. Strong performance on most tasks at moderate cost. Good default choice for production applications.
- **Claude Haiku 3.5** (`claude-haiku-3-5-20241022`) — The fastest and most affordable model. Best for high-volume, lower-complexity tasks like classification, extraction, and simple Q&A.

Choosing a model depends on the task. Consider three factors: complexity (does the task require deep reasoning?), speed (does the response need to be fast?), and cost (how many requests will you make?).

For the POC and learning, Sonnet is the recommended default — capable enough for most tasks, fast enough for interactive use, and moderately priced.

Model IDs follow a pattern: `claude-{tier}-{version}-{date}`. The date is a snapshot identifier. Anthropic also provides aliases without dates (e.g., `claude-sonnet-4-20250514`) but pinned versions are recommended for production stability.

### Common Misconceptions

- **"Bigger model is always better."** Not true — Haiku outperforms on speed-sensitive tasks and is far more cost-effective for simple operations. Using Opus for classification is wasteful.
- **"Model names are just marketing."** The tiers reflect real architectural differences in capability, context handling, and reasoning depth.
- **"I should always use the latest model."** For production, pinning to a specific date version prevents unexpected behavior changes.

### Knowledge Check

"Imagine you're building two features: one that classifies customer support tickets into categories, and one that writes detailed technical documentation. Which model would you pick for each, and why?"

*Expected understanding: Haiku for classification (high volume, simple task, speed matters, cost sensitive). Opus or Sonnet for documentation (complex writing, nuanced output, lower volume).*

---

## Concept 4: Anatomy of a Response

**concept_id:** response-anatomy

### Teaching Notes

A Messages API response contains several key fields:

```json
{
  "id": "msg_01XFDUDYJgAACzvnptvVoYEL",
  "type": "message",
  "role": "assistant",
  "content": [
    {
      "type": "text",
      "text": "Hello! How can I help you today?"
    }
  ],
  "model": "claude-sonnet-4-20250514",
  "stop_reason": "end_turn",
  "stop_sequence": null,
  "usage": {
    "input_tokens": 12,
    "output_tokens": 10
  }
}
```

Key fields:
- **id** — A unique message identifier. Useful for logging and debugging.
- **content** — An array of content blocks. Usually contains one text block, but can contain multiple blocks (e.g., when using tool use, there may be text and tool_use blocks).
- **stop_reason** — Why Claude stopped generating. Values: `"end_turn"` (Claude finished its thought), `"max_tokens"` (hit the max_tokens limit — the response was truncated), `"stop_sequence"` (hit a custom stop sequence), `"tool_use"` (Claude wants to use a tool).
- **usage** — Token counts for input and output. Critical for cost tracking.

The `stop_reason` is important for application logic. If it's `"max_tokens"`, the response was cut off and you may want to continue the conversation or increase max_tokens. If it's `"end_turn"`, Claude finished naturally.

Content blocks are typed. The `"text"` type is the most common, but `"tool_use"` blocks appear when Claude invokes tools (covered in a later course).

### Common Misconceptions

- **"The response is just a string."** No — it's structured JSON with metadata. The actual text is nested inside content blocks.
- **"stop_reason: max_tokens means I used too much input."** It means the *output* hit the limit you set. The input was fine.
- **"One request = one content block."** Responses can contain multiple content blocks, especially with tool use.

### Knowledge Check

"If you make an API call and the stop_reason comes back as 'max_tokens', what does that tell you about Claude's response? What would you do about it?"

*Expected understanding: Claude's response was truncated — it had more to say but hit the max_tokens limit. You could increase max_tokens, ask Claude to be more concise, or send a follow-up message asking it to continue.*

---

## Concept 5: Understanding Tokens

**concept_id:** tokens

### Teaching Notes

Tokens are the fundamental unit of text processing for language models. A token is roughly 3/4 of a word in English, though this varies. The word "understanding" is 2-3 tokens; "a" is 1 token; code and special characters often tokenize differently than natural language.

Token usage matters for two reasons:

1. **Cost** — You pay per token for both input and output. Input tokens (your prompt, system prompt, conversation history) and output tokens (Claude's response) are priced separately, with output tokens typically costing more.

2. **Context window** — Each model has a maximum context window (the total number of tokens it can process in one request, input + output combined). For Claude Sonnet 4, this is 200,000 tokens. If your conversation history grows too long, you'll need to summarize or truncate older messages.

The `usage` field in the response tells you exactly how many tokens were used:
- `input_tokens` — Everything you sent: system prompt + messages + any tool definitions
- `output_tokens` — Everything Claude generated in its response

A practical heuristic: 1,000 tokens is roughly 750 words of English text. A typical API request with a short system prompt and a simple question might use 50-200 input tokens and 100-500 output tokens.

For cost estimation: if Sonnet costs $3 per million input tokens and $15 per million output tokens, a request with 200 input tokens and 300 output tokens costs about $0.0051 — fraction of a cent.

### Common Misconceptions

- **"One word = one token."** Roughly, but not exactly. Short common words are often one token; longer or uncommon words may be 2-4 tokens. Code, punctuation, and non-English text tokenize differently.
- **"The context window is just for input."** The context window includes both input AND output tokens. If your input uses 199,000 of a 200,000-token window, Claude can only generate 1,000 output tokens.
- **"Tokens don't matter for small projects."** Even small projects should monitor token usage to avoid surprise costs and context window limits as conversations grow.

### Knowledge Check

"If you have a conversation with Claude that's been going on for a while and your API response comes back with input_tokens: 180000, what might you need to think about for your next message?"

*Expected understanding: You're approaching the context window limit. You may need to summarize earlier parts of the conversation, remove older messages, or start a new conversation. Also, there's limited space left for Claude's output.*

---

## Exercise 1: Build Your First Request

**exercise_id:** ex-build-request
**linked_concepts:** api-structure, roles

### Prompt

"Build a complete, valid API request to ask Claude to explain what an API is, in terms a 10-year-old would understand. Include a system prompt that tells Claude to use simple language and short sentences. Write out the full JSON request body."

### Acceptance Criteria

The submission must:
1. Include `"model"` with a valid Claude model identifier
2. Include `"max_tokens"` with a positive integer
3. Include `"system"` as a top-level parameter (not inside messages) with instructions about simple language
4. Include `"messages"` as an array with at least one user message
5. The user message must ask Claude to explain what an API is
6. Roles must be valid (`"user"` for the message)
7. The JSON must be syntactically valid

### Hints

1. "What three fields are required in every Messages API request?"
2. "Remember, the system prompt isn't part of the messages array — it's its own field. Where does it go?"
3. "Here's the skeleton: `{ \"model\": ..., \"max_tokens\": ..., \"system\": ..., \"messages\": [...] }`. Can you fill in the values?"
4. "The messages array needs objects with 'role' and 'content'. What role would your question have?"

### Sample Solution

```json
{
  "model": "claude-sonnet-4-20250514",
  "max_tokens": 1024,
  "system": "You are a friendly teacher. Use simple language and short sentences that a 10-year-old would understand.",
  "messages": [
    {
      "role": "user",
      "content": "What is an API?"
    }
  ]
}
```

---

## Exercise 2: Pick the Right Model

**exercise_id:** ex-model-choice
**linked_concepts:** model-selection

### Prompt

"I'm going to describe three different applications. For each one, tell me which Claude model you'd recommend and explain your reasoning:

A) A chatbot that answers simple FAQ questions for a small business website (about 500 queries per day)
B) A research assistant that reads 50-page academic papers and writes detailed summaries with citations
C) A real-time content moderation system that checks 10,000 social media posts per hour for policy violations"

### Acceptance Criteria

The submission must:
1. Recommend a specific model for each scenario (A, B, C)
2. Provide reasoning that references at least two of: capability, speed, and cost
3. Correctly identify that the high-volume, simple-task scenarios favor Haiku
4. Correctly identify that the complex-reasoning scenario favors Opus or Sonnet
5. Not recommend Opus for simple classification tasks

### Hints

1. "Think about the three factors we discussed: complexity, speed, and cost. How does each scenario rank on those dimensions?"
2. "For scenario C, what matters most — the quality of each individual decision, or keeping up with the volume?"
3. "Consider the cost implications: at 10,000 posts per hour, even small per-request costs add up. Which model gives you the best quality-to-cost ratio for simple decisions?"

### Sample Solution

A) **Haiku** — FAQ responses are relatively simple (low complexity), volume is moderate, and cost efficiency matters for a small business. Haiku handles straightforward Q&A well.

B) **Opus** (or Sonnet) — Reading long academic papers and producing detailed summaries with citations requires deep comprehension, nuanced writing, and handling large context. This is a high-complexity, low-volume task where quality matters most.

C) **Haiku** — Content moderation at 10,000 posts/hour is a high-volume classification task. Speed and cost are critical. Haiku's speed and low cost per request make it the clear choice. The task (policy violation detection) is essentially classification, which Haiku handles well.

---

## Exercise 3 (Capstone): Complete API Interaction

**exercise_id:** ex-capstone
**linked_concepts:** api-structure, roles, model-selection, response-anatomy, tokens

### Prompt

"You're building a simple app that helps users write professional emails. Design the complete interaction:

1. Write the API request JSON that sends a user's rough draft to Claude for polishing. The rough draft is: 'hey john, wanted to check if ur team can meet thursday about the project. we need to figure out the timeline stuff. thanks'

2. Choose and justify your model selection.

3. After you write the request, I'll give you a mock response. Interpret it: explain the stop_reason, the token usage, and whether you'd change anything about your request based on what you see."

*After the student writes the request, provide this mock response for them to interpret:*

```json
{
  "id": "msg_example123",
  "type": "message",
  "role": "assistant",
  "content": [
    {
      "type": "text",
      "text": "Subject: Meeting Request - Project Timeline Discussion\n\nHi John,\n\nI hope this message finds you well. I'd like to schedule a meeting with your team this Thursday to discuss our project timeline.\n\nSpecifically, I'd like us to:\n- Review current milestones and deadlines\n- Identify any blockers or dependencies\n- Align on next steps and ownership\n\nPlease let me know if Thursday works for your team, and if so, what time would be most convenient.\n\nBest regards"
    }
  ],
  "model": "claude-sonnet-4-20250514",
  "stop_reason": "end_turn",
  "stop_sequence": null,
  "usage": {
    "input_tokens": 95,
    "output_tokens": 118
  }
}
```

### Acceptance Criteria

Part 1 (Request):
1. Valid JSON with model, max_tokens, messages
2. System prompt that instructs Claude to rewrite emails professionally
3. User message containing the rough draft
4. Reasonable max_tokens value (not too low to cut off an email, not wastefully high)

Part 2 (Model selection):
5. Reasonable choice with justification referencing the task characteristics

Part 3 (Response interpretation):
6. Correctly identifies stop_reason "end_turn" means Claude finished naturally
7. Notes the token usage and what it implies about cost
8. Identifies that the request was efficient (low token counts for a useful result)

### Hints

1. "Start with the system prompt: what behavior do you want Claude to have for all email rewrites?"
2. "For max_tokens, think about how long a professional email typically is. A paragraph is roughly 100-200 tokens."
3. "When you get the response back, check the stop_reason first. That tells you whether Claude finished on its own terms or was cut off."

### Sample Solution

Request:
```json
{
  "model": "claude-sonnet-4-20250514",
  "max_tokens": 512,
  "system": "You are a professional email editor. Rewrite the user's rough draft into a polished, professional email. Maintain the original intent and key information. Use a friendly but professional tone.",
  "messages": [
    {
      "role": "user",
      "content": "Please rewrite this email professionally:\n\nhey john, wanted to check if ur team can meet thursday about the project. we need to figure out the timeline stuff. thanks"
    }
  ]
}
```

Model choice: Sonnet — email rewriting is moderately complex (needs to understand intent, maintain information, and produce polished output) but not so complex as to require Opus. It's also likely a production feature with moderate volume, so Sonnet's balance of quality and cost is appropriate.

Response interpretation: stop_reason is "end_turn" — Claude finished naturally, so the email is complete and wasn't cut off. Usage shows 95 input tokens and 118 output tokens — very efficient for a useful result. At Sonnet pricing, this request costs a fraction of a cent. The max_tokens of 512 was more than enough (only 118 used), but that's fine — it's a budget, not a target.
