/* eslint-disable no-console */

const redis = require('redis'),
      colors = require('colors'),
      maxMsgs = 1000,
      config = {
        port: 6379, // Port of your locally running Redis server
        host: '127.0.0.1', // Redis server host, defaults to 127.0.0.1
      },
      client = redis.createClient(config);

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
    str += String.fromCharCode(r += r > 9 ? r < 36 ? 55 : 61 : 48);
  }
  return str;
}

function colorLog(message, type) {
  if (type === undefined) console.log(`${message}`);
  else if (type === 'generator') console.log(colors.green(`${message}`));
  else if (type === 'processor') console.log(colors.blue(`${message}`));
}

function actGenerator(generator) {
  generator.set('active_gen', 'active', 'EX', 5);
  const message = newMessage(5);
  // const message = 'test';
  generator.incr('generated');
  generator.rpush('to_process', message);
  colorLog(`message is  ${message}`, client.myAppType);
}

function actProcessor(processor) {
  client.get('active_gen', (err, active) => {
    if (active !== 'active') {
      processor.myAppType = 'generator';
      processor.set('active_gen', 'active', 'EX', 5);
    }
    processor.blpop('to_process', 0, (err, reply) => {
      if (Math.random() >= 0.95) {
        colorLog('Probability 5% triggered', processor.myAppType);
        processor.lpush('corrupted', reply[1]);
      } else {
        processor.lpush('processed', reply[1]);
        colorLog(`processed  + ${reply[1]}`, processor.myAppType);
      }
    });
  });
}

client.on('error', (err) => {
  colorLog(`error event - ${client.host} : ${client.port} - ${err}`);
});

setInterval(() => {
//  client.on('idle', () => {
    if (client.myAppType === 'processor') {
      client.llen('processed', (err, genMsgs) => {
        colorLog(`processed so far ${genMsgs}`);
        if (genMsgs >= maxMsgs) {          
          client.quit();
        }
        actProcessor(client);
      });
    } else if (client.myAppType === 'generator') {
      client.get('generated', (err, generated) => {
        colorLog(`generated so far ${generated}`);
      });
      actGenerator(client);
    }
    else throw new Error(`Expected 'processor or 'generator' but got ${client.myAppType}`);
//  });
}, 0);

client.on('ready', () => {
  client.myAppType = 'processor';
  colorLog('ready');
  client.get('active_gen', (err, reply) => {
    if (reply !== 'active') {
      client.myAppType = 'generator';
      client.set('active_gen', 'active', 'EX', 5);
    }
    return 0;
  });
});
