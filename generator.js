/**
 * 0) check app start parameters, if (process.argv[2] === 'getErrors') -> set_appStatus = 'errMonitorApp' and run
 * 1) generate the reqired values {appID, appTTL}
 * 2) register app -> add the app credentials to the list of apps
 * 3) check if generator is present
 *      if (present) - ok, start processing -> set_appStatus = 'processingApp'
 *      else (not present) - check if this app is next in queue,
 *            if (this is the next app in queue) - it becomes a generator -> set_appStatus = 'generatorApp'
 *            else (not next) - we process -> set_appStatus = 'processingApp'
 *
 * [[errMonitorApp]] - lpop from [corrupted_messages] list and output to screen. Errors are removed from list(or marked as shown)
 *
 * [[generatorApp]] - Normally: generates message every 500ms and puts into [to_rocess] list end;
 *                    checks if present - resets a (active_gen) record with TTL 1.5 sec which contains generatorApp identifier
 *                    if generator was offline more than 1.5 sec (e.g. 3 messages were not generated) the (active_gen) record is invalid
 *                    and the first app steps forward to be a generator needs a validation check,
 *                    maybe that shit has to check time delta btween last generated messages to see if it is no more a valid generator
 *
 * [[processingApp]] - lpop a message from [to_rocess] list and hold it for 1 second then put to [well_processed] list,
 *                     or 5% possibiblity put it into [corrupted_messages] after each processed message check if generator is ok
 *                     and if this app has to step forward
 */

function registerApp() { // called on startup
// generate redisApp object
// create new random appId
// add this to app list in redis
}

function takeOver() {
// set (last_active_gen)=this.appID
// (active_gen)=this.appID, reset (active_gen) TTL = 1.5 sec
// this.appStatus = 'generatorApp';
}

function genIsValid() {

}

function generateMsg() {

}

function processMsg() {

}

function dealWithErrors() {

}
