var zookeeper = require('node-zookeeper-client');

var zkClient;
var sessionId;

var master = {};



master.begin = function(){
	zkClient = zookeeper.createClient('172.16.16.220:2181', {sessionTimeout:5000});

	zkClient.on('state', onZkClientState);

	zkClient.connect();
};

function onZkClientState(state){
	if(state === zookeeper.State.SYNC_CONNECTED){
		sessionId = zkClient.getSessionId().toString('hex');
		console.log('connected, sessionId=%s', sessionId.toString('hex'));
		catchMaster();
	}
}

function catchMaster(){
	zkClient.create(
			'/zht/status-collaboration/master/lock',
			new Buffer(sessionId || ''),
			zookeeper.CreateMode.EPHEMERAL,
			catchMasterCallback);

}

function catchMasterCallback(error, path){
	if(error){
		console.log('catchMasterCallback=>master is exists failed:' + error.message);
		checkMasterIsExist();
		return;
	}

	console.log('catched master success, i am(%s)', sessionId);
}

function checkMasterIsExist(){
	zkClient.exists(
		'/zht/status-collaboration/master/lock',
		catchMasterWatcher,
		checkMasterIsExistCallback);
}

function checkMasterIsExistCallback(error, state){
	if(error){
		console.log('checkMasterIsExistCallback=>error:' + error.message);
		return;
	}

	if(state){
		console.log('checkMasterIsExistCallback=>master is exists');
	}else{
		catchMaster();
	}
}

function catchMasterWatcher(event){
	if(event.getType() === zookeeper.Event.NODE_DELETED){
		console.log('catchMasterWatcher=>begin catch master');
		catchMaster();
	}
}



module.exports = master;