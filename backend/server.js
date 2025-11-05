// server.js - AI Career Guide Backend (Updated for @google/genai SDK)

import express from "express";
import cors from "cors";
import { GoogleGenAI } from "@google/genai";
import "dotenv/config";

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Gemini AI (NEW SDK)
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

// Default model (change in .env if needed)
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash-001";

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: "healthy",
    service: "AI Career Guide Backend",
    model: GEMINI_MODEL,
    timestamp: new Date().toISOString(),
  });
});

// ========================= CHAT ENDPOINT ========================= //
app.post("/api/chat", async (req, res) => {
  try {
    const { message, userProfile, timestamp } = req.body;

    if (!message) {
      return res.status(400).json({
        error: "Invalid request format",
        message: "Message is required",
      });
    }

    // Build system prompt
    let systemPrompt = `You are an expert AI Career Counselor developed by the Code Lords team. You provide personalized, actionable career advice with deep knowledge of:
    - Global job market trends (2024–2025)
    - Industry-specific insights and salary ranges
    - Skills development and certification paths
    - Career transition strategies
    - Interview preparation and resume optimization
    - Emerging technologies and their career impact

    PERSONALITY: Professional yet conversational, encouraging, and practical. Always provide specific, actionable advice.`;

    if (userProfile && userProfile.quizCompleted) {
      systemPrompt += `\n\nUSER PROFILE:\n- Interests: ${userProfile.interests.join(", ")}\n- Skills: ${userProfile.skills.join(", ")}\n- Experience Level: ${userProfile.experience}\n- Work Style: ${userProfile.workStyle}\n- Career Goals: ${userProfile.careerGoals}\n- Preferred Industry: ${userProfile.industry}`;
    } else {
      systemPrompt += `\n\nNOTE: The user hasn't completed the career quiz yet. Encourage them to take it for more personalized recommendations.`;
    }

    console.log(`[${timestamp}] Processing chat with user profile: ${userProfile?.quizCompleted ? "Yes" : "No"}`);

    // Generate response using Gemini
    const result = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [
        {
          role: "user",
          parts: [{ text: `${systemPrompt}\n\nUser Question: ${message}` }],
        },
      ],
      generationConfig: {
        temperature: 0.7,
        topP: 0.8,
        topK: 40,
        maxOutputTokens: 1000,
      },
    });

    const aiResponse = result.text;
    console.log(`[${timestamp}] Generated response: ${aiResponse.substring(0, 100)}...`);

    res.json({
      reply: aiResponse,
      model: GEMINI_MODEL,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Chat API Error:", error);
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to generate AI response",
    });
  }
});

// ====================== QUIZ ANALYSIS ENDPOINT ====================== //
app.post("/api/quiz-analysis", async (req, res) => {
  try {
    const { answers } = req.body;

    if (!answers || typeof answers !== "object") {
      return res.status(400).json({
        error: "Invalid request",
        message: "Quiz answers are required",
      });
    }

    const analysisPrompt = `
    As an expert career counselor, analyze these quiz responses and provide personalized career guidance:

    QUIZ RESPONSES:
    ${Object.entries(answers)
      .map(([q, a]) => `Q${q}: ${a}`)
      .join("\n")}

    Please provide:
    **CAREER PROFILE ANALYSIS:** (2–3 sentences)
    **TOP 3 CAREER RECOMMENDATIONS:**
    1. [Job Title] - [Brief description]. Match: [70–95]%
    2. [Job Title] - [Brief description]. Match: [70–95]%
    3. [Job Title] - [Brief description]. Match: [70–95]%

    **NEXT STEPS:** 5 practical actions.
    `;

    const result = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [{ role: "user", parts: [{ text: analysisPrompt }] }],
      generationConfig: {
        temperature: 0.7,
        topP: 0.8,
        topK: 40,
        maxOutputTokens: 1000,
      },
    });

    const analysis = result.text;

    const profile = extractProfileFromAnswers(answers);
    const structuredAnalysis = parseAnalysis(analysis);

    res.json({
      analysis: structuredAnalysis.summary,
      recommendations: structuredAnalysis.recommendations,
      nextSteps: structuredAnalysis.nextSteps,
      profile,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Quiz Analysis Error:", error);
    res.status(500).json({
      error: "Analysis failed",
      message: "Failed to analyze quiz responses",
    });
  }
});

// ====================== CAREER ASSESSMENT ENDPOINT ====================== //
app.post("/api/career-assessment", async (req, res) => {
  try {
    const { experience, workStyle, skills, goals } = req.body;

    const assessmentPrompt = `
    Analyze this career profile and provide a structured assessment:

    **Profile:**
    - Experience Level: ${experience}
    - Work Style: ${workStyle}
    - Skills/Interests: ${skills}
    - Career Goals: ${goals || "Not specified"}

    Include:
    1. Top 3 Career Recommendations
    2. Skills Analysis
    3. Learning Path
    4. Market Outlook
    5. Next Steps
    `;

    const result = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [{ role: "user", parts: [{ text: assessmentPrompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1000,
      },
    });

    const assessment = result.text;

    res.json({
      assessment,
      profile: { experience, workStyle, skills, goals },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Assessment API Error:", error);
    res.status(500).json({
      error: "Assessment failed",
      message: "Failed to generate career assessment",
    });
  }
});

// ====================== INDUSTRY INSIGHTS ENDPOINT ====================== //
app.get("/api/industry-insights/:industry?", async (req, res) => {
  try {
    const industry = req.params.industry || "technology";

    const insightsPrompt = `
    Provide up-to-date insights for the ${industry} industry (2024–2025):

    1. Growth Trends
    2. Hot Skills
    3. Emerging Roles
    4. Salary Ranges
    5. Future Outlook
    6. Entry Points
    `;

    const result = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [{ role: "user", parts: [{ text: insightsPrompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1000,
      },
    });

    const insights = result.text;

    res.json({
      industry,
      insights,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Industry Insights Error:", error);
    res.status(500).json({
      error: "Failed to fetch insights",
      message: "Unable to generate industry insights",
    });
  }
});

// ====================== HELPER FUNCTIONS ====================== //
function extractProfileFromAnswers(answers) {
  const profile = {
    interests: [],
    skills: [],
    experience: "",
    workStyle: "",
    careerGoals: "",
    industry: "",
  };

  Object.entries(answers).forEach(([id, answer]) => {
    switch (parseInt(id)) {
      case 1:
        if (answer === "analytical") profile.interests.push("Problem Solving", "Analysis");
        else if (answer === "creative") profile.interests.push("Creative Work", "Design");
        else if (answer === "people-oriented") profile.interests.push("People Management", "Communication");
        else if (answer === "leadership") profile.interests.push("Leadership", "Management");
        break;
      case 2:
        profile.workStyle = answer;
        break;
      case 3:
        if (answer === "financial") profile.careerGoals = "Financial success and stability";
        else if (answer === "impact") profile.careerGoals = "Positive social impact";
        else if (answer === "growth") profile.careerGoals = "Personal and professional growth";
        else if (answer === "recognition") profile.careerGoals = "Achievement and recognition";
        break;
      case 4:
        profile.industry = answer;
        break;
      case 7:
        if (answer === "technical") profile.skills.push("Technical Skills", "Programming");
        else if (answer === "communication") profile.skills.push("Communication", "Presentation");
        else if (answer === "leadership-skills") profile.skills.push("Leadership", "Management");
        else if (answer === "creative-skills") profile.skills.push("Creative Skills", "Design");
        break;
      case 10:
        profile.experience = answer;
        break;
    }
  });
  return profile;
}

function parseAnalysis(text) {
  const structured = { summary: "", recommendations: [], nextSteps: [] };
  const summaryMatch = text.match(/\*\*CAREER PROFILE ANALYSIS:\*\*([\s\S]*?)\*\*TOP 3/);
  if (summaryMatch) structured.summary = summaryMatch[1].trim();
  const recsMatch = text.match(/\*\*TOP 3 CAREER RECOMMENDATIONS:\*\*([\s\S]*?)\*\*NEXT/);
  if (recsMatch) {
    recsMatch[1]
      .trim()
      .split("\n")
      .forEach((line) => {
        const m = line.match(/^\d+\. (.*?) - (.*?) Match: (\d+)%/);
        if (m) structured.recommendations.push({ title: m[1], description: m[2], match: parseInt(m[3]) });
      });
  }
  const nextStepsMatch = text.match(/\*\*NEXT STEPS:\*\*([\s\S]*)$/);
  if (nextStepsMatch) {
    structured.nextSteps = nextStepsMatch[1].trim().split("\n").map((l) => l.replace(/^[-•]\s*/, "").trim());
  }
  return structured;
}

// ====================== ERROR HANDLER ====================== //
app.use((error, req, res, next) => {
  console.error("Unhandled error:", error);
  res.status(500).json({
    error: "Internal server error",
    message: "Something went wrong on the server",
  });
});

// ====================== START SERVER ====================== //
app.listen(PORT, async () => {
  console.log(`🚀 AI Career Guide Backend running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🤖 Chat endpoint: http://localhost:${PORT}/api/chat`);

  if (!process.env.GEMINI_API_KEY) {
    console.warn("⚠️  WARNING: GEMINI_API_KEY not found in .env");
  } else {
    console.log("✅ Gemini API key configured");
  }

  try {
    const list = await ai.models.list();
    console.log("✅ Available Gemini models:", list.models.slice(0, 5).map((m) => m.name));
  } catch (err) {
    console.warn("⚠️ Could not list Gemini models:", err.message);
  }
});

export default app;
