# Redis_task

## The task
This should be an application that works with redis.
It should be able to generate and process messages.
If run with 'getErrors' flag - it should output all corrupted messages to the screen, deleting them from the DB, and terminate.

App conditions:
- In parallel as many applications as needed can be run.
- All the information exchange is done only through redis.
- Only one app at a time can generate messages(generator), all other started apps can only process(processor).
- Any app can become a generator.
- If the current generator is terminated, then one of the processors should replace the generator.
- The processor, has 5% probability to determine that a message is corrupted.

Messages conditions:
- Messages are generated every 500 ms.
- All messages must be processed only once.
- Message is generated as a return from function with a random text response.
- The application, receiving a message, with a probability of 5% determines that the message contains
an error.
- If the message was marked as corrupted it should be placed in redis for later research.