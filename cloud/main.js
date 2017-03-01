Parse.Cloud.define('sendUserAccessMail', function (req, res) {

  var query = new Parse.Query(Parse.User);
  query.equalTo("username", req.params.email);
  query.equalTo("objectId", req.params.objectId);
  query.find().then(function (results) {
    if (results.length > 0) {
      var user = results[0]
      return Parse.User.requestPasswordReset(user.getUsername())
    } else {
      return res.error('User not found')
    }
  }).then(function (error, result) {
    return res.success(result)
  }).catch(function (error) {
    return res.error('User not found')
  });

});