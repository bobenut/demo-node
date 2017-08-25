var express = require('express');
var reqParamsGetter = require('../utilities/reqParamsGetter')
var agendaJobSetter = require('../controllers/agenda-job-setter')
var router = express.Router();

router.post('/timeout/task', function(req, res, next) {
  var reqParams = reqParamsGetter.get(req);
  
//   console.log('url: %s, params； %s', '/timeout/task', JSON.stringify(reqParams, null, 2))

  agendaJobSetter.addTaskIntoTimeoutJob(reqParams)
    .then(function (data) {
        res.send({result: 'success'})
        res.end()
    })
    .catch(function (err) {
        res.send({result: 'failed', errMsg: err})
        res.end()
    });
});

module.exports = router;
