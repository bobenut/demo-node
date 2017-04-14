var Promise = require('bluebird');

function f1(){
	return new Promise(function(resolve, reject){
		console.log('f1 ok');
		reject(new Error('CUS'));
		// resolve('f1');
	});
}

function f2(){
	return new Promise(function(resolve, reject){
		console.log('f2 ok');
		resolve('f2');
	});
}

var fes = [f1, f2];
Promise.map(fes, function(f, index){
	return f();
})
.then(function(result){
	console.log('ok: %s', result)
})
.catch(function(error){
	console.error('error: %s', error.message);
});




