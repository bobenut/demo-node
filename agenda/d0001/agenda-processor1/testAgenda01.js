const Agenda = require('agenda');
const http = require('http')

const agenda = new Agenda({db: {address: 'mongodb://127.0.0.1/agendaDb'}});

agenda.on('ready', () => {
  defineJobs();

  agenda.start();
  console.log('started');
});

const defineJobs = () => {
  agenda.define('print msg', (job, done) => {
    var d = new Date();
    var postData = {date: d.getHours() + ':' + d.getMinutes() + ':' + d.getSeconds()};
    
    var options = {
      hostname: 'localhost',
      port: 4000,
      path: '/',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=UTF-8'
      }
    };
    
    var req = http.request(options, (res) => {
      console.log('响应码: %s', res.statusCode);
    }); 
    
    req.write(JSON.stringify(postData, null, 2));
    req.end();

    console.log("pring msg at %s", Date.now)
    done();
  });

  agenda.every('5 seconds', 'print msg');
}




