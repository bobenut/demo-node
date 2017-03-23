var zookeeper = require('node-zookeeper-client');
var Promise = require('bluebird');
const EventEmitter = require('events');
const config = require('./config');


var zkClient;
var sessionId;
var workers = {};
var requesters = {};
var assignedTasks = {};

var master = {};


var requestersWatcherEventEmitter = new EventEmitter();
var workersWatcherEventEmitter = new EventEmitter();


master.begin = function(){
	// zkClient = zookeeper.createClient('172.13.2.204:2181', {sessionTimeout:5000});
	zkClient = zookeeper.createClient('172.16.16.220:2181', {sessionTimeout:5000});
	// zkClient = zookeeper.createClient('172.16.24.208:2181', {sessionTimeout:5000});
	// zkClient = zookeeper.createClient('172.16.24.166:2181', {sessionTimeout:5000});

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
	}).then(handleNoAssignedTasks)
	.then(SetTasksWatcher)
	.catch(function(error){
		// console.log('master::doResponsiblity=>do synces error:' + error.message);
	});

	requestersWatcherEventEmitter.on('comein', onRequesterComein);
	requestersWatcherEventEmitter.on('goout', onRequesterGoout);
}

function handleNoAssignedTasks(){
	return new Promise(function(resolve, reject){
		getTaskNames()
			.then(assignTasks)
			.then(function(results){
				// console.log('master::handleNoAssignedTasks=>assign tasks ok');
				resolve(results);
			})
		.catch(function(error){
			// console.log('master::handleNoAssignedTasks=>assign tasks error: %s', error.message);
			reject(error);		
		});
	});
}

function getTaskNames(){
	return new Promise(function(resolve, reject){
		zkClient.getChildren(
			config.tasksPath,
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
	var taskPath = config.tasksPath + '/' + taskNodeName;

	return new Promise(function(resolve, reject){
		zkClient.getData(
			taskPath,
			function(error, data, state){
				if(error){
					// consle.log('master::getTaskData=>get %s\'s data error: %s', taskName, error.message);
					console.error('%s=> get %s\'s detail by task Node Name error: %s', config.masterName, taskNodeName, error.message);
					reject(error);
					return;
				}

				// console.log('master::getTaskData=>get %s\'s data ok, data: ', taskName, JSON.parse(data.toString())); 
				var taskDetail = JSON.parse(data.toString());
				taskDetail.taskNodeName = taskNodeName;
				taskDetail.taskPath = taskPath;

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

		taskDetail.assignToWho = workerName;
		taskDetail.assignedPath = config.tasksAssignPath + '/' + workerName + '/' + taskDetail.taskNodeName;

		zkClient.transaction()
			.create(
				taskDetail.assignedPath,
				new Buffer(JSON.stringify(taskDetail, null, 2)),
				zookeeper.CreateMode.PERSISTENT)
			.setData(
				taskDetail.taskPath,
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
	return 'worker' + (taskNo % Object.getOwnPropertyNames(workers).length + 1);
}

function isExistWorkers(){
	return Object.getOwnPropertyNames(workers).length > 0;
}

function syncWorkers(){
	return new Promise(function(resolve, reject){
		getWorkers().then(function(children){
			memoryPersistWorkers(children);
			console.log('%s=> got workers', config.masterName);
			resolve();
		}).catch(function(error){
			console.error('%s=> got workers error: %s', config.masterName, error.message);
			reject(error);
		});
	});
}

function memoryPersistWorkers(workerNames){
	for(var i=0,workerName;workerName=workerNames[i++];){
		var workerPath = config.workersPath + '/' + workerName;
		if(!workers[workerPath]){
			workers[workerPath] = {};
			// console.log('master::memoryPersistWorkers=>add worker: %s', workerPath);
		}
	}
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
			console.log('%s=> got requesters', config.masterName);
			resolve();
		}).catch(function(error){
			console.error('%s=> got requesters error: %s', config.masterName, error.message);
			reject(error);
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

				resolve(children);
			});
	});
}

function memoryPersistRequsters(requesterNames){
	for(var i=0,requesterName;requesterName=requesterNames[i++];){
		var requesterPath = config.requestersPath + '/' + requesterName;
		if(!requesters[requesterPath]){
			requesters[requesterPath] = {};
			// console.log('master::memoryPersistRequsters=>add requester: %s', requesterPath);
		}
	}
}

function requestersWatcher(event){
	if(event.getType() === zookeeper.Event.NODE_CHILDREN_CHANGED){
		console.log('master::requestersWatcher=>type=%s, name=%s, path=%s, eventString=%s', 
			event.getType(),event.getName(),event.getPath(),event.toString());

		// syncRequesters()
		// 	.then()
	}
}

function SetTasksWatcher(event){
	return new Promise(function(resolve, reject){
		zkClient.getChildren(
			config.tasksPath,
			tasksWatcher,
			function(error, children, state){
				if(error){
					// console.log('master::SetTasksWatcher=>set tasks watcher error: %s', error.message);
					console.error('%s=> set watcher for tasks error: %s', config.masterName, error.message);
					reject(error);
					return;
				}

				// console.log('master::SetTasksWatcher=>set tasks watcher ok: %s', children);
				resolve();			
			});
	});
}

function tasksWatcher(event){
	if(event.getType() === zookeeper.Event.NODE_CHILDREN_CHANGED){
		// console.log('master::tasksWatcher=>type=%s, name=%s, path=%s, eventString=%s', 
		// 	event.getType(),event.getName(),event.getPath(),event.toString());

		handleNoAssignedTasks()
			.then(function(results){
				// console.log('master::tasksWatcher=>reset tasks watcher ok');
			})
			.catch(function(error){
				// console.log('master::tasksWatcher=>reset tasks watcher error: %s', error.message);
			})
			.finally(SetTasksWatcher);
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

		reponseDoneTask(event.getPath())
			.catch(function(error){

			});
	}
}

function reponseDoneTask(assignedTaskPath){
	return new Promise(function(resolve, reject){
		isTaskDone(assignedTaskPath)
			.then(getAssignedTaskData)
			.then(taskDoneTaskIntoRequester)
			.then(getResponsedTaskDone)
			.then(function(){
				resolve();
			})
			.catch(function(error){
				// console.error(new Error('master::reponseDoneTask=>error: ' + error.message));
				reject(error);
			});
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

function taskDoneTaskIntoRequester(taskDetail){
	var taskNodeNo = takeOutTaskNo(taskDetail.taskNodeName);
	var requesterName = allocateRequesterForTask(taskNodeNo);

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
				taskDetail.taskPath,
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
					// console.log('master::SetResponsedTaskWatcher=>set responsed task watcher error: %s', error.message);
					console.error('%s=> get task watcher is done that was responsed to requester error: %s', 
						config.masterName, error.message);
					reject(error);
					return;
				}


				for(var i in children){
					if(children[i] == 'done'){
						console.log('#################have done');
						handleResponsedTask(taskDetail.responseTaskPath);
						reject(new Error('REPONSED_TASK_IS_DONE'));
						return;
					}
				}

				// console.log('master::SetResponsedTaskWatcher=>set responsed task watcher ok');
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
			.then(removeTask)
			.catch(function(error){
				// console.log('master::responsedTaskWatcher=>error: %s', error.message); 
			});
}

function responsedTaskWatcher(event){
	if(event.getType() === zookeeper.Event.NODE_CHILDREN_CHANGED){
		console.log('master::responsedTaskWatcher=>type=%s, name=%s, path=%s, eventString=%s', 
			event.getType(),event.getName(),event.getPath(),event.toString());

		handleResponsedTask(event.getPath());
	}
}

function isResponsedTaskDone(taskDetail){
	return new Promise(function(resolve, reject){
		// console.log('***********************2');

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

function removeTask(taskDetial){
	return new Promise(function(resolve, reject){
		// console.log('***********************3');

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
				taskDetial.taskPath)			
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


function onRequesterComein(){
	
}

function onRequesterGoout(){
	
}



module.exports = master;