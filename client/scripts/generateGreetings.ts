import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize client (Ensure you have ELEVENLABS_API_KEY exported in your terminal)
const elevenlabs = new ElevenLabsClient();

const greetings = [
  { locale: "en-GB", code: "en", text: "Welcome back" },
  { locale: "de-DE", code: "de", text: "Willkommen zurück" },
  { locale: "es-ES", code: "es", text: "Bienvenido de nuevo" },
  { locale: "fr-FR", code: "fr", text: "Bon retour" },
  { locale: "nl-NL", code: "nl", text: "Welkom terug" },
  { locale: "tr-TR", code: "tr", text: "Tekrar hoşgeldin" },
  { locale: "uk-UA", code: "uk", text: "З поверненням" },
  { locale: "ar",    code: "ar", text: "مرحباً بعودتك" },
  { locale: "zh-CN", code: "zh", text: "欢迎回来" },
];

const VOICE_ID = "NOpBlnGInO9m6vDvFkFC";

async function generateAll() {
  const outDir = path.resolve(__dirname, "../public/audio/greetings");
  await fs.mkdir(outDir, { recursive: true });

  console.log(`Starting sequential generation of ${greetings.length} greetings...`);

  for (const greeting of greetings) {
    console.log(`⚡ Generating [${greeting.locale}]...`);
    
    try {
      const audioStream = await elevenlabs.textToSpeech.convert(VOICE_ID, {
        text: greeting.text,
        model_id: "eleven_multilingual_v2", // Multilingual model handles all 9 locales properly natively
        output_format: "mp3_44100_128", // Explicit standard high-quality MP3 bounds
      });

      // The JS SDK returns an async iterable stream
      const chunks: Buffer[] = [];
      for await (const chunk of audioStream) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);
      
      const filePath = path.join(outDir, `${greeting.locale}.mp3`);
      await fs.writeFile(filePath, buffer);

      console.log(`✓ Saved ${greeting.locale}.mp3`);
    } catch (e) {
      console.error(`X Failed to generate [${greeting.locale}]:`, e);
    }
    
    // Slight pause between API calls to gracefully prevent HTTP 429 Rate Limits
    await new Promise(resolve => setTimeout(resolve, 800));
  }
  
  console.log("🎉 All generations completed!");
}

generateAll().catch(console.error);
