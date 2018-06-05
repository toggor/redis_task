/* eslint-disable no-console */

// const NRP = require('node-redis-pubsub');
const redis = require('redis');

const config = {
  port: 6379, // Port of your locally running Redis server
  host: '127.0.0.1', // Redis server host, defaults to 127.0.0.1
  // scope : 'demo'  // Use a scope to prevent two NRPs from sharing messages
};

// var client  = redis.createClient(config);

// const nrp = new NRP(config); // This is the NRP client
// const client1 = redis.createClient(config);
const client2 = redis.createClient(config);

client2.on('error', (err) => {
  console.log(`error event - ${client2.host} : ${client2.port} - ${err}`);
});

/* nrp.on('to process', function(data){
  console.log('message: ' + data.message);

}); */

/*
client1.on('message', function (channel, message) {
  console.log('client1 channel ' + channel + ': ' + message);

  if(Math.random() >= 0.95){
    console.log('Probability 5% triggered');
    client2.set('corrupted',  JSON.stringify({message : message}), redis.print);
    client2.lpush('msgcorrupted',  JSON.stringify({message : message}), redis.print);
  }
});

client1.on('ready', function () {
  // if you need auth, do it here
  client1.subscribe('to process');
});
*/


/*

client2.on('idle', function () {
  client2.llen('to_process', function (err, qLen) {
    if (qLen > 0) {
      client2.blpop('to_process', 0,  function (err, reply) {
        if (Math.random() >= 0.95) {
          console.log('Probability 5% triggered');
          //client2.set('corrupted',  JSON.stringify({message : message}), redis.print);
          client2.lpush('msgcorrupted', reply, redis.print);
        } else {
          client2.lpush('processed', reply);
          console.log('processed ' + reply);
        }
      });
    }
  });
}); */

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
