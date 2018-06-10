/* eslint-disable no-console */

const Promise = require('bluebird');
const redis = Promise.promisifyAll(require('redis'));
const color = require('colors');

let doLogging = false;
const startTime = Date.now();
const cliPrefix = 'tester_';
/* const config = {
  port: 6379, // Port of Redis server
  host: '127.0.0.1', // Redis server host
}; */

const aClient = redis.createClient();

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
  if (doLogging) {
    if (type === undefined) console.log(`${message}`);
    else if (type === 'generator') console.log(color.green(`${message}`));
    else if (type === 'processor') console.log(color.blue(`${message}`));
    else if (type === 'error') console.log(color.red(`${message}`));
  }
}

/**
* As in task we do the following:
* get the messages with errors
* display them
* then delete
*/
function getErrors(client) {
  colorLog('getErrors call accepted');
  client.llenAsync('corrupted')
    .then((num)=> {
      colorLog(`Appeared ${num} corrupted messages`);
      return client.lrangeAsync('corrupted', 0, num);
    })
    .then((data)=> {
      for (let i = 0; i < data.length; i++) {
        colorLog(data[i]);
      }
    })
    .then(()=> {
      colorLog('Deleting corrupted messages');
      return client.del('corrupted');
    })
    .delay(2000)
    .then(()=> {
      console.log('All deleted');
      process.exit(0);
    });
}
/**
 * Return true if generator is active
 * @param {redis client} generator we pass a redis client
 */
function genIsValid(generator) {
  return generator.getAsync('active_gen')
    .then((result) => {
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
  generator.setAsync('active_gen', 'active', 'EX', 1)
    .then(()=>{
      const message = newMessage(5);
      generator.setActionType('generator');
      generator.rpushAsync('to_process', message);
      generator.incrAsync('generated');
      colorLog(`message pushed ${message}`, generator.myActionType); })
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
  processor.llenAsync('to_process')
    .then((qsize)=>{  // check the 'to_process' queue not to block all clients
      if (qsize < 2) { return Promise.resolve(); }
      return processor.blpopAsync('to_process', 0)
        .then((reply) => {
          processor.setActionType('processor');
          if (Math.random() >= 0.95) {
            colorLog(`Probability 5% triggered for ${reply[1]}`);
            processor.lpushAsync('corrupted', reply[1]);
          }
          else {
            colorLog(`processed  + ${reply[1]}`, processor.myActionType);
            processor.lpushAsync('processed', reply[1]);
          }
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
    const cliQueue = [];
    res = data.split(/\n(?!$)/); // new lines except ending line, coz its empty

    for (let i = 0; i < res.length; i++) {
      let temp =  res[i].split(/\b\s/); // spaces after words
      // res[i] = temp;
      // temp = res[i][3].split(/=/)[1]; // params look like 'name=cli_name', split on '='
      temp = temp[3].split(/=/)[1]; // params look like 'name=cli_name', split on '='
      if (temp.indexOf(cliPrefix) + 1) { cliQueue.push(temp); } // get only our apps clients names prefixed with 'tester_'
    }
    return cliQueue;
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
  const name = cliPrefix + newMessage(8);
  client.setAppName(name); // a redis client property
  client.clientAsync('setname', name); // a name for DB connection
}

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
  let msgsGenerated = 0;
  if (Number.parseInt(timesToRun, 10) > 0) limitGen = true;

  initApp(client);
  colorLog(`Client name: ${client.appName}`);

  function hamster() {
    genIsValid(client).then((isActive) => {
      if (isActive) {
        if (client.myActionType === 'generator') {
          msgsGenerated++;
          if (limitGen && (msgsGenerated >= timesToRun)) {
            return Promise.reject(new Error('tired to rock'));
          }
          return Promise.delay(10).then(pActGenerator(client));  // delay changed for testing reasons
        }
        return pActProcessor(client);
      }
      return  appIsNext(client).then((isNext)=>{
        if (isNext) { pActGenerator(client); }
      });
    })
      .then(() => {
        process.nextTick(hamster);
        return Promise.resolve();
      })
      .catch((err) => {
        if (err.toString() === 'Error: tired to rock') {
          const passed = (Date.now() - startTime) / 1000;
          colorLog(`Took ${Math.floor(Number.parseInt(passed, 10))} seconds to generate ${timesToRun}`);
        }
        else { colorLog(`Look! An error: ${err.toString()}`, 'error');}
        process.exit();
      });
  }
  hamster();
}


/**
 *  don't forget to switch on the output;
 *  we don't mess around and accept only
 *  'app', 'getError', or number of messages to generate
 *  otherwise it won't start
 */
if (process.argv[2] !== undefined) {
  doLogging = true;
  if (isNaN(process.argv[2])) {
    if (process.argv[2].toLowerCase() === 'app') {
      wheel(aClient);
    }
    else if (process.argv[2] === 'getErrors') {
      getErrors(aClient);
    }
    else {
      colorLog('Incorrect starting parameters', 'error');
      process.exit();
    }
  }
  else if (Number.parseInt(process.argv[2], 10) > 0) {
    wheel(aClient, Number.parseInt(process.argv[2], 10));
  }
  else {
    colorLog('Incorrect starting parameters', 'error');
    process.exit();
  }
}
else { process.exit(); }

module.exports.wheel = wheel;
