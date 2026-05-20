const express = require('express');
const stripe = require('stripe')('YOUR_STRIPE_SECRET_KEY'); // SILA GANTI DENGAN SECRET KEY STRIPE ANDAATAU GUNAKAN ENV VARIABLE
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

app.post('/create-checkout-session', async (req, res) => {
  try {
    const { amount, campaignName } = req.body;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['fpx', 'card'],
      line_items: [{
        price_data: {
          currency: 'myr',
          product_data: { name: campaignName || 'Sumbangan Kempen MyDana' },
          unit_amount: amount, // jumlah dalam sen
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: 'https://example.com/success', // Tukar kepada deep-link MyDana jika sedia
      cancel_url: 'https://example.com/cancel',
    });

    res.json({ url: session.url });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server Stripe sedang berjalan di port ${PORT}`);
  console.log('Sila pastikan anda menukar "sk_test_..." dengan Secret Key Stripe anda di atas fail ini.');
});
