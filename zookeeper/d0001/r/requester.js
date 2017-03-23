var zookeeper = require('node-zookeeper-client');
var Promise = require('bluebird');
const config = require('./config');

var zkClient;
var sessionId;

var requester = {};



requester.begin = function(){
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
		console.log('%s=> connected server', config.requesterName);
		registerRequester();

		registerRequesterResponse()
			.then(setResponseTasksWatcher);
	}
}

function registerRequester(){
	zkClient.create(
			config.requestersPath +  '/' + config.requesterName,
			new Buffer(sessionId || ''),
			zookeeper.CreateMode.EPHEMERAL,
			registerRequesterCallback);

}

function registerRequesterCallback(error, path){
	if(error){
		// console.log('registerRequesterCallback=>register %s error:' + error.message, requesterName);
		if(error.message == 'Exception: NODE_EXISTS[-110]'){
			console.log('%s=> the same name requester existed, may be a old me', config.requesterName);
		}else{
			console.error('%s=> registe error: %s', config.requesterName, error.message);
		}
		setRequestWatcher();
		return;
	}

	console.log('%s=> registed', config.requesterName);
}

function setRequestWatcher(){
	zkClient.exists(
		config.requestersPath + '/' + config.requesterName,
		requesterWatcher,
		setRequestWatcherCallback);
}

function setRequestWatcherCallback(error, state){
	if(error){
		// console.log('setRequestWatcherCallback=>error:' + error.message);
		console.error('%s=> set watcher for myself error: %s', config.requesterName, error.message);
		return;
	}

	if(state){
		//console.log('setRequestWatcherCallback=>%s is exists', requesterName);
		// console.log('%s=> the same name requester existed, may be a old me', config.requesterName);
	}else{
		registerRequester();
	}
}

function requesterWatcher(event){
	if(event.getType() === zookeeper.Event.NODE_DELETED){
		// console.log('requesterWatcher=>begin register %s', requesterName);
		registerRequester();
	}
}

requester.submitTask = function(task){
	zkClient.create(
		config.tasksPath + '/' + 'task',
		new Buffer(JSON.stringify(task,null,2) || ''),
		zookeeper.CreateMode.PERSISTENT_SEQUENTIAL,
		submitTaskCallback);
}

function submitTaskCallback(error, state){
	if(error){
		// console.log('submitTaskCallback=>error:' + error.message);
		console.log('%s=> submitted a task', config.requesterName);
		return;
	}
}

function registerRequesterResponse(){
	return new Promise(function(resolve, reject){
		zkClient.create(
			config.tasksResponsePath + '/' + config.requesterName,
			new Buffer(sessionId || ''),
			zookeeper.CreateMode.PERSISTENT,
			function(error, path){
				if(error){
					// console.log('%s::registerRequesterResponse.Callback=>register in response warnning: %s',
					// 	requesterName, error.message);
					// console.error('%s=> registe in reponse error: %s', config.requesterName, error.message);
					resolve();
					return;
				}

				// console.log('%s::registerRequesterResponse.Callback=>registered in response ok', requesterName);
				resolve();
			});
	});
}

function setResponseTasksWatcher(){
	var requesterResponsePath = config.tasksResponsePath + '/' + config.requesterName;
	return new Promise(function(resolve, reject){
		zkClient.getChildren(
			requesterResponsePath,
			responseTasksWatcher,
			function(error, children, state){
				if(error){
					// console.log('%s::setResponseTasksWatcher=>set tasks response watcher error: %s', requesterName, error.message);
					console.error('%s=> set watcher for tasks what responsed to me error: %s', config.requesterName, error.message);
					reject(error);
					return;
				}

				// console.log('%s::setResponseTasksWatcher=>set tasks response watcher ok', requesterName);
				resolve();			
			});
	});
		
}

function responseTasksWatcher(event){
	if(event.getType() === zookeeper.Event.NODE_CHILDREN_CHANGED){
		// console.log('master::responseTasksWatcher=>type=%s, name=%s, path=%s, eventString=%s', 
		// 	event.getType(),event.getName(),event.getPath(),event.toString());

		handleResponsedTasks()
			.catch(function(error){

			})
			.finally(function(){
				setResponseTasksWatcher();
			});
	}
}

function handleResponsedTasks(){
	return new Promise(function(resolve, reject){
		getResponsedTasks()
			.then(handleEachResponsedTask)
			.then(function(){
				resolve();
			})
			.catch(function(error){
				// console.log('%s::handleResponsedTasks=>error:', requesterName, error.message);
				reject(error)
			});
	});
}

function getResponsedTasks(){
	var requesterResponsePath = config.tasksResponsePath + '/' + config.requesterName;
	return new Promise(function(resolve, reject){
		zkClient.getChildren(
			requesterResponsePath,
			function(error, children, state){
				if(error){
					// console.log('%s::getResponseTasks.callback=>get tasks response error: %s', requesterName, error.message);
					console.error('%s=> get tasks what responsed to me error: %s', config.requesterName, error.message);
					reject(error);
					return;
				}

				// console.log('%s::getResponseTasks.callback=>get tasks response ok', requesterName);
				resolve(children);			
			});
	});
}

function handleEachResponsedTask(taskNodeNames){
	Promise.map(taskNodeNames, function(taskNodeName, index, length){
		return new Promise(function(resolve, reject){
			isTaskNotDone(taskNodeName)
				.then(getTaskDetail)
				.then(executeTask)
				.catch(function(error){
					// console.log('%s::handleEachResponsedTask=>to task <%s> error: %s', requesterName, taskNodeName, error.message);
					resolve();
				});	
		});
	})
	.then(function(){
		// console.log('%s::handleEachResponsedTask=>ok', requesterName);
	})
	.catch(function(error){
		// console.log('%s::handleEachResponsedTask=>error: %s', requesterName, error.message);
	});
}

function isTaskNotDone(taskNodeName){
	return new Promise(function(resolve, reject){
		zkClient.getChildren(
			config.tasksResponsePath + '/' + config.requesterName + '/' + taskNodeName,
			function(error, children, state){
				if(error){
					// console.log('%s::isTaskNotDone.callback=>error: %s', requesterName, error.message);
					reject(error);
					return;
				}

				// console.log('%s::isTaskNotDone.callback=>ok: %s', requesterName, JSON.stringify(children, null, 2));
				if(!children || children.length === 0){
					resolve(taskNodeName);
				}else{
					reject(new Error('TASK_IS_DONE'));			
				}
			});
	});
}

function getTaskDetail(taskNodeName){
	return new Promise(function(resolve, reject){
		var taskPath = config.tasksResponsePath + '/' + config.requesterName + '/' + taskNodeName;
		zkClient.getData(
			taskPath,
			function(error, data, state){
				if(error){
					// consle.log('%s::getTaskDetail=>get data error: %s', requesterName, error.message);
					console.error('%s=> get task detail error: %s', config.requesterName, error.message);
					reject(error);
					return;
				}

				// console.log('%s::getTaskDetail=>get data ok, data: ', requesterName, JSON.parse(data.toString())); 

				resolve({
					taskNodeName: taskNodeName,
					taskPath: taskPath,
					taskData: JSON.parse(data.toString())});			
			});
	});
}


function executeTask(taskDetail){
	return new Promise(function(resolve, reject){
		// console.log('%s=> responsed task: \n%s',JSON.stringify(taskDetail.taskData, null, 2));

		CreateDoneNodeForExecutedTask(taskDetail)
			.then(function(){
				console.log('%s=> responsed task: \n%s', config.requesterName, JSON.stringify(taskDetail.taskData, null, 2));
				resolve();
			})
			.catch(function(error){
				console.error('%s=> done then task error: %s', config.requesterName, error.message);
				resolve();
			})
	});
}

function CreateDoneNodeForExecutedTask(taskDetail){
	var doneNodePath = taskDetail.taskData.responseTaskPath  + '/done';

	return new Promise(function(resolve, reject){
		zkClient.create(
			doneNodePath,
			new Buffer(''),
			zookeeper.CreateMode.PERSISTENT,
			function(error, path){
				if(error){
					// console.log('%s::CreateDoneNodeForExecutedTask.Callback=>create done node error: %s', requesterName, 
					// 	error.message);

					reject(error);
					return;
				}

				// console.log('%s::CreateDoneNodeForExecutedTask.Callback=>create done node ok', requesterName);
				resolve();
			});
	});

};

module.exports = requester;