/* eslint-disable no-console */


const redis = require('redis');

const config = {
  port: 6379, // Port of your locally running Redis server
  host: '127.0.0.1', // Redis server host, defaults to 127.0.0.1
  // scope : 'demo'  // Use a scope to prevent two NRPs from sharing messages
};

const client2 = redis.createClient(config);

client2.on('error', (err) => {
  console.log(`error event - ${client2.host} : ${client2.port} - ${err}`);
});


client2.on('idle', () => {
  client2.blpop('to_process', 0, (err, reply) => {
    if (Math.random() >= 0.95) {
      console.log('Probability 5% triggered');
      // client2.set('corrupted',  JSON.stringify({message : message}), redis.print);
      client2.lpush('corrupted', reply[1], redis.print);
    } else {
      client2.lpush('processed', reply[1]);
      console.log(`processed  + ${reply[1]}`);
    }
  });
});
