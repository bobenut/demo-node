var zookeeper = require('node-zookeeper-client');
var Promise = require('bluebird');
const RequesterWatcherEventEmitter = require('events');
const config = require('./config');

var PATH_WORKERS = '/zht/status-collaboration/workers';
var PATH_REQUESTERS = '/zht/status-collaboration/requesters';
var PATH_RESPONSE = '/zht/status-collaboration/response';
var PATH_ASSIGN = '/zht/status-collaboration/assign';
var PATH_TASKS = '/zht/status-collaboration/tasks';

var zkClient;
var sessionId;
var workers = {};
var requesters = {};
var assignedTasks = {};

var master = {};




var requestersWatcherEventEmitter = new RequesterWatcherEventEmitter();




master.begin = function(){
	// zkClient = zookeeper.createClient('172.13.2.204:2181', {sessionTimeout:5000});
	zkClient = zookeeper.createClient('172.16.16.220:2181', {sessionTimeout:5000});
	// zkClient = zookeeper.createClient('172.16.24.208:2181', {sessionTimeout:5000});

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
			config.masterLockPath,
			new Buffer(sessionId || ''),
			zookeeper.CreateMode.EPHEMERAL,
			catchMasterCallback);

}

function catchMasterCallback(error, path){
	if(error){
		// console.log('master::catchMasterCallback=>master is exists failed:' + error.message);
		if(error.message == 'NODE_EXISTS'){
			console.log('%s=> master is existed', config.masterName);
		}else{
			console.erorr('%s=> catch master error: %s', config.masterName, error.message);
		}
		checkMasterIsExist();
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
		console.erorr('%s=>set watcher to catch master error: %s', config.masterName, error.message);
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
			console.log('master::doResponsiblity=>do synces ok:');
			resolve();
		});
	}).then(handleNoAssignedTasks)
	.then(SetTasksWatcher)
	.catch(function(error){
		console.log('master::doResponsiblity=>do synces error:' + error.message);
	});

	requestersWatcherEventEmitter.on('comein', onRequesterComein);
	requestersWatcherEventEmitter.on('goout', onRequesterGoout);
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
				getTaskDataByName(taskName)
					.then(taskIsNotYetAssigned)
					.then(assignTask)
					.then(setAssignedTasksWatcher)
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
		task.taskData.taskNodeName = task.taskName;
		task.taskData.taskPath = task.taskPath;
		task.taskData.assignedPath = workerAssignPath;


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
				resolve(task);
			});
	});
}

function getTaskDataByName(taskName){
	var taskPath = PATH_TASKS + '/' + taskName;

	return new Promise(function(resolve, reject){
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

function getTaskDataByPath(taskPath){
	return new Promise(function(resolve, reject){
		zkClient.getData(
			taskPath,
			function(error, data, state){
				if(error){
					consle.log('master::getTaskData=>get %s\'s data error: %s', taskPath, error.message);
					reject(error);
					return;
				}

				console.log('master::getTaskData=>get %s\'s data ok, data: ', taskPath, JSON.parse(data.toString())); 

				resolve({
					taskName: taskPath,
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

function setAssignedTasksWatcher(task){
	var workerAssignPath = PATH_ASSIGN + '/' + task.taskData.assignToWho + '/' + task.taskName;
		// console.log('master::assignTask=>workerAssignPath: %s', workerAssignPath); 
	return new Promise(function(resolve, reject){
		zkClient.getChildren(
			workerAssignPath,
			assignedTasksWatcher,
			function(error, children, state){
				if(error){
					console.log('master::setAssignedTasksWatcher=>set tasks assigned watcher error: %s', error.message);
					reject(error);
					return;
				}

				console.log('master::setAssignedTasksWatcher=>set tasks assigned watcher ok: %s', children);
				resolve();			
			});
	});
		
}

function assignedTasksWatcher(event){
	if(event.getType() === zookeeper.Event.NODE_CHILDREN_CHANGED){
		console.log('master::assignedTasksWatcher=>type=%s, name=%s, path=%s, eventString=%s', 
			event.getType(),event.getName(),event.getPath(),event.toString());

		reponseDoneTask(event.getPath());
	}
}

function reponseDoneTask(assignedTaskPath){
	return new Promise(function(resolve, reject){
		isTaskDone(assignedTaskPath)
			.then(getAssignedTaskData)
			.then(taskDoneTaskIntoRequester)
			.then(SetResponsedTaskWatcher)
			.then(function(){
				resolve();
			})
			.catch(function(error){
				console.error(new Error('master::reponseDoneTask=>error: ' + error.message));
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
					console.error(new Error('master::isTaskDone=>error: ' + error.message));
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
					consle.log('master::getAssignedTaskData=>get data error: %s', error.message);
					reject(error);
					return;
				}

				console.log('master::getAssignedTaskData=>get data ok, data: ', JSON.parse(data.toString())); 

				resolve({
					taskData: JSON.parse(data.toString())});			
			});
	});
}

function taskDoneTaskIntoRequester(taskDetail){
	var taskNodeNo = takeOutTaskNo(taskDetail.taskData.taskNodeName);
	var requesterName = allocateRequesterForTask(taskNodeNo);

	taskDetail.taskData.responseToWho = requesterName;
	taskDetail.taskData.responseTaskPath = PATH_RESPONSE + '/' + requesterName + '/' + taskDetail.taskData.taskNodeName;
	console.log('master::taskDoneTaskIntoRequester=>responseTaskPath: %s', taskDetail.taskData.responseTaskPath ); 

	return new Promise(function(resolve, reject){
		zkClient.transaction()
			.create(
				taskDetail.taskData.responseTaskPath,
				new Buffer(JSON.stringify(taskDetail.taskData, null, 2)),
				zookeeper.CreateMode.PERSISTENT)
			.setData(
				taskDetail.taskData.taskPath,
				new Buffer(JSON.stringify(taskDetail.taskData, null, 2)))
			.setData(
				taskDetail.taskData.assignedPath,
				new Buffer(JSON.stringify(taskDetail.taskData, null, 2)))			
			.commit(function(error, results){
				if(error){
					console.log('master::taskDoneTaskIntoRequester=>commit error: %s', error.message); 
					reject(error);
					return;
				}

				console.log('master::taskDoneTaskIntoRequester=>commit ok: %s', results); 
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

function SetResponsedTaskWatcher(taskDetail){
	return new Promise(function(resolve, reject){
		zkClient.getChildren(
			taskDetail.taskData.responseTaskPath,
			responsedTaskWatcher,
			function(error, children, state){
				if(error){
					console.log('master::SetResponsedTaskWatcher=>set responsed task watcher error: %s', error.message);
					reject(error);
					return;
				}

				console.log('master::SetResponsedTaskWatcher=>set responsed task watcher ok');
				resolve();			
			});
	});
}

function responsedTaskWatcher(event){
	if(event.getType() === zookeeper.Event.NODE_CHILDREN_CHANGED){
		console.log('master::responsedTaskWatcher=>type=%s, name=%s, path=%s, eventString=%s', 
			event.getType(),event.getName(),event.getPath(),event.toString());

		getTaskDataByPath(event.getPath())
			.then(isResponsedTaskDone)
			.then(removeTask)
			.catch(function(error){
				console.log('master::responsedTaskWatcher=>error: %s', error.message); 
			});

	}
}

function isResponsedTaskDone(taskDetail){
	return new Promise(function(resolve, reject){
		console.log('***********************2');

		zkClient.getChildren(
			taskDetail.taskData.responseTaskPath,
			function(error, children, state){
				if(error){
					console.error(new Error('master::isResponsedTaskDone=>error: ' + error.message));
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
		console.log('***********************3');

		zkClient.transaction()
			.remove(
				taskDetial.taskData.responseTaskPath+'/'+'done')
			.remove(
				taskDetial.taskData.responseTaskPath)
			.remove(
				taskDetial.taskData.assignedPath+'/'+'done')	
			.remove(
				taskDetial.taskData.assignedPath)		
			.remove(
				taskDetial.taskData.taskPath)			
			.commit(function(error, results){
				if(error){
					console.log('master::removeTask=>remove all infos of task  error: %s', error.message); 
					reject(error);
					return;
				}

				console.log('master::removeTask=>remove all infos of task ok: %s', results); 
				resolve(taskDetial);
			});		
	});
}


function onRequesterComein(){
	
}

function onRequesterGoout(){
	
}



module.exports = master;