
function getAdapterForEnvironment() {
    console.log(process.env.NODE_ENV == "production")
    console.log(process.env.NODE_ENV)
    if (process.env.NODE_ENV == "production") {
        return {
            ios: [
                {
                    pfx: './push-notifications/resources/lab262.55lab.socialnetwork.production.p12', // Dev PFX or P12
                    bundleId: 'lab262.55lab.socialnetwork.production',
                    passphrase: '', // optional password to your p12
                    production: true // Dev
                }
            ]
        }
    } else if (process.env.NODE_ENV == "test") {
        return {
            ios: [
                {
                    pfx: './push-notifications/resources/lab262.55lab.socialnetwork.test.p12', // Dev PFX or P12
                    bundleId: 'lab262.55lab.socialnetwork.test',
                    passphrase: 'lab26255lab$$$', // optional password to your p12
                    production: true // Dev
                }
            ]
        }
    } else {
        return {
            ios: [
                {
                    pfx: './push-notifications/resources/lab262.55lab.socialnetwork.dev.p12', // Dev PFX or P12
                    bundleId: 'lab262.55lab.socialnetwork.dev',
                    passphrase: 'lab26255lab$$$', // optional password to your p12
                    production: false // Dev
                }
            ]
        }
    }
}
console.log(getAdapterForEnvironment())
module.exports = getAdapterForEnvironment()