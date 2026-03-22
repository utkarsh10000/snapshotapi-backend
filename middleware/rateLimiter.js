const rateLimit = require('express-rate-limit')

// Global rate limiter — applies to all routes
// Max 100 requests per 15 minutes per IP
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: {
    success: false,
    error: 'Too many requests from this IP. Please try again after 15 minutes.',
  },
})

// Strict rate limiter — applies to screenshot route only
// Max 10 requests per minute per IP
const screenshotLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10,
  message: {
    success: false,
    error: 'Too many screenshot requests. Please slow down and try again in 1 minute.',
  },
})

module.exports = { globalLimiter, screenshotLimiter }