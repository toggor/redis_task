/* eslint-disable no-console */

const Promise = require('bluebird');
const redis = require('redis');
const pActProcessor = require('../for_test.js').pActProcessor;
const pActGenerator = require('../for_test.js').pActGenerator;
const wheel = require('../for_test.js').wheel;

Promise.promisifyAll(redis);

const config = {
  port: 6379, // Port of Redis server
  host: '127.0.0.1', // Redis server host
};
const aClient = redis.createClient(config);

function cleanBeforeRun(client) {
  client.delAsync('to_process');
  client.delAsync('generated');
  client.delAsync('processed');
}

aClient.setActionType = function setActionType(type) {
  this.myActionType = type;
};
aClient.setAppName = function setAppName(name) {
  this.appName = name;
};
/*
describe('Generator', () => {
  it('Generator should generate things', (done) => {
    cleanBeforeRun(aClient);
    pActGenerator(aClient).then(done).catch((err) => {
      console.log(`Processing: ${err.toString()}`);
    });
  });
});


describe('Processor', () => {
  it('Processor should process', (done) => {
    const expected = 0;
    aClient.set('active_gen', 'active');
    pActProcessor(aClient)
      .then(aClient.del('active_gen'))
      .then(done)
      .catch((err) => {
        console.log(`Processing: ${err.toString()}`);
      });
  });
});

*/
describe('Main should generate', () => {
  it('Main generates', (done) => {
    const expected = 10;
    wheel(aClient, 10);
    aClient.get('generated', (err, gNum)=>{
      console.log(`Generated ${gNum} messages`);
      if (gNum >= expected) return Promise.resolve();
      return Promise.reject(new Error('generated not enough'));
    })
      .then(done());
  });
});
