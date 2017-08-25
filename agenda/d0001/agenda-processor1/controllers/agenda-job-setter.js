var agenda = require('../core/agenda-base').agenda
var Promise = require('bluebird')
const processorName = 'agp1';

module.exports.addTaskIntoTimeoutJob = (params) => {
  return new Promise((resolve, reject) => {
    agenda.jobs({name: 'timeout-job'}, (err, jobs) => {
      let beginDate = new Date()
      console.log('5-1.%s begin to add timeout task at %s', 
        processorName,
        beginDate.toLocaleDateString() + ' ' + beginDate.toLocaleTimeString() + '.' + beginDate.getMilliseconds())

      if(err) {
        reject(err)
        return
      }

      // console.log('append task into timeout-job', JSON.stringify(jobs))
      let job = jobs[0]
      if(!job.attrs.data) {
        job.attrs.data = {tasks:[]}
      }

      job.attrs.data.tasks.push(params.body)
      
      
      job.save((err) => {
        if(err){
          reject(err)
          return;
        }

        // console.log('save ok: %s', JSON.stringify(job, null, 2))
        let endDate = new Date()
        console.log('5-2.%s end to add timeout task at %s', 
          processorName,
          endDate.toLocaleDateString() + ' ' + endDate.toLocaleTimeString() + '.' + endDate.getMilliseconds())
          
        resolve({result: 'done', data: jobs})
      })
      
      // [{"_id":"599e974ef040b8079056c138","name":"timeout-job","type":"single","data":null,"priority":0,"repeatInterval":"5 seconds","repeatTimezone":null,"lastModifiedBy":null,"nextRunAt":"2017-08-24T09:18:02.514Z","lockedAt":null,"lastRunAt":"2017-08-24T09:17:57.514Z","lastFinishedAt":"2017-08-24T09:17:57.543Z"}]
    })
  })
}


