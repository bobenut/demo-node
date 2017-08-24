var agenda = require('../core/agenda-base').agenda
var Promise = require('bluebird')

module.exports.addTaskIntoTimeoutJob = (params) => {
  return new Promise((resolve, reject) => {
    agenda.jobs({name: 'timeout-job'}, (err, jobs) => {
      if(err) {
        reject(err)
        return
      }

      console.log('append task into timeout-job', JSON.stringify(jobs))
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

        console.log('save ok: %s', JSON.stringify(job, null, 2))
        resolve({result: 'done', data: jobs})
      })
      
      // [{"_id":"599e974ef040b8079056c138","name":"timeout-job","type":"single","data":null,"priority":0,"repeatInterval":"5 seconds","repeatTimezone":null,"lastModifiedBy":null,"nextRunAt":"2017-08-24T09:18:02.514Z","lockedAt":null,"lastRunAt":"2017-08-24T09:17:57.514Z","lastFinishedAt":"2017-08-24T09:17:57.543Z"}]
    })
  })
}


