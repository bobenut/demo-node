const http = require('http')
var Promise = require('bluebird')

//curl -i -H "Content-Type:application/json" -d "{\"time\":\"2017/08/24 17:11:00\",\"from\":\"client1\",\"clientUrl\":\"http://localhost:7000/timeout/consumer\"}" http://localhost:4000/timeout/task
let sendTask = () => {
  return new Promise((resolve, reject) => {
    console.log('sending')
    let d = new Date();
    let task = {
      time: d.toLocaleDateString() + ' ' + d.toLocaleTimeString(),
      from: 'client1',
      clientUrl: 'http://localhost:5001/timeout/consumer/finished'
    }

    var options = {
      hostname: 'localhost',
      port: 4002,
      path: '/timeout/task',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=UTF-8'
      }
    };
    
    let req = http.request(options, (res) => {
      if(res.statusCode==200) {
        console.log('发送超时任务成功: %s', JSON.stringify(task, null, 2));
        resolve()
      } else {
        console.log('发送超时任务失败: %s', JSON.stringify(task, null, 2));
        reject(new Error('发送超时任务失败: ' + JSON.stringify(task, null, 2)))
      }
    }); 

    req.on('error', (err) => {
      console.log('发送超时任务失败: %s', JSON.stringify(task, null, 2));
      reject(new Error('发送超时任务失败: ' + JSON.stringify(task, null, 2)))
    })
    
    req.write(JSON.stringify(task, null, 2))
    req.end()
  })
}

exports.startSending = () => {
  setTimeout(() => {
    sendTask()
      .finally(exports.startSending)
  }, 10000)
}

