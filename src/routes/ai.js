const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const ai = require('../services/ai');

router.use(rateLimit({ windowMs: 60 * 1000, max: 20, message: { error: 'Too many AI requests, try again in a minute.' } }));

// POST /api/ai/analyze  { text, task: "sentiment" | "summary" | "both" }
// API keys stay on the server (.env) and are never exposed to the browser.
router.post('/analyze', async (req, res) => {
  const { text, task = 'both' } = req.body || {};
  if (!text || text.trim().length < 10) return res.status(400).json({ error: 'Please send at least 10 characters of text' });
  if (text.length > 5000) return res.status(400).json({ error: 'Text too long (max 5000 characters)' });

  const result = {};
  if (task === 'sentiment' || task === 'both') result.sentiment = await ai.sentiment(text);
  if (task === 'summary' || task === 'both') result.summary = await ai.summarize(text);
  res.json(result);
});

module.exports = router;
