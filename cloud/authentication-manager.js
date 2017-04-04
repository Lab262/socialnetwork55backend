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

Parse.Cloud.define('membershipLogin', function(req,res) {
  // var query = new Parse.Query(Parse.User);
  // query.equalTo("email", req.params.em);

  var loginInfo = {}
  Parse.User.logIn(req.paras.email, req.params.password).then(function (user) {
    loginInfo = user
    return Parse.Cloud.httpRequest({
      method: 'GET',
      url: 'https://app.vindi.com.br:443/api/v1/customers?query=registry_code=' + user.Person.CPF,
      body: null,
      params: null,
      headers: {
        "Authorization": "Basic SWNHWjBxc3dPOExUMGh3M1U5SnpWNU5PcEdrWnQ2cWY6KioqKiogSGlkZGVuIGNyZWRlbnRpYWxzICoqKioq"
      }
    })

  }).then(function (httpResponse) {

    if (httpResponse.length > 0) {
      return Parse.Cloud.httpRequest({
        method: 'GET',
        url: 'https://app.vindi.com.br:443/api/v1/subscriptions?page=1&query=customer_id=' + httpResponse[0].id,
        body: null,
        params: null,
        headers: {
          "Authorization": "Basic SWNHWjBxc3dPOExUMGh3M1U5SnpWNU5PcEdrWnQ2cWY6KioqKiogSGlkZGVuIGNyZWRlbnRpYWxzICoqKioq"
        }
      })
    } else {
      return res.error({
        code: 401,
        error: 'User missing vindi registration'
      })
    }
  }).then(function (httpResponse) {

    if (httpResponse.length > 0) {
        var subscription = httpResponse[0]

        if (subscription.status == "active") {
          return res.success(loginInfo)
        } else {
          return res.error({
            code: 401,
            error: 'User membership subscription inactive'
          })
        }
    } else {
      return res.error({
        code: 401,
        error: 'User missing membership subscription'
      })
    }
  }).catch(function (error) {
    return res.error(error)
  });

})