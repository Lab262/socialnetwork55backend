
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