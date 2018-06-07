/* eslint-disable no-console */

const redis = require('redis'),
      colors = require('colors'),
      maxMsgs = 100000,
      config = {
        port: 6379, // Port of your locally running Redis server
        host: '127.0.0.1', // Redis server host, defaults to 127.0.0.1
      },
      worker = redis.createClient(config);

worker.myAppType = 'pocessor';
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
  else if (type === 'generator') console.log(colors.green(`${message}`));
  else if (type === 'processor') console.log(colors.blue(`${message}`));
}

/**
 *
 * @param {redis.Client} generator we pass a redis client and do what generator should do
 */
function actGenerator(generator) {
  // update the active generator record TTL, create message for processor and push it to 'to_process'
  generator.set('active_gen', 'active', 'EX', 5);
  const message = newMessage(5);
  generator.incr('generated');
  generator.rpush('to_process', message);
  colorLog(`message is  ${message}`, client.myAppType);
}

/**
 *
 * @param {redis.Client} processor we pass a redis client and do what processor should do
 */
function actProcessor(processor) {
  processor.blpop('to_process', 0, (err, reply) => {
    // if generator is present - we block and pop records from 'to_process' queue and push them to 'processed' or 'corrupted'
    colorLog(reply.toString);
    if (Math.random() >= 0.95) {
      colorLog('Probability 5% triggered', processor.myAppType);
      processor.lpush('corrupted', reply[1]);
    } else {
      processor.lpush('processed', reply[1]);
      colorLog(`processed  + ${reply[1]}`, processor.myAppType);
    }
  });
}

worker.on('error', (err) => {
  colorLog(`error event - ${client.host} : ${client.port} - ${err}`);
});


function run(client) {

  client.get('active_gen', (err, reply) => {
    if (reply !== 'active') {
      client.set('active_gen', 'active', 'EX', 5);
      client.myAppType = 'generator';
    }
    else {
      client.myAppType = 'pocessor';     
    }
  });
  if (client.myAppType === 'generator') {
    client.get('generated', (err, generated) => {
      colorLog(`generated so far ${generated}`);
      if (generated >= maxMsgs * 1.1) {
        client.quit();
        colorLog('reached max Generated');
        // clearInterval(setIntervalId);
      }
    });
    actGenerator(client);
  }
  else if (client.myAppType === 'processor') {
    client.llen('processed', (err, genMsgs) => {
      colorLog(`processed so far ${genMsgs}`);
      if (genMsgs >= maxMsgs) {
        // if Max number of processed messages reached we stop processing
        colorLog('reached max Processed');
        client.quit();
      }
    });
    actProcessor(client);
  }
  setImmediate(run(client));
}

/* worker.on('ready', () => {
  // by default our clients come as 'processors' but if no generator present - at least one is needed
  worker.myAppType = 'processor';
  colorLog('ready');
  worker.get('active_gen', (err, reply) => {
    if (reply !== 'active') {
      worker.myAppType = 'generator';
      worker.set('active_gen', 'active', 'EX', 5);
    }
    return 0;
  });

}); */
run(worker);
