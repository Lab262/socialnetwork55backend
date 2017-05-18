var path = require('path');
var VindiManager = require(path.join(__dirname, '/vindi-manager.js'));
var BlingManager = require(path.join(__dirname, '/bling-manager.js'));

const SubscriptionStatus = {
  INACTIVE: 0,
  ACTIVE: 1,
  CANCELED: 2,
  DEFAULTING: 3,
  PENDINGVISIT: 4,
  TRYINGTOBUY: 5
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
  var CPFValidator = require("cpf_cnpj").CPF;
  var emailValidator = require("email-validator");
  if (CPFValidator.isValid(req.params.cpf, true) == false) {
    return res.error({ msg: "Invalid CPF" });
  } else if (emailValidator.validate(req.params.email) == false) {
    return res.error({ msg: "Invalid email" });
  }
  var userToRegister = null;
  findUserByEmailOrCpf(req.params.email, req.params.cpf, res).then(function (users) {
    return verifyAndCreateUserCowork(users, req.params)
  }).then(function (userCowork) {
    userToRegister = userCowork
    return verifyAndCreateVindiUser(userCowork, res);
  }).then(function (vindiHttpResponse) {
    return verifyAndCreateBlingUser(userToRegister);  
    //TODO: user to active - API DONT EXISTS User needs being created as active 
  }).then(function (blingHttpRequest) {
    return res.success(blingHttpRequest); 
    //TODO: VERIFY AND CREATE USER EXCELL 
  }).catch(function (error) {
    return res.error(error);
  })
})

function findUserByEmailOrCpf(email, cpf, res) {
  var userExistsQuery = new Parse.Query(Parse.User);
  userExistsQuery.equalTo("username", email);
  var PersonObject = Parse.Object.extend("Person");

  var personExistsQuery = new Parse.Query(PersonObject);
  personExistsQuery.equalTo("cpf", cpf);
  var userPersonExistQuery = new Parse.Query(Parse.User);
  userPersonExistQuery.matchesQuery("personPointer", personExistsQuery);
  var mainQuery = Parse.Query.or(userExistsQuery, userPersonExistQuery);
  mainQuery.include('personPointer')
  return mainQuery.find()
}

function createNewUserPerson(email, cpf, name, status) {
  var User = Parse.Object.extend("User");
  var newUser = new User();
  var randomPassword = Math.random().toString(36);
  newUser.set('username', email);
  newUser.set('email', email);
  newUser.set('subscriptionStatus', status);
  newUser.set('password', randomPassword);
  var Person = Parse.Object.extend("Person");
  var newPerson = new Person();
  newPerson.set('cpf', cpf);
  newPerson.set('name', name)
  newUser.set('personPointer', newPerson);
  return newUser.save()
}

function verifyAndCreateUserCowork(users, userParams) {
  return new Promise(function (fulfill, reject) {
    if (users.length > 0) { //is already registered
      userToRegister = users[0]
      var CPFValidator = require("cpf_cnpj").CPF;
      var existentUserCPF = CPFValidator.strip(userToRegister.get('personPointer').get('cpf'));
      var requestedUserCPF = CPFValidator.strip(userParams.cpf);
      if (existentUserCPF != requestedUserCPF) {
        reject({ msg: "Email already using another CPF" });
      } else if (users.get('email') != userParams.email) {
        reject({ msg: "CPF already being used another email" });
      } else if (userToRegister.get('subscriptionStatus') != SubscriptionStatus.ACTIVE) {
        fulfill(userToRegister)
      } else {
        reject({ msg: "User already with an active subscription " });
      }
    } else { //is not registered
      createNewUserPerson(userParams.email, userParams.cpf, userParams.name, SubscriptionStatus.TRYINGTOBUY).then(function (createdUser) {
        fulfill(createdUser)
      }).catch(function (err) {
        reject(err);
      });
    }
  })
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
          "registry_code": person.get('cpf') //TODO: STATUS
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
    var blingUser = {
        //TODO: CREATE USER AS ACTIVE - CHECK HOW AFFECT THE PROCESS - MAYBE FILTER BY OBSERVACAO
        //TODO: ADD DANDOS NECESSARIOS PEDIDO
      "nome": user.get('personPointer').get('name'),
      "tipoPessoa": "F", //F - Física, J - Jurídica
      "contribuinte": 9, //1 - Contribuinte do ICMS, 2 - Contribuinte isento do ICMS ou 9 - Não contribuinte
      "cpf_cnpj": user.get('personPointer').get('cpf'),
      "email": user.get('email')
    }
    BlingManager.searchBlingUserByCPF(user.get('personPointer').get('cpf')).then(function (contacts) {
      if (contacts.length <= 0) { //user not found
        //CREATE NEW USER 
        BlingManager.createBlingUserWithData(blingUser).then(function (httpResponse) {
          fulfill(httpResponse)
        }).catch(function (error) {
          reject(error)
        })
      } else {
        var contact = contacts[contacts.length - 1]["contato"];
        // if (contact["situacao"] != BlingContactStatus.ACTIVE) { //user inactive
          fulfill(contact)           //TODO: user to active - API DONT EXISTS User needs being created as active 


        // } else {
          // fulfill(contact)
        // }
      }
    }).catch(function (error) {
      reject(error)
    })
  })
}