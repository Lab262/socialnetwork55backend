// Example express application adding the parse-server module to expose Parse
// compatible API routes.

var express = require('express');
var ParseServer = require('parse-server').ParseServer;
var path = require('path');
var SimpleSendGridAdapter = require('parse-server-sendgrid-adapter');
var MailTemplateAdapter = require('parse-server-mail-template-adapter');

var databaseUri = process.env.DATABASE_URI || process.env.MONGODB_URI;

if (!databaseUri) {
  console.log('DATABASE_URI not specified, falling back to localhost.');
}

var mailAdapter = MailTemplateAdapter({
    adapter: SimpleSendGridAdapter({
      apiKey: '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',
      fromAddress: 'thiago@lab262.com',
    }),
    template: {
      verification: {
        subject: "Seu acesso ao +55Lab.Community",
        // Choose one in body and bodyFile, if both setted then body used
        body: "verfication body",
        bodyFile: "./mail/VerificationEmailBody.txt"
      },
      resetPassword: {  // Same as verification
        subject: "reset password subject",
        // body: "<br> <br> <br> reset password body",
        bodyFile: "./mail/ResetPasswordEmail.txt"
      }
    }
  })

var api = new ParseServer({
  databaseURI: databaseUri || 'mongodb://localhost:27017/dev',
  cloud: process.env.CLOUD_CODE_MAIN || __dirname + '/cloud/main.js',
  appId: process.env.APP_ID || 'myAppId',
  masterKey: process.env.MASTER_KEY || 'myMasterKey', //Add your master key here. Keep it secret!
  serverURL: process.env.SERVER_URL || 'http://localhost:1337/parse',  // Don't forget to change to https if needed
  appName: "+55Lab.Community",
  publicServerURL: "http://localhost:1337/parse",
  emailAdapter: mailAdapter,
  customPages: {
    // invalidLink: 'http://localhost:1337/invalid_link.html',
    // verifyEmailSuccess: 'http://localhost:1337/verify_email_success.html',
    // choosePassword: 'http://localhost:1337/parse/choose_password.html',
    passwordResetSuccess: 'http://55lab.co'
  },
  push: {
    ios:  [
    {
      pfx: './push-notifications/lab262.55lab.socialnetwork.dev.p12', // Dev PFX or P12
      bundleId: 'lab262.55lab.socialnetwork.dev',
      passphrase: 'lab26255lab$$$', // optional password to your p12
      production: false // Dev
    }
  ]
  }

});
// Client-keys like the javascript key or the .NET key are not necessary with parse-server
// If you wish you require them, you can set them as options in the initialization above:
// javascriptKey, restAPIKey, dotNetKey, clientKey

var app = express();

// Serve static assets from the /public folder
app.use('/public', express.static(path.join(__dirname, '/public')));

// Serve the Parse API on the /parse URL prefix
var mountPath = process.env.PARSE_MOUNT || '/parse';
app.use(mountPath, api);

// Parse Server plays nicely with the rest of your web routes
app.get('/', function (req, res) {
  res.status(200).send('I dream of being a website.  Please star the parse-server repo on GitHub!');
});

var port = process.env.PORT || 1337;
var httpServer = require('http').createServer(app);
httpServer.listen(port, function () {
  console.log('parse-server-example running on port ' + port + '.');
});

// This will enable the Live Query real-time server
ParseServer.createLiveQueryServer(httpServer);
