export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { imageBase64 } = req.body;
  if (!imageBase64) return res.status(400).json({ error: 'No image' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
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

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '인식 실패';

  res.json({ height: text });
}
