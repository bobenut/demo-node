var zookeeper = require('node-zookeeper-client');
var schedule = require('node-schedule');
var Promise = require('bluebird');
const EventEmitter = require('events');
const config = require('./config');
require('protolink');

var zkClient;
var sessionId;

var worker = {};




worker.begin = function(){
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
		// console.log('worker connected server, sessionId=%s', sessionId.toString('hex'));
		console.log('%s=> connected server', config.workerName);
		registerWorker();
	}
}

function registerWorker(){
	zkClient.create(
			config.workersPath + '/' + config.workerName,
			new Buffer(sessionId || ''),
			zookeeper.CreateMode.EPHEMERAL,
			registerWorkerCallback);
}

function registerWorkerCallback(error, path){
	if(error){
		// console.log('registerWorkerCallback=>register %s error:' + error.message, workerName);
		if(error.message == 'Exception: NODE_EXISTS[-110]'){
			console.log('%s=> the same name worker existed, may be a old me', config.workerName);
		}else{
			console.error('%s=> registe error: %s', config.workerName, error.message);
		}
		setWorkerWatcher();
		return;
	}

	registerWorkerAssign()
		.then(doAssignedAllTask)
		.then(SetTasksWatcher);

	// console.log('registered worker, i am(%s)', sessionId);
	console.log('%s=> registed', config.workerName);
}

function setWorkerWatcher(){
	zkClient.exists(
		config.workersPath + '/' + config.workerName,
		workerWatcher,
		setWorkerWatcherCallback);
}

function setWorkerWatcherCallback(error, state){
	if(error){
		// console.log('setWorkerWatcherCallback=>error:' + error.message);
		console.error('%s=> set watcher for myself error: %s', config.workerName, error.message);
		return;
	}

	if(state){
		// console.log('%s=> the same name worker existed, may be a old me', config.workerName);
	}else{
		registerWorker();
	}
}

function workerWatcher(event){
	if(event.getType() === zookeeper.Event.NODE_DELETED){
		// console.log('%s=> workerWatcher=>begin register %s', workerName);
		registerWorker();
	}
}

function registerWorkerAssign(){
	return new Promise(function(resolve, reject){
		zkClient.create(
			config.tasksAssignPath + '/' + config.workerName,
			new Buffer(sessionId || ''),
			zookeeper.CreateMode.PERSISTENT,
			function(error, path){
				if(error){
					// console.log('%s::registerWorkerAssign.Callback=>register in assign warnning: %s',
					// 	workerName, error.message);
					// console.error('%s=> registe in assign error: %s', config.workerName, error.message);
					resolve();
					return;
				}

				// console.log('%s=> registed in assign', config.workerName);
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

function getAllAssignedTaskNames(){
	return new Promise(function(resolve, reject){
		zkClient.getChildren(
			config.tasksAssignPath + '/' + config.workerName,
			function(error, children, state){
				if(error){
					// console.log('%s::getAllAssignedTaskNames.callback=>error: %s', workerName, error.message);
					console.error('%s=> get all tasks assigned to me  error: %s', config.workerName, error.message);
					reject(error);
					return;
				}

				if(!children || !children.length || children.length == 0){
					// console.log('%s::getAllAssignedTaskNames.callback=>no assigned task', workerName);
				}
				
				// console.log('%s::getAllAssignedTaskNames.callback=>ok: %s', workerName, JSON.stringify(children, null, 2));
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
					// console.log('%s::doTaskJob=>to task <%s> error: %s', workerName, taskNodeName, error.message);
					resolve();
				});	
		});
	})
	.then(function(){
		// console.log('%s::doAllTasksJob=>ok', workerName);
	})
	.catch(function(error){
		// console.log('%s::doAllTasksJob=>error: %s', workerName, error.message);
	});
}

function isTaskNotDone(taskNodeName){
	return new Promise(function(resolve, reject){
		zkClient.getChildren(
			config.tasksAssignPath + '/' + config.workerName + '/' + taskNodeName,
			function(error, children, state){
				if(error){
					// console.log('%s::isTaskNotDone.callback=>error: %s', workerName, error.message);
					console.error('%s=> check task was done error: %s', config.workerName, error.message);
					reject(error);
					return;
				}

				// console.log('%s::isTaskNotDone.callback=>ok: %s', workerName, JSON.stringify(children, null, 2));
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
		var taskPath = config.tasksAssignPath + '/' + config.workerName + '/' + taskNodeName;
		zkClient.getData(
			taskPath,
			function(error, data, state){
				if(error){
					// consle.log('%s::getTaskData=>get data error: %s', workerName, error.message);
					console.error('%s=> get task detail error: %s', config.workerName, error.message);
					reject(error);
					return;
				}

				// console.log('%s::getTaskData=>get data ok, data: ', workerName, JSON.parse(data.toString())); 
				var taskDetail = JSON.parse(data.toString());

				resolve(taskDetail);	
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
			config.tasksAssignPath + '/' + config.workerName,
			tasksWatcher,
			function(error, children, state){
				if(error){
					// console.log('%s::SetTasksWatcher=>set tasks watcher error: %s', workerName, error.message);
					console.error('%s=> set watcher for tasks what assigned to me error: %s', config.workerName, error.message);
					reject(error);
					return;
				}

				// console.log('$s::SetTasksWatcher=>set tasks watcher ok', workerName);
				resolve();			
			});
	});
}

function tasksWatcher(event){
	if(event.getType() === zookeeper.Event.NODE_CHILDREN_CHANGED){
		// console.log('%s::tasksWatcher=>type=%s, name=%s, path=%s, eventString=%s', 
		// 	config.workerName,event.getType(),event.getName(),event.getPath(),event.toString());

		doAssignedAllTask()
			.then(function(results){
				// console.log('%s::tasksWatcher=>reset tasks watcher ok');
			})
			.catch(function(error){
				// console.log('%s::tasksWatcher=>reset tasks watcher error: %s', error.message);
			})
			.finally(SetTasksWatcher);
	}
}



function createTaskJobBase(){
	return {
		begin: function(){
			throw new error('please override begin method');
		},
		end: function(){
			throw new error('please override end method');
		},
		emitEnd: function(data){
			this.emit('end', data);
		}
	};
}

function createOvertimeTaskJob(zkClient, taskDetail){

	var taskJobBase = createTaskJobBase();
	taskJobBase.protolink(new EventEmitter());

	var overtimeTaskJob = {
		zkClient: zkClient,
		taskDetail: taskDetail
	};

	overtimeTaskJob.protolink(taskJobBase);

	overtimeTaskJob.begin = function(){
		if(this.isTimeNotValid()){
			console.log('overtimeTaskJob=> begin failed: time is invalid');
			this.end();
			return;
		}

		var year  = parseInt(this.taskDetail.time.slice(0, 4));
		var month = parseInt(this.taskDetail.time.slice(4, 6));
		var day = parseInt(this.taskDetail.time.slice(6, 8));
		var hour = parseInt(this.taskDetail.time.slice(8, 10));
		var minute = parseInt(this.taskDetail.time.slice(10, 12));
		var second = parseInt(this.taskDetail.time.slice(12, 14));

		var taskTime = new Date(year, month-1, day, hour, minute, second);
		if(this.isTimePassed(taskTime)){
			console.log('overtimeTaskJob=> begin failed: time is passed: %s', taskTime.toLocaleString());
			this.end();
			return;
		}

		var that = this;
		this.scheduleJob = schedule.scheduleJob(taskTime, function(){
			that.end.call(that);
		});

		console.log('overtimeTaskJob=> begined the task job <%s> what assgined to <%s>', 
			this.taskDetail.taskNodeName, 
			this.taskDetail.assignToWho);
	};

	overtimeTaskJob.end = function(){
		that = this;

		that.CreateDoneNode().then(function(){
			that.scheduleJob = null;
			that.emitEnd(that.taskDetail.taskNodeName);
			console.log('overtimeTaskJob=> done task job <%s> what assgined to <%s>', 
				that.taskDetail.taskNodeName, 
				that.taskDetail.assignToWho);
		}).catch(function(error){
			console.log('overtimeTaskJob=> done task error: %s', error.message);

		});
	};

	overtimeTaskJob.CreateDoneNode = function(){
		var doneNodePath = 
			config.tasksAssignPath + '/' +
			this.taskDetail.assignToWho + '/' + this.taskDetail.taskNodeName + '/done';

		var that = this;

		return new Promise(function(resolve, reject){
			that.zkClient.create(
				doneNodePath,
				new Buffer(''),
				zookeeper.CreateMode.PERSISTENT,
				function(error, path){
					if(error){
						console.error('overtimeTaskJob=> create done node error when done task: %s',
							error.message);
						reject(error);
						return;
					}

					// console.log('overtimeTaskJob::CreateDoneNode.Callback=>create done node ok');
					resolve();
				});
		});

	};

	overtimeTaskJob.isTimeNotValid = function(){
		//20170312175800
		if(!this.taskDetail.time || this.taskDetail.time.length !== 14){
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
		var taskJob = taskJobCreaters[taskDetail.taskName](zkClient, taskDetail);
        taskJobs[taskDetail.taskNodeName] = taskJob;
		console.log('taskJobController=> crate task job <%s> what assigned to <%s>, save into cache',
			taskDetail.taskNodeName, taskDetail.assignToWho);
		return taskJob;
	};

	controller.beginTaskJob = function(taskJob){
		taskJob.on('end', this.endTaskJob);
		taskJob.begin();
	};

	controller.endTaskJob = function(taskNodeName){
		// console.log('****: %s', JSON.stringify(taskJobs));
		delete taskJobs[taskNodeName];
		console.log('taskJobController=> done the job, delete <%s> frome cache', taskNodeName);
	};

	return controller;

})();

module.exports = worker;