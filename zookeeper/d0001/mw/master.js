var zookeeper = require('node-zookeeper-client');

var zkClient;


var master = {};



master.init = function(){
	zkClient = zookeeper.createClient('172.16.16.220:2181', {sessionTimeout:50000});

	zkClient.on('state', onZkClientState);


};

master.connect = function(){
	zkClient.connect();
};

function onZkClientState(state){
	if(state === zookeeper.State.SYNC_CONNECTED){
		console.log('connected');
	}
}



module.exports = master;