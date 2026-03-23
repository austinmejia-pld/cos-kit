import express from "express";
import multer from "multer";
import { readFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// cos-kit wrapper imports
import {
  initSkillWrapper,
  handleWrappedCommand,
  loadSkillCatalog,
  routeSkill,
} from "../../src/wrapper/index.js";
import type { RouterInput, ScoredSkill } from "../../src/wrapper/index.js";
import { createClaudeLLMClient, CLAUDE_MODEL } from "./claudeAdapter.js";
import AnthropicVertex from "@anthropic-ai/vertex-sdk";

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = resolve(__dirname, "..");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(join(APP_ROOT, "public")));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

// ── Config ──────────────────────────────────────────────────────────

const PROJECT_ID = process.env.GCP_PROJECT_ID || "austin-demo-490711";
const REGION = process.env.GCP_REGION || "us-east5";

// ── Prompts ─────────────────────────────────────────────────────────

const PROMPTS_DIR = join(__dirname, "prompts");

function readPrompt(filename: string): string {
  return readFileSync(join(PROMPTS_DIR, filename), "utf-8");
}

// ── Sessions ────────────────────────────────────────────────────────

interface Session {
  transcript: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  createdAt: number;
  lastAccess?: number;
}

const SESSION_TTL_MS = 60 * 60 * 1000;
const sessions = new Map<string, Session>();

function createSession(transcript: string): string {
  const id =
    "sess_" +
    Date.now() +
    "_" +
    Math.random().toString(36).slice(2, 8);
  sessions.set(id, { transcript, messages: [], createdAt: Date.now() });
  return id;
}

function touchSession(id: string): void {
  const s = sessions.get(id);
  if (s) s.lastAccess = Date.now();
}

setInterval(() => {
  const now = Date.now();
  for (const [id, s] of sessions) {
    const age = now - (s.lastAccess || s.createdAt);
    if (age > SESSION_TTL_MS) sessions.delete(id);
  }
}, 5 * 60 * 1000);

// ── JSON extraction (for Claude fallback) ───────────────────────────

function extractJSON(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw);
  } catch {
    const fenced = raw.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
    if (fenced) {
      try {
        return JSON.parse(fenced[1].trim());
      } catch {
        /* fall through */
      }
    }
    const braces = raw.match(/\{[\s\S]*\}/);
    if (braces) {
      return JSON.parse(braces[0]);
    }
    throw new Error("Model did not return valid JSON");
  }
}

// ── Initialize cos-kit wrapper ──────────────────────────────────────

const llmClient = createClaudeLLMClient();
initSkillWrapper({ enabled: true, llmClient });

// ── Skill label derivation ──────────────────────────────────────────

function deriveLabel(command: string): string {
  // "/commitments" → "Commitments", "/decision-audit" → "Decision Audit"
  return command
    .replace(/^\//, "")
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// ── Transcript triage (personalized greeting on upload) ─────────────

interface TriageResult {
  topic: string;
  participants: string[];
}

async function triageTranscript(
  transcript: string,
): Promise<TriageResult | null> {
  try {
    const client = new AnthropicVertex({ projectId: PROJECT_ID, region: REGION });
    const systemPrompt = readPrompt("system-upload-triage.txt");

    // Only send first ~3000 chars — topic and participants appear early
    const excerpt = transcript.slice(0, 3000);
    console.log("[triage] calling Claude for greeting — model:", CLAUDE_MODEL, "| excerpt length:", excerpt.length);

    const response = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: "user", content: `<transcript>\n${excerpt}\n</transcript>` }],
    });

    const raw = response.content[0].type === "text" ? response.content[0].text : "";

    console.log("[triage] raw response preview:", raw.slice(0, 200));

    if (!raw) {
      console.error("[triage] empty response from Claude");
      return null;
    }

    let parsed: TriageResult;
    try {
      parsed = extractJSON(raw) as unknown as TriageResult;
    } catch (parseErr) {
      console.error("[triage] JSON parse failed. Full raw response:\n", raw);
      throw parseErr;
    }

    if (!parsed.topic || !Array.isArray(parsed.participants)) {
      console.error("[triage] parsed JSON missing required fields:", JSON.stringify(parsed));
      return null;
    }

    console.log("[triage] greeting success — topic:", parsed.topic, "| participants:", parsed.participants);
    return parsed;
  } catch (err) {
    console.error(
      "Triage greeting failed (falling back to defaults):",
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

async function routeSkillForTriage(
  topic: string,
): Promise<ScoredSkill[]> {
  try {
    const catalog = loadSkillCatalog();
    const intentMessage = `analyze this ${topic} transcript`;
    const input: RouterInput = {
      userMessage: intentMessage,
      availableInputs: ["transcript"],
    };
    console.log("[triage] routing with intent:", intentMessage);
    const decision = await routeSkill(input, catalog, llmClient, true);
    console.log("[triage] routing decision:", decision.decision, "| engine:", decision.engine, "| suggestions:", decision.suggestions?.map(s => `${s.skillId}(${Math.round(s.score * 100)}%)`).join(", ") || "none");
    return decision.suggestions ?? [];
  } catch (err) {
    console.error("[triage] skill routing failed:", err instanceof Error ? err.message : err);
    return [];
  }
}

function formatParticipantList(names: string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── API Routes ──────────────────────────────────────────────────────

// Config
app.get("/api/config", (_req, res) => {
  res.json({ model: CLAUDE_MODEL, auth: "gcloud-adc" });
});

// Upload — extract text, triage with Claude, return personalized greeting + skills
app.post("/api/upload", upload.array("files", 5), async (req, res) => {
  try {
    const files = req.files as Express.Multer.File[] | undefined;
    if (!files || files.length === 0) {
      res.status(400).json({ error: "No files uploaded" });
      return;
    }

    let fullText = "";

    for (const file of files) {
      if (file.mimetype === "application/pdf") {
        const pdfParse = (await import("pdf-parse")).default;
        const data = await pdfParse(file.buffer);
        fullText += data.text + "\n\n";
      } else {
        fullText += file.buffer.toString("utf-8") + "\n\n";
      }
    }

    fullText = fullText.trim();
    if (!fullText) {
      res.status(400).json({
        error: "Could not extract text from uploaded files",
      });
      return;
    }

    const sessionId = createSession(fullText);

    // Build full skill catalog (for "Run another analysis")
    type SkillEntry = {
      id: string;
      command: string;
      label: string;
      description: string;
    };

    let allSkills: SkillEntry[] = [];
    try {
      const catalog = loadSkillCatalog();
      allSkills = catalog
        .filter(
          (s) =>
            s.status === "active" &&
            s.requiredInputs.includes("transcript"),
        )
        .map((s) => ({
          id: s.id,
          command: s.command,
          label: s.label?.trim() || deriveLabel(s.command),
          description:
            s.description.length > 120
              ? s.description.slice(0, 117) + "..."
              : s.description,
        }));
    } catch {
      // Catalog unavailable — return empty skills, app still works
    }

    // Step 1: Get greeting (topic + participants)
    const triage = await triageTranscript(fullText);

    // Step 2: Route using topic (only if triage succeeded)
    let scoredSkills: ScoredSkill[] = [];
    if (triage?.topic) {
      scoredSkills = await routeSkillForTriage(triage.topic);
    }

    // Build personalized greeting
    const participantStr =
      triage && triage.participants.length > 0
        ? ` with ${formatParticipantList(triage.participants)}`
        : "";
    const topic = triage?.topic ?? null;
    const greeting = topic
      ? `I've reviewed the <strong>${escapeHtml(topic)}</strong> transcript${participantStr}. Here are a few things I can help with:`
      : "Your transcript is ready. Here's what I can analyze:";

    // Map router's ScoredSkill[] to SkillEntry[] (preserves router's ranking)
    const skillMap = new Map(allSkills.map((s) => [s.id, s]));
    const suggestedSkills = scoredSkills
      .map((s) => skillMap.get(s.skillId))
      .filter((s): s is SkillEntry => s !== undefined);

    // Fall back to all skills if router returned nothing
    const skills = suggestedSkills.length > 0 ? suggestedSkills : allSkills;

    res.json({ sessionId, greeting, skills, allSkills });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Upload error:", message);
    res.status(500).json({ error: message });
  }
});

// Chat — route through cos-kit wrapper, fall back to Claude
app.post("/api/chat", async (req, res) => {
  try {
    const { sessionId, message, type } = req.body;

    if (!message || typeof message !== "string" || !message.trim()) {
      res.status(400).json({ error: "Message is required" });
      return;
    }
    if (!sessionId || !sessions.has(sessionId)) {
      res.status(400).json({ error: "Invalid or expired session" });
      return;
    }

    const session = sessions.get(sessionId)!;
    touchSession(sessionId);

    // ── Skill execution (slash command) ──
    if (type === "skill") {
      const result = await handleWrappedCommand(message, {
        transcript: session.transcript,
      });

      if (result.ok) {
        res.json({ type: "skill-result", content: result.content });
      } else {
        res.json({ type: "error", error: result.content });
      }
      return;
    }

    // ── Freetext: try router first ──
    if (type === "freetext" || !type) {
      const result = await handleWrappedCommand(message, {
        transcript: session.transcript,
      });

      // Router matched — return suggestion
      if (result.ok && result.mode === "insight") {
        // The insight content is formatted text from the router.
        // Parse it to extract skill suggestions if possible.
        // For now, return the router's suggestion as a structured response.
        const catalog = loadSkillCatalog();
        const suggestions = catalog
          .filter(
            (s) =>
              s.status === "active" &&
              result.content.includes(s.command),
          )
          .map((s) => ({
            skillId: s.id,
            command: s.command,
            label: s.label?.trim() || deriveLabel(s.command),
            description:
              s.description.length > 100
                ? s.description.slice(0, 97) + "..."
                : s.description,
          }));

        if (suggestions.length > 0) {
          res.json({ type: "suggest", suggestions });
          return;
        }

        // If we couldn't parse suggestions, return as skill-result
        res.json({ type: "skill-result", content: result.content });
        return;
      }

      // NO_SKILL — fall through to Claude chat
      const client = new AnthropicVertex({ projectId: PROJECT_ID, region: REGION });
      const systemPrompt = readPrompt("system-chat.txt");
      const fullSystem = `${systemPrompt}\n\n<transcript>\n${session.transcript}\n</transcript>`;

      const prefixedMessage = `The user asks: "${message}"`;
      session.messages.push({ role: "user", content: prefixedMessage });

      const response = await client.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 4096,
        system: fullSystem,
        messages: session.messages,
      });

      const raw = response.content[0].type === "text" ? response.content[0].text : "";
      session.messages.push({ role: "assistant", content: raw });

      const parsed = extractJSON(raw);

      if (!parsed.answer || typeof parsed.answer !== "string") {
        throw new Error('Model response missing required "answer" field');
      }
      if (!parsed.thinking) parsed.thinking = [];
      if (!parsed.followUps) parsed.followUps = [];

      res.json({
        type: "chat",
        thinking: parsed.thinking,
        answer: parsed.answer,
        followUps: parsed.followUps,
      });
      return;
    }

    // Unknown type — treat as freetext Claude fallback
    res.status(400).json({ error: `Unknown message type: ${type}` });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Chat error:", message);
    res.status(500).json({ error: message });
  }
});

// ── Start ───────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`Plaud Coach running at http://localhost:${PORT}`);
  console.log(`Config page: http://localhost:${PORT}/config.html`);
});
