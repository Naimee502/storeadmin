import { AdminSettings } from "../../models/adminsettings";
import { AiLog } from "../../models/ai";
import { decryptSecret } from "../secret";

// Gemini, per business: off unless switched on, a monthly cap on actions, every call logged.
// Nothing here throws on a missing key — callers fall back to their own plain text.

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";
// Cheapest stable model; good at the extraction and classification this system asks for.
const DEFAULT_MODEL = "gemini-3.5-flash-lite";
const DEFAULT_CAP = 500;

export type AiConfig = {
  /** gemini, or openai for any OpenAI-compatible API (Groq, OpenRouter…) on the platform key. */
  provider: "gemini" | "openai";
  on: boolean;
  key: string;
  keysource: "platform" | "own" | "";
  model: string;
  cap: number;
  used: number;
  left: number;
  /** Why it is unavailable, for the screen to show. */
  reason: string;
};

const monthStart = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
};

/** Settings, key and this month's usage for a business. */
export async function aiConfig(adminid: any): Promise<AiConfig> {
  const s: any = await AdminSettings.getOrCreateForAdmin(adminid);
  const own = decryptSecret(s?.aiApiKey);
  // AI_PROVIDER=openai switches the platform key to an OpenAI-compatible API; a business's own key stays Gemini.
  const openaiPlatform = String(process.env.AI_PROVIDER || "").toLowerCase() === "openai";
  const platform = String((openaiPlatform ? process.env.AI_API_KEY : process.env.GEMINI_API_KEY) || "").trim();
  const provider: AiConfig["provider"] = !own && openaiPlatform ? "openai" : "gemini";
  // The business's own key is used first, so its usage never counts against the platform key.
  const key = own || platform;
  const keysource: AiConfig["keysource"] = own ? "own" : platform ? "platform" : "";
  const cap = Number(s?.aiMonthlyCap) > 0 ? Number(s.aiMonthlyCap) : DEFAULT_CAP;
  const used = await AiLog.countDocuments({ adminid, ok: true, createdAt: { $gte: monthStart() } });
  const on = s?.aiEnabled === true;
  return {
    provider,
    on,
    key,
    keysource,
    model: String(provider === "openai" ? (process.env.AI_MODEL || "llama-3.3-70b-versatile") : (s?.aiModel || process.env.GEMINI_MODEL || DEFAULT_MODEL)),
    cap,
    used,
    left: Math.max(cap - used, 0),
    reason: !on ? "AI is switched off for this business." : !key ? "No AI API key is set." : used >= cap ? "This month's AI limit is used up." : "",
  };
}

export type AiTool = {
  name: string;
  description: string;
  parameters: any;
  run: (args: any) => Promise<any>;
};

type AskOpts = {
  task: string;
  prompt: string;
  system?: string;
  /** Ask for JSON back; the reply is parsed before it is returned. */
  json?: boolean;
  tools?: AiTool[];
  /** Stored on the log line (the question only, never the answer). */
  question?: string;
  user?: any;
  branchid?: any;
  maxSteps?: number;
};

export type AiResult = {
  ok: boolean;
  text: string;
  data?: any;
  /** Tools the model ran, so the screen can show its working. */
  steps: { tool: string; args: any }[];
  reason?: string;
};

const textOf = (part: any) => (typeof part?.text === "string" ? part.text : "");

/** Parses JSON out of a reply, with or without a ``` fence. */
function parseJson(text: string): any {
  const body = text.replace(/^\s*```(?:json)?/i, "").replace(/```\s*$/, "").trim();
  try {
    return JSON.parse(body);
  } catch {
    const a = body.indexOf("{");
    const b = body.lastIndexOf("}");
    if (a >= 0 && b > a) {
      try {
        return JSON.parse(body.slice(a, b + 1));
      } catch { /* give up below */ }
    }
    return null;
  }
}

/**
 * One AI call for a business. Returns ok:false with a reason when AI is off, has
 * no key or is over its cap — never throws for those, so screens keep working.
 * With tools, the model may call them (tenant-scoped by the caller) before answering.
 */
export async function aiAsk(adminid: any, opts: AskOpts): Promise<AiResult> {
  const cfg = await aiConfig(adminid);
  if (cfg.reason) return { ok: false, text: "", steps: [], reason: cfg.reason };

  const started = Date.now();
  const steps: { tool: string; args: any }[] = [];
  const contents: any[] = [{ role: "user", parts: [{ text: opts.prompt }] }];
  const body: any = {
    contents,
    generationConfig: { temperature: 0.2, ...(opts.json ? { responseMimeType: "application/json" } : {}) },
  };
  if (opts.system) body.systemInstruction = { parts: [{ text: opts.system }] };
  if (opts.tools?.length) {
    body.tools = [{ functionDeclarations: opts.tools.map(({ name, description, parameters }) => ({ name, description, parameters })) }];
  }

  let text = "";
  let intokens = 0;
  let outtokens = 0;
  let error = "";
  try {
    if (cfg.provider === "openai") {
      const r = await openaiLoop(cfg, opts, steps);
      text = r.text;
      intokens = r.intokens;
      outtokens = r.outtokens;
    } else for (let step = 0; step < (opts.maxSteps ?? 4); step++) {
      const res = await fetch(`${ENDPOINT}/${encodeURIComponent(cfg.model)}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": cfg.key },
        body: JSON.stringify(body),
      });
      const json: any = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String(json?.error?.message || `Gemini answered ${res.status}`).slice(0, 300));
      intokens += Number(json?.usageMetadata?.promptTokenCount || 0);
      outtokens += Number(json?.usageMetadata?.candidatesTokenCount || 0);

      const parts: any[] = json?.candidates?.[0]?.content?.parts || [];
      const calls = parts.filter((p) => p?.functionCall?.name);
      if (!calls.length) {
        text = parts.map(textOf).join("").trim();
        break;
      }
      // Run what it asked for and hand the results back for the next turn.
      contents.push({ role: "model", parts });
      const replies: any[] = [];
      for (const c of calls) {
        const tool = opts.tools?.find((t) => t.name === c.functionCall.name);
        const args = c.functionCall.args || {};
        steps.push({ tool: c.functionCall.name, args });
        let out: any;
        try {
          out = tool ? await tool.run(args) : { error: "unknown tool" };
        } catch (e: any) {
          out = { error: String(e?.message || e).slice(0, 200) };
        }
        replies.push({ functionResponse: { name: c.functionCall.name, response: { result: out } } });
      }
      contents.push({ role: "user", parts: replies });
    }
  } catch (e: any) {
    error = String(e?.message || e).slice(0, 300);
  }

  try {
    await AiLog.create({
      adminid,
      branchid: opts.branchid || undefined,
      task: opts.task,
      model: cfg.model,
      keysource: cfg.keysource,
      promptchars: opts.prompt.length,
      intokens,
      outtokens,
      ms: Date.now() - started,
      ok: !error,
      error: error || undefined,
      question: opts.question?.slice(0, 500),
      userid: opts.user?.id ? String(opts.user.id) : undefined,
      username: opts.user?.name || opts.user?.email,
    });
  } catch { /* the log must never break the answer */ }

  if (error) return { ok: false, text: "", steps, reason: error };
  return { ok: true, text, data: opts.json ? parseJson(text) : undefined, steps };
}

// OpenAI-compatible chat completions with tool calls (Groq, OpenRouter, OpenAI…).
async function openaiLoop(cfg: AiConfig, opts: AskOpts, steps: { tool: string; args: any }[]) {
  const base = String(process.env.AI_BASE_URL || "https://api.groq.com/openai/v1").replace(/\/$/, "");
  const messages: any[] = [];
  if (opts.system) messages.push({ role: "system", content: opts.system });
  messages.push({ role: "user", content: opts.prompt + (opts.json ? "\nReply with JSON only." : "") });
  const tools = opts.tools?.length
    ? opts.tools.map(({ name, description, parameters }) => ({ type: "function", function: { name, description, parameters } }))
    : undefined;
  let intokens = 0;
  let outtokens = 0;
  for (let step = 0; step < (opts.maxSteps ?? 4); step++) {
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.key}` },
      body: JSON.stringify({ model: cfg.model, temperature: 0.2, messages, ...(tools ? { tools } : {}), ...(opts.json ? { response_format: { type: "json_object" } } : {}) }),
    });
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(String(json?.error?.message || `AI answered ${res.status}`).slice(0, 300));
    intokens += Number(json?.usage?.prompt_tokens || 0);
    outtokens += Number(json?.usage?.completion_tokens || 0);
    const msg = json?.choices?.[0]?.message || {};
    const calls: any[] = msg.tool_calls || [];
    if (!calls.length) return { text: String(msg.content || "").trim(), intokens, outtokens };
    messages.push(msg);
    for (const c of calls) {
      const name = c?.function?.name;
      let args: any = {};
      try { args = JSON.parse(c?.function?.arguments || "{}"); } catch { /* empty args */ }
      steps.push({ tool: name, args });
      const tool = opts.tools?.find((t) => t.name === name);
      let out: any;
      try {
        out = tool ? await tool.run(args) : { error: "unknown tool" };
      } catch (e: any) {
        out = { error: String(e?.message || e).slice(0, 200) };
      }
      messages.push({ role: "tool", tool_call_id: c.id, content: JSON.stringify(out).slice(0, 20000) });
    }
  }
  return { text: "", intokens, outtokens };
}
