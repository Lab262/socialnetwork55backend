var GCSAdapter = require('parse-server-gcs-adapter');

var bucketName = "";
 if (process.env.NODE_ENV == "production") {     
    bucketName = "55lab-socialnetwork-production";
 } else if (process.env.NODE_ENV == "test") { 
    bucketName = "55lab-socialnetwork-test";
 } else { 
     bucketName = "55lab-socialnetwork-dev";
 }


var gcsAdapter = new GCSAdapter('493991025661', 
								'./file-storage/resources/55lab Social Network-6a23cf29f2ca.json', 
								bucketName , {
									bucketPrefix: '',
									directAccess: true
								});

  module.exports = gcsAdapter