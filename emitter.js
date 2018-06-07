/* eslint-disable no-console */

const Promise = require('bluebird');
const redis = require('redis');
const color = require('colors');

Promise.promisifyAll(redis);

const config = {
  port: 6379, // Port of your locally running Redis server
  host: '127.0.0.1', // Redis server host, defaults to 127.0.0.1
};

const client = redis.createClient(config);
// client.set('active_gen', 'active', 'EX', 5);

// redis.prototype.appType = 'new_app';

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
  for (;i++ < len;) {
    let r = Math.random() * (max - min) + min << 0;
    str += String.fromCharCode(r += r > 9 ? r < 36 ? 55 : 61 : 48);
  }
  return str;
}

function genIsValid(generator) {
  return generator.get('active_gen', (err, reply) => { // suspicious function it migh not return correct value | TOrefactor
    return reply.toLowerCase === 'active';
  });
}

/*
// const tToRun = 100000;
const tToRun = 100;
let i = 0;
const timerId = setInterval(() => {
  i++;
  if (i >= tToRun) return 0;
  const gen = genIsValid(client);
  if (gen) {
    client.set('active_gen', 'active', 'EX', 5);
    const message = newMessage(40);
    client.rpush('to_process', message);
    console.log(`message is  ${message}`);

  }
  else { console.log(gen); }

}, 500);
*/

client.client('list', (err, data) => {
  let res = [];
  const appQueue = [];
  res = data.split(/\n(?!$)/); // new lines except ending line, coz its empty

  for (let i = 0; i < res.length; i++) {
    const temp =  res[i].split(/\b\s/); // spaces after words
    // each res[i] contains a string with clients params
    res[i] = temp;
  }
  for (let i = 0; i < res.length; i++) {
    console.log(`[${i}] ClientID = ${res[i][0].split(/=/)[1]}, ClientName = ${res[i][3].split(/=/)[1]}`);
    const temp = res[i][3].split(/=/)[1]; // get only our apps clients names prefixed with 'tester_'
    if (temp.indexOf('tester_') + 1) appQueue.push(temp);
  }
  return appQueue;
});
// }

