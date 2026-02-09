exports.handler = async function (event, context) {
    // Only allow GET requests
    if (event.httpMethod !== "GET") {
        return { statusCode: 405, body: "Method Not Allowed" };
    }

    // Restrict via Referer header (optional but recommended for public APIs)
    // const referer = event.headers.referer || event.headers.Referer;
    // if (!referer || !referer.includes(process.env.URL)) { // process.env.URL is Netlify's site URL
    //    return { statusCode: 403, body: "Forbidden" };
    // }

    const config = {
        apiKey: process.env.FIREBASE_API_KEY,
        authDomain: process.env.FIREBASE_AUTH_DOMAIN,
        projectId: process.env.FIREBASE_PROJECT_ID,
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.FIREBASE_APP_ID
    };

    // Check if critical keys are present
    if (!config.apiKey || !config.projectId) {
        console.error("Missing Firebase configuration environment variables");
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Configuration missing on server" })
        };
    }


    return {
        statusCode: 200,
        headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*" // Adjust this in production to your domain
        },
        body: JSON.stringify(config)
    };
};
