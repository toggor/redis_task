/* eslint-disable no-console*/
/* eslint-disable no-underscore-dangle*/
const Redis           = require('ioredis'),
      RedisLock       = require('ioredis-lock'),
      Promise         = require('bluebird'),
      colors          = require('colors'),
      uuidV4          = require('uuid/v4'),
      messageInterval = 1,
      lockInterval    = messageInterval + 20,
      enableLogging   = true,
      cluster         = require('cluster'),
      workers         = 2,
      maxMessageCount = 1000;
let cpus = require('os').cpus().length;

if (cpus === 32) {
  cpus = 2; // HACK that's strange but require('os').cpus().length shows 32 on travis.
}

const maxMessageCountPerNode = maxMessageCount / cpus;

let messageCount = 0;

function myLog(guid, message, level) {
  if (!enableLogging) {
    return;
  }
  if (level === 'warn') {
    console.log(colors.green(`${guid} : ${message}`));
  } else if (level === 'warn') {
    console.log(colors.red(`${guid} : ${message}`));
  } else {
    console.log(`${guid} : ${message}`);
  }

}

function getRandomArbitrary(min, max) {
  return Math.floor(Math.random() * (max - min) + min);
}

function beGenerator(client, lock, myGuid) {
  if (messageCount > maxMessageCountPerNode) {
    myLog(myGuid, 'I`ve done all I could', 'warn');
    cluster.worker.kill();
    return 0;// no need to return here after suicide, only for consistency
  }
  messageCount++;
  const errorGeneration = getRandomArbitrary(1, 100);
  let message = messageCount;
  if (errorGeneration < 6) {
    message = `${messageCount}: ERROR: ${message}`;
    myLog(myGuid, 'publishing error');
  } else {
    myLog(myGuid, 'publishing message');
  }
  return lock.extend(lockInterval)
    .then(()=> {
      return client.publish('data', message);
    })
    .then(()=> {
      if (errorGeneration < 3) {
        // emulate blackout. It would be better to release lock but we are emulating emergency, so...
        myLog(myGuid, 'emulating generator blackout', 'warn');
        return Promise.resolve();
      }
      return Promise
        .delay(messageInterval)
        .then(()=>beGenerator(client, lock, myGuid));
    })
    .catch(RedisLock.LockExtendError, ()=> {
      return Promise.delay(messageInterval);
    });
}


function beSubscriber(client, instanceGuid) {
  const subscribeClient = new Redis({keyPrefix: 'OneTwoTripTest:'});
  const lockSubscriber = RedisLock.createLock(client, {
    timeout: lockInterval,
    retries: 0,
    delay: messageInterval,
  });
  return lockSubscriber.acquire('app:feature:lock:subscriber')
    .then(()=>subscribeClient.subscribe('data'))
    .then(()=> {
      myLog(instanceGuid, 'I am a subscriber now!', 'warn');
      return new Promise((resolve)=> {
        subscribeClient.on('message', (channel, message) => {
          lockSubscriber.extend(lockInterval)
            .then(()=> {
              myLog(instanceGuid, `Received message ${message} from channel ${channel}`);
              let action = Promise.resolve();
              if (message.indexOf('ERROR') !== -1) {
                action = client.lpush('errors', message);
              }
              if (getRandomArbitrary(1, 100) < 4) {
                myLog(instanceGuid, 'emulating subscriber blackout', 'warn');
                // emulate blackout. It would be better to release lock but we are emulating emergency, so...
                action.then(()=> {
                  subscribeClient.disconnect();
                  resolve();
                });
              }
            })
            .catch(RedisLock.LockExtendError, ()=> {
              subscribeClient.disconnect();
              resolve();
            });
        });
      });
    })
    .catch(RedisLock.LockAcquisitionError, ()=> {
      myLog(instanceGuid, 'Failed to get subscriber lock');
      subscribeClient.disconnect();
      return Promise.delay(messageInterval);
    });
}

function run(guid) {
  const instanceGuid = guid || uuidV4();
  myLog(instanceGuid, 'starting');
  const client = new Redis({keyPrefix: 'OneTwoTripTest:'});

  function start() {
    return client.pubsub('NUMSUB', 'data')
      .then((data)=> {
        const subscribers = data[1];
        if (subscribers === 0) {
          return beSubscriber(client, instanceGuid);
        }
        // try being a generator
        const lockGenerator = RedisLock.createLock(client, {
          timeout: lockInterval,
          retries: 0,
          delay: messageInterval,
        });
        return lockGenerator.acquire('app:feature:lock:generator')
          .then(()=> {
            myLog(instanceGuid, 'I am a generator now!', 'warn');
            return beGenerator(client, lockGenerator, instanceGuid);
          })
          .catch(RedisLock.LockAcquisitionError, ()=> {
            return Promise.delay(messageInterval);
          });
      })
      .then(()=> {
        setImmediate(start);
      })
      .catch((err)=> {
        myLog(instanceGuid, `Smth bad happened: ${err.toString()}`, 'error');
        setImmediate(start);
      });
  }

  start();
}

function masterLog(data) {
  console.log(colors.yellow(data));
}
if (cluster.isMaster) {
  masterLog(`Master ${process.pid} is running`);
  masterLog(`I'm gonna launch ${cpus} nodes with ${workers} workers on each node`);
  for (let i = 0; i < cpus; i++) {
    cluster.fork();
  }
  cluster.on('exit', (node, code, signal) => {
    masterLog(`node ${node.process.pid} died, code ${code}`);
    if (code !== 0) { // client fallen, long live the client!
      masterLog('restarting node');
      cluster.fork();
      return;
    }
    let nodesAlive = 0;
    Object.keys(cluster.workers).forEach((id)=> {
      if (!cluster.workers[id].isDead()) {
        nodesAlive++;
      }
    });
    if (nodesAlive === 0) {
      masterLog('All processing finished, exiting gracefully');
      Promise.delay(100) // to ensure that console output sucseeded
        .then(()=>process.exit(0));
    } else {
      masterLog(`still waiting for ${nodesAlive} nodes to finish`);
    }
  });
} else {
  for (let i = 0; i < workers; i++) {
    run();
  }
  masterLog(`node ${process.pid} started`);
}
