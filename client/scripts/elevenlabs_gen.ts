import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const VOICE_ID = "CwhRBWXzGAHq8TQ4Fs17"; // Roger (Standard Premade Voice)

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

async function generateAll() {
  const outDir = path.resolve(__dirname, "../public/audio/greetings");
  await fs.mkdir(outDir, { recursive: true });

  console.log(`Starting sequential native fetch generation for ${greetings.length} greetings...`);

  for (const greeting of greetings) {
    console.log(`🎙️  Generating [${greeting.locale}]...`);
    
    try {
      const resp = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=mp3_22050_32`, {
        method: "POST",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY!,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          text: greeting.text,
          model_id: "eleven_multilingual_v2"
        })
      });

      if (!resp.ok) {
        throw new Error(`API Error ${resp.status}: ${await resp.text()}`);
      }

      const arrayBuffer = await resp.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const filePath = path.join(outDir, `${greeting.locale}.mp3`);
      await fs.writeFile(filePath, buffer);

      console.log(`  ✓ Saved ${greeting.locale}.mp3`);
    } catch (e) {
      console.error(`  X Failed on [${greeting.locale}]:`, e);
    }
  }

  console.log("🎉 All premium clips generated & saved!");
}

generateAll().catch(console.error);
