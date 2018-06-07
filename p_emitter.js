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

client.setActionType = function (type) { this.myActionType = type; };
client.setAppName = function (name) { this.appName = name; };

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
 * @param {*} message  to color
 * @param {*} type  generator, processor or system
 * if no type - system by default color = white
 */
function colorLog(message, type) {
  if (type === undefined) console.log(`${message}`);
  else if (type === 'generator') console.log(color.green(`${message}`));
  else if (type === 'processor') console.log(color.blue(`${message}`));
}

function genIsValid(generator) {
  return generator.getAsync('active_gen').then((result) => { // check that gen is valid instead of genIsValid func
    return result === 'active';
  });
}


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

function pActProcessor(processor) {
  return processor.llenAsync('to_process').then((qsize)=>{  // check the to_process queue not to block all clients
    if (qsize < 1) return Promise.resolve();
    return processor.blpopAsync('to_process', 0)
      .then((reply) => {
        if (Math.random() >= 0.95) {
          console.log(`Probability 5% triggered for ${reply[1]}`);
          processor.lpushAsync('corrupted', reply[1]);
        }
        colorLog(`processed  + ${reply[1]}`, client.myActionType);
        processor.lpushAsync('processed', reply[1]);
      });
  }).catch((err)=>{
    console.log(`Error in actProcessor blocking POP ${err.toString()}`);
  });
}

function pGenTakeover(worker) {
  pActGenerator(worker);
}

function appIsNext(worker) {
  return worker.clientAsync('list').then((data) => {
    let res = [];
    const appQueue = [];
    res = data.split(/\n(?!$)/); // new lines except ending line, coz its empty

    for (let i = 0; i < res.length; i++) {
      const temp =  res[i].split(/\b\s/); // spaces after words
      // each res[i] contains a string with clients params
      res[i] = temp;
    }
    for (let i = 0; i < res.length; i++) {
      // console.log(`[${i}] ClientID = ${res[i][0].split(/=/)[1]}, ClientName = ${res[i][3].split(/=/)[1]}`);
      const temp = res[i][3].split(/=/)[1]; // get only our apps clients names prefixed with 'tester_'
      if (temp.indexOf('tester_') + 1) appQueue.push(temp);
    }
    return appQueue;
  }).then((result)=>{
    return worker.appName === result[0];
  }).catch((err) => {
    console.log(`Error in appIsNext: ${err.toString()}`);
  });

}

function initApp(worker) {
  const name = `tester_${newMessage(8)}`;
  worker.setAppName(name);
  return worker.clientAsync('setname', name);
}

function run(worker) {
  initApp(worker);
  console.log(`Client name: ${worker.appName}`);

  function start() {
    return genIsValid(worker).then((isActive) => { // check that gen is valid instead of genIsValid func
      if (isActive) {
        if (worker.myActionType === 'generator') {
          console.log(color.yellow(`generator is ${isActive}`));
          return Promise.delay(500).then(pActGenerator(worker));
        }
        return pActProcessor(worker);
      }
      return  appIsNext(worker).then((isNext)=>{
        if (isNext) pGenTakeover(worker);
      });
    })
      .then(() => {
        setImmediate(start);
      })
      .catch((err) => {
        console.log(`Smth bad happened: ${err.toString()}`);
        setImmediate(start);
      });
  }
  start();
}

run(client);
