// math-scanner worker — accepts an image POST, asks Gemini to solve the math,
// returns the answer text. No state, no storage. CORS allowlisted to the
// frontend origin(s).

type Env = {
  GEMINI_API_KEY: string;
  ALLOWED_ORIGINS: string;
};

type Body = {
  imageBase64?: unknown;
  mimeType?: unknown;
};

const PROMPT = `You are reading a photo of handwritten or printed math problem(s).

Return only the solved answers, one problem per line, in the form:
  <problem> = <answer>

Rules:
- Keep it terse. Do not show steps unless the problem itself asks for them.
- If a digit or operator is unclear in the image, append " ?" to that line and add a short note in parentheses (e.g., "is the second operand 6 or 8?").
- If a pencil overlay or smudge is obscuring something, mention what is obscured.
- Do not invent problems that are not in the image.`;

function corsHeaders(origin: string | null, allowed: string[]): Record<string, string> {
  const h: Record<string, string> = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
  if (origin && allowed.includes(origin)) {
    h['Access-Control-Allow-Origin'] = origin;
  }
  return h;
}

function json(body: unknown, init: ResponseInit = {}, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...extra,
      ...(init.headers as Record<string, string> | undefined),
    },
  });
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const origin = req.headers.get('Origin');
    const allowed = env.ALLOWED_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean);
    const cors = corsHeaders(origin, allowed);

    if (req.method === 'OPTIONS') {
      return new Response(null, {status: 204, headers: cors});
    }
    if (req.method === 'GET') {
      return json({ok: true, service: 'math-scanner'}, {status: 200}, cors);
    }
    if (req.method !== 'POST') {
      return json({error: 'method_not_allowed'}, {status: 405}, cors);
    }

    let body: Body;
    try {
      body = (await req.json()) as Body;
    } catch {
      return json({error: 'invalid_json'}, {status: 400}, cors);
    }

    if (typeof body.imageBase64 !== 'string' || body.imageBase64.length === 0) {
      return json({error: 'missing_image'}, {status: 400}, cors);
    }
    const mimeType = typeof body.mimeType === 'string' ? body.mimeType : 'image/jpeg';

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${env.GEMINI_API_KEY}`;
    const gResp = await fetch(url, {
      method: 'POST',
      headers: {'content-type': 'application/json'},
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {inline_data: {mime_type: mimeType, data: body.imageBase64}},
              {text: PROMPT},
            ],
          },
        ],
        generationConfig: {temperature: 0.1},
      }),
    });

    if (!gResp.ok) {
      const detail = await gResp.text().catch(() => '');
      console.error('gemini_failed', gResp.status, detail.slice(0, 500));
      return json({error: 'ai_failed', status: gResp.status}, {status: 502}, cors);
    }

    const data = (await gResp.json()) as {
      candidates?: Array<{content?: {parts?: Array<{text?: string}>}}>;
    };
    const answer = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!answer) {
      console.error('gemini_no_text', JSON.stringify(data).slice(0, 500));
      return json({error: 'ai_no_answer'}, {status: 502}, cors);
    }

    return json({answer}, {status: 200}, cors);
  },
};
