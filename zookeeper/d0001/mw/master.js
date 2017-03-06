var zookeeper = require('node-zookeeper-client');
var Promise = require('bluebird');

var PATH_WORKERS = '/zht/status-collaboration/workers';
var PATH_REQUESTERS = '/zht/status-collaboration/requesters';

var zkClient;
var sessionId;
var workers = {};
var requesters = {};

var master = {};




master.begin = function(){
	// zkClient = zookeeper.createClient('172.16.16.220:2181', {sessionTimeout:5000});
	// zkClient = zookeeper.createClient('172.13.12.28:2181', {sessionTimeout:5000});

	zkClient.on('state', onZkClientState);

	zkClient.connect();
};

function onZkClientState(state){
	if(state === zookeeper.State.SYNC_CONNECTED){
		sessionId = zkClient.getSessionId().toString('hex');
		console.log('master::onZkClientState=>master connected server, sessionId=%s', sessionId.toString('hex'));
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
		console.log('master::catchMasterCallback=>master is exists failed:' + error.message);
		checkMasterIsExist();
		return;
	}

	console.log('master::catchMasterCallback=>catched master, i am(%s)', sessionId);

	doResponsiblity();
}

function checkMasterIsExist(){
	zkClient.exists(
		'/zht/status-collaboration/master/lock',
		catchMasterWatcher,
		checkMasterIsExistCallback);
}

function checkMasterIsExistCallback(error, state){
	if(error){
		console.log('master::checkMasterIsExistCallback=>error:' + error.message);
		return;
	}

	if(state){
		console.log('master::checkMasterIsExistCallback=>master is exists');
	}else{
		catchMaster();
	}
}

function catchMasterWatcher(event){
	if(event.getType() === zookeeper.Event.NODE_DELETED){
		console.log('master::catchMasterWatcher=>begin catch master');
		catchMaster();
	}
}

function doResponsiblity(){
	var synces = [syncWorkers(), syncRequesters()];
	Promise.all(synces).then(function(){
		console.log('master::doResponsiblity=>do synces ok:');
	}).catch(function(error){
		console.log('master::doResponsiblity=>do synces error:' + error.message);
	});
}

function syncTasks(){
	zkClient.getChildren(
		'/zht/status-collaboration/tasks',
		tasksWatcher,
		setTasksWatcherCallback);
}

function syncTasksCallback(error, children, state){
	if(error){
		console.log('master::syncTasksCallback=>set watcher for tasks error:' + error.message);
		return;
	}

	for(var i=0,child;child=children[i++];){
		console.log(child);
	}

	console.log('master::syncTasksCallback=>set watcher for tasks ok');

}

function tasksWatcher(event){
	// if(event.getType() === zookeeper.Event.NODE_CHILDREN_CHANGED){
		console.log('master::tasksWatcher=>type=%s, name=%s, path=%s, eventString=%s', 
			event.getType(),event.getName(),event.getPath(),event.toString());
	// }
}

function syncWorkers(){
	return new Promise(function(resolve, reject){
		getWorkers().then(function(children){
			memoryPersistWorkers(children);
			resolve();
		}).catch(function(error){
			reject(error);
		});
	});
}

function memoryPersistWorkers(workerNames){
	for(var i=0,workerName;workerName=workerNames[i++];){
		var workerPath = PATH_WORKERS + '/' + workerName;
		if(!workers[workerPath]){
			workers[workerPath] = {};
			console.log('master::memoryPersistWorkers=>add worker: %s', workerPath);
		}
	}
}

function getWorkers(){
	return new Promise(function(resolve, reject){
		zkClient.getChildren(
			'/zht/status-collaboration/workers',
			workersWatcher,
			function(error, children, state){
				if(error){
					reject(error);
					return;
				}

				resolve(children);
			});
	});
}

function workersWatcher(event){
	// if(event.getType() === zookeeper.Event.NODE_CHILDREN_CHANGED){
		console.log('master::workersWatcher=>type=%s, name=%s, path=%s, eventString=%s', 
			event.getType(),event.getName(),event.getPath(),event.toString());
	// }
}

function syncRequesters(){
	return new Promise(function(resolve, reject){
		getRequesters().then(function(children){
			memoryPersistRequsters(children);
			resolve();
		}).catch(function(error){
			reject(error);
		});
	});
}

function getRequesters(){
	return new Promise(function(resolve, reject){
		zkClient.getChildren(
			'/zht/status-collaboration/requesters',
			requestersWatcher,
			function(error, children, state){
				if(error){
					reject(error);
					return;
				}

				resolve(children);
			});
	});
}

function memoryPersistRequsters(requesterNames){
	for(var i=0,requesterName;requesterName=requesterNames[i++];){
		var requesterPath = PATH_REQUESTERS + '/' + requesterName;
		if(!workers[requesterPath]){
			workers[requesterPath] = {};
			console.log('master::memoryPersistRequsters=>add requester: %s', requesterPath);
		}
	}
}

function requestersWatcher(event){
	// if(event.getType() === zookeeper.Event.NODE_CHILDREN_CHANGED){
		console.log('master::requestersWatcher=>type=%s, name=%s, path=%s, eventString=%s', 
			event.getType(),event.getName(),event.getPath(),event.toString());
	// }
}



module.exports = master;