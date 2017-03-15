var zookeeper = require('node-zookeeper-client');
var Promise = require('bluebird');

var PATH_WORKERS = '/zht/status-collaboration/workers';
var PATH_REQUESTERS = '/zht/status-collaboration/requesters';
var PATH_ASSIGN = '/zht/status-collaboration/assign';
var PATH_TASKS = '/zht/status-collaboration/tasks';

var zkClient;
var sessionId;
var workers = {};
var requesters = {};
var assignedTasks = {};

var master = {};




master.begin = function(){
	// zkClient = zookeeper.createClient('172.16.16.220:2181', {sessionTimeout:5000});
	zkClient = zookeeper.createClient('172.16.24.208:2181', {sessionTimeout:5000});

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
		return new Promise(function(resolve, reject){
			console.log('master::doResponsiblity=>do synces ok:');
			resolve();
		});
	}).then(handleNoAssignedTasks)
	.then(SetTasksWatcher)
	.catch(function(error){
		console.log('master::doResponsiblity=>do synces error:' + error.message);
	});
}

function handleNoAssignedTasks(){
	return new Promise(function(resolve, reject){
		getTaskNames()
			.then(assignTasks)
			.then(function(results){
				console.log('master::handleNoAssignedTasks=>assign tasks ok');
				resolve(results);
			})
		.catch(function(error){
			console.log('master::handleNoAssignedTasks=>assign tasks error: %s', error.message);
			reject(error);		
		});
	});
}

function getTaskNames(){
	return new Promise(function(resolve, reject){
		zkClient.getChildren(
			'/zht/status-collaboration/tasks',
			function(error, children, state){
				if(error){
					console.log('master::getTaskNames=>error: %s', error.message);
					reject(error);
					return;
				}

				console.log('master::getTaskNames=>ok: %s', children);
				resolve(children);			
			});
	});
}

function assignTasks(taskNames){
	return new Promise(function(resolve1, reject1){
		Promise.map(taskNames, function(taskName, index){
			return new Promise(function(resolve2, reject2){
				getTaskData(taskName)
					.then(taskIsNotYetAssigned)
					.then(assignTask)
					.then(function(results){
						console.log('master::assignTasks.p1=>assign %s, assignTask is ok: %s', taskName, results);
						resolve2(results);
					}).catch(function(error){
						console.log('master::assignTasks.p1=>do %s catch error: %s', taskName, error.message);
						//reject2(error);
						resolve2();
					});
				});
		}).then(function(results){
			console.log('master::assignTasks.p2=>assignTask is ok: %s', results);
			resolve1(results)
		}, function(error){
			console.log('master::assignTasks.p2=>error: %s', error.message);
			reject1(error);
		});
	});
}

function assignTask(task){
	return new Promise(function(resolve, reject){
		if(!isExistWorkers){
			reject(new Error('NO_WORKERS'));
			return;
		}

		var taskNo = takeOutTaskNo(task.taskName);
		var workerName = allocateWorkerForTask(taskNo);

		var workerAssignPath = PATH_ASSIGN + '/' + workerName + '/' + task.taskName;
		// console.log('master::assignTask=>workerAssignPath: %s', workerAssignPath); 
		task.taskData.assignToWho = workerName;
		// console.log('master::assignTask=>taskPath: %s', task.taskPath); 
		zkClient.transaction()
			.create(
				workerAssignPath,
				new Buffer(JSON.stringify(task.taskData, null, 2)),
				zookeeper.CreateMode.PERSISTENT)
			.setData(
				task.taskPath,
				new Buffer(JSON.stringify(task.taskData, null, 2)))
			.commit(function(error, results){
				if(error){
					console.log('master::assignTask=>commit error: %s', error.message); 
					reject(error);
					return;
				}

				console.log('master::assignTask=>commit ok: %s', results); 
				resolve(results);
			});
	});
}

function getTaskData(taskName){
	return new Promise(function(resolve, reject){
		var taskPath = PATH_TASKS + '/' + taskName;
		zkClient.getData(
			taskPath,
			function(error, data, state){
				if(error){
					consle.log('master::getTaskData=>get %s\'s data error: %s', taskName, error.message);
					reject(error);
					return;
				}

				console.log('master::getTaskData=>get %s\'s data ok, data: ', taskName, JSON.parse(data.toString())); 

				resolve({
					taskName: taskName,
					taskPath: taskPath,
					taskData: JSON.parse(data.toString())});			
			});
	});
}

function taskIsNotYetAssigned(task){
	return new Promise(function(resolve, reject){
		if(task.taskData.assignToWho.length === 0){
			resolve(task);
		}else{
			reject(new Error('TASK_ASSIGNED'));
		}
	});
}


function takeOutTaskNo(taskName){
	var taskNo = parseInt(taskName.slice(4));
	// console.log('master::takeOutTaskNo=>taskNo=%s', taskNo);

	return taskNo;
}

function allocateWorkerForTask(taskNo){
	return 'worker' + (taskNo % Object.getOwnPropertyNames(workers).length + 1);
}

function isExistWorkers(){
	return Object.getOwnPropertyNames(workers).length > 0;
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
		if(!requesters[requesterPath]){
			requesters[requesterPath] = {};
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

function SetTasksWatcher(event){
	return new Promise(function(resolve, reject){
		zkClient.getChildren(
			'/zht/status-collaboration/tasks',
			tasksWatcher,
			function(error, children, state){
				if(error){
					console.log('master::SetTasksWatcher=>set tasks watcher error: %s', error.message);
					reject(error);
					return;
				}

				console.log('master::SetTasksWatcher=>set tasks watcher ok: %s', children);
				resolve();			
			});
	});
}

function tasksWatcher(event){
	if(event.getType() === zookeeper.Event.NODE_CHILDREN_CHANGED){
		console.log('master::tasksWatcher=>type=%s, name=%s, path=%s, eventString=%s', 
			event.getType(),event.getName(),event.getPath(),event.toString());

		handleNoAssignedTasks()
			.then(function(results){
				console.log('master::tasksWatcher=>reset tasks watcher ok');
			})
			.catch(function(error){
				console.log('master::tasksWatcher=>reset tasks watcher error: %s', error.message);
			})
			.finally(SetTasksWatcher);
	}
}

module.exports = master;