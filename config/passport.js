const passport = require('passport')
const GoogleStrategy = require('passport-google-oauth20').Strategy
const GitHubStrategy = require('passport-github2').Strategy
const jwt = require('jsonwebtoken')
const User = require('../models/User')

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret'

// ─── GOOGLE ───────────────────────────────────────────
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: '/api/auth/google/callback',
}, async (accessToken, refreshToken, profile, done) => {
  try {
    // Check if user already exists
    let user = await User.findOne({ email: profile.emails[0].value })

    if (!user) {
      // Create new user
      user = await User.create({
        email: profile.emails[0].value,
        provider: 'google',
        providerId: profile.id,
      })
    }

    // Generate JWT token
    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' })
    return done(null, { user, token })
  } catch (err) {
    return done(err, null)
  }
}))

// ─── GITHUB ───────────────────────────────────────────
passport.use(new GitHubStrategy({
  clientID: process.env.GITHUB_CLIENT_ID,
  clientSecret: process.env.GITHUB_CLIENT_SECRET,
  callbackURL: '/api/auth/github/callback',
  scope: ['user:email'],
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const email = profile.emails?.[0]?.value || `${profile.username}@github.com`

    let user = await User.findOne({ email })

    if (!user) {
      user = await User.create({
        email,
        provider: 'github',
        providerId: profile.id.toString(),
      })
    }

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' })
    return done(null, { user, token })
  } catch (err) {
    return done(err, null)
  }
}))

passport.serializeUser((data, done) => done(null, data))
passport.deserializeUser((data, done) => done(null, data))

module.exports = passport