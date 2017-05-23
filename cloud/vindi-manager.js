
Parse.Cloud.define('vindiManager', function (req, res) {

  performVindiRequest(req.params.requestMethod, 
  req.params.pathPlusParams, 
  req.params.requestBody, 
  req.params.requestParams).then(function(httpResponse) {
    return res.success(httpResponse.data);
  }).catch(function(error){ 
    return res.error(error)
  })
});

function performVindiRequest(requestMethod, pathPlusParams, requestBody, requestParams) {
    return Parse.Cloud.httpRequest({
      method: requestMethod,
      url: 'https://app.vindi.com.br:443/api/v1/' + pathPlusParams,
      body: requestBody,
      params: requestParams,
      headers: {
        "Authorization": "Basic SWNHWjBxc3dPOExUMGh3M1U5SnpWNU5PcEdrWnQ2cWY6KioqKiogSGlkZGVuIGNyZWRlbnRpYWxzICoqKioq",
        "Content-Type": "application/json; charset=UTF-8"
      }
    })
}

function searchVindiUserByCPF(cpf) {
  return performVindiRequest('GET', 'customers', null, 'query= registry_code=' + cpf + ' status!=archived');
}

function createVindiUserWithData(userData) {
    return performVindiRequest('POST', 'customers', userData, null);
}

function updateVindiUserWithData(userData,userId) {
    return performVindiRequest('PUT', 'customers/' + userId, userData, null);
}

exports.performVindiRequest = performVindiRequest;
exports.searchVindiUserByCPF = searchVindiUserByCPF;
exports.createVindiUserWithData = createVindiUserWithData;
exports.updateVindiUserWithData = updateVindiUserWithData;