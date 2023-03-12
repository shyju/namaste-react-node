const env = require('dotenv').config({path:'./.env.local'})

const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_PRIVATE_KEY);
const cors = require('cors');
const bodyParser = require("body-parser");
const { default: axios } = require('axios');

const HASURA_BASE_URL = process.env.HASURA_BASE_URL;

const ORDER_STATUS = ['PENDING', 'CANCELLED', 'COMPLETED'];

const app = express();

const PORT = process.env.PORT || 3000;

app.use(bodyParser.json())
app.use(cors());

app.use(
    express.json({
      // We need the raw body to verify webhook signatures.
      // Let's compute it only when hitting the Stripe webhook endpoint.
      verify: function(req, res, buf) {
        if (req.originalUrl.startsWith("/webhook")) {
          req.rawBody = buf.toString();
        }
      }
    })
  );
  
  app.get("/", (req, res) => {
    res.send("Hello from API");
  });
  
  app.post("/create-payment-intent", async (req, res) => {
    try {
        const paymentIntent = await stripe.paymentIntents.create({
          currency: "EUR",
          amount: 1999,
          automatic_payment_methods: { enabled: true },
        });
    
        // Send publishable key and PaymentIntent details to client
        res.send({
          client_secret: paymentIntent.client_secret,
        });
      } catch (e) {
        return res.status(400).send({
          error: {
            message: e.message,
          },
        });
      }
  });

  app.post("/completeOrder", async (req, res) => {
      const {order_id} = req.body;
      console.log('order_id:', JSON.stringify(order_id));
      setTimeout(async () => {
        console.log(`I'm running`);
        const response = await axios.put(`${HASURA_BASE_URL}updateOrderState`,{ order_id, order_state: _.random(ORDER_STATUS) },
        {
          headers: {
            'content-type': 'application/json',
            'x-hasura-admin-secret': process.env.HASURA_ADMIN_SECRET
          },
        }
        ).then(({data}) => data.response);
        // console.log('response:', response);
        res.send({id: response?.id})
      }, 60000)
  })
  
  // Webhook handler for asynchronous events.
  app.post("/webhook", async (req, res) => {
    let data;
    let eventType;
    // Check if webhook signing is configured.
    if (process.env.STRIPE_WEBHOOK_SECRET) {
      // Retrieve the event by verifying the signature using the raw body and secret.
      let event;
      let signature = req.headers["stripe-signature"];
  
      try {
        event = stripe.webhooks.constructEvent(
          req.rawBody,
          signature,
          process.env.STRIPE_WEBHOOK_SECRET
        );
      } catch (err) {
        console.log(`⚠️ Webhook signature verification failed.`);
        return res.sendStatus(400);
      }
      // Extract the object from the event.
      data = event.data;
      eventType = event.type;
    } else {
      // Webhook signing is recommended, but if the secret is not configured in `config.js`,
      // retrieve the event data directly from the request body.
      data = req.body.data;
      eventType = req.body.type;
    }
  
    if (eventType === "payment_intent.succeeded") {
      // Fulfill any orders, e-mail receipts, etc
      console.log("💰 Payment received!");
    }
  
    if (eventType === "payment_intent.payment_failed") {
      // Notify the customer that their order was not fulfilled
      console.log("❌ Payment failed.");
    }
  
    res.sendStatus(200);
  });
  
  app.listen(PORT, () => console.log(`Node server listening on port ${PORT}!`));