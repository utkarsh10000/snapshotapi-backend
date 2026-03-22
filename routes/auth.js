const express = require('express')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const User = require('../models/User')
const router = express.Router()
const passport = require('../config/passport')

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret'

// ─── SIGNUP ───────────────────────────────────────────
// POST /api/auth/signup
router.post('/signup', async (req, res) => {
  const { email, password } = req.body

  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'Email and password are required.' })
  }

  if (password.length < 6) {
    return res.status(400).json({ success: false, error: 'Password must be at least 6 characters.' })
  }

  try {
    // Check if user already exists
    const existing = await User.findOne({ email })
    if (existing) {
      return res.status(400).json({ success: false, error: 'Email already registered.' })
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Create user
    const user = await User.create({ email, password: hashedPassword })

    // Generate JWT token
    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' })

    return res.status(201).json({
      success: true,
      message: 'Account created!',
      token,
      user: {
        email: user.email,
        plan: user.plan,
        apiKey: user.apiKey,
        usage: user.usage,
      },
    })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ success: false, error: 'Server error.' })
  }
})

// ─── LOGIN ────────────────────────────────────────────
// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body

  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'Email and password are required.' })
  }

  try {
    // Find user
    const user = await User.findOne({ email })
    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid email or password.' })
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password)
    if (!isMatch) {
      return res.status(401).json({ success: false, error: 'Invalid email or password.' })
    }

    // Generate JWT token
    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' })

    return res.status(200).json({
      success: true,
      message: 'Logged in!',
      token,
      user: {
        email: user.email,
        plan: user.plan,
        apiKey: user.apiKey,
        usage: user.usage,
      },
    })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ success: false, error: 'Server error.' })
  }
})

// ─── GET CURRENT USER ─────────────────────────────────
// GET /api/auth/me
router.get('/me', async (req, res) => {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]

  if (!token) {
    return res.status(401).json({ success: false, error: 'No token provided.' })
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    const user = await User.findById(decoded.userId)

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found.' })
    }

    return res.status(200).json({
      success: true,
      user: {
        email: user.email,
        plan: user.plan,
        apiKey: user.apiKey,
        usage: user.usage,
      },
    })
  } catch (error) {
    return res.status(401).json({ success: false, error: 'Invalid token.' })
  }
})

// POST /api/auth/regen-key
router.post('/regen-key', async (req, res) => {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]
  if (!token) return res.status(401).json({ success: false, error: 'No token.' })

  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    const user = await User.findById(decoded.userId)
    if (!user) return res.status(404).json({ success: false, error: 'User not found.' })

    // Generate new API key
    const { v4: uuidv4 } = require('uuid')
    user.apiKey = uuidv4()
    await user.save()

    return res.status(200).json({ success: true, apiKey: user.apiKey })
  } catch (error) {
    return res.status(401).json({ success: false, error: 'Invalid token.' })
  }
})

// POST /api/auth/change-password
router.post('/change-password', async (req, res) => {
  const token = req.headers['authorization']?.split(' ')[1]
  if (!token) return res.status(401).json({ success: false, error: 'No token.' })

  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    const user = await User.findById(decoded.userId)
    if (!user) return res.status(404).json({ success: false, error: 'User not found.' })

    const { currentPassword, newPassword } = req.body
    const isMatch = await bcrypt.compare(currentPassword, user.password)
    if (!isMatch) return res.status(400).json({ success: false, error: 'Current password is incorrect.' })

    user.password = await bcrypt.hash(newPassword, 10)
    await user.save()
    return res.status(200).json({ success: true })
  } catch (err) {
    return res.status(401).json({ success: false, error: 'Invalid token.' })
  }
})

// DELETE /api/auth/delete-account
router.delete('/delete-account', async (req, res) => {
  const token = req.headers['authorization']?.split(' ')[1]
  if (!token) return res.status(401).json({ success: false, error: 'No token.' })

  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    await User.findByIdAndDelete(decoded.userId)
    return res.status(200).json({ success: true })
  } catch (err) {
    return res.status(401).json({ success: false, error: 'Invalid token.' })
  }
})

// ─── GOOGLE OAUTH ─────────────────────────────────────
router.get('/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
)

router.get('/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: `${process.env.FRONTEND_URL}/login` }),
  (req, res) => {
    const { token, user } = req.user
    const userData = encodeURIComponent(JSON.stringify({
      email: user.email,
      plan: user.plan,
      apiKey: user.apiKey,
      usage: user.usage,
    }))
    res.redirect(`${process.env.FRONTEND_URL}/auth/callback?token=${token}&user=${userData}`)
  }
)

// ─── GITHUB OAUTH ─────────────────────────────────────
router.get('/github',
  passport.authenticate('github', { scope: ['user:email'] })
)

router.get('/github/callback',
  passport.authenticate('github', { session: false, failureRedirect: `${process.env.FRONTEND_URL}/login` }),
  (req, res) => {
    const { token, user } = req.user
    const userData = encodeURIComponent(JSON.stringify({
      email: user.email,
      plan: user.plan,
      apiKey: user.apiKey,
      usage: user.usage,
    }))
    res.redirect(`${process.env.FRONTEND_URL}/auth/callback?token=${token}&user=${userData}`)
  }
)

module.exports = router