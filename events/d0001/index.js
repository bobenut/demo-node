const EventEmitter =  require('events');

const emitter = new EventEmitter();

emitter.on('end', function(result){
	console.log('task end: %s', result);
});

emitter.emit('end', 'hoho');
