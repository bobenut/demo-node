var express = require('express');
var reqParamsGetter = require('../utilities/reqParamsGetter')
var agendaJobSetter = require('../controllers/agenda-job-setter')
var router = express.Router();

//curl -i -H "Content-Type:application/json" -d "{\"time\":\"2017/08/24 17:11:00\",\"from\":\"client1\",\"clientUrl\":\"http://localhost:7000/timeout/consumer\"}" http://localhost:4000/timeout/task
router.post('/timeout/task', function(req, res, next) {
  var reqParams = reqParamsGetter.get(req);
  
  console.log('url: %s, params； %s', '/timeout/task', JSON.stringify(reqParams, null, 2))

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
