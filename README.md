# WhatsApp Electronics Sales Agent

AI agent inayojibu maswali ya wateja, kuchukua oda, na kuratibu malipo kwa
WhatsApp — imejengwa na Claude API + WhatsApp Business Cloud API (Meta).

## Muundo wa faili

```
whatsapp-agent/
├── server.js           # Webhook server kuu
├── system_prompt.md     # Maelekezo/persona ya agent (badilisha hapa!)
├── package.json
├── .env.example
└── data/
    ├── catalog.json      # Bidhaa zako - badilisha na za kwako
    ├── conversations.json # (inatengenezwa kiotomatiki) historia ya kila mteja
    └── orders.json        # (inatengenezwa kiotomatiki) oda zilizothibitishwa
```

## Hatua za Kusetup

### 1. Install dependencies
```bash
npm install
```

### 2. Jaza taarifa zako
- Nakili `.env.example` uwe `.env`
- Jaza:
  - `VERIFY_TOKEN` — chagua neno lolote la siri
  - `WHATSAPP_TOKEN` na `WHATSAPP_PHONE_NUMBER_ID` — kutoka
    [Meta for Developers](https://developers.facebook.com) > App yako >
    WhatsApp > API Setup (kwa kuwa tayari una namba, hizi zipo kwenye
    dashboard yako)
  - `ANTHROPIC_API_KEY` — kutoka [console.anthropic.com](https://console.anthropic.com)

### 3. Badilisha catalog na system prompt
- Fungua `data/catalog.json` — weka bidhaa zako halisi (jina, bei, specs, stock)
- Fungua `system_prompt.md` — badilisha namba za M-Pesa/Tigo Pesa/Airtel Money,
  sera za uwasilishaji, na warranty kulingana na biashara yako halisi

### 4. Deploy (fanya server ipatikane kwa intaneti)
Meta inahitaji webhook URL ya https://... inayofikika hadharani. Chaguo rahisi:
- **Render.com** au **Railway.app** — deploy bure/gharama ndogo, inasaidia Node.js moja kwa moja
- **ngrok** — kwa majaribio ya haraka: `ngrok http 3000` inakupa URL ya muda

```bash
npm start
```

### 5. Unganisha Webhook kwenye Meta
Kwenye Meta for Developers > App yako > WhatsApp > Configuration:
- Callback URL: `https://[deploy-url-yako]/webhook`
- Verify Token: ile uliyoweka kwenye `.env`
- Subscribe kwenye field: `messages`

### 6. Jaribu
Tuma ujumbe kwa namba yako ya WhatsApp Business kutoka simu nyingine — agent
itajibu kiotomatiki kwa kutumia catalog uliyoweka.

## Kuangalia oda zilizoingia
Fungua `https://[deploy-url-yako]/orders` kwenye browser kuona oda zote
zilizothibitishwa (jina la mteja, historia ya mazungumzo, hali).

⚠️ Kwa matumizi ya kibiashara ya kweli, badilisha uhifadhi wa faili (JSON)
na database halisi (kama PostgreSQL au MongoDB), na ongeza uthibitisho wa
malipo wa kiotomatiki (kama M-Pesa API/webhook) badala ya kuangalia
screenshot kwa mkono.

## Vikwazo vya sasa (unavyoweza kuboresha baadaye)
- Malipo yanathibitishwa kwa mkono (mteja anatuma screenshot, wewe unahakiki)
- Historia ya mazungumzo inahifadhiwa kwenye faili la JSON — si salama/imara
  kwa biashara kubwa; tumia database halisi
- Inashughulikia ujumbe wa maandishi tu (sio picha/sauti/mahali)
