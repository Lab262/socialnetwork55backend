
Parse.Cloud.define('hello', function (req, res) {

  res.success('Hi');
});


Parse.Cloud.define('sendUserRegisterConfirmationMail', function (req, res) {

  var query = new Parse.Query(Parse.User);
  query.equalTo("username", req.params.email);
  query.equalTo("objectId", req.params.objectId);
  query.find().then(function (results) {
    return res.success(results);
  }, function (error) {
    return res.error('User not found')
  });

});