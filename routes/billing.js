const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Self-contained JWT verification middleware
const verifyJWT = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id || decoded._id || decoded.userId);

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// POST /api/billing/checkout
router.post('/checkout', verifyJWT, async (req, res) => {
  const { plan } = req.body;

  if (!['starter', 'pro'].includes(plan)) {
    return res.status(400).json({ error: 'Invalid plan' });
  }

  const priceId =
    plan === 'starter'
      ? process.env.PADDLE_STARTER_PRICE_ID
      : process.env.PADDLE_PRO_PRICE_ID;

  try {
    const response = await fetch('https://api.paddle.com/transactions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.PADDLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        items: [
          {
            price_id: priceId,
            quantity: 1
          }
        ],
        customer: {
          email: req.user.email
        },
        custom_data: {
          user_id: req.user._id.toString()
        },
        checkout: {
          url: `${process.env.FRONTEND_URL}/dashboard/billing`
        }
      })
    });

    const data = await response.json();
    const checkoutUrl = data?.data?.checkout?.url;

    if (!checkoutUrl) {
      console.error('Paddle error:', JSON.stringify(data));
      return res.status(500).json({ error: 'Failed to create checkout' });
    }

    res.json({ url: checkoutUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/billing/webhook
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const secret = process.env.PADDLE_WEBHOOK_SECRET;
  const signature = req.headers['paddle-signature'];

  if (!signature) {
    return res.status(401).json({ error: 'No signature' });
  }

  try {
    const [tsPart, h1Part] = signature.split(';');
    const ts = tsPart.split('=')[1];
    const h1 = h1Part.split('=')[1];

    const signedPayload = `${ts}:${req.body}`;
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(signedPayload)
      .digest('hex');

    if (expectedSignature !== h1) {
      return res.status(401).json({ error: 'Invalid signature' });
    }
  } catch (err) {
    return res.status(401).json({ error: 'Signature verification failed' });
  }

  const payload = JSON.parse(req.body);
  const eventType = payload.event_type;
  const userId = payload.data?.custom_data?.user_id;

  console.log('Paddle webhook received:', eventType, 'for user:', userId);

  if (!userId) return res.status(200).json({ received: true });

  try {
    if (eventType === 'subscription.created' || eventType === 'subscription.updated') {
      const priceId = payload.data?.items?.[0]?.price?.id;
      let plan = 'free';
      if (priceId === process.env.PADDLE_STARTER_PRICE_ID) plan = 'starter';
      if (priceId === process.env.PADDLE_PRO_PRICE_ID) plan = 'pro';

      await User.findByIdAndUpdate(userId, { plan });
      console.log(`User ${userId} plan updated to ${plan}`);
    }

    if (eventType === 'subscription.canceled') {
      await User.findByIdAndUpdate(userId, { plan: 'free' });
      console.log(`User ${userId} downgraded to free`);
    }

    res.status(200).json({ received: true });
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(500).json({ error: 'Webhook processing error' });
  }
});

module.exports = router;