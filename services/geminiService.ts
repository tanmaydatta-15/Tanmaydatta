
import { GoogleGenAI, Modality, GenerateContentResponse, GroundingChunk } from "@google/genai";
import { ChatMessage, MessageType, Sender, AppMode, UserSettings } from '../types';

// Constants
export const STARTUP_MESSAGE: ChatMessage = {
  id: 'start-1',
  sender: Sender.AI,
  type: MessageType.Text,
  text: 'Friday is online and ready. Select a mode or ask me anything!',
  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
};

// Models Configuration
const MODEL_TEXT_FAST = 'gemini-3-flash-preview';
const MODEL_TEXT_PRO = 'gemini-3-pro-preview';
const MODEL_VISION = 'gemini-2.5-flash';
const MODEL_IMAGE_GEN = 'gemini-2.5-flash-image';

// Utility Functions
export const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.onerror = (error) => reject(error);
  });

export const getMimeType = (file: File): string => {
    return file.type;
};

// Gemini Service
let ai: GoogleGenAI;
try {
  ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });
} catch (error) {
  console.error("Failed to initialize GoogleGenAI:", error);
}

export const GeminiService = {
  generateChatResponse: async (prompt: string, mode: AppMode, settings: UserSettings): Promise<string> => {
    if (!ai) throw new Error("Gemini AI not initialized.");

    const model = (settings.highReasoningMode || mode === AppMode.Task) ? MODEL_TEXT_PRO : MODEL_TEXT_FAST;
    const tools: any[] = [];
    
    if (settings.extensions.googleSearch) tools.push({ googleSearch: {} });
    if (settings.extensions.googleMaps) tools.push({ googleMaps: {} });

    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        tools: tools.length > 0 ? tools : undefined,
        thinkingConfig: (model === MODEL_TEXT_PRO) ? { thinkingBudget: 16000 } : undefined,
      }
    });
    
    return response.text || "";
  },

  generateSearchResponse: async (prompt: string, settings: UserSettings): Promise<{ text: string; citations: { uri: string; title: string }[] }> => {
    if (!ai) throw new Error("Gemini AI not initialized.");
    
    const response = await ai.models.generateContent({
      model: MODEL_TEXT_FAST,
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const groundingChunks: GroundingChunk[] = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const citations = groundingChunks
      .map(chunk => chunk.web)
      .filter(web => web?.uri && web?.title)
      .map(web => ({ uri: web!.uri!, title: web!.title! }));

    return { text: response.text || "No results found.", citations };
  },

  generateImage: async (prompt: string, imageBase64?: string, mimeType?: string): Promise<string> => {
    if (!ai) throw new Error("Gemini AI not initialized.");
    
    const parts: any[] = [];
    if (imageBase64 && mimeType) {
        parts.push({ inlineData: { mimeType, data: imageBase64 } });
    }
    parts.push({ text: prompt });

    const response = await ai.models.generateContent({
      model: MODEL_IMAGE_GEN,
      contents: { parts: parts },
      config: {
        responseModalities: [Modality.IMAGE],
      },
    });

    for (const part of response.candidates?.[0]?.content.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    throw new Error('No image was generated.');
  },

  analyzeImage: async (prompt: string, imageBase64: string, mimeType: string): Promise<string> => {
    if (!ai) throw new Error("Gemini AI not initialized.");
    const response = await ai.models.generateContent({
      model: MODEL_VISION,
      contents: { 
        parts: [
          { text: prompt }, 
          { inlineData: { mimeType, data: imageBase64 } }
        ] 
      },
    });
    return response.text || "I couldn't analyze the image.";
  },
};
