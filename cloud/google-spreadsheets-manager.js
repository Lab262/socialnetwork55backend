var fs = require('fs');
var readline = require('readline');
var google = require('googleapis');
var googleAuth = require('google-auth-library');
var path = require('path');

// If modifying these scopes, delete your previously saved credentials
// at ~/.credentials/sheets.googleapis.com-nodejs-quickstart.json
var SCOPES = ['https://www.googleapis.com/auth/spreadsheets','https://www.googleapis.com/auth/drive'];
var TOKEN_DIR = (process.env.HOME || process.env.HOMEPATH ||
    process.env.USERPROFILE) + '/.credentials/';
var TOKEN_PATH = TOKEN_DIR + 'sheets.googleapis.com-nodejs-quickstart.json';
var authClient = null


//CHECK AUTHORIZATION
fs.readFile(path.join(__dirname, '/client_secret.json'), function processClientSecrets(err, content) {
    if (err) {
        console.log('Error loading client secret file: ' + err);
        return;
    }
    // Authorize a client with the loaded credentials, then call the
    // Google Sheets API.
    authorize(JSON.parse(content), function () { }, null, null);
});

function authorizeAndCallApi(secretPath) {
    // Load client secrets from a local file.
    fs.readFile(secretPath, function processClientSecrets(err, content) {
        if (err) {
            console.log('Error loading client secret file: ' + err);
            return;
        }
        // Authorize a client with the loaded credentials, then call the
        // Google Sheets API.
        authorize(JSON.parse(content));
    });
}

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 *
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials) {
    var clientSecret = credentials.installed.client_secret;
    var clientId = credentials.installed.client_id;
    var redirectUrl = credentials.installed.redirect_uris[0];
    var auth = new googleAuth();
    var oauth2Client = new auth.OAuth2(clientId, clientSecret, redirectUrl);

    // Check if we have previously stored a token.
    fs.readFile(TOKEN_PATH, function (err, token) {
        if (err) {
            getNewToken(oauth2Client);
        } else {
            oauth2Client.credentials = JSON.parse(token);
            this.authClient = oauth2Client
        }
    });
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 *
 * @param {google.auth.OAuth2} oauth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback to call with the authorized
 *     client.
 */
function getNewToken(oauth2Client) {
    var authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES
    });
    console.log('Authorize this app by visiting this url: ', authUrl);
    var rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    rl.question('Enter the code from that page here: ', function (code) {
        rl.close();
        oauth2Client.getToken(code, function (err, token) {
            if (err) {
                console.log('Error while trying to retrieve access token', err);
                return;
            }
            oauth2Client.credentials = token;
            this.authClient = oauth2Client
            storeToken(token);
        });
    });
}

/**
 * Store token to disk be used in later program executions.
 *
 * @param {Object} token The token to store to disk.
 */
function storeToken(token) {
    try {
        fs.mkdirSync(TOKEN_DIR);
    } catch (err) {
        if (err.code != 'EEXIST') {
            throw err;
        }
    }
    fs.writeFile(TOKEN_PATH, JSON.stringify(token));
    console.log('Token stored to ' + TOKEN_PATH);
}

Parse.Cloud.define('lisUsersGoogleSpreadsheets', function (req, res) {
    var sheets = google.sheets('v4');
    sheets.spreadsheets.values.get({
        auth: this.authClient,
        spreadsheetId: '1VB4PIIW6OwWdbm9YFkiP0TX5seQluDymPirRURkNYWc',
        range: 'A2:D2',
    }, function (err, response) {
        if (err) {
            // console.log('The API returned an error: ' + err);
            return res.error(err);
        }
        var rows = response.values;
        if (rows.length == 0) {
            return res.error({ message: "No data found." });
        } else {
            return res.success(rows);
        }
    });

});

Parse.Cloud.define('addUsersGoogleSpreadsheets', function (req, res) {

    var user = req.params.user

    var sheets = google.sheets('v4');
    sheets.spreadsheets.values.append({
        spreadsheetId: '1VB4PIIW6OwWdbm9YFkiP0TX5seQluDymPirRURkNYWc',
        range: 'A:D',
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        resource: {
            "values": [
                [
                    user.ID,
                    user.name,
                    user.CPF,
                    user.Address
                ]
            ]
        },
        auth: this.authClient
    }, function (err, response) {
        if (err) {
            // console.log('The API returned an error: ' + err);
            return res.error(err);
        }
        return res.success(response);
    });

});
