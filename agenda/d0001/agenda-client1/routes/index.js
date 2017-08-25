var express = require('express')
var reqParamsGetter = require('../utilities/reqParamsGetter')
var router = express.Router()

router.post('/consumer/finished', function(req, res, next) {
  var reqParams = reqParamsGetter.get(req)
  
  console.log('url: %s, params； %s', '/timeout/consumer/finished', JSON.stringify(reqParams, null, 2))
  res.end()
})

module.exports = router
