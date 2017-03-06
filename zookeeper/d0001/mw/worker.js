var zookeeper = require('node-zookeeper-client');

var zkClient;
var sessionId;
var workerName = 'worker1';

var worker = {};



worker.begin = function(){
	zkClient = zookeeper.createClient('172.16.16.220:2181', {sessionTimeout:5000});
	// zkClient = zookeeper.createClient('192.168.0.138:2181', {sessionTimeout:5000});

	zkClient.on('state', onZkClientState);

	zkClient.connect();
};

function onZkClientState(state){
	if(state === zookeeper.State.SYNC_CONNECTED){
		sessionId = zkClient.getSessionId().toString('hex');
		console.log('worker connected server, sessionId=%s', sessionId.toString('hex'));
		registerWorker();
	}
}

function registerWorker(){
	zkClient.create(
			'/zht/status-collaboration/workers/'+workerName,
			new Buffer(sessionId || ''),
			zookeeper.CreateMode.EPHEMERAL,
			registerWorkerCallback);

}

function registerWorkerCallback(error, path){
	if(error){
		console.log('registerWorkerCallback=>register %s error:' + error.message, workerName);
		setWorkerWatcher();
		return;
	}


	registerWorkerAssign();
	console.log('registered worker, i am(%s)', sessionId);
}

function registerWorkerAssign(){
	zkClient.create(
			'/zht/status-collaboration/assign/'+workerName,
			new Buffer(sessionId || ''),
			zookeeper.CreateMode.PERSISTENT,
			registerWorkerAssignCallback);

}

function registerWorkerAssignCallback(error, path){
	if(error){
		console.log('registerWorkerAssignCallback=>register %s error:' + error.message, workerName);
		return;
	}

	console.log('registered worker in assign, i am(%s)', sessionId);
}

function setWorkerWatcher(){
	zkClient.exists(
		'/zht/status-collaboration/workers/'+workerName,
		workerWatcher,
		setWorkerWatcherCallback);
}

function setWorkerWatcherCallback(error, state){
	if(error){
		console.log('setWorkerWatcherCallback=>error:' + error.message);
		return;
	}

	if(state){
		console.log('setWorkerWatcherCallback=>%s is exists', workerName);
	}else{
		registerWorker();
	}
}

function workerWatcher(event){
	if(event.getType() === zookeeper.Event.NODE_DELETED){
		console.log('workerWatcher=>begin register %s', workerName);
		registerWorker();
	}
}

module.exports = worker;