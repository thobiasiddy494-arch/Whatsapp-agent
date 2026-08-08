/**
 * WhatsApp Electronics Sales Agent
 * -----------------------------------
 * Inaunganisha WhatsApp Business Cloud API (Meta) na Claude API
 * ili kutengeneza AI sales agent inayojibu maswali, kuchukua oda,
 * na kuratibu malipo kwa bidhaa za electronics.
 *
 * Jinsi inavyofanya kazi:
 *  1. Meta inatuma ujumbe wa mteja kwenye POST /webhook
 *  2. Tunachukua historia ya mazungumzo ya mteja huyo (kwa namba yake)
 *  3. Tunatuma system prompt + catalog + historia + ujumbe mpya kwenda Claude API
 *  4. Tunapokea jibu na kulituma kwa mteja kupitia WhatsApp Cloud API
 *  5. Kama jibu lina [ORDER_CONFIRMED] tunahifadhi oda kwenye data/orders.json
 *  6. Kama jibu lina [NEEDS_HUMAN] tunaandika kwenye log ili mwanadamu aingilie
 */

const express = require("express");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const app = express();
app.use(express.json());

// ---------- Config (weka hizi kwenye faili la .env) ----------
const {
  VERIFY_TOKEN,            // token unayochagua mwenyewe, inatumika Meta webhook verification
  WHATSAPP_TOKEN,          // permanent/temporary access token kutoka Meta App
  WHATSAPP_PHONE_NUMBER_ID,// Phone Number ID kutoka Meta Business Suite
  ANTHROPIC_API_KEY,       // API key yako ya Anthropic
  PORT = 3000,
} = process.env;

const CATALOG_PATH = path.join(__dirname, "catalog.json");
const CONVOS_PATH = path.join(__dirname, "conversations.json");
const ORDERS_PATH = path.join(__dirname, "orders.json");
const SYSTEM_PROMPT_PATH = path.join(__dirname, "system_prompt.md");

// ---------- Helpers: hifadhi ya faili (unaweza kubadilisha na database halisi) ----------
function readJSON(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return fallback;
  }
}
function writeJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

if (!fs.existsSync(CONVOS_PATH)) writeJSON(CONVOS_PATH, {});
if (!fs.existsSync(ORDERS_PATH)) writeJSON(ORDERS_PATH, []);

function loadSystemPrompt(catalog, history) {
  const raw = fs.readFileSync(SYSTEM_PROMPT_PATH, "utf-8");
  // Chukua sehemu ya ndani ya ``` ``` pekee (yaani maelekezo halisi)
  const match = raw.match(/```([\s\S]*?)```/);
  const template = match ? match[1] : raw;
  return template
    .replace("{{CATALOG}}", JSON.stringify(catalog, null, 2))
    .replace("{{CONVERSATION_HISTORY}}", history.map(h => `${h.role}: ${h.content}`).join("\n"));
}

// ---------- 1. Webhook verification (Meta inaita hii mara moja unaposetup) ----------
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("Webhook verified.");
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// ---------- 2. Kupokea ujumbe kutoka kwa mteja ----------
app.post("/webhook", async (req, res) => {
  // Jibu haraka Meta ili isirudia kutuma (haihitaji kusubiri Claude)
  res.sendStatus(200);

  try {
    const entry = req.body.entry?.[0];
    const change = entry?.changes?.[0];
    const message = change?.value?.messages?.[0];
    if (!message) return; // status update au aina nyingine ya event, sio ujumbe wa maandishi

    const from = message.from; // namba ya mteja
    const text = message.text?.body;
    console.log(`📩 Ujumbe umepokelewa kutoka ${from}: "${text}"`);
    if (!text) {
      console.log("⚠️  Ujumbe haukuwa na maandishi (labda picha/sauti) - umepuuzwa.");
      return;
    }

    await handleIncomingMessage(from, text);
  } catch (err) {
    console.error("❌ Kosa la webhook:", err);
  }
});

// ---------- 3. Mantiki kuu: piga Claude, jibu mteja, hifadhi oda ----------
async function handleIncomingMessage(from, text) {
  const conversations = readJSON(CONVOS_PATH, {});
  const history = conversations[from] || [];
  const catalog = readJSON(CATALOG_PATH, []);

  history.push({ role: "user", content: text });

  const systemPrompt = loadSystemPrompt(catalog, history.slice(0, -1)); // historia kabla ya ujumbe huu

  const claudeResponse = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 500,
      system: systemPrompt,
      messages: [{ role: "user", content: text }],
    }),
  });

  const data = await claudeResponse.json();

  if (!claudeResponse.ok) {
    console.error("❌ Kosa kutoka Claude API:", JSON.stringify(data));
    await sendWhatsAppMessage(from, "Samahani, kuna hitilafu ya kiufundi kwa sasa. Jaribu tena baadaye.");
    return;
  }

  let reply = data.content?.map(b => b.text || "").join("\n").trim() || "";
  console.log(`🤖 Claude imejibu: "${reply}"`);

  // ---- Tafsiri amri maalum kutoka kwa Claude ----
  let orderConfirmed = false;
  let needsHuman = false;

  if (reply.startsWith("[ORDER_CONFIRMED]")) {
    orderConfirmed = true;
    reply = reply.replace("[ORDER_CONFIRMED]", "").trim();
  }
  if (reply.startsWith("[NEEDS_HUMAN]")) {
    needsHuman = true;
    reply = reply.replace("[NEEDS_HUMAN]", "").trim();
  }

  // Hifadhi historia
  history.push({ role: "assistant", content: reply });
  conversations[from] = history;
  writeJSON(CONVOS_PATH, conversations);

  // Hifadhi oda ikiwa imethibitishwa
  if (orderConfirmed) {
    const orders = readJSON(ORDERS_PATH, []);
    orders.push({
      mteja: from,
      historia_ya_mazungumzo: history,
      wakati: new Date().toISOString(),
      hali: "Inasubiri uthibitisho wa malipo",
    });
    writeJSON(ORDERS_PATH, orders);
    console.log(`✅ Oda mpya kutoka ${from} imehifadhiwa.`);
  }

  if (needsHuman) {
    console.log(`⚠️  Mteja ${from} anahitaji msaada wa mwanadamu.`);
    // Hapa unaweza kuongeza: kutuma notification Slack/Email kwa timu yako
  }

  await sendWhatsAppMessage(from, reply);
}

// ---------- 4. Kutuma ujumbe kurudi WhatsApp ----------
async function sendWhatsAppMessage(to, body) {
  const res = await fetch(
    `https://graph.facebook.com/v20.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body },
      }),
    }
  );
  const result = await res.json();
  if (!res.ok) {
    console.error(`❌ WhatsApp imekataa kutuma ujumbe kwa ${to}:`, JSON.stringify(result));
  } else {
    console.log(`✅ Ujumbe umetumwa kwa ${to} kwa mafanikio.`);
  }
}

// ---------- Endpoint rahisi ya kuangalia oda zote (kwa matumizi yako mwenyewe) ----------
app.get("/orders", (req, res) => {
  res.json(readJSON(ORDERS_PATH, []));
});

app.listen(PORT, () => {
  console.log(`🚀 WhatsApp Sales Agent inaendesha kwenye port ${PORT}`);
});
