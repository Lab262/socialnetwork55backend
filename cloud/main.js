Parse.Cloud.define('sendUserAccessMail', function (req, res) {

  var users = req.params.users

  for (index in users) {
    resetUserPassword(users[index], res)
  }

});

function resetUserPassword(userInfo, res) {
  var query = new Parse.Query(Parse.User);
  query.equalTo("username", userInfo.email);
  query.equalTo("objectId", userInfo.objectId);
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
}


Parse.Cloud.define('vindiManager', function (req, res) {

  Parse.Cloud.httpRequest({
    method: req.params.requestMethod,
    url: 'https://app.vindi.com.br:443/api/v1/' + req.params.pathPlusParams,
    body: req.params.requestBody,
    params: req.params.requestParams,
    headers: {
      "Authorization": "Basic SWNHWjBxc3dPOExUMGh3M1U5SnpWNU5PcEdrWnQ2cWY6KioqKiogSGlkZGVuIGNyZWRlbnRpYWxzICoqKioq"
    }
  }).then(function(httpResponse) {
    return res.success(httpResponse.data)

  }, function(httpResponse) {
    return res.error(httpResponse)
    // console.error('Request failed with response code ' + httpResponse.status);
  });
});
