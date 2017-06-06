var path = require('path');
var VindiManager = require(path.join(__dirname, '/vindi-manager.js'));
var BlingManager = require(path.join(__dirname, '/bling-manager.js'));
var GoogleSpreadsheetsManager = require(path.join(__dirname, '/google-spreadsheets-manager.js'));
var SendgridManager = require(path.join(__dirname, '/sendgrid-manager.js'));

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

const BlingPedidoStatus = {  //BLING STATUS E-excluido I-inativo A-ativo S-sem movimento
  OPENED: 0,
  SERVICED: 1,
  CANCELED: 2,
  INPROGRESS: 3,
  SALEBROKERED: 4,
  INTYPING: 10,
  VERIFIED: 11
}

// Parse.Cloud.define('sendUserAccessMail', function (req, res) {

//   var users = req.params.users

//   for (index in users) {
//     resetUserPassword(users[index], res)
//   }

// });

function resetUserPassword(userInfo) {
  return new Promise(function (fulfill, reject) {
    var query = new Parse.Query(Parse.User);
    query.equalTo("username", userInfo.email);
    query.equalTo("objectId", userInfo.objectId);
    query.find().then(function (results) {
      if (results.length > 0) {
        var user = results[0];
        return Parse.User.requestPasswordReset(user.getUsername());
      } else {
        return reject('User not found');
      }
    }).then(function (error, result) {
      return fulfill(result);
    }).catch(function (error) {
      return reject('User not found');
    });
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

  var membershipPlanId = 14928
  var creditCardDecriptedData = req.params.cardInfo
  var userToRegister = null;
  var vindiUserId = null
  var blingClientData = null
  var membershipPlanInfo = null
  findUserByEmailOrCpf(req.params.email, req.params.cpf, res).then(function (users) {
    return verifyAndCreateUserCowork(users, req.params)
  }).then(function (userCowork) {
    userToRegister = userCowork
    return verifyAndCreateVindiUser(userCowork, res);
  }).then(function (vindiHttpResponse) {
    vindiUserId = vindiHttpResponse.data.customer.id
    return verifyAndCreateBlingUser(userToRegister);
  }).then(function (blingHttpRequest) {
    blingClientData = blingHttpRequest
    return verifyAndCreateGooleSheetsUser(userToRegister);
  }).then(function (googleSheetsHttpRequest) {
    return createSubscriptionWithUserAndVindiIdAndPlanIdAndCardInfo(userToRegister, vindiUserId, membershipPlanId, creditCardDecriptedData)
  }).then(function (vindiSubscriptionHttpResponse) {
    membershipPlanInfo = {
      name: vindiSubscriptionHttpResponse.data.subscription.product_items[0].product.name,
      price: vindiSubscriptionHttpResponse.data.subscription.product_items[0].pricing_schema.price,
      code: vindiSubscriptionHttpResponse.data.subscription.product_items[0].product.code
    }
    return updateUserPerson(req.params, userToRegister, SubscriptionStatus.ACTIVE);
  }).then(function (updatedUser) {
    var userInfo = {
      email: userToRegister.get('email'),
      objectId: userToRegister.id
    }
    resetUserPassword(userInfo);
    createBlingMembershipSellsWithData(blingClientData, membershipPlanInfo, userToRegister.id);
    //TODO: Gera compras com pagamento previsto e parcelas usando status e nao 12 compras diferentes -> TO TEST
    return res.success(updatedUser);
  }).catch(function (error) {
    return res.error(error);
  });
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
    newAddress.set('state', userParams.person.address.state);
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
    newPerson.get('phones').query().equalTo('isMain', true).find().then(function (mainPhones) {
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
      return newPerson.get('addresses').query().equalTo('isMain', true).find()
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
      newAddress.set('state', userParams.person.address.state);
      newAddress.set('isMain', userParams.person.address.isMain);

      return newAddress.save()

    }).then(function (newAddress) {
      if (isNewAddress == true) {
        var addressesRelation = newPerson.relation("addresses");
        addressesRelation.add(newAddress);
      }
      newUser.set('personPointer', newPerson);
      return newUser.save(null, { useMasterKey: true })
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
  var existingPhoneId = null
  return new Promise(function (fulfill, reject) {
    VindiManager.searchVindiUserByCPF(person.get('cpf'), res).then(function (httpResponse) {
      if (httpResponse.data["customers"].length > 0) { // user registered on vindi
        existingUserId = httpResponse.data["customers"][0]["id"];
        if (httpResponse.data["customers"][0]["phones"].length > 0) {
          existingPhoneId = httpResponse.data["customers"][0]["phones"][0]["id"];
        }
      }

      return person.get('addresses').query().equalTo('isMain', true).find();
    }).then(function (mainAddresses) {
      if (mainAddresses.length > 0) {
        var address = mainAddresses[0];
        vindiUserData["address"] = { //add address
          "street": address.get('street'),
          "number": address.get('number'),
          "neighborhood": address.get('neighborhood'),
          "zipcode": address.get('zip'),
          "city": address.get('city'),
          "state": address.get('state'),
          "country": 'BR'
        };
      }
      return person.get('phones').query().equalTo('isMain', true).find();
    }).then(function (mainPhones) {
      if (mainPhones.length > 0) { //add phones
        var phone = mainPhones[0];
        var vindiPhoneData = {
          phone_type: "mobile",
          number: phone.get('number'),
          exension: ""
        };
        if (existingPhoneId != null) {
          vindiPhoneData["id"] = existingPhoneId;
        }
        vindiUserData["phones"] = [vindiPhoneData];
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
      "situacao": BlingContactStatus.ACTIVE
    }
    BlingManager.searchBlingUserByCPF(user.get('personPointer').get('cpf')).then(function (contacts) {
      if (contacts.length <= 0) { //user not found
        //CREATE NEW USER 
        person.get('addresses').query().equalTo('isMain', true).find().then(function (mainAddresses) {
          if (mainAddresses.length > 0) {
            var address = mainAddresses[0];
            blingUser["endereco"] = address.get('street');
            blingUser["numero"] = address.get('number');
            blingUser["bairro"] = address.get('neighborhood');
            blingUser["cep"] = address.get('zip');
            blingUser["cidade"] = address.get('city');
            blingUser["uf"] = address.get('state');
          }
          return person.get('phones').query().equalTo('isMain', true).find();
        }).then(function (mainPhones) {
          if (mainPhones.length > 0) { //add phones
            var phone = mainPhones[0];
            blingUser["fone"] = phone.get('number');
          }
          return BlingManager.createBlingUserWithData(blingUser)
        }).then(function (httpResponse) {
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


}

function createBlingMembershipSellsWithData(userData, productData, clientDBId) {
  var blingSellData = {
    "cliente": {
      "nome": userData.nome,
      "tipo_pessoa": userData.tipo,
      "cpf_cnpj": userData.cnpj,
      "endereco": userData.endereco,
      "numero": userData.numero,
      "bairro": userData.bairro,
      "cep": userData.cep,
      "cidade": userData.cidade,
      "uf": userData.uf,
      "email": userData.email,
      "fone": userData.fone
    },
    "itens": [
      {
        "item": {
          "descricao": productData.name,
          "un": "Pc",
          "qtde": "1",
          "vlr_unit": productData.price,
          "tipo": "P",
          "codigo": productData.code,
          "class_fiscal": "01022110",
          "origem": "1",
          "obs": "client_code_" + clientDBId
        }
      }
    ],
    "parcelas": [
      {
        "parcela": {
          "dias": "0",
          "vlr": productData.price
        }
      }
    ],
    "loja": "203149110", //55lab filial
    "numero_loja": productData.code, //vindi code
    // "loja2teste": "203135828",
    "vendedor": "Lab262" //
  }

  createBlingMembershipSellsWithDataIteration(0, blingSellData)

}

function createBlingMembershipSellsWithDataIteration(iteration, data) {
  var dataWithStatementDateUpdated = data;
  dataWithStatementDateUpdated.parcelas[0].parcela.dias = "" + iteration * 30;
  dataWithStatementDateUpdated.itens[0].item.obs = dataWithStatementDateUpdated.itens[0].item.obs + "_fidelidade_" + iteration;

  if (iteration < 3) {
    var gerarnfe = "false"
    if (iteration == 0) { //just the current payment has nfe
      gerarnfe = "true"
    }
    BlingManager.createBlingPedidoWithData(dataWithStatementDateUpdated, gerarnfe).then(function (httpResponse) {
      // console.log(iteration);
      var iterationStep = iteration + 1;
      if (iteration == 0) {
        //update to serviced and after create new
        BlingManager.updateBlingPedidoSituacao(BlingPedidoStatus.SERVICED, httpResponse.retorno.pedidos[0].pedido.numero).then(function (blingUpdateHttpsRequest) {
          createBlingMembershipSellsWithDataIteration(iterationStep, dataWithStatementDateUpdated);
        }).catch(function (err) {
          console.log(error.length);
          console.log(error[0].erro);
        });
      } else {
        createBlingMembershipSellsWithDataIteration(iterationStep, dataWithStatementDateUpdated);
      }
    }).catch(function (error) {
      console.log(error.length);
      console.log(error[0].erro);
    })
  } else {
    console.log("success bling sells created");
  }

}

function verifyAndCreateGooleSheetsUser(user) {

  return new Promise(function (fulfill, reject) {

    var newUser = {
      "values": [
        [
          user.get('email'),
          user.get('personPointer').get('name'),
          user.get('personPointer').get('cpf'),
          "F",
          user.get('personPointer').get('rg'),
          SubscriptionStatus.TRYINGTOBUY
        ]
      ]
    }
    var isNewUser = false;
    var googlePayload = null
    GoogleSpreadsheetsManager.findUserWithEmail(user.get('username')).then(function (payload) {
      if (payload == null) {
        isNewUser = true
      }
      googlePayload = payload;

      return user.get('personPointer').get('addresses').query().equalTo('isMain', true).find()

    }).then(function (mainAddresses) {
      if (mainAddresses.length > 0) {
        var address = mainAddresses[0];
        newUser.values[0].push(address.get('street'));
        newUser.values[0].push(address.get('number'));
        newUser.values[0].push(address.get('neighborhood'));
        newUser.values[0].push(address.get('zip'));
        newUser.values[0].push(address.get('city'));
        newUser.values[0].push(address.get('state'));
      }
      return user.get('personPointer').get('phones').query().equalTo('isMain', true).find();
    }).then(function (mainPhones) {
      if (mainPhones.length > 0) { //add phones
        var phone = mainPhones[0];
        newUser.values[0].push(phone.get('number'));
      }
      if (isNewUser == true) {
        return GoogleSpreadsheetsManager.createNewUserWithData(newUser);
      } else {
        return GoogleSpreadsheetsManager.updateUserWithData(newUser, googlePayload.range);
      }
    }).then(function (userSaved) {
      fulfill(userSaved);
    }).catch(function (err) {
      reject(err);
    });

  });



}

function createSubscriptionWithUserAndVindiIdAndPlanIdAndCardInfo(user, userVindiId, planId, cardInfo, res) {
  var person = user.get('personPointer');
  var subscriptionData = {
    "plan_id": planId,
    "customer_id": userVindiId,
    "start_at": getTodayISO8601(),
    "payment_method_code": "credit_card",
    "payment_profile": {
      "holder_name": person.get('name'),
      "registry_code": person.get('cpf'),
      "card_expiration": cardInfo['expiration'],
      "card_number": cardInfo['number'],
      "card_cvv": cardInfo['cvv'],
      "payment_method_code": 'credit_card',
      "payment_company_code": cardInfo['payment_company_code']
    }
  }
  return new Promise(function (fulfill, reject) {
    VindiManager.createSubscriptionWithData(subscriptionData).then(function (httpResponse) {
      fulfill(httpResponse)
    }).catch(function (error) {
      SendgridManager.sendMailToWithSubjectAndBody(["thiago@lab262.com", "luis@lab262.com"], "Tentativa mal sucedida de compra membership", "Um possível lead tentou comprar membership mas a tentativa falhou, o usuario entrou com os seguintes dados:     " + JSON.stringify(subscriptionData));
      reject(error);
    })
  })

  function getTodayISO8601() {
    var today = new Date();
    var dd = today.getDate();
    var mm = today.getMonth() + 1; //January is 0!
    var yyyy = today.getFullYear();
    if (dd < 10) {
      dd = '0' + dd
    }

    if (mm < 10) {
      mm = '0' + mm
    }
    var today = yyyy + "-" + mm + "-" + dd
    return today
  }
}