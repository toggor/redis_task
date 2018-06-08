/* eslint-disable no-console */

const Promise = require('bluebird');
const redis = require('redis');
const color = require('colors');

Promise.promisifyAll(redis);

const doLogging = false;

const config = {
  port: 6379, // Port of Redis server
  host: '127.0.0.1', // Redis server host
};
const aClient = redis.createClient(config);

/**
 * Param setters for action type and client name
 */
aClient.setActionType = function setActionType(type) { this.myActionType = type; };
aClient.setAppName = function setAppName(name) { this.appName = name; };

/**
 * This generates a random string
 * @param {Integer} len is an output message length
 */
function newMessage(len) {
  let str = '';
  const max = 62;
  for (let i = 0; i < len; i++) {
    let r = Math.floor(Math.random() * max);
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

/**
 * Colored output to see who is who
 * @param {*} message  text to be colored
 * @param {*} type  generator, processor or system
 * by default color = white
 */
function colorLog(message, type) {
  if (!doLogging) return 0;
  if (type === undefined) console.log(`${message}`);
  else if (type === 'generator') console.log(color.green(`${message}`));
  else if (type === 'processor') console.log(color.blue(`${message}`));
  else if (type === 'error') console.log(color.red(`${message}`));
}

/**
 * Return true if generator is active
 * @param {redis client} generator we pass a redis client
 */
function genIsValid(generator) {
  return generator.getAsync('active_gen').then((result) => {
    return result === 'active';
  });
}

/**
 * Do what generator does
 * @param {redis client} generator we pass a redis client
 * update TTL of the active_gen record
 * generate message then push it to 'to_process' queue
 * increase 'generated' iterator in case we'll need it
 */
function pActGenerator(generator) {
  return generator.setAsync('active_gen', 'active', 'EX', 2)
    .then(()=>{
      const message = newMessage(5);
      generator.rpushAsync('to_process', message);
      generator.setActionType('generator');
      colorLog(`message pushed ${message}`, generator.myActionType); })
    .then(generator.incrAsync('generated'))
    .then(()=>{ return Promise.resolve(); })
    .catch((err)=>{
      colorLog(`Error in actGenerator ${err.toString()}`, 'error');
    });
}

/**
 * Do what processor does
 * @param {redis client} processor we pass a redis client
 * we use the blocking pop to make processors work one by one
 * if we got in 5% possibility range we put a message into 'corrupted' queue
 * else we put a message into 'processed' queue
 */
function pActProcessor(processor) {
  return processor.llenAsync('to_process').then((qsize)=>{  // check the 'to_process' queue not to block all clients
    if (qsize < 1) return Promise.resolve();
    return processor.blpopAsync('to_process', 0)
      .then((reply) => {
        processor.setActionType('processor');
        if (Math.random() >= 0.95) {
          colorLog(`Probability 5% triggered for ${reply[1]}`);
          return processor.lpushAsync('corrupted', reply[1])
            .then(()=>{ return Promise.resolve(); });
        }
        colorLog(`processed  + ${reply[1]}`, processor.myActionType);
        processor.lpushAsync('processed', reply[1]).then(()=>{ return Promise.resolve(); });
      });
  }).catch((err)=>{
    colorLog(`Error in actProcessor blocking POP ${err.toString()}`, 'error');
  });
}
/**
 * Check if our this client is next
 * if true he takes over if the generator fails
 * @param {redis client} client we pass a redis client
 * we get a list of all connected redis clients
 * and parse it to get only our clients
 * then compare if this is the correct client to become generator
 */
function appIsNext(client) {
  return client.clientAsync('list').then((data) => {
    let res = [];
    const appQueue = [];
    res = data.split(/\n(?!$)/); // new lines except ending line, coz its empty

    for (let i = 0; i < res.length; i++) {
      const temp =  res[i].split(/\b\s/); // spaces after words
      res[i] = temp;
    }
    for (let i = 0; i < res.length; i++) {
      const temp = res[i][3].split(/=/)[1]; // params look like 'id=23', split on '='
      if (temp.indexOf('tester_') + 1) appQueue.push(temp); // get only our apps clients names prefixed with 'tester_'
    }
    return appQueue;
  }).then((result)=>{
    return client.appName === result[0];
  }).catch((err) => {
    colorLog(`Error in appIsNext: ${err.toString()}`, 'error');
  });

}

/**
 * Init our apps with names
 * @param {redis client} client we pass a redis client
 * by default clients connections are unnamed
 * we name them to be able to distinguish them later
 */
function initApp(client) {
  const name = `tester_${newMessage(8)}`;
  client.setAppName(name); // a redis client property
  client.clientAsync('setname', name); // a name for DB connection
}

aClient.on('quit', ()=>{
  setTimeout(()=>{
    process.exit();
  }, 10000);
});

/**
 * int main (void).... almost
 * @param {redis client} client we pass a redis client
 * outer function is to control the execution
 * and a small hamster running in the wheel
 *
 * we init client
 * check if the generator is present:
 * generator active and this is a 'generator' - we generate every 500 ms
 * generator active and this is a 'processor' - we process
 * no generator - we look which client is next in queue, if this is next - become generator
 */
function wheel(client, timesToRun) {
  let limitGen = false;
  let repeater;
  if (Number.parseInt(timesToRun, 10) > 0) limitGen = true;

  initApp(client);
  colorLog(`Client name: ${client.appName}`);

  function hamster() {
    genIsValid(client).then((isActive) => { // check that gen is valid instead of genIsValid func
      if (isActive) {
        if (client.myActionType === 'generator') {
          colorLog(`generator is ${isActive}`);
          return Promise.delay(10).then(pActGenerator(client));  // changed for testing reasons
        }
        return pActProcessor(client);
      }
      return  appIsNext(client).then((isNext)=>{
        if (isNext) pActGenerator(client);
      });
    }).then(()=>{
      if (limitGen) {
        return client.getAsync('generated').then((gNum)=>{
          if (gNum >= timesToRun) { clearInterval(repeater); return Promise.reject(new Error('tired to rock')); }
        });
      }
      return Promise.resolve();
    })
      .then(() => {
        repeater = setImmediate(hamster);
      })
      .catch((err) => {
        colorLog(`Look! An error: ${err.toString()}`, 'error');
        // setImmediate(hamster);
      });
  }
  hamster();
}

if (process.argv[2] === 'unlim') {
  wheel(aClient);
}
else if (!Number.parseInt(process.argv[2], 10).isNaN && Number.parseInt(process.argv[2], 10) > 0 ) {
  wheel(aClient, Number.parseInt(process.argv[2], 10));
}

module.exports.pActGenerator = pActGenerator;
module.exports.pActProcessor = pActProcessor;
module.exports.wheel = wheel;
