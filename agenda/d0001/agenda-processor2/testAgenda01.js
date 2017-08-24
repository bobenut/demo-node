const Agenda = require('agenda');

const agenda = new Agenda({db: {address: 'mongodb://127.0.0.1/agendaDb'}});

agenda.on('ready', () => {
  // defineJobs();

  // agenda.start();
  // console.log('started');
});

const defineJobs = () => {
  agenda.define('print msg', (job, done) => {
    console.log("pring msg at %s", Date.now)
    done();
  });

  agenda.every('5 seconds', 'print msg');
}


