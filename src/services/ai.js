// Hybrid AI service: OpenAI -> HuggingFace -> built-in fallback (always works for demos)

const POS = ['good','great','excellent','amazing','love','awesome','happy','best','fantastic','nice','wonderful','perfect','fast','easy','helpful','recommend'];
const NEG = ['bad','terrible','awful','hate','worst','poor','slow','sad','broken','horrible','disappointed','useless','difficult','bug','angry','waste'];

function localSentiment(text) {
  const words = text.toLowerCase().match(/[a-z']+/g) || [];
  const p = words.filter((w) => POS.includes(w)).length;
  const n = words.filter((w) => NEG.includes(w)).length;
  const label = p > n ? 'POSITIVE' : n > p ? 'NEGATIVE' : 'NEUTRAL';
  const total = p + n;
  return { label, score: total ? Number((Math.max(p, n) / total).toFixed(2)) : 0.5, provider: 'built-in' };
}

function localSummary(text) {
  const sentences = text.match(/[^.!?]+[.!?]*/g) || [text];
  const freq = {};
  (text.toLowerCase().match(/[a-z]{4,}/g) || []).forEach((w) => (freq[w] = (freq[w] || 0) + 1));
  const ranked = sentences
    .map((s, i) => ({ s: s.trim(), i, v: (s.toLowerCase().match(/[a-z]{4,}/g) || []).reduce((a, w) => a + (freq[w] || 0), 0) }))
    .sort((a, b) => b.v - a.v).slice(0, Math.min(2, sentences.length)).sort((a, b) => a.i - b.i);
  return { summary: ranked.map((r) => r.s).join(' '), provider: 'built-in' };
}

async function openai(prompt) {
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: prompt }], temperature: 0.2 })
  });
  if (!r.ok) throw new Error(`OpenAI ${r.status}`);
  return (await r.json()).choices[0].message.content.trim();
}

async function hf(model, text) {
  const r = await fetch(`https://router.huggingface.co/hf-inference/models/${model}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.HF_TOKEN}` },
    body: JSON.stringify({ inputs: text })
  });
  if (!r.ok) throw new Error(`HuggingFace ${r.status}`);
  return r.json();
}

async function sentiment(text) {
  try {
    if (process.env.OPENAI_API_KEY) {
      const out = await openai(`Classify the sentiment of this text as POSITIVE, NEGATIVE or NEUTRAL. Reply with only one word.\n\n${text}`);
      return { label: out.toUpperCase().replace(/[^A-Z]/g, ''), score: null, provider: 'openai' };
    }
    if (process.env.HF_TOKEN) {
      const data = await hf('distilbert/distilbert-base-uncased-finetuned-sst-2-english', text);
      const top = (Array.isArray(data[0]) ? data[0] : data).sort((a, b) => b.score - a.score)[0];
      return { label: top.label, score: Number(top.score.toFixed(2)), provider: 'huggingface' };
    }
  } catch (e) { console.error('[ai] falling back:', e.message); }
  return localSentiment(text);
}

async function summarize(text) {
  try {
    if (process.env.OPENAI_API_KEY) {
      return { summary: await openai(`Summarize the following text in 2 short sentences:\n\n${text}`), provider: 'openai' };
    }
    if (process.env.HF_TOKEN) {
      const data = await hf('facebook/bart-large-cnn', text);
      return { summary: data[0].summary_text, provider: 'huggingface' };
    }
  } catch (e) { console.error('[ai] falling back:', e.message); }
  return localSummary(text);
}

module.exports = { sentiment, summarize, localSentiment, localSummary };
