const env = require('dotenv').config({path:'./.env.local'})

const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_PRIVATE_KEY);
const cors = require('cors');
const bodyParser = require("body-parser");
const { default: axios } = require('axios');
const _ = require('lodash'); 

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
        const response = await axios.put(`${HASURA_BASE_URL}updateOrderState`,{ order_id, order_state: _.sample(ORDER_STATUS) },
        {
          headers: {
            'content-type': 'application/json',
            'x-hasura-admin-secret': process.env.HASURA_ADMIN_SECRET
          },
        }
        ).then(({data}) => data.response)
        .catch((err) => JSON.stringify(err));
        // console.log('response:', response);
        res.send({id: response?.id})
      }, 60000)
  })
  app.listen(PORT, () => console.log(`Node server listening on port ${PORT}!`));