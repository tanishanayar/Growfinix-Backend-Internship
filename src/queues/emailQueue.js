const { Queue } = require('bullmq');
const { connection } = require('../config/redis');

const emailQueue = new Queue('emails', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 3000 },
    removeOnComplete: 100,
    removeOnFail: 100
  }
});

module.exports = { emailQueue };
