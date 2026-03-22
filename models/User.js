const mongoose = require('mongoose')
const { v4: uuidv4 } = require('uuid')

const UserSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
  },
  password: {
    type: String,
    default: null, // null for OAuth users
  },
  provider: {
    type: String,
    enum: ['email', 'google', 'github'],
    default: 'email',
  },
  providerId: {
    type: String,
    default: null, // stores Google/GitHub user ID
  },
  apiKey: {
    type: String,
    default: () => uuidv4(),
    unique: true,
  },
  plan: {
    type: String,
    enum: ['free', 'starter', 'pro'],
    default: 'free',
  },
  usage: {
    type: Number,
    default: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
})

module.exports = mongoose.model('User', UserSchema)