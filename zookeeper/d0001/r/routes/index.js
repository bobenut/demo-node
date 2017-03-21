var express = require('express');
var requester = require('../requester');

var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

router.post('/task/overtime', function(req, res, next){
	 console.log("query: %s", JSON.stringify(req.query, null, 2));
	 console.log("body: %s", JSON.stringify(req.body, null, 2));
	var followOvertimeTask = {
		name:'followOvertime',
		time:req.body.time,
		assignToWho:'',
		responseToWho:'',
		done:'',
		doneReason:''
	};

	console.log("followOvertimeTask: %s", JSON.stringify(followOvertimeTask, null, 2));
	requester.submitTask(followOvertimeTask);
	
	res.end();
})

module.exports = router;
