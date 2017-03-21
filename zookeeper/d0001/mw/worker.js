var zookeeper = require('node-zookeeper-client');
var schedule = require('node-schedule');
var Promise = require('bluebird');
const EventEmitter = require('events');
require('protolink');

var zkClient;
var sessionId;
var workerName = 'worker1';

var worker = {};




worker.begin = function(){
	// zkClient = zookeeper.createClient('172.13.2.204:2181', {sessionTimeout:5000});
	zkClient = zookeeper.createClient('172.16.16.220:2181', {sessionTimeout:5000});
	// zkClient = zookeeper.createClient('172.16.24.208:2181', {sessionTimeout:5000});

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

	registerWorkerAssign()
		.then(doAssignedAllTask)
		.then(SetTasksWatcher);

	console.log('registered worker, i am(%s)', sessionId);
}

function registerWorkerAssign(){
	return new Promise(function(resolve, reject){
		zkClient.create(
			'/zht/status-collaboration/assign/'+workerName,
			new Buffer(sessionId || ''),
			zookeeper.CreateMode.PERSISTENT,
			function(error, path){
				if(error){
					console.log('%s::registerWorkerAssign.Callback=>register in assign warnning: %s',
						workerName, error.message);
					resolve();
					return;
				}

				console.log('%s::registerWorkerAssign.Callback=>registered in assign ok', workerName);
				resolve();
			});
	});
}

function doAssignedAllTask(){
	return new Promise(function(resolve, jeject){
		getAllAssignedTaskNames()
			.then(doAllTasksJob)
			.then(function(){
				resolve();
			})
			.catch(function(error){
				reject(error);
			});
	});
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

function getAllAssignedTaskNames(){
	return new Promise(function(resolve, reject){
		zkClient.getChildren(
			'/zht/status-collaboration/assign' + '/' + workerName,
			function(error, children, state){
				if(error){
					console.log('%s::getAllAssignedTaskNames.callback=>error: %s', workerName, error.message);
					reject(error);
					return;
				}

				if(!children || !children.length || children.length == 0){
					console.log('%s::getAllAssignedTaskNames.callback=>no assigned task', workerName);
				}
				
				console.log('%s::getAllAssignedTaskNames.callback=>ok: %s', workerName, JSON.stringify(children, null, 2));
				resolve(children);			
			});
	});
}

function doAllTasksJob(taskNodeNames){
	Promise.map(taskNodeNames, function(taskNodeName, index, length){
		return new Promise(function(resolve, reject){
			isTaskNotDone(taskNodeName)
				.then(taskJobController.isTaskNotDoing)
				.then(getTaskDetail)
				.then(doTaskJob)
				.catch(function(error){
					console.log('%s::doTaskJob=>to task <%s> error: %s', workerName, taskNodeName, error.message);
					resolve();
				});	
		});
	})
	.then(function(){
		console.log('%s::doAllTasksJob=>ok', workerName);
	})
	.catch(function(error){
		console.log('%s::doAllTasksJob=>error: %s', workerName, error.message);
	});
}

function isTaskNotDone(taskName){
	return new Promise(function(resolve, reject){
		zkClient.getChildren(
			'/zht/status-collaboration/assign' + '/' + workerName + '/' + taskName,
			function(error, children, state){
				if(error){
					console.log('%s::isTaskNotDone.callback=>error: %s', workerName, error.message);
					reject(error);
					return;
				}

				console.log('%s::isTaskNotDone.callback=>ok: %s', workerName, JSON.stringify(children, null, 2));
				if(!children || children.length === 0){
					resolve(taskName);
				}else{
					reject(new Error('TASK_IS_DONE'));			
				}
			});
	});
}

function getTaskDetail(taskNodeName){
	return new Promise(function(resolve, reject){
		var taskPath = '/zht/status-collaboration/assign' + '/' + workerName + '/' + taskNodeName;
		zkClient.getData(
			taskPath,
			function(error, data, state){
				if(error){
					consle.log('%s::getTaskData=>get data error: %s', workerName, error.message);
					reject(error);
					return;
				}

				console.log('%s::getTaskData=>get data ok, data: ', workerName, JSON.parse(data.toString())); 

				resolve({
					taskNodeName: taskNodeName,
					taskPath: taskPath,
					taskData: JSON.parse(data.toString())});			
			});
	});
}

function doTaskJob(taskDetail){
	return new Promise(function(resolve, reject){
		var taskJob = taskJobController.createTaskJob(zkClient, taskDetail);
		taskJobController.beginTaskJob(taskJob);
		resolve();
	});
}

function SetTasksWatcher(){
	return new Promise(function(resolve, reject){
		zkClient.getChildren(
			'/zht/status-collaboration/assign/' + workerName,
			tasksWatcher,
			function(error, children, state){
				if(error){
					console.log('%s::SetTasksWatcher=>set tasks watcher error: %s', workerName, error.message);
					reject(error);
					return;
				}

				console.log('$s::SetTasksWatcher=>set tasks watcher ok', workerName);
				resolve();			
			});
	});
}

function tasksWatcher(event){
	if(event.getType() === zookeeper.Event.NODE_CHILDREN_CHANGED){
		console.log('%s::tasksWatcher=>type=%s, name=%s, path=%s, eventString=%s', 
			workerName,event.getType(),event.getName(),event.getPath(),event.toString());

		doAssignedAllTask()
			.then(function(results){
				console.log('%s::tasksWatcher=>reset tasks watcher ok');
			})
			.catch(function(error){
				console.log('%s::tasksWatcher=>reset tasks watcher error: %s', error.message);
			})
			.finally(SetTasksWatcher);
	}
}



var taskJobBase = {
	begin: function(){
		throw new error('please override begin method');
	},
	end: function(){
		throw new error('please override end method');
	},
	emitEnd: function(data){
		this.emit('end', data);
	}
}

taskJobBase.protolink(new EventEmitter());


function createOvertimeTaskJob(zkClient, taskDetail){
	var overtimeTaskJob = {
		zkClient: zkClient,
		taskDetail: taskDetail
	};

	overtimeTaskJob.protolink(taskJobBase);

	overtimeTaskJob.begin = function(){
		if(this.isTimeNotValid()){
			console.log('overtimeTaskJob::begin=>time is invalid');
			this.end();
			return;
		}

		var year  = parseInt(this.taskDetail.taskData.time.slice(0, 4));
		var month = parseInt(this.taskDetail.taskData.time.slice(4, 6));
		var day = parseInt(this.taskDetail.taskData.time.slice(6, 8));
		var hour = parseInt(this.taskDetail.taskData.time.slice(8, 10));
		var minute = parseInt(this.taskDetail.taskData.time.slice(10, 12));
		var second = parseInt(this.taskDetail.taskData.time.slice(12, 14));

		var taskTime = new Date(year, month-1, day, hour, minute, second);
		if(this.isTimePassed(taskTime)){
			console.log('overtimeTaskJob::begin=>time is passed: %s', taskTime.toLocaleString());
			this.end();
			return;
		}

		var that = this;
		this.scheduleJob = schedule.scheduleJob(taskTime, function(){
			that.end.call(that);
		});

		console.log('overtimeTaskJob::begin=>begined the task job <%s>, assgined to <%s>', 
			this.taskDetail.taskNodeName, 
			this.taskDetail.taskData.assignToWho);
	};

	overtimeTaskJob.end = function(){
		that = this;
		this.CreateDoneNode().then(function(){
			that.scheduleJob = null;
			that.emitEnd(that.taskDetail.taskNodeName);
			console.log('overtimeTaskJob::end=>create task job <%s>\'s done node , assgined to <%s>', 
				that.taskDetail.taskNodeName, 
				that.taskDetail.taskData.assignToWho);
		}).catch(function(error){
			console.log('overtimeTaskJob::end=>error: %s', error.message);			
		});
	};

	overtimeTaskJob.CreateDoneNode = function(){
		var doneNodePath = 
			'/zht/status-collaboration/assign/' + 
			this.taskDetail.taskData.assignToWho + '/' + this.taskDetail.taskNodeName + '/done';

		console.log('$$$$$$, doneNodePath = %s', doneNodePath);	

		var that = this;

		return new Promise(function(resolve, reject){
			that.zkClient.create(
				doneNodePath,
				new Buffer(''),
				zookeeper.CreateMode.PERSISTENT,
				function(error, path){
					if(error){
						console.log('overtimeTaskJob::CreateDoneNode.Callback=>create node error: %s',
							error.message);
						reject(error);
						return;
					}

					console.log('overtimeTaskJob::CreateDoneNode.Callback=>create done node ok');
					resolve();
				});
		});

	};

	overtimeTaskJob.isTimeNotValid = function(){
		//20170312175800
		if(!this.taskDetail.taskData.time || this.taskDetail.taskData.time.length !== 14){
			return true;
		} else {
			return false;
		}
	};

	overtimeTaskJob.isTimePassed = function(taskTime){
		var now = new Date();
		if(taskTime	>= now){
			return false;
		} else {
			return true;
		}
	};


	return overtimeTaskJob;
}

const taskJobController = (function(){
	var controller = {};
	var taskJobs = {};

	taskJobCreaters = {
		followOvertime: createOvertimeTaskJob
	}

	controller.isTaskNotDoing = function(taskNodeName){
		return new Promise(function(resolve, reject){
			if(!taskJobs[taskNodeName]){
				resolve(taskNodeName);
			}else{
				reject(new Error('TASK_IS_DOING'));
			}
		});
	}

	controller.createTaskJob = function(zkClient, taskDetail){
		var taskJob = taskJobCreaters[taskDetail.taskData.name](zkClient, taskDetail);
        taskJobs[taskDetail.taskNodeName] = taskJob;
		console.log('taskJobController::createTaskJob=>crate task job <%s>, assigned to <%s>, save into cache',
			taskDetail.taskNodeName, taskDetail.taskData.assignToWho);
		return taskJob;
	};

	controller.beginTaskJob = function(taskJob){
		taskJob.on('end', this.endTaskJob);
		taskJob.begin();
	};

	controller.endTaskJob = function(taskNodeName){
		delete taskJobs[taskNodeName];
		console.log('taskJobController::endTaskJob=>delete <%s> frome cache', taskNodeName);
	};

	return controller;

})();

module.exports = worker;