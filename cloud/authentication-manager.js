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
  Parse.User.logIn(req.params.email, req.params.password).then(function (user) {
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
  if (CPFValidator.isValid(req.params.person.cpf, true) == false) {
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

function createNewUserPerson(userParams, status) {
  return new Promise(function (fulfill, reject) {

    var User = Parse.Object.extend("User");
    var newUser = new User();
    var randomPassword = Math.random().toString(36);
    newUser.set('username', userParams.email);
    newUser.set('email', userParams.email);
    newUser.set('subscriptionStatus', status);
    newUser.set('password', randomPassword);

    var Person = Parse.Object.extend("Person");
    var newPerson = new Person();
    newPerson.set('cpf', userParams.person.cpf);
    newPerson.set('name', userParams.person.name);
    newPerson.set('rg', userParams.person.rg);

    var Address = Parse.Object.extend("Address");
    var newAddress = new Address();
    newAddress.set('street', userParams.person.address.street);
    newAddress.set('number', userParams.person.address.number);
    newAddress.set('neighborhood', userParams.person.address.neighborhood);
    newAddress.set('zip', userParams.person.address.zip);
    newAddress.set('city', userParams.person.address.city);
    newAddress.set('uf', userParams.person.address.uf);
    newAddress.set('isMain', userParams.person.address.isMain);

    var Phone = Parse.Object.extend("Phone");
    var newPhone = new Phone();
    newPhone.set('number', userParams.person.phone.number);
    newPhone.set('isMain', userParams.person.phone.isMain);

    newUser.set('personPointer', newPerson);

    newPhone.save().then(function (newPhone) {
      var phonesRelation = newPerson.relation("phones");
      phonesRelation.add(newPhone);
      return newAddress.save()
    }).then(function (newAddress) {
      var addressesRelation = newPerson.relation("addresses");
      addressesRelation.add(newAddress);
      newUser.set('personPointer', newPerson);
      return newUser.save()
    }).then(function (newUser) {
      fulfill(newUser)
    }).catch(function (err) {
      reject(err)
    });

  });
}

function updateUserPerson(userParams, oldUser, status) {
  return new Promise(function (fulfill, reject) {

    var newUser = oldUser;
    var randomPassword = Math.random().toString(36);
    newUser.set('username', userParams.email);
    newUser.set('email', userParams.email);
    newUser.set('subscriptionStatus', status);
    newUser.set('password', randomPassword);

    var newPerson = oldUser.get('personPointer');
    newPerson.set('cpf', userParams.person.cpf);
    newPerson.set('name', userParams.person.name);
    newPerson.set('rg', userParams.person.rg);
    var newPhone = null;
    var isNewPhone = false
    var newAddress = null;
    var isNewAddress = false
    newPerson.get('phones').query().equalTo('isMain',true).find().then(function (mainPhones) {
      if (mainPhones.length > 0) { //add phones
        var newPhone = mainPhones[0];

      } else {
        var Phone = Parse.Object.extend("Phone");
        var newPhone = new Phone();
        isNewPhone = true
      }
      newPhone.set('number', userParams.person.phone.number);
      newPhone.set('isMain', userParams.person.phone.isMain);
      return newPhone.save();

    }).then(function (newPhone) {
      if (isNewPhone == true) {
        var phonesRelation = newPerson.relation("phones");
        phonesRelation.add(newPhone);
      }
      return newPerson.get('addresses').query().equalTo('isMain',true).find()
    }).then(function (mainAddresses) {
      if (mainAddresses.length > 0) {
        newAddress = mainAddresses[0];
      } else {
        var Address = Parse.Object.extend("Address");
        var newAddress = new Address();
        isNewAddress = true
      }

      newAddress.set('street', userParams.person.address.street);
      newAddress.set('number', userParams.person.address.number);
      newAddress.set('neighborhood', userParams.person.address.neighborhood);
      newAddress.set('zip', userParams.person.address.zip);
      newAddress.set('city', userParams.person.address.city);
      newAddress.set('uf', userParams.person.address.uf);
      newAddress.set('isMain', userParams.person.address.isMain);

      return newAddress.save()

    }).then(function (newAddress) {
      if (isNewAddress == true) {
        var addressesRelation = newPerson.relation("addresses");
        addressesRelation.add(newAddress);
      }
      newUser.set('personPointer', newPerson);
      return newUser.save(null,{useMasterKey: true})
    }).then(function (newUser) {
      fulfill(newUser)
    }).catch(function (err) {
      reject(err)
    });
  });
}

function verifyAndCreateUserCowork(users, userParams) {
  return new Promise(function (fulfill, reject) {
    if (users.length > 0) { //is already registered
      userToRegister = users[0]
      var CPFValidator = require("cpf_cnpj").CPF;
      var existentUserCPF = CPFValidator.strip(userToRegister.get('personPointer').get('cpf'));
      var requestedUserCPF = CPFValidator.strip(userParams.person.cpf);
      if (existentUserCPF != requestedUserCPF) {
        reject({ msg: "Email already using another CPF" });
      } else if (userToRegister.get('username') != userParams.email) {
        reject({ msg: "CPF already being used another email" });
      } else if (userToRegister.get('subscriptionStatus') != SubscriptionStatus.ACTIVE) {
        updateUserPerson(userParams, userToRegister, SubscriptionStatus.TRYINGTOBUY).then(function (updatedUser) {
          fulfill(updatedUser)
        }).catch(function (err) {
          reject(err);
        });
      } else {
        reject({ msg: "User already with an active subscription " });
      }
    } else { //is not registered
      createNewUserPerson(userParams, SubscriptionStatus.TRYINGTOBUY).then(function (createdUser) {
        fulfill(createdUser)
      }).catch(function (err) {
        reject(err);
      });
    }
  })
}

function verifyAndCreateVindiUser(user, res) {
  var person = user.get('personPointer');
  var phone = person.get('phones');
  var vindiUserData = {
    "name": person.get('name'),
    "email": user.get('email'),
    "registry_code": person.get('cpf'),
    "status": "inactive"
  };
  var existingUserId = null
  return new Promise(function (fulfill, reject) {
    VindiManager.searchVindiUserByCPF(person.get('cpf'), res).then(function (httpResponse) {
      if (httpResponse.data["customers"].length > 0) { // user registered on vindi
        existingUserId = httpResponse.data["customers"]["id"];
      }
      return person.get('addresses').query().equalTo('isMain',true).find();
    }).then(function (mainAddresses) {
      if (mainAddresses.length > 0) {
        var address = mainAddresses[0];
        vindiUserData["address"] = { //add address
          "street": address.get('street'),
          "number": address.get('numero'),
          "neighborhood": address.get('bairro'),
          "zipcode": address.get('zip'),
          "city": address.get('cidade'),
          "state": address.get('uf'),
          "country": 'Brasil'
        };
      }
      return person.get('phones').query().equalTo('isMain',true).find();
    }).then(function (mainPhones) {
      if (mainPhones.length > 0) { //add phones
        var phone = mainPhones[0];
        vindiUserData["phones"] = [
          {
            "phone_type": "cell",
            number: phone.get('number'),
            exension: ""
          }
        ]
      }

      if (existingUserId == null) {
        return VindiManager.createVindiUserWithData(vindiUserData);
      } else {
        return VindiManager.updateVindiUserWithData(vindiUserData, existingUserId);
      }
    }).then(function (httpResponse) {
      fulfill(httpResponse)
    }).catch(function (error) {
      reject(error);
    })
  })
}

function verifyAndCreateBlingUser(user) {
  var person = user.get('personPointer');
  var address = person.get('addresses');
  var phone = person.get('phones');

  return new Promise(function (fulfill, reject) {
    var blingUser = {
      "nome": person.get('name'),
      "tipoPessoa": "F", //F - Física, J - Jurídica
      "contribuinte": 9, //1 - Contribuinte do ICMS, 2 - Contribuinte isento do ICMS ou 9 - Não contribuinte
      "cpf_cnpj": person.get('cpf'),
      "email": user.get('email'),
      "rg": person.get('rg'),
      "endereco": address.get('street'),
      "numero": address.get('numero'),
      "bairro": address.get('bairro'),
      "cep": address.get('zip'),
      "cidade": address.get('cidade'),
      "uf": address.get('uf'),
      "fone": phone.get('number'),
      "situacao": BlingContactStatus.ACTIVE
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
        fulfill(contact)
        // } else {
        // fulfill(contact)
        // }
      }
    }).catch(function (error) {
      reject(error)
    })
  })

  function verifyAndCreateGooleSheetsUser(user) {

  }
}