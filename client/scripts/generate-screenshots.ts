import { chromium } from 'playwright'
import { spawn } from 'child_process'
import { SCREENS, LOCALES, DEVICES } from '../src/screenshots/config.ts'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SCREENSHOTS_DIR = path.resolve(__dirname, '../ios/App/fastlane/screenshots')

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

        const outDir = path.join(SCREENSHOTS_DIR, locale.fastlaneDir)
        fs.mkdirSync(outDir, { recursive: true })
        const filename = `${device.name}-${screen.id}.png`
        await page.screenshot({
          path: path.join(outDir, filename),
          fullPage: false
        })
        console.log(`✓ ${locale.fastlaneDir}/${filename}`)
      }
      await context.close()
    }
  }

  await browser.close()
  server.kill()

  // Verification table
  console.log('\nLocale     | 1 | 2 | 3 | 4 | 5 | size_ok')
  for (const locale of LOCALES) {
    const checks = SCREENS.map(s => {
      const f = path.join(SCREENSHOTS_DIR, locale.fastlaneDir, `iPhone69-${s.id}.png`)
      return fs.existsSync(f) && fs.statSync(f).size > 100_000 ? '✓' : '✗'
    })
    const sizeOk = checks.every(c => c === '✓') ? '✓' : '✗'
    console.log(`${locale.fastlaneDir.padEnd(10)} | ${checks.join(' | ')} | ${sizeOk}`)
  }
}

main().catch(e => { console.error(e); process.exit(1) })
