/* eslint-disable no-console */

const Promise = require('bluebird');
const redis = Promise.promisifyAll(require('redis'));
const wheel = Promise.promisify(require('../app.js').wheel);


const config = {
  port: 6379, // Port of Redis server
  host: '127.0.0.1', // Redis server host
};

const aClient = redis.createClient(config);
const wheelClient = redis.createClient(config);

function cleanRun(client) {
  client.del('to_process');
  client.del('generated');
  client.del('processed');
}

wheelClient.setActionType = function setActionType(type) {
  this.myActionType = type;
};
wheelClient.setAppName = function setAppName(name) {
  this.appName = name;
};


describe('Main should generate', () => {

  it('Main generates', (done) => {
    aClient.get('generated', (err, result) => {
      console.log(`Generated ${result} messages`);
      if (result > 0) done();
      else throw new Error('generates not');
    });
  });
});

describe('Main should process', () => {
  it('Main process', (done) => {
    function justDoIt() {
      aClient.llen('processed', (err, result) => {
        console.log(`Processed ${result} messages`);
        if (result > 0) {
          // aClient.del('active_gen');
          cleanRun(aClient);
          done();
        }
        else {
          // aClient.del('active_gen');
          cleanRun(aClient);
          throw new Error('processes not');
        }
      });
    }
    wheel(wheelClient, 50);
    setTimeout(justDoIt, 100);
  });
});
