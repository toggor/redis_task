/* eslint-disable no-console */

const Promise = require('bluebird');
const redis = require('redis');

Promise.promisifyAll(redis);

const config = {
  port: 6379, // Port of your locally running Redis server
  host: '127.0.0.1', // Redis server host, defaults to 127.0.0.1
};

const client = redis.createClient(config);
console.log(client.toString());
// client.prototype.myAppType = 'new_app';
/**
 * RANDOM STRING GENERATOR
 *
 * Info:      http://stackoverflow.com/a/27872144/383904
 * Use:       randomString(length [,"A"] [,"N"] );
 * Default:   return a random alpha-numeric string
 * Arguments: If you use the optional "A", "N" flags:
 *            "A" (Alpha flag)   return random a-Z string
 *            "N" (Numeric flag) return random 0-9 string
 */
function newMessage(len, an) {
  an = an && an.toLowerCase();
  let str = '',
      i = 0;
  const min = an === 'a' ? 10 : 0,
        max = an === 'n' ? 10 : 62;
  for (; i++ < len;) {
    let r = Math.random() * (max - min) + min << 0;
    // str += String.fromCharCode(r += r > 9 ? r < 36 ? 55 : 61 : 48);
    if (r > 9) {
      if (r < 36) {
        r += 55;
      } else {
        r += 61;
      }
    } else {
      r += 48;
    }
    str += String.fromCharCode(r);
  }
  return str;
}

function genIsValid(generator) {
  return generator.getAsync('active_gen').then((result) => { // check that gen is valid instead of genIsValid func
    return result === 'active';
  });
}


function pActGenerator(generator) {
  generator.setAsync('active_gen', 'active', 'EX', 5);
  generator.incrAsync('generated');
  generator.rpushAsync('to_process', newMessage(5));
  // colorLog(`message is  ${message}`, client.myAppType);
}

function pActProcessor(processor) {
  genIsValid(processor).then((isActive) => {
    if (isActive !== 'active') pActGenerator(processor);
    return processor.blpopAsync('to_process', 0)
      .then((reply) => {
        if (Math.random() >= 0.95) {
          console.log(`Probability 5% triggered for ${reply[1]}`);
          processor.lpushAsync('corrupted', reply[1]);
        }
        console.log(`processed  + ${reply[1]}`);
        processor.lpushAsync('processed', reply[1]);
      }).catch((err)=>{
        console.log(`Error in actProcessor blocking POP ${err.toString()}`);
      });
  }).catch((err)=>{
    console.log(`Error in actProcessor genIsValid ${err.toString()}`);
  });
}

const tToRun = 10; // we use iterators not to hang the machine when trying to process 1kk of messages
let i = 0;

function run(worker) {
  i++;
  if (i >= tToRun) return 0;
  return genIsValid(worker).then((isActive) => { // check that gen is valid instead of genIsValid func
    if (isActive) return Promise.delay(500).pActGenerator(worker);
    return pActProcessor(worker);
  })
    .then(() => {
      setImmediate(run);
    })
    .catch((err) => {
      console.log(`Smth bad happened: ${err.toString()}`);
      setImmediate(run);
    });
}

const r = run(client);
