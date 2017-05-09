var path = require('path');
var VindiManager = require(path.join(__dirname, '/vindi-manager.js'));
var BlingManager = require(path.join(__dirname, '/bling-manager.js'));

const SubscriptionStatus = {
  INACTIVE: 0,
  ACTIVE: 1,
  CANCELED: 2,
  DEFAULTING: 3,
  PENDINGVISIT: 4
}

const BlingContactStatus = {  //BLING STATUS E-excluido I-inativo A-ativo S-sem movimento
  DELETED: "E",
  INACTIVE: "I",
  ACTIVE: "A",
  NOMOVEMENT: "S"
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
      var user = results[0];
      return Parse.User.requestPasswordReset(user.getUsername());
    } else {
      return res.error('User not found');
    }
  }).then(function (error, result) {
    return res.success(result);
  }).catch(function (error) {
    return res.error('User not found');
  });
}

Parse.Cloud.define('membershipLogin', function (req, res) {

  var loginInfo = {};
  Parse.User.logIn(req.paras.email, req.params.password).then(function (user) {
    loginInfo = user;
    var person = fetchedComment.get("personPointer");
    return person.fetch()

  }).then(function (person) {
    return VindiManager.searchVindiUserByCPF(person.get('cpf'));
  }).then(function (httpResponse) {
    if (httpResponse.length > 0) {
      return VindiManager.performVindiRequest('GET', 'subscriptions?page=1&query=customer_id=' + httpResponse[0].id, null, null);
    } else {
      return res.error({
        code: 401,
        error: 'User missing vindi registration'
      });
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
  var userToRegister = null;
  findUserByEmailAndCpf(req.params.email, req.params.cpf, res).then(function (users) {
    if (users.length > 0) { //is already registered
      if (users[0].get('subscriptionStatus') != SubscriptionStatus.ACTIVE) {
        userToRegister = users[0]
        return verifyAndCreateVindiUser(userToRegister, res);
      } else {
        return res.error({ msg: "User already with an active subscription " });
      }
    } else { //is not registered
      createNewUserPerson(req.params.email, req.params.cpf, req.params.name, res).then(function (createdUser) {
        userToRegister = createdUser
        return verifyAndCreateVindiUser(userToRegister, res)
      }).catch(function (error) {
        return res.error(error);
      })
    }
  }).then(function (vindiHttpResponse) {
    return verifyAndCreateBlingUser(userToRegister);
  }).then(function (blingHttpRequest) {
    res.success(blingHttpRequest);

  }).catch(function (error) {
    return res.error(error);
  })
})

function findUserByEmailAndCpf(email, cpf, res) {
  var userExistsQuery = new Parse.Query(Parse.User);
  userExistsQuery.equalTo("username", email);
  var PersonObject = Parse.Object.extend("Person");
  var innerPersonQuery = new Parse.Query(PersonObject);
  innerPersonQuery.equalTo("cpf", cpf);
  userExistsQuery.matchesQuery("personPointer", innerPersonQuery);
  userExistsQuery.include('personPointer')
  return userExistsQuery.find()
}

function createNewUserPerson(email, cpf, name, res) {
  var User = Parse.Object.extend("User");
  var newUser = new User();
  var randomPassword = Math.random().toString(36);
  newUser.set('username', email);
  newUser.set('email', email);
  newUser.set('subscriptionStatus', SubscriptionStatus.INACTIVE);
  newUser.set('password', randomPassword);
  var Person = Parse.Object.extend("Person");
  var newPerson = new Person();
  newPerson.set('cpf', cpf);
  newPerson.set('name', name)
  newUser.set('personPointer', newPerson);
  return newUser.save()
}

function verifyAndCreateVindiUser(user, res) {
  var person = user.get('personPointer')
  return new Promise(function (fulfill, reject) {
    VindiManager.searchVindiUserByCPF(person.get('cpf'), res).then(function (httpResponse) {
      if (httpResponse.data["customers"].length > 0) { // user registered on vindi
        //VERIFY USER ON BLING 
        fulfill(httpResponse)
      } else { //user not registered on vindi
        VindiManager.createVindiUserWithData({
          "name": person.get('name'),
          "email": user.get('email'),
          "registry_code": person.get('cpf')
        }).then(function (httpResponse) {
          fulfill(httpResponse)
        }).catch(function (error) {
          reject(error);
        })
      }
    }).catch(function (error) {
      reject(error);
    })
  })
}

function verifyAndCreateBlingUser(user) {
  return new Promise(function (fulfill, reject) {
    BlingManager.searchBlingUserByCPF(user.get('personPointer').get('cpf')).then(function (contacts) {
      var errors = httpResponse.data['retorno']['erros'];
      if (contacts.length <= 0) { //user not found
        //CREATE NEW USER 
      } else {
        var contact = contacts[contact.length - 1]
        if (contact["situacao"] != BlingContactStatus.ACTIVE) { //user inactive
          //update user to active
        } else {
          // return user 
        }
      }
    }).catch(function (error) {
      reject(error)
    })
  })
}