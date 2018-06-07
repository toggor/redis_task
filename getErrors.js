/* eslint-disable no-console */
const Promise = require('bluebird');
const redis = Promise.promisifyAll(require('redis'));

const client = redis.createClient();

/**
 * As in task we do the following:
 * get the messages with errors
 * display them
 * then delete
 */
console.log('getErrors call accepted');
client.llenAsync('corrupted')
  .then((num)=> {
    console.log(`Appeared ${num} corrupted messages`);
    return client.lrangeAsync('corrupted', 0, num);
  })
  .then((data)=> {
    for (let i = 0; i < data.length; i++) {
      console.log(data[i]);
    }
  })
  .then(()=> {
    console.log('Corrupted messages deleted');
    return client.del('corrupted');
  })
  .then(()=> {
    process.exit(0);
  });
