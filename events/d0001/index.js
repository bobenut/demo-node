const EventEmitter =  require('events');
require('protolink');

const emitter = new EventEmitter();

emitter.on('end', function(result){
	console.log('task end: %s', result);
});

emitter.emit('end', '1 end');

var worker = {
	begin: function(){
		
	},
	emitEnd: function(data){
		this.emit('end', data);
	}
};

worker.protolink(new EventEmitter());
worker.on('end', function(data){
	console.log('2 end %s', data);
});

var workerMan = {};
workerMan.protolink(worker);
workerMan.begin = function(){
	var that = this;
	setTimeout(function(){
		that.emitEnd('bobenut');
	}, 2000);
};

workerMan.begin();




