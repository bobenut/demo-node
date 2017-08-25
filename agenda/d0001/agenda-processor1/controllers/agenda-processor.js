var agenda = require('../core/agenda-base').agenda;
const processorName = 'agp1';

agenda.define('timeout-job', {lockLifetime: 2000}, (job, done) => {
  let beginDate = new Date()
  console.log('6-1.%s begin to process timeout task at %s', 
    processorName,
    beginDate.toLocaleDateString() + ' ' + beginDate.toLocaleTimeString() + '.' + beginDate.getMilliseconds())
  // console.log('tasks: %s', JSON.stringify(job.attrs.data))
  if(job.attrs.data){
    for (let index, task; task = job.attrs.data.tasks[index++];) {
      let temp = task
    }
    // console.log('tasks: %s', JSON.stringify(job.attrs.data.tasks))
  }

  let endDate = new Date()
  console.log('6-2.%s end to process timeout task at %s', 
    processorName,
    endDate.toLocaleDateString() + ' ' + endDate.toLocaleTimeString() + '.' + endDate.getMilliseconds())  
  done();
});

const configProcessors = () => {
  agenda.jobs({name: 'timeout-job'}, (err, jobs) => {
      if(jobs.length == 0) {
        console.log('create new timeout-job')
        agenda.every('5 seconds', 'timeout-job', {tasks:[]});
      } else {
        console.log('update timeout-job')
        agenda.every('5 seconds', 'timeout-job', jobs[0].attrs.data);
      }
  })
}

agenda.on('ready', () => {
  configProcessors();
  agenda.start();
  console.log('%s started', processorName);
});




