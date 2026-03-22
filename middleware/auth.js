const User = require('../models/User')

// Plan limits
const PLAN_LIMITS = {
  free: 50,
  starter: 500,
  pro: 5000,
}

const authMiddleware = async (req, res, next) => {
  // 1. Get API key from request header
  const apiKey = req.headers['x-api-key']

  // 2. Check if API key was provided
  if (!apiKey) {
    return res.status(401).json({
      success: false,
      error: 'Missing API key. Add x-api-key to your request headers.',
    })
  }

  // 3. Find user by API key in database
  const user = await User.findOne({ apiKey })

  // 4. Check if API key is valid
  if (!user) {
    return res.status(401).json({
      success: false,
      error: 'Invalid API key.',
    })
  }

  // 5. Check if user has hit their plan limit
  const limit = PLAN_LIMITS[user.plan]
  if (user.usage >= limit) {
    return res.status(429).json({
      success: false,
      error: `Monthly limit reached. You have used ${user.usage}/${limit} screenshots. Upgrade your plan to continue.`,
    })
  }

  // 6. Attach user to request so screenshot route can use it
  req.user = user
  next()
}

module.exports = authMiddleware