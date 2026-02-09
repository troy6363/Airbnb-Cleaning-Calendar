const https = require('https');

exports.handler = async function (event, context) {
    const url = event.queryStringParameters.url;

    if (!url) {
        return {
            statusCode: 400,
            body: 'Missing URL parameter'
        };
    }

    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                resolve({
                    statusCode: 200,
                    headers: {
                        "Content-Type": "text/calendar",
                        "Access-Control-Allow-Origin": "*"
                    },
                    body: data
                });
            });

        }).on('error', (err) => {
            resolve({
                statusCode: 500,
                body: err.message
            });
        });
    });
};
