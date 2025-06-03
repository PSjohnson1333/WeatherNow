// proxy-server.js
const dotenv = require('dotenv'); // Require the library first

// Configure dotenv to load 'backend.env'
const result = dotenv.config({ path: './backend.env' }); // or just 'backend.env' if in the same dir

if (result.error) {
  console.error('Error loading .env file:', result.error);
  // process.exit(1); // Uncomment to exit if .env loading fails
}

const express = require('express');
const cors = require('cors'); // For enabling Cross-Origin Resource Sharing
const fetch = require('node-fetch'); // For making HTTP requests from the server
const { GoogleGenerativeAI } = require("@google/generative-ai"); // For Google AI

const app = express(); // Initialize Express app
const PORT = 3000; // Define the port the server will listen on

// --- API and Base URL Configurations ---
const NWS_API_BASE_URL = "https://api.weather.gov";
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const POSITIONSTACK_API_KEY = process.env.POSITIONSTACK_API_KEY;

// --- Initialize Google AI Client ---
let genAI;
if (GOOGLE_API_KEY) {
    try {
        genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);
        console.log("Google AI SDK initialized successfully.");
    } catch (e) {
        console.error("ERROR: Could not initialize GoogleGenerativeAI. Check your API key and SDK setup.", e.message);
        genAI = null; // Ensure genAI is null if initialization fails
    }
} else {
    console.warn("WARNING: GOOGLE_API_KEY is not set in backend.env. AI features will be disabled.");
}

// --- Middleware ---
app.use(cors()); // Enable CORS for all routes
app.use(express.json()); // Middleware to parse JSON request bodies

// --- Geocoding Proxy (Example: Positionstack) ---
app.get('/api/geocode/positionstack', async (req, res) => {
    const query = req.query.query;
    if (!POSITIONSTACK_API_KEY) {
        return res.status(500).json({ error: "Positionstack API key not configured on server." });
    }
    if (!query) {
        return res.status(400).json({ error: "Query parameter is required for geocoding." });
    }
    const url = `http://api.positionstack.com/v1/forward?access_key=${POSITIONSTACK_API_KEY}&query=${encodeURIComponent(query)}&limit=5`;
    try {
        // console.log('PROXY SERVER GEOCODE: typeof fetch is:', typeof fetch); // Keep for debugging if needed
        const response = await fetch(url);
        const data = await response.json();
        if (!response.ok || data.error) {
            const errorMsg = data.error?.message || data.error?.context?.query?.message || `Positionstack API error: ${response.status}`;
            console.error("Positionstack API Error Response:", data.error);
            throw new Error(errorMsg);
        }
        res.json(data);
    } catch (error) {
        console.error("Positionstack proxy error:", error.message);
        res.status(500).json({ error: "Failed to fetch from Positionstack", details: error.message });
    }
});

// --- NWS Points Proxy ---
app.get('/api/nws/points/:latlon', async (req, res) => {
    const { latlon } = req.params;
    if (!latlon) {
        return res.status(400).json({ error: "Latitude and longitude are required." });
    }
    const url = `${NWS_API_BASE_URL}/points/${latlon}`;
    try {
        // console.log('PROXY SERVER NWS POINTS: typeof fetch is:', typeof fetch); // Keep for debugging if needed
        const response = await fetch(url, {
            headers: { 'User-Agent': 'MyWeatherApp/1.0 (your.email@example.com)' }
        });
        const data = await response.json();
        if (!response.ok) {
            const errorDetail = data.detail || data.title || `NWS Points API error: ${response.status}`;
            throw new Error(errorDetail);
        }
        res.json(data);
    } catch (error) {
        console.error("NWS Points proxy error:", error.message);
        res.status(500).json({ error: "Failed to fetch NWS points data", details: error.message });
    }
});

// --- NWS Forecast Proxy ---
app.get('/api/nws/forecast', async (req, res) => {
    const forecastUrl = req.query.url;
    if (!forecastUrl) {
        return res.status(400).json({ error: "NWS forecast URL is required." });
    }
    try {
        // console.log('PROXY SERVER NWS FORECAST: typeof fetch is:', typeof fetch); // Keep for debugging if needed
        const response = await fetch(decodeURIComponent(forecastUrl), {
            headers: { 'User-Agent': 'MyWeatherApp/1.0 (your.email@example.com)' }
        });
        const data = await response.json();
        if (!response.ok) {
            const errorDetail = data.detail || data.title || `NWS Forecast API error: ${response.status}`;
            throw new Error(errorDetail);
        }
        res.json(data);
    } catch (error) {
        console.error("NWS Forecast proxy error:", error.message);
        res.status(500).json({ error: "Failed to fetch NWS forecast data", details: error.message });
    }
});

// --- NWS Active Alerts Proxy ---
app.get('/api/nws/alerts/active', async (req, res) => {
    const { lat, lon } = req.query; 
    if (!lat || !lon) {
        return res.status(400).json({ error: "Required query parameters lat and lon missing for alerts." });
    }
    const alertUrl = `${NWS_API_BASE_URL}/alerts/active?point=${lat},${lon}`;
    try {
        // console.log('PROXY SERVER NWS ALERTS: typeof fetch is:', typeof fetch); // Keep for debugging if needed
        const response = await fetch(alertUrl, {
            headers: { 'User-Agent': 'MyWeatherApp/1.0 (your.email@example.com)' }
        });
        const data = await response.json(); 
        if (!response.ok) {
            const errorDetail = data.detail || data.title || `NWS Alerts API error: ${response.status}`;
            throw new Error(errorDetail);
        }
        res.json(data);
    } catch (error) {
        console.error("NWS Alerts proxy error:", error.message);
        res.status(500).json({ error: "Failed to fetch NWS alerts data", details: error.message });
    }
});


// --- Google AI Insights Endpoint ---
app.post('/api/googleai/generate-insights', async (req, res) => {
    if (!genAI) {
        return res.status(500).json({ error: "Google AI not configured or initialized on server." });
    }
    const { weatherData, locationName } = req.body;
    if (!weatherData || !locationName) {
        return res.status(400).json({ error: "weatherData and locationName are required." });
    }
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
        const prompt = `
            You are a friendly and insightful weather companion.
            The current weather in ${locationName} is:
            - Temperature: ${weatherData.temperature}°${weatherData.temperatureUnit}
            - Condition: ${weatherData.shortForecast}
            - Wind: ${weatherData.windSpeed} from ${weatherData.windDirection}
            - Detailed: ${weatherData.detailedForecast}
            ${weatherData.relativeHumidity && weatherData.relativeHumidity.value !== null ? `- Humidity: ${weatherData.relativeHumidity.value}%` : ''}

            Based on this, provide:
            1.  A concise, conversational summary of the current weather (1-2 sentences, like you're talking to a friend).
            2.  Suggest 1-2 suitable activities or considerations for this weather.
            3.  If applicable, offer a brief piece of practical advice (e.g., "remember sunscreen," "an umbrella might be handy later," "great for a walk").
            Keep the tone light and helpful. Format the output clearly. Do not use markdown for bolding, use plain text.`;
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        res.json({ insights: text });
    } catch (error) {
        console.error("Google AI Insights Error:", error.message, error.stack);
        res.status(500).json({ error: "Failed to generate weather insights.", details: error.message });
    }
});

// --- Google AI Alert Explanation Endpoint ---
app.post('/api/googleai/explain-alert', async (req, res) => {
    if (!genAI) {
        return res.status(500).json({ error: "Google AI not configured or initialized on server." });
    }
    const { alertProperties, locationName } = req.body;
    if (!alertProperties) {
        return res.status(400).json({ error: "alertProperties are required." });
    }
    const { 
        event = "Weather Alert", 
        headline = "No headline provided.", 
        description = "No description provided.", 
        instruction = "No specific instructions provided. Follow general safety guidelines.", 
        severity = "Unknown", 
        urgency = "Unknown" 
    } = alertProperties;

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
        const prompt = `
            You are a helpful assistant providing clear explanations for weather alerts.
            An active weather alert has been issued${locationName ? ` for ${locationName}` : ''}.

            Alert Details:
            - Event Type: ${event}
            - Severity: ${severity}
            - Urgency: ${urgency}
            - Headline: ${headline}
            - Description: ${description}
            - Instructions: ${instruction}

            Please explain this alert in simple, easy-to-understand language for a general audience.
            Focus on:
            1. What is the main hazard or event?
            2. What are the potential impacts or dangers?
            3. What specific actions should people take to stay safe, based on the instructions if provided, or general knowledge?
            4. How serious is this alert based on its severity and urgency?

            Keep the tone calm but direct and actionable. If instructions are present, emphasize them.
            Do not use markdown for bolding, use plain text. Structure your response clearly.`;
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        res.json({ explanation: text });
    } catch (error) {
        console.error("Google AI Explain Alert Error:", error.message, error.stack);
        res.status(500).json({ error: "Failed to generate alert explanation.", details: error.message });
    }
});

// --- Server Start ---
app.listen(PORT, () => {
    console.log(`Proxy server running on http://localhost:${PORT}`);
    if (POSITIONSTACK_API_KEY) {
        console.log("Positionstack proxy enabled (API key found).");
    } else {
        console.warn("WARNING: Positionstack API key not found in backend.env. Geocoding proxy will fail if used.");
    }
    if (genAI) {
        console.log("Google AI features should be available (API key found and SDK initialized).");
    } else {
        console.warn("WARNING: Google AI features will NOT be available (API key missing or SDK initialization failed).");
    }
});