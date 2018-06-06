/* eslint-disable no-console */

const Promise = require('bluebird');
const redis = Promise.promisifyAll(require('redis'));

const config = {
  port: 6379, // Port of your locally running Redis server
  host: '127.0.0.1', // Redis server host, defaults to 127.0.0.1
};

const client = redis.createClient(config);
// const client2 = redis.createClient(config);
const msgMax = 10000;

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
  console.log('gen is valid called');
  return generator.getAsync('active_gen').then((result) => { // check that gen is valid instead of genIsValid func
    return result === 'active';
  });
}

/* function msgsGenerated(generator) {
  return generator.getAsync('generated').then((result) => { // check cnumber of generated messages
    return result;
  });
} */

function actGenerator(worker) {
  const message = newMessage(40);
  console.log(`message is  ${message}`);
  return worker.rpushAsync('to_process', message)
    .then(worker.incrAsync('generated'))
    .then(worker.getAsync('generated'))
    .then((result) => {
      console.log(`generated so far ${result}`);
      if (result >= msgMax) return worker.pause();
      return 'contue';
    });
}

function actProcessor(worker) {
  worker.blpopAsync('to_process', 0)
    .then((reply) => {
      if (Math.random() >= 0.95) {
        console.log(`Probability 5% triggered for ${reply[1]}`);
        return worker.lpushAsync('corrupted', reply[1]);
      }
      console.log(`processed  + ${reply[1]}`);
      return worker.lpushAsync('processed', reply[1]);
    })
    .then(genIsValid(worker))
    .then((isValid) => {
      if (!isValid) {
        client.myAppType = 'generator';
        console.log('set to generator');
        return 'set to generator';
      }
      return 'left as processor';
    });
}

client.on('error', (err) => {
  console.log(`Client err - ${client.host} : ${client.port} - ${err}`);
});

client.on('ready', () => {
  genIsValid(client)
    .then((isValid) => {
      if (!isValid) {
        client.myAppType = 'generator';
        return client.setAsync('active_gen', 'active', 'EX', 5);
      }
      client.myAppType = 'processor';
      return client;
    });
});

client.on('idle', () => {
  genIsValid(client)
    .then((isValid)=>{
      if (!isValid) {
        client.myAppType = 'generator';
        return client.setAsync('active_gen', 'active', 'EX', 5);
      }
      if (client.myAppType === 'generator') return Promise.delay(500).then(actGenerator(client));
      return actProcessor(client);
    });
});

