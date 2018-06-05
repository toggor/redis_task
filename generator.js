/**
 * 0) check app start parameters, if (process.argv[2] === 'getErrors') -> set_appStatus = 'errMonitorApp' and run
 * 1) generate the reqired values {appID, appTTL}
 * 2) register app -> add the app credentials to the list of apps
 * 3) check if generator is present
 *      if (present) - ok, start processing -> appStatus = 'processingApp'
 *      else (not present) - check if this app is next in queue,
 *            if (this is the next app in queue) - it becomes a generator -> appStatus = 'generatorApp'
 *            else (not next) - we process -> set_appStatus = 'processingApp'
 *
 * [[errMonitorApp]] - lpop from [corrupted] list and output to screen. Errors are removed from list(or marked as shown)
 *
 * [[generatorApp]] - Normally: generates message every 500ms and puts into [to_rocess] list end;
 *                    checks if present - resets a (active_gen) record with TTL 1.5 sec which contains generatorApp identifier
 *                    if generator was offline more than 1.5 sec (e.g. 3 messages were not generated) the (active_gen) record is invalid
 *                    and the first app steps forward to be a generator needs a validation check,
 *                    maybe that shit has to check time delta btween last generated messages to see if it is no more a valid generator
 *
 * [[processingApp]] - lpop a message from [to_rocess] list and hold it for 1 second then put to [processed] list,
 *                     or 5% possibiblity put it into [corrupted] after each processed message check if generator is ok
 *                     and if this app has to step forward
 */
// a class for applications
class protoApp {
  constructor() {
    this.appStatus = 'new_app';
    this.db = {}; // object should contain redis credentials
    this.registerApp();
  }

  generateMsg() {
    // here we generate random text
    // then put it into redis
  }

  processMsg(message) {
    // we get the message from db and hold it for some time
    // 95% we put it into [processed] list
    // 5% we put it into [corrupted] list
  }

  work() {
    // we check this.appStatus and process accordingly
    // for the generator:
    //      - check if this is the (active_gen)
    //      - reset the TTL of a (active_gen)
    //      - generateMsg()
    //      - put the message into (to_process) list
    // for the processor
    //      - get the message from (to_process)
    //      - processMsg(message)
  }

  // other things: setter for DB params
  //               setter and getter for appStatus
  //               getter for appId
}

function genIsValid() {
  // we check if the generator is up and running
  // if yes - we keep the app as processor
  // if no - we check if app is next in list or the list is empty
  // if yes - do the takeOver otherwise stay as processor
}

function takeOver() {
  // (last_active_gen)=redisApp.appID
  // (active_gen)=redisApp.appID, reset (active_gen) TTL = 1.5 sec
  // redisApp.appStatus = 'generatorApp';
}

function dealWithErrors() {
  // if the app was called with 'getErrors' flag
  // we output messages from [corrupted] list
  // delete them from DB and terminate the app
}


// I suppose we check if 'getErrors' was present -> dealWithErrors();
// Then create the 'redApp' new protoApp() application, fill in the info
// Then do an infinite cycle where we:
// - check the generator status
// - tkeOver or not
// - do the job redApp.work()
// Maybe check the signals from outside in case we have to stop
// process Errors if we face any


