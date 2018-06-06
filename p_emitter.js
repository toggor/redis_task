
/* eslint-disable no-console */

const Promise = require('bluebird');
const redis = Promise.promisifyAll(require('redis'));

const config = {
  port: 6379, // Port of your locally running Redis server
  host: '127.0.0.1', // Redis server host, defaults to 127.0.0.1
};

const client = redis.createClient(config);
client.set('active_gen', 'active', 'EX', 5);
//client.prototype.myAppType = 'new_app';
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
    // str += String.fromCharCode(r += r > 9 ? r < 36 ? 55 : 61 : 48);
    if (r > 9) { if (r < 36) { r += 55; } else { r += 61; } } else { r += 48; }
    str += String.fromCharCode(r);
  }
  return str;
}

function genIsValid(generator) {
  return generator.getAsync('active_gen').then((result) => {   // check that gen is valid instead of genIsValid func
    return result === 'active';
  });
}

/* const active = client.getAsync('active_gen').then((result) => {   // check that gen is valid instead of genIsValid func
  return result === 'active';
});*/
// console.log(active); // should be a promise

const tToRun = 10;     // we use iterators not to hang the machine when trying to process 1kk of messages
let i = 0;
const timerId = setInterval(() => {
  i++;
  if (i >= tToRun) return 0;
  const gen = genIsValid(client).then((isValid) => {
    if (!isValid) return isValid;

    const message = newMessage(40);
    console.log(`message is  ${message}`);
    console.log(`message is  ${Object.getPrototypeOf(client).toString}`);
    return client.rpushAsync('to_process', message);

  });
}, 500);


/* It is said to a correct for promise loop
var promiseFor = Promise.method(function(condition, action, value) {
    if (!condition(value)) return value;
    return action(value).then(promiseFor.bind(null, condition, action));
});

promiseFor(function(count) {
    return count < 10;
}, function(count) {
    return db.getUser(email)
             .then(function(res) {
                 logger.log(res);
                 return ++count;
             });
}, 0).then(console.log.bind(console, 'all done')); */
