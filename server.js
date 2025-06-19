require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const app = express();
app.use(cors());
app.use(express.json());

const OPENAI_API_KEY = process.env.OPENAI_API_KEY; // Now loaded from .env

app.post('/generate-reply', async (req, res) => {
  try {
    const { prompt, tone, customInstruction } = req.body;
    let systemPrompt = `Reply in a ${tone} tone. Do NOT include a subject line in your reply. Only generate the body of the email.`;
    if (customInstruction && customInstruction.trim()) {
      systemPrompt += ` Custom instruction: ${customInstruction.trim()}`;
    }
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ]
      },
      {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    res.json({ reply: response.data.choices[0].message.content.trim() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(3001, () => console.log('Proxy server running on port 3001')); 