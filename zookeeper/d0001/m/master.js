var zookeeper = require('node-zookeeper-client');
var Promise = require('bluebird');
const EventEmitter = require('events');
const config = require('./config');


var zkClient;
var sessionId;
var workers = {};
var workersTable = [];
var requesters = {};
var assignedTasks = {};

var master = {};


var requestersWatcherEventEmitter = new EventEmitter();
var workersWatcherEventEmitter = new EventEmitter();


master.begin = function(){
	// zkClient = zookeeper.createClient('172.13.2.204:2181', {sessionTimeout:5000});
	zkClient = zookeeper.createClient('172.16.16.210:2181', {sessionTimeout:5000});
	// zkClient = zookeeper.createClient('172.16.24.208:2181', {sessionTimeout:5000});
	// zkClient = zookeeper.createClient('172.16.24.166:2181', {sessionTimeout:5000});
	// zkClient = zookeeper.createClient('172.16.23.227:2181', {sessionTimeout:5000});

	zkClient.on('state', onZkClientState);

	zkClient.connect();
};

function onZkClientState(state){
	if(state === zookeeper.State.SYNC_CONNECTED){
		sessionId = zkClient.getSessionId().toString('hex');
		// console.log('master::onZkClientState=>master connected server, sessionId=%s', sessionId.toString('hex'));
		console.log('%s=> connected server', config.masterName);
		catchMaster();
	}
}

function catchMaster(){
	zkClient.create(
			config.masterLockPath,
			new Buffer(sessionId || ''),
			zookeeper.CreateMode.EPHEMERAL,
			catchMasterCallback);

}

function catchMasterCallback(error, path){
	if(error){
		// console.log('master::catchMasterCallback=>master is exists failed:' + error.message);
		if(error.message == 'Exception: NODE_EXISTS[-110]'){
			console.log('%s=> master is existed', config.masterName);
		}else{
			console.error('%s=> catch master error: %s', config.masterName, error.message);
		}
		setCatchMasterWatcher();
		return;
	}

	// console.log('master::catchMasterCallback=>catched master, i am(%s)', sessionId);
	console.log('%s=> i am master', config.masterName);

	doResponsiblity();
}

function setCatchMasterWatcher(){
	zkClient.exists(
		config.masterLockPath,
		catchMasterWatcher,
		setCatchMasterWatcherCallback);
}

function setCatchMasterWatcherCallback(error, state){
	if(error){
		// console.log('master::checkMasterIsExistCallback=>error:' + error.message);
		console.error('%s=> set watcher to catch master error: %s', config.masterName, error.message);
		return;
	}

	if(state){
		// console.log('master::checkMasterIsExistCallback=>master is exists');
		// console.log('%s=> master is existed', config.masterName);
	}else{
		catchMaster();
	}
}

function catchMasterWatcher(event){
	if(event.getType() === zookeeper.Event.NODE_DELETED){
		// console.log('master::catchMasterWatcher=>begin catch master');
		catchMaster();
	}
}

function doResponsiblity(){
	var synces = [syncWorkers(), syncRequesters()];
	Promise.all(synces).then(function(){
		return new Promise(function(resolve, reject){
			// console.log('master::doResponsiblity=>do synces ok:');

			resolve();
		});
	})
	.then(setDispatchingTasksWatcher)
	.then(setResponsingTasksWatcher)
	.then(handleNoAssignedTasks)
	.catch(function(error){
		console.error('%s=> do responsiblity error: %s' , config.masterName, error.message);
	});

	workersWatcherEventEmitter.on('camein', onWorkerCamein);
	workersWatcherEventEmitter.on('leaved', onWorkerLeaved);
	requestersWatcherEventEmitter.on('camein', onRequesterCamein);
	requestersWatcherEventEmitter.on('goout', onRequesterLeaved);
}

function handleNoAssignedTasks(){
	return new Promise(function(resolve, reject){

		checkIsCouldAssignTask()
			.then(getTaskNames)
			.then(assignTasks)
			.then(function(results){
				// console.log('master::handleNoAssignedTasks=>assign tasks ok');
				resolve(results);
			})
		.catch(function(error){
			// console.log('master::handleNoAssignedTasks=>assign tasks error: %s', error.message);
			console.error('%s=> handle no assigned tasks error %s', config.masterName, error.message);
			reject(error);		
		});
	});
}

function checkIsCouldAssignTask(){
	return new Promise(function(resolve, reject){
		var workerCount = Object.getOwnPropertyNames(workers).length;
		var requesterCount = Object.getOwnPropertyNames(requesters).length;

		if(workerCount > 0 && requesterCount > 0){
			resolve();
		}else if(workerCount == 0){
			reject(new Error('NO_WORKERS'));

		}else if(requesterCount == 0){
			reject(new Error('NO_REQUESTERS'));

		}else{
			reject(new Error('CHECK_IS_COULD_ASSIGN_TASK_FAILED'));
		}
	});
}

function getTaskNames(){
	return new Promise(function(resolve, reject){

		zkClient.getChildren(
			config.tasksDispatchingPath,
			function(error, children, state){
				if(error){
					// console.log('master::getTaskNames=>error: %s', error.message);
					console.error('%s=> get names all of tasks error: %s', config.masterName, error.message);
					reject(error);
					return;
				}

				// console.log('master::getTaskNames=>ok: %s', children);
				resolve(children);			
			});
	});
}

function assignTasks(taskNodeNames){
	return new Promise(function(resolve1, reject1){

		Promise.map(taskNodeNames, function(taskNodeName, index){
			return new Promise(function(resolve2, reject2){

				getTaskDataByName(taskNodeName)
					.then(taskIsNotYetAssigned)
					.then(assignTask)
					.then(setAssignedTasksWatcher)
					.then(function(results){
						// console.log('master::assignTasks.p1=>assign %s, assignTask is ok: %s', taskName, results);
						resolve2(results);
					}).catch(function(error){
						// console.log('master::assignTasks.p1=>do %s catch error: %s', taskName, error.message);
						//reject2(error);
						resolve2();
					});
				});
		}).then(function(results){
			// console.log('master::assignTasks.p2=>assignTask is ok: %s', results);
			resolve1(results)
		}, function(error){
			// console.log('master::assignTasks.p2=>error: %s', error.message);
			reject1(error);
		});
	});
}


function getTaskDataByName(taskNodeName){
	var taskDispatchingPath = config.tasksDispatchingPath + '/' + taskNodeName;

	return new Promise(function(resolve, reject){

		zkClient.getData(
			taskDispatchingPath,
			function(error, data, state){
				if(error){
					// consle.log('master::getTaskData=>get %s\'s data error: %s', taskName, error.message);
					console.error('%s=> get %s\'s detail by task Node Name error: %s', config.masterName, taskNodeName, error.message);
					reject(error);
					return;
				}

				// console.log('master::getTaskData=>get %s\'s data ok, data: ', taskName, JSON.parse(data.toString())); 
				var taskDetail = JSON.parse(data.toString());
				taskDetail.taskNodeName = taskDetail.taskNodeName || taskNodeName;
				taskDetail.taskDispatchingPath = taskDetail.taskDispatchingPath || taskDispatchingPath;
				//console.log('####################################1: %s', JSON.stringify(taskDetail, null, 2));

				resolve(taskDetail);			
			});
	});
}

function taskIsNotYetAssigned(taskDetail){
	return new Promise(function(resolve, reject){
		if(taskDetail.assignToWho.length === 0){
			resolve(taskDetail);
		}else{
			reject(new Error('TASK_ASSIGNED'));
		}
	});
}

function assignTask(taskDetail){
	return new Promise(function(resolve, reject){
		

		if(!isExistWorkers){
			reject(new Error('NO_WORKERS'));
			return;
		}

		var taskNo = takeOutTaskNo(taskDetail.taskNodeName);
		var workerName = allocateWorkerForTask(taskNo);

		taskDetail.isDispatchedToWorker = true;
		taskDetail.assignToWho = workerName;
		taskDetail.assignedPath = config.tasksAssignPath + '/' + workerName + '/' + taskDetail.taskNodeName;

		zkClient.transaction()
			.create(
				taskDetail.assignedPath,
				new Buffer(JSON.stringify(taskDetail, null, 2)),
				zookeeper.CreateMode.PERSISTENT)
			.setData(
				taskDetail.taskDispatchingPath,
				new Buffer(JSON.stringify(taskDetail, null, 2)))
			.commit(function(error, results){
				if(error){
					// console.log('master::assignTask=>commit error: %s', error.message); 
					console.error('%s=> dispatched <%s> to <%s> error: %s', config.masterName, taskDetail.taskNodeName, workerName, error.message);
					reject(error);
					return;
				}
				// console.log('master::assignTask=>commit ok: %s', results); 
				console.log('%s=> dispatched <%s> to <%s> ', config.masterName, taskDetail.taskNodeName, taskDetail.assignToWho);
				resolve(taskDetail);
			});
	});
}


function getTaskDataByPath(taskPath){
	return new Promise(function(resolve, reject){
		zkClient.getData(
			taskPath,
			function(error, data, state){
				if(error){
					// consle.log('master::getTaskData=>get %s\'s data error: %s', taskPath, error.message);
					console.error('%s=> get <%s>\'s detail by task path error: %s', config.masterName, taskPath, error.message);
					reject(error);
					return;
				}

				// console.log('master::getTaskData=>get %s\'s data ok, data: ', taskPath, JSON.parse(data.toString())); 
				var taskDetail = JSON.parse(data.toString());

				resolve(taskDetail);			
			});
	});
}

function takeOutTaskNo(taskNodeName){
	var taskNo = parseInt(taskNodeName.slice(4));

	return taskNo;
}

function allocateWorkerForTask(taskNo){

	var allocatedWorkerIndex = taskNo % workersTable.length ;
	var allocatedWorkerPath = workersTable[allocatedWorkerIndex];
	var allocatedWorkerPathElements = allocatedWorkerPath.split('/');
	var allocatedWorkerName = allocatedWorkerPathElements[allocatedWorkerPathElements.length - 1];

	// console.log("%%%%=> allocateWorkerForTask=> allocatedWorkerName=%s", allocatedWorkerName);
	// console.log("%%%%=> allocateWorkerForTask=> workers=%s", JSON.stringify(workers, null, 2));
	// console.log("%%%%=> allocateWorkerForTask=> workersTable=%s", JSON.stringify(workersTable, null, 2));
	return allocatedWorkerName;
}

function isExistWorkers(){
	return Object.getOwnPropertyNames(workers).length > 0;
}

function syncWorkers(){
	return new Promise(function(resolve, reject){
		getWorkers()
			.then(memoryPersistWorkers)
			.then(function(){
				resolve();
			})
			.catch(function(error){
				console.error('%s=> got workers error: %s', config.masterName, error.message);
				reject(error);
			});
	});
}

function memoryPersistWorkers(workerNames){
	return new Promise(function(resolve, reject){
		for(var i=0,workerName;workerName=workerNames[i++];){
			var workerPath = config.workersPath + '/' + workerName;
			if(!workers[workerPath]){
				workersTable.push(workerPath);
				workers[workerPath] = {
					tableIndex: workersTable.length - 1
				};
				// console.log("%%%%=> memoryPersistWorkers=> workers=%s", JSON.stringify(workers, null, 2));
				// console.log("%%%%=> memoryPersistWorkers=> workersTable=%s", JSON.stringify(workersTable, null, 2));
				// console.log('master::memoryPersistWorkers=>add worker: %s', workerPath);
			}
		}
		resolve(workerNames);
	});

}

function getWorkers(){
	return new Promise(function(resolve, reject){
		zkClient.getChildren(
			config.workersPath,
			workersWatcher,
			function(error, children, state){
				if(error){
					reject(error);
					return;
				}
				console.log('%s=> got workers', config.masterName);
				resolve(children||[]);
			});
	});
}

function workersWatcher(event){
	if(event.getType() === zookeeper.Event.NODE_CHILDREN_CHANGED){
		// console.log('master::workersWatcher=>type=%s, name=%s, path=%s, eventString=%s', 
		// 	event.getType(),event.getName(),event.getPath(),event.toString());

		console.log('%s=> workers changed', config.masterName);
		getWorkers()
			.then(followChangedWorkers)
			.catch(function(error){
				console.error('%s=> workers changed, get/check/notify changing error: %s', config.masterName, error.message);
			});
	}
}

function followChangedWorkers(workerNames){
	return new Promise(function(resolve, reject){
		var follows = [followCameinWorker(workerNames), followLeavedWorker(workerNames)];
		Promise.all(follows)
			.then(function(){
				resolve();
			})
			.catch(function(error){
				console.error('%s=> workers changed, follow changed workers error: %s', config.masterName, error.message);
			});
	});
}

function followCameinWorker(workerNames){
		// console.log('$$$$10: %s', JSON.stringify(workerNames, null, 2));

	return new Promise(function(resolve, reject){
		checkHasCameinWorker(workerNames)
			.then(NotifyWorkerCamein)
			.then(function(){
				resolve();
			})
			.catch(function(error){
				if(error.message == 'NO_CAMEIN_WORKERS'){
					console.log('%s=> workers changed, follow workers came in, no workers came in', config.masterName);
					resolve();
				}else{
					console.error('%s=> workers changed, follow workers came in error: %s', config.masterName, error.message);
					reject(error);
				}
			});
	});
}

function followLeavedWorker(workerNames){
	return new Promise(function(resolve, reject){
		checkHasLeavedWorker(workerNames)
			.then(NotifyWorkerLeaved)
			.then(function(){
				resolve();
			})
			.catch(function(error){
				if(error.message == 'NO_LEAVED_WORKERS'){
					console.log('%s=> workers changed, follow leaved workers, no workers leaved' , config.masterName);
					resolve();
				}else{
					console.error('%s=> workers changed, follow leaved workers error: %s', config.masterName, error.message);
					reject(error);
				}
			});
	});
}

function checkHasCameinWorker(workerNames){
	return new Promise(function(resolve, reject){
		var addedWorkers = [];
		for(var i=0; i<workerNames.length; i++){
			var workerName = workerNames[i];
			var workerPathIsExisted = false;
			var workerPath = config.workersPath + '/' + workerName;

			if(!workers[workerPath]){
				workersTable.push(workerPath);
				workers[workerPath] = {
					tableIndex: workersTable.length - 1
				};

				addedWorkers.push(workerName);
			}
		}

		if(addedWorkers.length > 0){
			resolve(addedWorkers);
		}else{
			reject(new Error('NO_CAMEIN_WORKERS'));
		}			
	});
}

function NotifyWorkerCamein(cameinWorkerNames){
	return new Promise(function(resolve, reject){
		if(cameinWorkerNames.length > 0){
			workersWatcherEventEmitter.emit('camein', cameinWorkerNames);
			resolve();
		}else{
			reject(new Error('NO_CAMEIN_WORKERS'));
		}
	});
}

function checkHasLeavedWorker(workerNames){
	return new Promise(function(resolve, reject){
		var leavedWorkers = [];
		// console.log('$$$$10: %s', JSON.stringify(workers, null, 2));
		for(var memorizedWorkerPath in workers){
			var memorizedWorkerPathIsExisted = false;
			var memorizedWorkerPathElements = memorizedWorkerPath.split('/');
			var memorizedWorkerName = memorizedWorkerPathElements[memorizedWorkerPathElements.length - 1];

			for(var i=0,workerName;workerName=workerNames[i++];){
				var workerPath = config.workersPath + '/' + workerName;
				if(memorizedWorkerPath == workerPath){
					memorizedWorkerPathIsExisted = true;
					break;				
				}	
			}

			if(!memorizedWorkerPathIsExisted){
				workersTable.splice(workers[memorizedWorkerPath].tableIndex, 1); 
				delete workers[memorizedWorkerPath];
				for(var i=0; i < workersTable.length; i++){
					// console.log("@@@@=> %s", JSON.stringify(workers[workersTable[i]], null, 2));
					workers[workersTable[i]].tableIndex = i;
				}

				leavedWorkers.push(memorizedWorkerName);
			}
		}


		if(leavedWorkers.length > 0){
			// console.log('&&1-1');
			// console.log("%%%%=> checkHasLeavedWorker=> workers=%s", JSON.stringify(workers, null, 2));
			// console.log("%%%%=> checkHasLeavedWorker=> workersTable=%s", JSON.stringify(workersTable, null, 2));
			resolve(leavedWorkers);
		}else{
			// console.log('&&1-2');
			reject(new Error('NO_LEAVED_WORKERS'));
		}
	});
}

function NotifyWorkerLeaved(leavedWorkerNames){
	return new Promise(function(resolve, reject){
		if(leavedWorkerNames.length > 0){
			// console.log('&&2-1');
			workersWatcherEventEmitter.emit('leaved', leavedWorkerNames);
			resolve();
		}else{
			// console.log('&&2-2');
			reject(new Error('NO_LEAVED_WORKERS'));
		}
		
	});

}

function syncRequesters(){
	return new Promise(function(resolve, reject){
		getRequesters()
			.then(memoryPersistRequsters)
			.then(function(){
				resolve();
			})
			.catch(function(error){
				console.error('%s=> got requesters error: %s', config.masterName, error.message);
				reject(error);
			});	var follows = [followCameinWorker, followLeavedWorker];
		Promise.all(follows)
			.then(function(){
				resolve();
			})
			.catch(function(error){
				console.error('%s=> workers changed, follow changed workers error: %s', config.masterName, error.message);
			});
	});
}

function getRequesters(){
	return new Promise(function(resolve, reject){
		zkClient.getChildren(
			config.requestersPath,
			requestersWatcher,
			function(error, children, state){
				if(error){
					reject(error);
					return;
				}

				console.log('%s=> got requesters', config.masterName);
				resolve(children);
			});
	});
}

function memoryPersistRequsters(requesterNames){
	return new Promise(function(resolve, reject){
		for(var i=0,requesterName;requesterName=requesterNames[i++];){
			var requesterPath = config.requestersPath + '/' + requesterName;
			if(!requesters[requesterPath]){
				requesters[requesterPath] = {};
				// console.log('master::memoryPersistRequsters=>add requester: %s', requesterPath);
			}
		}

		resolve(requesterNames);		
	});

}

function requestersWatcher(event){
	if(event.getType() === zookeeper.Event.NODE_CHILDREN_CHANGED){
		// console.log('master::requestersWatcher=>type=%s, name=%s, path=%s, eventString=%s', 
		// 	event.getType(),event.getName(),event.getPath(),event.toString());

		getRequesters()
			.then(checkIsAddedRequester)
			.then(NotifyRequestersIsAdded)
			.catch(function(error){
				console.error('%s=> requesters changed, get/check/notify changing error: %s', config.masterName, error.message);
			});
	}
}

function checkIsAddedRequester(requesterNames){
	return new Promise(function(resolve, reject){
		var addedRequesters = [];
		for(var i=0,requesterName;requesterName=requesterNames[i++];){
			var requesterPath = config.requestersPath + '/' + requesterName;
			if(!requesters[requesterPath]){
				requesters[requesterPath] = {}
				addedRequesters.push(requesterName);
				// console.log('master::memoryPersistRequsters=>add requester: %s', requesterPath);
			}
		}
		
		if(addedRequesters.length > 0){
			resolve(addedRequesters);
		}else{
			reject(new Error('NO_ADDED_REQUESTERS'));
		}
	});

}

function NotifyRequestersIsAdded(addedRequesterNames){
	return new Promise(function(resolve, reject){
		if(addedRequesterNames.length > 0){
			requestersWatcherEventEmitter.emit('camein', addedRequesterNames);
			resolve();
		}else{
			reject(new Error('NO_ADDED_REQUESTERS'));
		}
		
	});

}

function setDispatchingTasksWatcher(event){
	return new Promise(function(resolve, reject){
		zkClient.getChildren(
			config.tasksDispatchingPath,
			dispatchingTasksWatcher,
			function(error, children, state){
				if(error){
					// console.log('master::setDispatchingTasksWatcher=>set tasks watcher error: %s', error.message);
					console.error('%s=> set watcher for tasks error: %s', config.masterName, error.message);
					reject(error);
					return;
				}

				// console.log('master::setDispatchingTasksWatcher=>set tasks watcher ok: %s', children);
				resolve();			
			});
	});
}

function dispatchingTasksWatcher(event){
	if(event.getType() === zookeeper.Event.NODE_CHILDREN_CHANGED){
		// console.log('master::dispatchingTasksWatcher=>type=%s, name=%s, path=%s, eventString=%s', 
		// 	event.getType(),event.getName(),event.getPath(),event.toString());
		setDispatchingTasksWatcher()
			.then(handleNoAssignedTasks)
			.then(function(results){
				// console.log('master::dispatchingTasksWatcher=>reset tasks watcher ok');
			})
			.catch(function(error){
				// console.log('master::dispatchingTasksWatcher=>reset tasks watcher error: %s', error.message);
			})
	}
}

function setResponsingTasksWatcher(event){
	return new Promise(function(resolve, reject){
		zkClient.getChildren(
			config.tasksResponsingPath,
			responsingTasksWatcher,
			function(error, children, state){
				if(error){
					// console.log('master::setDispatchingTasksWatcher=>set tasks watcher error: %s', error.message);
					console.error('%s=> set watcher for dispatching tasks error: %s', config.masterName, error.message);
					reject(error);
					return;
				}
				// console.log('master::setDispatchingTasksWatcher=>set tasks watcher ok: %s', children);
				resolve();			
			});
	});
}

function responsingTasksWatcher(event){
	if(event.getType() === zookeeper.Event.NODE_CHILDREN_CHANGED){
		// console.log('master::responsingTasksWatcher=>type=%s, name=%s, path=%s, eventString=%s', 
		// 	event.getType(),event.getName(),event.getPath(),event.toString());
		setResponsingTasksWatcher()
			.then(handleResponsingTasks)
			.then(function(results){
				// console.log('master::dispatchingTasksWatcher=>reset tasks watcher ok');
			})
			.catch(function(error){
				// console.log('master::dispatchingTasksWatcher=>reset tasks watcher error: %s', error.message);
			});
	}
}

function setAssignedTasksWatcher(taskDetail){
	var workerAssignPath = config.tasksAssignPath + '/' + taskDetail.assignToWho + '/' + taskDetail.taskNodeName;
	// console.log('master::assignTask=>workerAssignPath: %s', workerAssignPath);
	return new Promise(function(resolve, reject){
		zkClient.getChildren(
			workerAssignPath,
			assignedTasksWatcher,
			function(error, children, state){
				if(error){
					// console.log('master::setAssignedTasksWatcher=>set tasks assigned watcher error: %s', error.message);
					console.error('%s=> set watcher for task that was assigned to worker error: %s', config.masterName, error.message);
					reject(error);
					return;
				}

				// console.log('master::setAssignedTasksWatcher=>set tasks assigned watcher ok: %s', children);
				resolve();			
			});
	});
}

function assignedTasksWatcher(event){
	if(event.getType() === zookeeper.Event.NODE_CHILDREN_CHANGED){
		// console.log('master::assignedTasksWatcher=>type=%s, name=%s, path=%s, eventString=%s', 
		// 	event.getType(),event.getName(),event.getPath(),event.toString());
		takeDoneTaskToResponsing(event.getPath())
			.catch(function(error){

			});
	}
}

function takeDoneTaskToResponsing(assignedTaskPath){
	return new Promise(function(resolve, reject){
		isTaskDone(assignedTaskPath)
			.then(getAssignedTaskData)
			.then(taskDoneTaskToResponsing)
			.then(function(){
				resolve();
			})
			.catch(function(error){
				// console.error(new Error('master::reponseDoneTask=>error: ' + error.message));
				reject(error);
			});
	});
}

function taskDoneTaskToResponsing(taskDetail){
	var taskNodeNo = takeOutTaskNo(taskDetail.taskNodeName);
	var requesterName = allocateRequesterForTask(taskNodeNo);

	taskDetail.isResponsing = true;
	taskDetail.isWorkerDone = true;
	taskDetail.taskResponsingPath = config.tasksResponsingPath + '/' + taskDetail.taskNodeName;
	// console.log('####3');
	// console.log('tasksResponsingPath=%s, taskResponsingPath=%s', taskDetail.taskResponsingPath, taskDetail.taskDispatchingPath);

	return new Promise(function(resolve, reject){
		zkClient.transaction()
			.create(
				taskDetail.taskResponsingPath,
				new Buffer(JSON.stringify(taskDetail, null, 2)),
				zookeeper.CreateMode.PERSISTENT)
			.setData(
				taskDetail.taskDispatchingPath,
				new Buffer(JSON.stringify(taskDetail, null, 2)))
			.setData(
				taskDetail.assignedPath,
				new Buffer(JSON.stringify(taskDetail, null, 2)))			
			.commit(function(error, results){
				if(error){
					console.error('%s=> took <%s> to responsing error: %s', 
						config.masterName, taskDetail.taskNodeName, error.message);
					reject(error);
					return;
				}

				console.log('%s=> took <%s> done to responsing', 
					config.masterName, taskDetail.taskNodeName);
				resolve(taskDetail);
			});		
	});
}

function handleResponsingTasks(){
	return new Promise(function(resolve, reject){
		checkIsCouldAssignTask()
			.then(getResponsingTaskNodeNames)
			.then(responseTasksToRequester)
			.then(function(results){
				// console.log('master::handleNoAssignedTasks=>assign tasks ok');
				resolve(results);
			})
			.catch(function(error){
				// console.log('master::handleNoAssignedTasks=>assign tasks error: %s', error.message);
				console.error('%s=> responsing tasks error: %s', config.masterName, error.message);
				reject(error);		
			});
	});
}

function getResponsingTaskNodeNames(){
	return new Promise(function(resolve, reject){
		zkClient.getChildren(
			config.tasksResponsingPath,
			function(error, children, state){
				if(error){
					// console.log('master::getTaskNames=>error: %s', error.message);
					console.error('%s=> get names all of tasks error: %s', config.masterName, error.message);
					reject(error);
					return;
				}
				// console.log('master::getTaskNames=>ok: %s', children);
				resolve(children);			
			});
	});
}

function responseTasksToRequester(taskNodeNames){
	return new Promise(function(resolve, reject){
		Promise.map(taskNodeNames, responseTaskToRequester)
			.then(function(results){
					resolve(results)
				}, function(error){
					reject(error);
				});
	});
}

function responseTaskToRequester(taskNodeName, index){
	return new Promise(function(resolve, reject){
		getTaskDataByName(taskNodeName)
			.then(taskIsNotYetResponsed)
			.then(taskResponsingTaskToRequester)
			.then(getResponsedTaskDone)
			.then(function(results){
				resolve(results);
			}).catch(function(error){
				resolve();
			});
		});
}

function taskIsNotYetResponsed(taskDetail){
	return new Promise(function(resolve, reject){
		if(taskDetail.responseToWho.length === 0){
			resolve(taskDetail);
		}else{
			reject(new Error('TASK_RESPONSED'));
		}
	});
}

function isTaskDone(assignedTaskPath){
	return new Promise(function(resolve, reject){
		zkClient.getChildren(
			assignedTaskPath,
			function(error, children, state){
				if(error){
					// console.error(new Error('master::isTaskDone=>error: ' + error.message));
					console.error('%s=> check the assigned task is done error: %s', config.masterName, error.message);
					reject(error);
					return;
				}

				for(var i in children){
					if(children[i] == 'done'){
						resolve(assignedTaskPath);
						return;
					}
				}

				reject(new Error('NO_DONE_NODE,assignedTaskPath=' + assignedTaskPath));
			});	
	});
}

function getAssignedTaskData(assignedTaskPath){
	return new Promise(function(resolve, reject){
		zkClient.getData(
			assignedTaskPath,
			function(error, data, state){
				if(error){
					// consle.log('master::getAssignedTaskData=>get data error: %s', error.message);
					console.error('%s=> get assigned task detail error: %s', config.masterName, error.message);
					reject(error);
					return;
				}

				// console.log('master::getAssignedTaskData=>get data ok, data: ', JSON.parse(data.toString())); 
				resolve(JSON.parse(data.toString()));			
			});
	});
}

function taskResponsingTaskToRequester(taskDetail){
	var taskNodeNo = takeOutTaskNo(taskDetail.taskNodeName);
	var requesterName = allocateRequesterForTask(taskNodeNo);

	taskDetail.isResponsedToRquester = true;
	taskDetail.responseToWho = requesterName;
	taskDetail.responseTaskPath = config.tasksResponsePath + '/' + requesterName + '/' + taskDetail.taskNodeName;
	// console.log('master::taskDoneTaskIntoRequester=>responseTaskPath: %s', taskDetail.responseTaskPath ); 

	return new Promise(function(resolve, reject){
		zkClient.transaction()
			.create(
				taskDetail.responseTaskPath,
				new Buffer(JSON.stringify(taskDetail, null, 2)),
				zookeeper.CreateMode.PERSISTENT)
			.setData(
				taskDetail.taskDispatchingPath,
				new Buffer(JSON.stringify(taskDetail, null, 2)))
			.setData(
				taskDetail.taskResponsingPath,
				new Buffer(JSON.stringify(taskDetail, null, 2)))			
			.setData(
				taskDetail.assignedPath,
				new Buffer(JSON.stringify(taskDetail, null, 2)))	
			.commit(function(error, results){
				if(error){
					// console.log('master::taskDoneTaskIntoRequester=>commit error: %s', error.message); 
					console.error('%s=> got back <%s> to <%s> error: %s', 
						config.masterName, taskDetail.taskNodeName, taskDetail.responseToWho, error.message);
					reject(error);
					return;
				}

				// console.log('master::taskDoneTaskIntoRequester=>commit ok: %s', results); 
				console.log('%s=> got back <%s> to <%s>', 
					config.masterName, taskDetail.taskNodeName, taskDetail.responseToWho);
				resolve(taskDetail);
			});		
	});
}

function allocateRequesterForTask(taskNo){
	return 'requester' + (taskNo % Object.getOwnPropertyNames(requesters).length + 1);
}

function isExistRequester(){
	return Object.getOwnPropertyNames(requesters).length > 0;
}

function getResponsedTaskDone(taskDetail){
	return new Promise(function(resolve, reject){
		zkClient.getChildren(
			taskDetail.responseTaskPath,
			responsedTaskWatcher,
			function(error, children, state){
				if(error){
					console.error('%s=> get task watcher is done that was responsed to requester error: %s', 
						config.masterName, error.message);
					reject(error);
					return;
				}

				for(var i in children){
					if(children[i] == 'done'){
						handleResponsedTask(taskDetail.responseTaskPath);
						reject(new Error('REPONSED_TASK_IS_DONE'));
						return;
					}
				}

				resolve(taskDetail);			
			});
	});
}

function SetResponsedTaskWatcher(taskDetail){
	return new Promise(function(resolve, reject){
		zkClient.getChildren(
			taskDetail.responseTaskPath,
			responsedTaskWatcher,
			function(error, children, state){
				if(error){
					// console.log('master::SetResponsedTaskWatcher=>set responsed task watcher error: %s', error.message);
					console.error('%s=> set task watcher that was responsed to requester error: %s', 
						config.masterName, error.message);
					reject(error);
					return;
				}

				// console.log('master::SetResponsedTaskWatcher=>set responsed task watcher ok');
				resolve();			
			});
	});
}

function handleResponsedTask(responseTaskPath){
	getTaskDataByPath(responseTaskPath)
		.then(isResponsedTaskDone)
		.then(updateResponsedTaskIsDone)
		.then(removeTask)
		.catch(function(error){
			console.log('%s=> handle responsed task error: %s', config.masterName, error.message); 
		});
}

function responsedTaskWatcher(event){
	if(event.getType() === zookeeper.Event.NODE_CHILDREN_CHANGED){
		// console.log('master::responsedTaskWatcher=>type=%s, name=%s, path=%s, eventString=%s', 
		// 	event.getType(),event.getName(),event.getPath(),event.toString());

		handleResponsedTask(event.getPath());
	}
}

function isResponsedTaskDone(taskDetail){
	return new Promise(function(resolve, reject){
		zkClient.getChildren(
			taskDetail.responseTaskPath,
			function(error, children, state){
				if(error){
					// console.error(new Error('master::isResponsedTaskDone=>error: ' + error.message));
					console.error('%s=> check the responsed task is done error: %s', 
						config.masterName, error.message);
					reject(error);
					return;
				}

				for(var i in children){
					if(children[i] == 'done'){
						resolve(taskDetail);
						return;
					}
				}

				reject(new Error('NO_DONE_NODE,isResponsedTaskDone=' + assignedTaskPath));
			});	
	});
}

function updateResponsedTaskIsDone(taskDetail){
	return new Promise(function(resolve, reject){
		taskDetail.isRequesterDone = true;
		zkClient.transaction()
			.setData(
				taskDetail.responseTaskPath,
				new Buffer(JSON.stringify(taskDetail, null, 2)))
			.setData(
				taskDetail.taskResponsingPath,
				new Buffer(JSON.stringify(taskDetail, null, 2)))
			.setData(
				taskDetail.assignedPath,
				new Buffer(JSON.stringify(taskDetail, null, 2)))
			.setData(
				taskDetail.taskDispatchingPath,
				new Buffer(JSON.stringify(taskDetail, null, 2)))
			.commit(function(error, results){
				if(error){
					console.error('%s=> update <%s> status to isRequesterDone error: %s',
						config.masterName, taskDetail.taskNodeName, error.message);
					reject(error);
					return;
				}

				console.log('%s=> update <%s> status to isRequesterDone',
					config.masterName, taskDetail.taskNodeName);
				resolve(taskDetail);
			});
	});
}


function removeTask(taskDetial){
	return new Promise(function(resolve, reject){

		zkClient.transaction()
			.remove(
				taskDetial.responseTaskPath+'/'+'done')
			.remove(
				taskDetial.responseTaskPath)
			.remove(
				taskDetial.assignedPath+'/'+'done')	
			.remove(
				taskDetial.assignedPath)		
			.remove(
				taskDetial.taskResponsingPath)						
			.remove(
				taskDetial.taskDispatchingPath)			
			.commit(function(error, results){
				if(error){
					// console.log('master::removeTask=>remove all infos of task  error: %s', error.message); 
					console.error('%s=> <%s>\'s process is finished, removed all infos error: %s', 
						config.masterName, taskDetial.taskNodeName, error.message);
					reject(error);
					return;
				}

				console.log('%s=> <%s>\'s process is finished, removed all infos: \n%s', 
					config.masterName, taskDetial.taskNodeName, JSON.stringify(taskDetial, null, 2));
				resolve(taskDetial);
			});		
	});
}

function onWorkerCamein(addedWorkerNames){
	console.log('%s=> workers <%s> came in', config.masterName, addedWorkerNames);
	handleNoAssignedTasks()
		.catch(function(error){
			console.error('%s=> After workers came in, handle no assigned tasks error: %s', 
				config.masterName, error.message);
		});
}

function onWorkerLeaved(leavedWorkerNames){
	console.log('%s=> workers <%s> leaved', config.masterName, leavedWorkerNames);

	Promise.map(leavedWorkerNames, handleLeavedWorkerTasks)
		.then(handleNoAssignedTasks)
		.then(function(results){
			console.log('%s=> reseted and reassigned tasks of leaved worker <%s> ok', 
				config.masterName, JSON.stringify(leavedWorkerNames, null, 2));
		})
		.catch(function(error){
			console.error('%s=> reseted and reassigned tasks of leaved worker error: %s', 
				config.masterName, error.message);
		});
}

function onRequesterCamein(addedRequesterNames){
	console.log('%s=> requesters <%s> came in', config.masterName, addedRequesterNames);
	handleNoAssignedTasks()
		.catch(function(error){
			console.error('%s=> After requesters came in, handle no assigned tasks error: %s', 
				config.masterName, error.message);
		});
}

function onRequesterLeaved(){
	
}

function handleLeavedWorkerTasks(leavedWorkerName, index){
	return new Promise(function(resolve, reject){
		getTaskPathsOfWorker(leavedWorkerName)
			.then(handleLeavedWorkerNotDoneTasks)
			.then(function(result){
				console.log('%s=> reseted tasks of <%s> leaved ok', 
					config.masterName, leavedWorkerName);
				resolve();
			})
			.catch(function(error){
				console.error('%s=> reseted tasks of worker leaved <%s> error: %s', 
					config.masterName, leavedWorkerName, error.message);
				resolve();
			});
	});
}

function handleLeavedWorkerNotDoneTasks(assignedTaskPaths, index){
	return new Promise(function(resolve, reject){
		// console.log('1111: %s', JSON.stringify(assignedTaskPaths, null, 2));
		Promise.map(assignedTaskPaths, handleLeavedWorkerNotDoneTask)
			.then(function(result){
				resolve();
			})
			.catch(function(error){
				console.error('%s=> reseted not done tasks <%s> of leaved worker error: %s', 
					config.masterName, JSON.strinify(assignedTaskPaths, null, 2), error.message);
				resolve();
			});
	});
}

function handleLeavedWorkerNotDoneTask(assignedTaskPath, index){
	return new Promise(function(resolve, reject){
		// console.log('222');
		checkAssignedTaskisNotDone(assignedTaskPath)
			.then(getTaskDataByPath)
			.then(resetAndReturnToTasks)
			.then(function(result){
				console.log('%s=> reseted not done task <%s> of leaved worker <%s>', 
					config.masterName, result.taskNodeName, result.assignToWho);
				resolve();
			})
			.catch(function(error){
				console.error('%s=> reseted not done task <%s> of leaved worker error: %s', 
					config.masterName, assignedTaskPath, error.message);
				resolve();
			});
	});
}
 
function getTaskPathsOfWorker(workerName){
	var assignedToWorkerPath = config.tasksAssignPath + '/' + workerName;

	return new Promise(function(resolve, reject){
		zkClient.getChildren(
			assignedToWorkerPath,
			function(error, children, state){
				if(error){
					// console.error(new Error('master::isResponsedTaskDone=>error: ' + error.message));
					console.error('%s=> get task node names what is assigned to <%s> error: %s', 
						config.masterName, workerName, error.message);
					reject(error);
					return;
				}

				for(var i in children){
					children[i] = config.tasksAssignPath + '/' + workerName + '/' + children[i];
				}

				resolve(children || []);
			});	
	});
}

function checkAssignedTaskisNotDone(assignedTaskPath){
	return new Promise(function(resolve, reject){
		zkClient.getChildren(
			assignedTaskPath,
			function(error, children, state){
				if(error){
					// console.error(new Error('master::isTaskDone=>error: ' + error.message));
					console.error('%s=> check the assigned task is not done error: %s', config.masterName, error.message);
					reject(error);
					return;
				}

				for(var i in children){
					if(children[i] == 'done'){
						reject(new Error('ASSIGNED_TASK_DONE'));
						return;
					}
				}

				resolve(assignedTaskPath);
			});	
	});
}

function resetAndReturnToTasks(taskDetail){
	return new Promise(function(resolve, reject){
		var assignedPath = taskDetail.assignedPath;
		var assignToWho = taskDetail.assignToWho;

		taskDetail.isDispatchedToWorker = false;
		taskDetail.assignToWho = '';
		taskDetail.assignedPath = '';

		zkClient.transaction()
			.remove(
				assignedPath)
			.setData(
				taskDetail.taskDispatchingPath,
				new Buffer(JSON.stringify(taskDetail, null, 2)))
			.commit(function(error, results){
				if(error){
					console.error('%s=> return <%s> to tasks error: %s', 
						config.masterName, taskDetail.taskNodeName, error.message);
					reject(error);
					return;
				}

				taskDetail.assignToWho = assignToWho;
				taskDetail.assignedPath = assignedPath;

				resolve(taskDetail);
			});
	});
}

function synTasks(){

}

function synTask(taskDetail){
	var synFuncs = [synAssignedTask];

	for(var i= 0, synFunc; synFunc = synFuncs[i++];){
		if(synFunc(taskDetail)){
			break;
		}
	}
}

function synAssignedTask(taskDetail){
	if(!(taskDetail.isDispatchedToWorker == true &&
	   taskDetail.isWorkerDone ==false)){
		return false;
	}



}





module.exports = master;