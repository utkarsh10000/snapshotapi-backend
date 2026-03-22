const express = require('express')
const puppeteer = require('puppeteer')
const authMiddleware = require('../middleware/auth')
const router = express.Router()

// GET /api/screenshot
// Protected by API key
router.get('/screenshot', authMiddleware, async (req, res) => {
  const { url } = req.query
  const user = req.user // came from auth middleware

  // 1. Check if URL was provided
  if (!url) {
    return res.status(400).json({
      success: false,
      error: 'Please provide a URL. Example: /api/screenshot?url=https://google.com'
    })
  }

  // 2. Make sure URL has http/https
  let targetUrl = url
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    targetUrl = 'https://' + url
  }

  let browser = null

  try {
    // 3. Launch headless browser
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    })

    // 4. Open new page
    const page = await browser.newPage()

    // 5. Set screen size (desktop by default)
    await page.setViewport({ width: 1280, height: 720 })

    // 6. Visit the URL (wait until fully loaded)
    await page.goto(targetUrl, {
      waitUntil: 'networkidle2',
      timeout: 30000
    })

    // 7. Take screenshot as base64
    const screenshot = await page.screenshot({
      encoding: 'base64',
      fullPage: false
    })

    // 8. Close browser
    await browser.close()

    // 9. Increment usage count in database
    user.usage += 1
    await user.save()

    // 10. Send back the result
    return res.status(200).json({
      success: true,
      url: targetUrl,
      image: `data:image/png;base64,${screenshot}`,
      takenAt: new Date().toISOString(),
      usage: {
        used: user.usage,
        plan: user.plan,
      },
    })

  } catch (error) {
    // Close browser if something went wrong
    if (browser) await browser.close()

    console.error('Screenshot error:', error.message)

    return res.status(500).json({
      success: false,
      error: 'Failed to take screenshot. Make sure the URL is valid and accessible.'
    })
  }
})

module.exports = router