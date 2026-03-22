require('dotenv').config()
const express = require('express')
const cors = require('cors')
const mongoose = require('mongoose')
const screenshotRoute = require('./routes/screenshot')
const User = require('./models/User')
const authRoute = require('./routes/auth')
const { globalLimiter, screenshotLimiter } = require('./middleware/rateLimiter')
const session = require('express-session')
const passport = require('./config/passport')
const billingRoutes = require('./routes/billing');

const app = express()
const PORT = process.env.PORT || 5000

// Middleware
app.use(cors())
app.use('/api/billing/webhook', express.raw({ type: 'application/json' }));
app.use(express.json())
app.use('/api/billing', billingRoutes);
app.use(session({
  secret: process.env.SESSION_SECRET || 'secret',
  resave: false,
  saveUninitialized: false,
}))
app.use(passport.initialize())
app.use(passport.session())
app.use(globalLimiter)

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB error:', err))

// Auth routes
app.use('/api/auth', authRoute)

// Screenshot route
app.use('/api', screenshotLimiter, screenshotRoute)

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'snapshot.api is running 🚀' })
})

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})