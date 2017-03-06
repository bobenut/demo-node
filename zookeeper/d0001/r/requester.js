var zookeeper = require('node-zookeeper-client');

var zkClient;
var sessionId;
var requesterName = 'requester1';

var requester = {};



requester.begin = function(){
	zkClient = zookeeper.createClient('172.16.16.220:2181', {sessionTimeout:5000});
	// zkClient = zookeeper.createClient('172.13.12.28:2181', {sessionTimeout:5000});

	zkClient.on('state', onZkClientState);

	zkClient.connect();
};

function onZkClientState(state){
	if(state === zookeeper.State.SYNC_CONNECTED){
		sessionId = zkClient.getSessionId().toString('hex');
		console.log('requester connected server, sessionId=%s', sessionId.toString('hex'));
		registerRequester();
	}
}

function registerRequester(){
	zkClient.create(
			'/zht/status-collaboration/requesters/'+requesterName,
			new Buffer(sessionId || ''),
			zookeeper.CreateMode.EPHEMERAL,
			registerRequesterCallback);

}

function registerRequesterCallback(error, path){
	if(error){
		console.log('registerRequesterCallback=>register %s error:' + error.message, requesterName);
		setRequestWatcher();
		return;
	}


	console.log('registered requester, i am(%s)', sessionId);
}

function setRequestWatcher(){
	zkClient.exists(
		'/zht/status-collaboration/requesters/'+requesterName,
		requesterWatcher,
		setRequestWatcherCallback);
}

function setRequestWatcherCallback(error, state){
	if(error){
		console.log('setRequestWatcherCallback=>error:' + error.message);
		return;
	}

	if(state){
		console.log('setRequestWatcherCallback=>%s is exists', requesterName);
	}else{
		registerRequester();
	}
}

function requesterWatcher(event){
	if(event.getType() === zookeeper.Event.NODE_DELETED){
		console.log('requesterWatcher=>begin register %s', requesterName);
		registerRequester();
	}
}

requester.submitTask = function(task){
	zkClient.create(
		'/zht/status-collaboration/tasks/task',
		new Buffer(JSON.stringify(task,null,2) || ''),
		zookeeper.CreateMode.PERSISTENT_SEQUENTIAL,
		submitTaskCallback);

}

function submitTaskCallback(error, state){
	if(error){
		console.log('submitTaskCallback=>error:' + error.message);
		return;
	}
}

module.exports = requester;