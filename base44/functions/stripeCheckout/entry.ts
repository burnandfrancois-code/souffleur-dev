import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import Stripe from 'npm:stripe@14.21.0';

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY"));

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { priceId, isFree, successUrl, cancelUrl } = await req.json();

    if (isFree) {
      return Response.json({ url: successUrl });
    }

    const session = await stripe.checkout.sessions.create({
      mode: priceId.startsWith('price_1TTLkRL7dx7vbq2tzbi4mvEm') ? 'payment' : 
            ['price_1TTLkRL7dx7vbq2tg7S4IBwS', 'price_1TTLkRL7dx7vbq2t2FtJNfVD', 'price_1TTLkRL7dx7vbq2tKSenXDhu', 'price_1TTLkRL7dx7vbq2tlWj3Rl7u'].includes(priceId) ? 'subscription' : 'payment',
      line_items: [{ price: priceId, quantity: 1 }],
      payment_method_types: ['card', 'link', 'twint', 'paypal', 'revolut_pay'],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        base44_app_id: Deno.env.get("BASE44_APP_ID")
      }
    });

    return Response.json({ url: session.url });
  } catch (error) {
    console.error('Stripe checkout error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});