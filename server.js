require("dotenv").config();
const express = require("express");
const axios = require("axios");
const cors = require("cors");
const app = express();
app.use(cors());
app.use(express.json());

const OPENAI_API_KEY = process.env.OPENAI_API_KEY; // Now loaded from .env

// Check for API key and log status
if (!OPENAI_API_KEY) {
  console.error(
    "FATAL ERROR: OPENAI_API_KEY is not set. Please create a .env file and add your key."
  );
  process.exit(1); // Stop the server if the key isn't found
} else {
  console.log("OpenAI API Key loaded successfully.");
}

app.post("/generate-reply", async (req, res) => {
  console.log("Received a request to /generate-reply");
  try {
    // console.log("Received request body:", req.body);
    const { prompt, tone, customInstruction, n, draft } = req.body;
    let systemPrompt = `Reply in a ${tone} tone. Do NOT include a subject line in your reply. Only generate the body of the email.`;
    if (customInstruction && customInstruction.trim()) {
      systemPrompt += ` Custom instruction: ${customInstruction.trim()}`;
    }
    const completionsCount = n && Number.isInteger(n) && n > 0 ? n : 2;

    let messages;
    if (draft && draft.trim()) {
      // If a draft is present, ask the model to improve it
      messages = [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Here is the email context:
            ${prompt}

            Here is my current draft reply:
            ${draft}

            Instruction: ${customInstruction || ""}

            Please improve the draft reply according to the instruction and tone.`,
        },
      ];
    } else {
      messages = [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Here is the email context:
          ${prompt}

          // Here is my current draft reply:
          // ${draft}

          Instruction: ${customInstruction || ""}

          Please give me appropriate reply according to the email context and tone and custom instruction(if any).`,
        },
      ];
      
    }

    console.log("Received request body:", messages);

    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-3.5-turbo",
        n: completionsCount,
        messages: messages,
      },
      {
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );
    console.log("Successfully received response from OpenAI.");
    res.json({
      replies: response.data.choices.map((choice) =>
        choice.message.content.trim()
      ),
    });
  } catch (err) {
    console.error(
      "Error calling OpenAI API:",
      err.response ? err.response.data : err.message
    );
    res.status(500).json({ error: "Failed to call OpenAI API" });
  }
});

app.listen(3001, () => console.log("Proxy server running on port 3001"));
