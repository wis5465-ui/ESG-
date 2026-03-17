export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { imageBase64 } = req.body;
  if (!imageBase64) return res.status(400).json({ error: 'No image' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY not set' });

  let response, data;
  try {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              {
                text: '이 사진에 있는 식물의 높이를 추정해주세요. 숫자와 단위(cm)만 답변해주세요. 예: 23cm. 식물이 없으면 "측정 불가"라고만 답변해주세요.'
              },
              {
                inline_data: { mime_type: 'image/jpeg', data: imageBase64 }
              }
            ]
          }]
        })
      }
    );
    data = await response.json();
  } catch (e) {
    return res.status(500).json({ error: 'fetch failed', detail: e.message });
  }

  if (!response.ok) {
    return res.status(500).json({ error: 'Gemini API error', status: response.status, detail: data });
  }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!text) {
    return res.status(500).json({ error: 'No text in response', raw: data });
  }
  res.json({ height: text });
}
