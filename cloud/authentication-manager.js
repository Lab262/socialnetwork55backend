const SubscriptionStatus = {
  INACTIVE: 0,
  ACTIVE: 1,
  CANCELED: 2,
  DEFAULTING: 3,
  PENDINGVISIT: 4
}

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

Parse.Cloud.define('membershipLogin', function (req, res) {

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


Parse.Cloud.define('membershipRegistration', function (req, res) {

  var userExistsQuery = new Parse.Query(Parse.User);
  userExistsQuery.equalTo("username", req.params.email);

  var PersonObject = Parse.Object.extend("Person");
  var innerPersonQuery = new Parse.Query(PersonObject);
  innerPersonQuery.equalTo("cpf", req.params.cpf);
  userExistsQuery.matchesQuery("personPointer", innerPersonQuery);

  userExistsQuery.find().then(function (users) {
    if (users.length > 0) { //is already registered
      if (users[0].get('subscriptionStatus') != SubscriptionStatus.ACTIVE) {
                res.success("vindi");
        // verifyAndCreateVindiUser(users[0])
      } else {
        res.error({ msg: "User already with an active subscription " });
      }
    } else {
      var User = Parse.Object.extend("User");
      var newUser = new User();
      var randomPassword = Math.random().toString(36);
      newUser.set('username', req.params.email);
      newUser.set('email', req.params.email);
      newUser.set('subscriptionStatus', SubscriptionStatus.INACTIVE);
      newUser.set('password', randomPassword);
      var Person = Parse.Object.extend("Person");
      var newPerson = new Person();
      newPerson.set('cpf', req.params.cpf);
      newUser.set('personPointer',newPerson);

      newUser.save().then(function (createdUser) {
                res.success("vindi criano");

      }).catch(function (error) {
        return res.error(error);
      })
    }
  }).catch(function (error) {
    return res.error(error);
  })
})

function verifyAndCreateVindiUser(user) {

}
