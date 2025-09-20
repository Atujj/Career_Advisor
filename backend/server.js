// server.js - Backend server for AI Career Guide
import express from 'express';
import cors from 'cors';
import { GoogleGenerativeAI } from '@google/generative-ai';
import 'dotenv/config';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Gemini model configuration
const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    generationConfig: {
        temperature: 0.7,
        topP: 0.8,
        topK: 40,
        maxOutputTokens: 1000,
    },
    safetySettings: [
        {
            category: "HARM_CATEGORY_HARASSMENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
        },
        {
            category: "HARM_CATEGORY_HATE_SPEECH", 
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
        }
    ]
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        service: 'AI Career Guide Backend',
        model: 'Gemini 1.5 Flash',
        timestamp: new Date().toISOString()
    });
});

// Enhanced chat endpoint with user profile support
app.post('/api/chat', async (req, res) => {
    try {
        const { message, userProfile, timestamp } = req.body;

        // Validate request
        if (!message) {
            return res.status(400).json({
                error: 'Invalid request format',
                message: 'Message is required'
            });
        }

        // Build context-aware prompt
        let systemPrompt = `You are an expert AI Career Counselor developed by Code Lords team. You provide personalized, actionable career advice with deep knowledge of:

        - Global job market trends (2024-2025)
        - Industry-specific insights and salary ranges
        - Skills development and certification paths
        - Career transition strategies
        - Interview preparation and resume optimization
        - Emerging technologies and their career impact

        PERSONALITY: Professional yet conversational, encouraging, and practical. Always provide specific, actionable advice.

        RESPONSE STYLE:
        - Ask relevant follow-up questions
        - Provide concrete next steps with timelines
        - Include salary ranges and market insights when relevant
        - Suggest specific courses, certifications, or resources
        - Be encouraging but realistic about career prospects`;

        // Add user profile context if available
        if (userProfile && userProfile.quizCompleted) {
            systemPrompt += `\n\nUSER PROFILE (from completed quiz):
            - Interests: ${userProfile.interests.join(', ')}
            - Skills: ${userProfile.skills.join(', ')}
            - Experience Level: ${userProfile.experience}
            - Work Style: ${userProfile.workStyle}
            - Career Goals: ${userProfile.careerGoals}
            - Preferred Industry: ${userProfile.industry}
            
            Use this profile information to provide highly personalized recommendations that align with their interests and goals.`;
        } else {
            systemPrompt += `\n\nNOTE: User hasn't completed the career quiz yet. Encourage them to take the quiz for more personalized recommendations.`;
        }

        const conversationContext = [
            {
                role: "user",
                parts: [{ text: `${systemPrompt}\n\nUser Question: ${message}` }]
            }
        ];

        console.log(`[${timestamp}] Processing chat with user profile: ${userProfile?.quizCompleted ? 'Yes' : 'No'}`);

        // Generate response using Gemini
        const result = await model.generateContent(conversationContext[0].parts[0].text);
        const aiResponse = result.response.text();

        console.log(`[${timestamp}] Generated response: ${aiResponse.substring(0, 100)}...`);

        res.json({
            reply: aiResponse,
            model: 'gemini-1.5-flash',
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Chat API Error:', error);
        
        // Handle specific Gemini API errors
        if (error.message.includes('API_KEY_INVALID')) {
            return res.status(401).json({
                error: 'API key invalid',
                message: 'Please check your Gemini API key configuration'
            });
        }

        if (error.message.includes('RATE_LIMIT_EXCEEDED')) {
            return res.status(429).json({
                error: 'Rate limit exceeded',
                message: 'Too many requests. Please try again later.'
            });
        }

        res.status(500).json({
            error: 'Internal server error',
            message: 'Failed to generate AI response'
        });
    }
});

// Quiz analysis endpoint
app.post('/api/quiz-analysis', async (req, res) => {
    try {
        const { answers } = req.body;

        if (!answers || typeof answers !== 'object') {
            return res.status(400).json({
                error: 'Invalid request',
                message: 'Quiz answers are required'
            });
        }

        // Analyze quiz responses
        const analysisPrompt = `
        As an expert career counselor, analyze these quiz responses and provide personalized career guidance:

        QUIZ RESPONSES:
        ${Object.entries(answers).map(([questionId, answer]) => `Q${questionId}: ${answer}`).join('\n')}

        Please provide a comprehensive analysis in the following format:

        **CAREER PROFILE ANALYSIS:**
        Write a 2-3 sentence summary of their personality, work preferences, and natural strengths based on the quiz responses.

        **TOP 3 CAREER RECOMMENDATIONS:**
        1. [Job Title] - [Brief description]. Match: [70-95]%
        2. [Job Title] - [Brief description]. Match: [70-95]%
        3. [Job Title] - [Brief description]. Match: [70-95]%

        **NEXT STEPS:**
        - [Specific, actionable step 1]
        - [Specific, actionable step 2]
        - [Specific, actionable step 3]
        - [Specific, actionable step 4]
        - [Specific, actionable step 5]

        Keep the tone professional but encouraging. Focus on growth opportunities and practical advice.`;

        const result = await model.generateContent(analysisPrompt);
        const analysis = result.response.text();

        // Extract profile data from responses for AI context
        const profile = extractProfileFromAnswers(answers);

        // Parse AI analysis for structured response
        const structuredAnalysis = parseAnalysis(analysis);

        res.json({
            analysis: structuredAnalysis.summary,
            recommendations: structuredAnalysis.recommendations,
            nextSteps: structuredAnalysis.nextSteps,
            profile: profile,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Quiz Analysis Error:', error);
        res.status(500).json({
            error: 'Analysis failed',
            message: 'Failed to analyze quiz responses'
        });
    }
});

// Helper function to extract profile from quiz answers
function extractProfileFromAnswers(answers) {
    const profile = {
        interests: [],
        skills: [],
        experience: '',
        workStyle: '',
        careerGoals: '',
        industry: ''
    };

    // Map quiz answers to profile attributes
    Object.entries(answers).forEach(([questionId, answer]) => {
        switch(parseInt(questionId)) {
            case 1: // Activities
                if (answer === 'analytical') profile.interests.push('Problem Solving', 'Analysis');
                else if (answer === 'creative') profile.interests.push('Creative Work', 'Design');
                else if (answer === 'people-oriented') profile.interests.push('People Management', 'Communication');
                else if (answer === 'leadership') profile.interests.push('Leadership', 'Management');
                break;
            
            case 2: // Work environment
                profile.workStyle = answer;
                break;
            
            case 3: // Motivation
                if (answer === 'financial') profile.careerGoals = 'Financial success and stability';
                else if (answer === 'impact') profile.careerGoals = 'Making positive social impact';
                else if (answer === 'growth') profile.careerGoals = 'Personal and professional growth';
                else if (answer === 'recognition') profile.careerGoals = 'Achievement and recognition';
                break;
            
            case 4: // Subject areas
                profile.industry = answer;
                break;
            
            case 7: // Skills to develop
                if (answer === 'technical') profile.skills.push('Technical Skills', 'Programming');
                else if (answer === 'communication') profile.skills.push('Communication', 'Presentation');
                else if (answer === 'leadership-skills') profile.skills.push('Leadership', 'Management');
                else if (answer === 'creative-skills') profile.skills.push('Creative Skills', 'Design');
                break;
            
            case 10: // Career timeline
                profile.experience = answer;
                break;
        }
    });

    return profile;
}

// Helper function to parse AI analysis into structured format
function parseAnalysis(analysisText) {
    const structuredAnalysis = {
        summary: '',
        recommendations: [],
        nextSteps: []
    };

    // Regex to find and extract the content of each section
    const summaryMatch = analysisText.match(/\*\*CAREER PROFILE ANALYSIS:\*\*\n*(.*?)\n*\*\*TOP 3 CAREER RECOMMENDATIONS:\*\*/s);
    if (summaryMatch) {
        structuredAnalysis.summary = summaryMatch[1].trim();
    }
    
    const recsMatch = analysisText.match(/\*\*TOP 3 CAREER RECOMMENDATIONS:\*\*\n*(.*?)\n*\*\*NEXT STEPS:\*\*/s);
    if (recsMatch) {
        const recLines = recsMatch[1].trim().split('\n');
        recLines.forEach(line => {
            const recMatch = line.match(/^\d+\. (.*?) - (.*?) Match: (\d+)%/);
            if (recMatch) {
                structuredAnalysis.recommendations.push({
                    title: recMatch[1].trim(),
                    description: recMatch[2].trim(),
                    match: parseInt(recMatch[3])
                });
            }
        });
    }

    const nextStepsMatch = analysisText.match(/\*\*NEXT STEPS:\*\*\n*(.*?)$/s);
    if (nextStepsMatch) {
        const stepLines = nextStepsMatch[1].trim().split('\n');
        structuredAnalysis.nextSteps = stepLines.map(line => line.replace(/^[-•]\s*/, '').trim());
    }
    
    return structuredAnalysis;
}

// Additional endpoints
app.post('/api/career-assessment', async (req, res) => {
    try {
        const { experience, workStyle, skills, goals } = req.body;

        const assessmentPrompt = `
        As an expert AI Career Counselor, please analyze this career profile and provide a comprehensive assessment:

        **Profile:**
        - Experience Level: ${experience}
        - Preferred Work Style: ${workStyle}  
        - Skills/Interests: ${skills}
        - Career Goals: ${goals || 'Not specified'}

        **Please provide:**

        1. **Top 3 Career Recommendations** with specific job titles
        2. **Skills Analysis** - strengths and gaps to address
        3. **Learning Path** - specific courses, certifications, or resources
        4. **Market Outlook** - salary ranges and job market trends
        5. **Next Steps** - actionable items with timeline

        Format your response in a structured, easy-to-read manner with clear sections.
        `;

        const result = await model.generateContent(assessmentPrompt);
        const assessment = result.response.text();

        res.json({
            assessment,
            profile: { experience, workStyle, skills, goals },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Assessment API Error:', error);
        res.status(500).json({
            error: 'Assessment failed',
            message: 'Failed to generate career assessment'
        });
    }
});

// Industry insights endpoint
app.get('/api/industry-insights/:industry?', async (req, res) => {
    try {
        const industry = req.params.industry || 'technology';
        
        const insightsPrompt = `
        Provide current industry insights for the ${industry} sector in 2024-2025:

        1. **Growth Trends** - What's driving growth?
        2. **Hot Skills** - Most in-demand skills right now
        3. **Emerging Roles** - New job titles appearing
        4. **Salary Ranges** - Current market rates
        5. **Future Outlook** - Predictions for next 2-3 years
        6. **Entry Points** - How to break into this industry

        Keep it current, specific, and actionable.
        `;

        const result = await model.generateContent(insightsPrompt);
        const insights = result.response.text();

        res.json({
            industry,
            insights,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Industry Insights Error:', error);
        res.status(500).json({
            error: 'Failed to fetch insights',
            message: 'Unable to generate industry insights'
        });
    }
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Unhandled error:', error);
    res.status(500).json({
        error: 'Internal server error',
        message: 'Something went wrong on the server'
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 AI Career Guide Backend running on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
    console.log(`🤖 Chat endpoint: http://localhost:${PORT}/api/chat`);
    
    // Check if Gemini API key is configured
    if (!process.env.GEMINI_API_KEY) {
        console.warn('⚠️  WARNING: GEMINI_API_KEY not found in environment variables!');
        console.log('📝 Please add GEMINI_API_KEY to your .env file');
    } else {
        console.log('✅ Gemini API key configured');
    }
});

export default app;
