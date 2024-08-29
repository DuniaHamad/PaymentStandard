import express from 'express';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import * as path from "node:path";
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware zum Parsen von JSON-Anfragen
app.use(express.json());
app.use(express.static(path.join(__dirname, 'src/assets')));

// CORS-Konfiguration
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

app.post('/api/orders', (req, res) => {
    try {
        const { cart } = req.body;

        // Überprüfung, ob der Warenkorb vorhanden ist
        if (!cart || !Array.isArray(cart) || cart.length === 0) {
            return res.status(400).json({ error: 'Warenkorb ist erforderlich.' });
        }

        // Berechnung der Gesamtsumme und der Steuer
        const subtotal = cart.reduce((acc, item) => acc + (item.product.price * item.quantity), 0);
        const totalTax = cart.reduce((acc, item) => acc + (item.product.price * item.product.taxRate * item.quantity), 0);
        const total = subtotal + totalTax;

        // Generierung einer eindeutigen Bestell-ID
        const orderId = Date.now().toString(); // Beispiel für eine eindeutige ID
        console.log('Generated orderId:', orderId);

        // Erstellung des Bestellobjekts
        const order = {
            id: orderId,
            products: cart.map(item => ({
                id: item.product.id,
                name: item.product.name,
                quantity: item.quantity,
                price: item.product.price
            })),
            status: 'CREATED',
            createdAt: new Date(),
            subtotal: subtotal.toFixed(2),
            totalTax: totalTax.toFixed(2),
            total: total.toFixed(2)
        };

        res.json(order);
    } catch (error) {
        console.error('Error creating order:', error);
        res.status(500).json({ error: `Error creating order: ${error.message}` });
    }
});

app.post('/api/paypal/create-order', async (req, res) => {
    const { total, products } = req.body;

    const orderData = {
        intent: 'CAPTURE',
        purchase_units: [{
            reference_id: 'unique_reference_id',
            amount: {
                currency_code: 'EUR', // Währung
                value: total.toFixed(2), // Gesamtbetrag
                breakdown: {
                    item_total: {
                        currency_code: 'EUR',
                        value: total.toFixed(2) // Zwischensumme
                    }
                }
            },
            items: products.map(product => ({
                name: product.name,
                unit_amount: {
                    currency_code: 'EUR', // Währung
                    value: product.price.toFixed(2)
                },
                quantity: product.quantity
            }))
        }],
        application_context: {
            return_url: 'https://example.com/returnUrl',
            cancel_url: 'https://example.com/cancelUrl'
        }
    };

    try {
        const response = await fetch('https://api-m.sandbox.paypal.com/v2/checkout/orders', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${await getAccessToken()}`
            },
            body: JSON.stringify(orderData)
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('Error creating PayPal order:', errorData);
            return res.status(response.status).json({ error: `Error creating PayPal order: ${errorData.message}` });
        }

        const order = await response.json();
        const approvalUrl = order.links.find(link => link.rel === 'approve').href;
        res.json({ id: order.id, approvalUrl });
    } catch (error) {
        console.error('Error creating PayPal order:', error);
        res.status(500).json({ error: `Error creating PayPal order: ${error.message}` });
    }
});
// Funktion zur Abrufung des Access Tokens

async function getAccessToken() {
    const clientId = process.env.PAYPAL_CLIENT_ID; // Ihre Client-ID aus der PayPal-App
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET; // Ihr Client-Secret aus der PayPal-App

    const response = await fetch('https://api-m.sandbox.paypal.com/v1/oauth2/token', {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Error getting access token: ${errorData.error_description}`);
    }

    const data = await response.json();
    return data.access_token; // Gibt den Access Token zurück
}
// Server starten
app.listen(PORT, () => {
    console.log(`Server läuft auf Port ${PORT}`);
});
