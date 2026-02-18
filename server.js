const express = require('express');
const fetch = require('node-fetch');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3001;

const fs = require('fs');

if (fs.existsSync('.env')) {
    const envConfig = fs.readFileSync('.env', 'utf8');
    envConfig.split('\n').forEach(line => {
        const [key, val] = line.split('=');
        if (key && val) {
            process.env[key.trim()] = val.trim();
        }
    });
}

app.use(express.static('public'));

app.get('/api/config', (req, res) => {
    res.json({
        apiKey: process.env.FIREBASE_API_KEY,
        authDomain: process.env.FIREBASE_AUTH_DOMAIN,
        projectId: process.env.FIREBASE_PROJECT_ID,
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.FIREBASE_APP_ID
    });
});

app.get('/api/calendar', async (req, res) => {
    const { url } = req.query;
    if (!url) {
        return res.status(400).json({ error: 'Missing url parameter' });
    }

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to fetch calendar: ${response.statusText}`);
        const data = await response.text();
        res.send(data);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch calendar data' });
    }
});

const sampleIcal = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Airbnb Inc//Hosting Calendar 0.8.8//EN
BEGIN:VEVENT
DTEND;VALUE=DATE:20260210
DTSTART;VALUE=DATE:20260205
UID:sample1@airbnb.com
SUMMARY:Reserved
END:VEVENT
BEGIN:VEVENT
DTEND;VALUE=DATE:20260215
DTSTART;VALUE=DATE:20260212
UID:sample2@airbnb.com
SUMMARY:Reserved
END:VEVENT
BEGIN:VEVENT
DTEND;VALUE=DATE:20260228
DTSTART;VALUE=DATE:20260225
UID:sample3@airbnb.com
SUMMARY:Reserved
END:VEVENT
END:VCALENDAR`;

app.get('/api/sample-calendar', (req, res) => {
    res.send(sampleIcal);
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
