var agenda = require('../core/agenda-base').agenda;
const processorName = 'agp2';

agenda.define('timeout-job', (job, done) => {
  console.log("%s's handling msg at %s", processorName, JSON.stringify(job.attrs.data))
  done();
});

const configProcessors = () => {
  agenda.every('5 seconds', 'timeout-job');
}

agenda.on('ready', () => {
  configProcessors();
  agenda.start();
  console.log('%s started', processorName);
});




