/**
 * api/generate.js
 * ----------------
 * Serverless function (runs on Vercel, not in the browser). This is what
 * keeps the Groq API key hidden - the frontend calls THIS endpoint, and
 * this endpoint calls Groq using a key stored as a server-side environment
 * variable, never exposed to visitors.
 *
 * REQUIRES A LOGGED-IN USER (added when the app moved behind real
 * accounts). This is verified server-side via requireUser() below - not
 * just a UI-level login screen - so the Groq quota can't be spent by
 * someone bypassing the frontend and calling this endpoint directly.
 *
 * Applies two lessons learned the hard way on a previous project:
 * 1. openai/gpt-oss-120b is a REASONING model - it spends tokens thinking
 *    silently before writing its visible answer. Too low a max_tokens
 *    budget can get entirely consumed by hidden reasoning, leaving an
 *    empty response. We set reasoning_effort="low" and a generous token
 *    budget to avoid that.
 * 2. Models sometimes wrap JSON output in extra text even when told not
 *    to. We defensively extract the {...} block instead of assuming the
 *    whole response is clean JSON.
 */
import { requireUser } from "./_supabaseAuth.js";

// Very lightweight, best-effort rate limiting. This resets whenever the
// serverless function cold-starts (Vercel doesn't guarantee the same
// instance handles every request), so it is NOT a robust defense against
// abuse - just a small speed bump. Documented honestly in the README.
const lastRequestByIP = new Map();
const MIN_MS_BETWEEN_REQUESTS = 8000;

const MODEL = "openai/gpt-oss-120b";
const VISION_MODEL = "qwen/qwen3.6-27b"; // confirmed vision-capable on Groq, used only when reference images are attached

const SYSTEM_PROMPT = `You are a rapid UI prototyping assistant built specifically for product managers.

You will be given either:
- A structured user story: "As a [user], I want [goal], so that [benefit]"
- A short free-form product brief

Your job: generate a single, self-contained HTML page that serves as a
believable, visually polished UI mockup for that idea - the kind of thing
a PM could screen-share in a stakeholder meeting to make an idea feel real.

Rules for the HTML:
- One complete HTML document: inline <style> in the <head>, inline <script>
  only if needed for simple interactivity (e.g. toggling a tab). No external
  resources, no external fonts, no external images - use CSS shapes,
  gradients, or emoji instead of <img> tags.
- Make deliberate, specific visual design choices (a real color palette,
  real typography, real layout) - not a generic gray Bootstrap-looking form.
  Ground the design in the actual product idea described.
- It should look like a real, finished screen - not a wireframe, not
  placeholder gray boxes.
- This can be a single screen, or a small connected flow of 2-4 screens
  (e.g. a login screen leading to a dashboard) when that better
  represents the idea. If you build a flow, include simple built-in
  navigation between screens using JavaScript to show/hide sections
  (e.g. a tab strip, or "Next" / "Back" buttons) - it must stay ONE
  self-contained HTML file, not separate pages or real URLs.

Rules for the rationale:
- 3 to 5 short bullet points explaining your key product/design decisions:
  what you prioritized, what you deliberately left out or simplified, and
  why - written the way a PM would justify their choices to a stakeholder.
- Be specific to THIS idea, not generic UX platitudes.

Respond ONLY with valid JSON in exactly this shape, no other text, no
markdown code fences:
{"html": "<!DOCTYPE html>...", "rationale": ["point 1", "point 2", "point 3"]}
`;

const REFINE_SYSTEM_PROMPT = `You are a rapid UI prototyping assistant built specifically for product managers.

You will be given the HTML of an existing prototype screen, plus a follow-up
instruction describing a change to make to it (e.g. "make the button bigger",
"add a pricing section", "switch to dark mode").

Your job: return an UPDATED version of the same HTML that applies the
requested change, while keeping everything else about the design consistent
with the original (same overall layout, palette, and style) unless the
instruction specifically asks to change that too. Do not start over from
scratch - edit the existing design.

Rules for the HTML: same as before - one self-contained document, inline
<style>, inline <script> only if needed, no external resources.

Rules for the rationale: 2-4 short bullets explaining what you changed and
why, specific to this refinement (not a re-explanation of the whole design).

Respond ONLY with valid JSON in exactly this shape, no other text, no
markdown code fences:
{"html": "<!DOCTYPE html>...", "rationale": ["point 1", "point 2"]}
`;

function buildUserMessage(body) {
  if (body.mode === "refine") {
    const instruction = (body.instruction || "").trim();
    const previousHtml = body.previousHtml || "";
    return `Existing prototype HTML:\n${previousHtml}\n\nRequested change:\n${instruction}`;
  }
  if (body.mode === "structured") {
    const asA = (body.asA || "user").trim();
    const iWant = (body.iWant || "").trim();
    const soThat = (body.soThat || "").trim();
    return `User story:\nAs a ${asA}, I want ${iWant}, so that ${soThat}.`;
  }
  const text = (body.freeformText || "").trim();
  return `Product brief:\n${text}`;
}

function extractJson(text) {
  let cleaned = (text || "").trim();
  cleaned = cleaned.replace(/```json/g, "").replace(/```/g, "").trim();
  if (!cleaned.startsWith("{")) {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) {
      cleaned = cleaned.slice(start, end + 1);
    }
  }
  return JSON.parse(cleaned);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  // Require a real, verified login BEFORE anything else - including
  // before the rate limiter, so an unauthenticated request never even
  // gets that far.
  const { user, error: authError } = await requireUser(req);
  if (!user) {
    res.status(401).json({ error: authError || "Please log in." });
    return;
  }

  // Best-effort rate limit per IP
  const ip = req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown";
  const now = Date.now();
  const last = lastRequestByIP.get(ip) || 0;
  if (now - last < MIN_MS_BETWEEN_REQUESTS) {
    res.status(429).json({ error: "Please wait a few seconds before generating again." });
    return;
  }
  lastRequestByIP.set(ip, now);

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "Server is missing GROQ_API_KEY. Set it in Vercel's project environment variables." });
    return;
  }

  let body;
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  } catch {
    res.status(400).json({ error: "Invalid request body." });
    return;
  }

  // Validate the RAW input length before adding any boilerplate prefix text -
  // checking the final constructed message would always pass this check
  // since the prefix text itself is longer than the minimum.
  if (body?.mode === "structured") {
    const iWant = (body.iWant || "").trim();
    const soThat = (body.soThat || "").trim();
    if (iWant.length < 5 || soThat.length < 5) {
      res.status(400).json({ error: "Please fill in the \u201cI want\u201d and \u201cso that\u201d parts with a bit more detail." });
      return;
    }
  } else if (body?.mode === "refine") {
    const instruction = (body.instruction || "").trim();
    const previousHtml = (body.previousHtml || "").trim();
    if (instruction.length < 3) {
      res.status(400).json({ error: "Describe the change you'd like to make." });
      return;
    }
    if (!previousHtml) {
      res.status(400).json({ error: "No existing prototype to refine. Generate one first." });
      return;
    }
  } else {
    const text = (body?.freeformText || "").trim();
    if (text.length < 15) {
      res.status(400).json({ error: "Please provide a bit more detail before generating." });
      return;
    }
  }

  const images = Array.isArray(body?.images) ? body.images.slice(0, 3) : [];
  const MAX_IMAGE_DATA_URL_LENGTH = 8_000_000; // roughly ~6MB decoded, well under Groq's 20MB/image limit
  for (const img of images) {
    if (typeof img !== "string" || !img.startsWith("data:image/") || img.length > MAX_IMAGE_DATA_URL_LENGTH) {
      res.status(400).json({ error: "One of the attached images is invalid or too large." });
      return;
    }
  }

  const userMessage = buildUserMessage(body || {});
  const systemPrompt = body?.mode === "refine" ? REFINE_SYSTEM_PROMPT : SYSTEM_PROMPT;
  const usingVision = images.length > 0;
  const modelToUse = usingVision ? VISION_MODEL : MODEL;

  const userContent = usingVision
    ? [
        { type: "text", text: userMessage + "\n\nReference image(s) attached - use them as visual inspiration for layout, color, and style." },
        ...images.map((url) => ({ type: "image_url", image_url: { url } })),
      ]
    : userMessage;

  try {
    const requestBody = {
      model: modelToUse,
      max_tokens: 6000, // raised from 4000 - multi-screen flows produce noticeably more HTML
      temperature: 0.7,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
    };
    // reasoning_effort is specific to openai/gpt-oss-120b's API surface -
    // omit it for the vision model call to avoid sending a parameter that
    // model may not recognize.
    if (!usingVision) {
      requestBody.reasoning_effort = "low";
    }

    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!groqResponse.ok) {
      const errText = await groqResponse.text();
      res.status(502).json({ error: `Groq API error: ${groqResponse.status} - ${errText.slice(0, 300)}` });
      return;
    }

    const data = await groqResponse.json();
    const content = data.choices?.[0]?.message?.content || "";

    let parsed;
    try {
      parsed = extractJson(content);
    } catch (parseErr) {
      res.status(502).json({ error: "Model returned a response that couldn't be parsed. Try generating again.", raw: content.slice(0, 500) });
      return;
    }

    if (!parsed.html) {
      res.status(502).json({ error: "Model response was missing the HTML. Try generating again." });
      return;
    }

    res.status(200).json({
      html: parsed.html,
      rationale: Array.isArray(parsed.rationale) ? parsed.rationale : [],
    });
  } catch (err) {
    res.status(500).json({ error: "Unexpected server error: " + err.message });
  }
}
