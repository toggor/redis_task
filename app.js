/* eslint-disable no-console */

const Promise = require('bluebird');
const redis = require('redis');
const color = require('colors');

Promise.promisifyAll(redis);

const config = {
  port: 6379, // Port of Redis server
  host: '127.0.0.1', // Redis server host
};
const client = redis.createClient(config);

/**
 * Param setters for action type and client name
 */
client.setActionType = function setActionType(type) { this.myActionType = type; };
client.setAppName = function setAppName(name) { this.appName = name; };

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
  if (type === undefined) console.log(`${message}`);
  else if (type === 'generator') console.log(color.green(`${message}`));
  else if (type === 'processor') console.log(color.blue(`${message}`));
}

/**
 * Return true if generator is active
 * @param {redis client} generator we pass a redis client
 */
function genIsValid(generator) {
  return generator.getAsync('active_gen').then((result) => { // check that gen is valid instead of genIsValid func
    return result === 'active';
  });
}

/**
 * Do what generator does
 * @param {redis client} generator we pass a redis client
 * update TTL of the active_gen record
 * generate message then push it to 'to_process' queue
 * increase generated iterator
 */
function pActGenerator(generator) {
  return generator.setAsync('active_gen', 'active', 'EX', 2)
    .then(()=>{
      const message = newMessage(5);
      generator.rpushAsync('to_process', message);
      generator.setActionType('generator');
      colorLog(`message pushed ${message}`, client.myActionType); })
    .then(generator.incrAsync('generated'))
    .catch((err)=>{
      console.log(`Error in actGenerator ${err.toString()}`);
    });
}

/**
 * Do what processor does
 * @param {redis client} processor we pass a redis client
 * we use the blocking pop to make processors work one by one
 * if we got in 5% range we put a message into 'corrupted' queue
 * else we put a message into 'processed' queue
 */
function pActProcessor(processor) {
  return processor.llenAsync('to_process').then((qsize)=>{  // check the 'to_process' queue not to block all clients
    if (qsize < 1) return Promise.resolve();
    return processor.blpopAsync('to_process', 0)
      .then((reply) => {
        if (Math.random() >= 0.95) {
          colorLog(`Probability 5% triggered for ${reply[1]}`);
          processor.lpushAsync('corrupted', reply[1]);
        }
        colorLog(`processed  + ${reply[1]}`, client.myActionType);
        processor.lpushAsync('processed', reply[1]);
      });
  }).catch((err)=>{
    console.log(`Error in actProcessor blocking POP ${err.toString()}`);
  });
}
/**
 * Check if our 'worker' is next
 * if true he takes over if the generator fails
 * @param {redis client} worker we pass a redis client
 * we get a list of all connected redis clients
 * and parse it to get only our clients
 * then compare if this is the correct worker to become generator
 */
function appIsNext(worker) {
  return worker.clientAsync('list').then((data) => {
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
    return worker.appName === result[0];
  }).catch((err) => {
    console.log(`Error in appIsNext: ${err.toString()}`);
  });

}

/**
 * Init our apps with names
 * @param {redis client} worker we pass a redis client
 * by default clients connections are unnamed
 * we name them to be able to distinguish them later
 */
function initApp(worker) {
  const name = `tester_${newMessage(8)}`;
  worker.setAppName(name);
  return worker.clientAsync('setname', name);
}


/**
 * int main void.... almost
 * @param {redis client} worker we pass a redis client
 * outer function is to control the execution
 * and a small hamster running in the wheel
 *
 * we init client
 * check if the generator is present:
 * generator active and this is a 'generator' - we generate every 500 ms
 * generator active and this is a 'processor' - we process
 * no generator - we look who is next in queue, if this is next - become generator
 */
function wheel(worker) {
  initApp(worker);
  console.log(`Client name: ${worker.appName}`);

  function hamster() {
    return genIsValid(worker).then((isActive) => { // check that gen is valid instead of genIsValid func
      if (isActive) {
        if (worker.myActionType === 'generator') {
          console.log(color.yellow(`generator is ${isActive}`));
          return Promise.delay(500).then(pActGenerator(worker));
        }
        return pActProcessor(worker);
      }
      return  appIsNext(worker).then((isNext)=>{
        if (isNext) pActGenerator(worker);
      });
    })
      .then(() => {
        setImmediate(hamster);
      })
      .catch((err) => {
        console.log(`Smth bad happened: ${err.toString()}`);
        setImmediate(hamster);
      });
  }
  hamster();
}

wheel(client);
