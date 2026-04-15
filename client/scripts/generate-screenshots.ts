import { chromium } from 'playwright'
import { spawn } from 'child_process'
import { SCREENS, LOCALES, DEVICES } from '../src/screenshots/config.ts'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const IOS_SCREENSHOTS_DIR = path.resolve(__dirname, '../ios/App/fastlane/screenshots')
const ANDROID_SCREENSHOTS_DIR = path.resolve(__dirname, '../android/fastlane/metadata/android')

async function main() {
  // Start vite dev server on port 5174
  const server = spawn('npx', ['vite', '--port', '5174'], {
    cwd: path.resolve(__dirname, '..'),
    stdio: 'pipe'
  })
  
  console.log('Starting Vite server...');
  await new Promise(r => setTimeout(r, 4000)) // wait for server ready

  const browser = await chromium.launch()

  for (const locale of LOCALES) {
    for (const device of DEVICES) {
      const context = await browser.newContext({
        viewport: { width: device.width, height: device.height },
        deviceScaleFactor: device.scale
      })
      const page = await context.newPage()

      for (const screen of SCREENS) {
        const url = `http://localhost:5174/screenshot?screen=${screen.id}&lang=${locale.lang}`
        await page.goto(url)
        await page.waitForSelector('body.screenshot-ready', { timeout: 10000 })

        // iOS Output
        const iosOutDir = path.join(IOS_SCREENSHOTS_DIR, locale.fastlaneDir)
        fs.mkdirSync(iosOutDir, { recursive: true })
        const iosFilename = `${device.name}-${screen.id}.png`
        const iosPath = path.join(iosOutDir, iosFilename)

        // Android Output
        const androidPhoneDir = path.join(ANDROID_SCREENSHOTS_DIR, locale.androidDir, 'images', 'phoneScreenshots');
        const androidSevenDir = path.join(ANDROID_SCREENSHOTS_DIR, locale.androidDir, 'images', 'sevenInchScreenshots');
        const androidTenDir = path.join(ANDROID_SCREENSHOTS_DIR, locale.androidDir, 'images', 'tenInchScreenshots');
        
        fs.mkdirSync(androidPhoneDir, { recursive: true });
        fs.mkdirSync(androidSevenDir, { recursive: true });
        fs.mkdirSync(androidTenDir, { recursive: true });
        
        const androidFilename = `${screen.id}.png`;

        await page.screenshot({
          path: iosPath,
          fullPage: false
        });
        
        if (device.name === 'iPhone69') {
           fs.copyFileSync(iosPath, path.join(androidPhoneDir, androidFilename));
        } else if (device.name === 'iPadPro129') {
           fs.copyFileSync(iosPath, path.join(androidSevenDir, androidFilename));
           fs.copyFileSync(iosPath, path.join(androidTenDir, androidFilename));
        }
        
        console.log(`✓ ${locale.fastlaneDir}/${iosFilename}`);
      }
      await context.close()
    }
  }

  await browser.close()
  server.kill()

  // Synchronize Text Metadata to Android Supply Layout
  console.log('\nSynchronizing text metadata to Android...');
  for (const locale of LOCALES) {
    const iosMetaDir = path.join(__dirname, '../ios/App/fastlane/metadata', locale.fastlaneDir);
    const androidMetaDir = path.join(ANDROID_SCREENSHOTS_DIR, locale.androidDir);
    
    if (fs.existsSync(iosMetaDir)) {
      fs.mkdirSync(androidMetaDir, { recursive: true });
      
      const copyIfExists = (iosFile: string, androidFile: string) => {
        const iosPath = path.join(iosMetaDir, iosFile);
        if (fs.existsSync(iosPath)) {
          fs.copyFileSync(iosPath, path.join(androidMetaDir, androidFile));
        }
      };

      // Map strict iOS text limits safely into Google Play variables
      copyIfExists('name.txt', 'title.txt');                                // max 30 -> max 50
      copyIfExists('subtitle.txt', 'short_description.txt');                // max 30 -> max 80 (guarantees safe bounds)
      copyIfExists('description.txt', 'full_description.txt');              // max 4000 -> max 4000
      
      console.log(`✓ Copied text metadata: ${locale.fastlaneDir} -> ${locale.androidDir}`);
    }
  }

  // Verification table
  console.log('\nLocale     | 1 | 2 | 3 | 4 | 5 | size_ok')
  for (const locale of LOCALES) {
    const checks = SCREENS.map(s => {
      const f = path.join(IOS_SCREENSHOTS_DIR, locale.fastlaneDir, `iPhone69-${s.id}.png`)
      return fs.existsSync(f) && fs.statSync(f).size > 100_000 ? '✓' : '✗'
    })
    const sizeOk = checks.every(c => c === '✓') ? '✓' : '✗'
    console.log(`${locale.fastlaneDir.padEnd(10)} | ${checks.join(' | ')} | ${sizeOk}`)
  }
}

main().catch(e => { console.error(e); process.exit(1) })
