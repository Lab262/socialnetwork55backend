
function getAdapterForEnvironment() {
    if (process.env.NODE_ENV == "production") {
        return {
            ios: [
                {
                    pfx: './push-notifications/resources/production/lab262.55lab.socialnetwork.dev.p12', // Dev PFX or P12
                    bundleId: 'lab262.55lab.socialnetwork.dev',
                    passphrase: 'lab26255lab$$$', // optional password to your p12
                    production: false // Dev
                },
                {
                    pfx: './push-notifications/resources/production/lab262.55lab.socialnetwork.deploy.p12', // Dev PFX or P12
                    bundleId: 'lab262.55lab.socialnetwork.dev',
                    passphrase: 'lab26255lab$$$', // optional password to your p12
                    production: true // Dev
                }
            ]
        }
    } else {
        return {
            ios: [
                {
                    pfx: './push-notifications/resources/dev/lab262.55lab.socialnetwork.ss.p12', // Dev PFX or P12
                    bundleId: 'lab262.55lab.socialnetwork.dev',
                    passphrase: 'lab26255lab$$$', // optional password to your p12
                    production: false // Dev
                },
                {
                    pfx: './push-notifications/resources/dev/lab262.55lab.socialnetwork.deploy.p12', // Dev PFX or P12
                    bundleId: 'lab262.55lab.socialnetwork.production',
                    passphrase: 'lab26255lab$$$', // optional password to your p12
                    production: true // Dev
                }
            ]
        }
    }
}

module.exports = getAdapterForEnvironment()