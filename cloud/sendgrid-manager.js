
var sg = require('sendgrid')('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');

function sendMailToWithSubjectAndBody(to, subject, body) {
  var helper = require('sendgrid').mail;
  var fromEmail = new helper.Email('thiago@lab262.com');
  var toEmail = new helper.Email(to[0]);
  var subject = subject;
  var content = new helper.Content('text/plain', body);
  var mail = new helper.Mail(fromEmail, subject, toEmail, content);
  
  for (var i = 1; i < to.length ; i++) {
    var toEmail = new helper.Email(to[i]);
    mail.personalizations[0].addTo(toEmail)
  }
  

  var request = sg.emptyRequest({
    method: 'POST',
    path: '/v3/mail/send',
    body: mail.toJSON()
  });

  sg.API(request, function (error, response) {
    if (error) {
      console.log('Error response received');
    }
    console.log(response.statusCode);
    console.log(response.body);
    console.log(response.headers);
  });
}

exports.sendMailToWithSubjectAndBody = sendMailToWithSubjectAndBody;
