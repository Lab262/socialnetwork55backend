
Parse.Cloud.define('blingManager', function (req, res) {

  performBlingRequest(req.params.requestMethod,
    req.params.pathPlusParams,
    req.params.requestBody,
    req.params.requestParams).then(function (httpResponse) {
      return res.success(httpResponse.data);
    }).catch(function (error) {
      return res.error(error);
    });
});

function performBlingRequest(requestMethod, pathPlusParams, requestBody, requestParams) {
  var params = "apikey=" + "ce7eb5a3b8b6ddcedc7d46b9cc49ef44a1966184";
  if (requestParams != null) {
    params = params + "&" + requestParams;
  }
  return Parse.Cloud.httpRequest({
    method: requestMethod,
    url: 'https://bling.com.br/Api/v2/' + pathPlusParams,
    body: requestBody,
    params: params
  });
}

function searchBlingUserByCPF(cpf) {
  return new Promise(function (fulfill, reject) {
    performBlingRequest('GET', 'contato/' + cpf + '/json/', null, null).then(function (httpResponse) {
      var errors = httpResponse.data['retorno']['erros'];
      var contacts = httpResponse.data['retorno']['contatos']
      if (errors != null || contacts == null || contacts.length <= 0) {
        if (errors.length > 0 && errors[0]['erro']['cod'] == 14) { //bling api contact not found error 
          fulfill([])
        } else {
          reject('Unexpected error in bling integration');
        }
      } else {
        fulfill(contacts)
      }
    }).catch(function (error) {
      reject(error)
    })
  })
}

function createBlingUserWithData(userData) {
  var js2xmlparser = require("js2xmlparser");
  var parseXMLString = require('xml2js').parseString;
  var objectToXml = js2xmlparser.parse("contato", userData);
  var xmlUserData = { "xml": objectToXml };
  return new Promise(function (fulfill, reject) {
    performBlingRequest('POST', 'contato', xmlUserData, null).then(function (httpResponse) {
      parseXMLString(httpResponse["text"], function (err, result) {
        if (err) {
          reject(err);
        } else {
          if (result["retorno"]["erros"] != null) {
            reject(result["retorno"]["erros"]);
          } else {
            fulfill(result);
          }
        }
      });
    }).catch(function (error) {
      reject(error);
    });
  })
}

exports.performBlingRequest = performBlingRequest;
exports.searchBlingUserByCPF = searchBlingUserByCPF;
exports.createBlingUserWithData = createBlingUserWithData;