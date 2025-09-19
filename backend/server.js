import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json()); // replaces body-parser

const PORT = 4000;

// Load Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Use Gemini Flash model
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// Chat route
app.post("/chat", async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || message.trim() === "") {
      return res.status(400).json({ reply: "⚠️ Please enter a message." });
    }

    const prompt = `
    You are an AI Career Advisor chatbot. 
    Always give clear, practical, and supportive career guidance. 
    Do not answer non-career-related queries. Politely redirect users if needed.

    User: ${message}
    `;

    const result = await model.generateContent(prompt);
    const aiResponse = result.response.text();

    res.json({ reply: aiResponse });
  } catch (error) {
    console.error("Gemini Error:", error);
    res.status(500).json({ reply: "⚠️ Sorry, I’m having trouble right now." });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(⁠`🚀 Gemini Career Advisor running at http://localhost:${PORT}`);
});
