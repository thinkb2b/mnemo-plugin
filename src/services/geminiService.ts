import { GoogleGenerativeAI } from "@google/generative-ai";
import type { AiGeneratedSnippet } from '../types';

const getApiKey = (): string => {
  // Vite Environment Variable
  const key = import.meta.env.VITE_GEMINI_API_KEY;
  
  if (!key || key === 'PLACEHOLDER_API_KEY') {
    throw new Error('Gemini API Key fehlt! Bitte in .env.local setzen.');
  }
  
  return key;
};

export const generateSnippet = async (prompt: string): Promise<AiGeneratedSnippet> => {
  const apiKey = getApiKey();
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-pro" });

  const systemPrompt = `
Du bist ein Assistent für professionelle E-Mail-Kommunikation.
Erstelle basierend auf der Anfrage einen E-Mail-Textbaustein.

WICHTIG:
- Identifiziere Variablen und markiere sie mit geschweiften Klammern: {Name}, {Datum}, {Betrag}
- Antworte NUR mit validem JSON (kein Markdown, keine Backticks)
- JSON Format: {"title": "...", "subject": "...", "body": "..."}
- Nutze \\n für Zeilenumbrüche im body

Benutzeranfrage:
${prompt}
`;

  try {
    const result = await model.generateContent(systemPrompt);
    const response = await result.response;
    const text = response.text();
    
    // Bereinige mögliche Markdown-Wrapping
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    const parsed = JSON.parse(cleaned);
    
    return {
      title: parsed.title || '',
      subject: parsed.subject || '',
      body: parsed.body || ''
    };
  } catch (error) {
    console.error('Gemini API Fehler:', error);
    throw new Error('KI-Generierung fehlgeschlagen. Bitte versuchen Sie es erneut.');
  }
};

export const improveText = async (text: string): Promise<string> => {
  const apiKey = getApiKey();
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-pro" });

  const prompt = `Verbessere den folgenden E-Mail-Text. Mache ihn professioneller, freundlicher und prägnanter. Behalte alle Variablen in {Klammern} bei:\n\n${text}`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error('Text-Verbesserung fehlgeschlagen:', error);
    return text;
  }
};