"use strict";

let eventQueue;
let logger;
let subscriptions;
let actors;

const CPU_SAFETY_RATIO = 0.8;

let stringifyError = function(err, filter, space)
{
  let plainObject = {};
  Object.getOwnPropertyNames(err).forEach(function(key)
  {
    plainObject[key] = err[key];
  });
  return JSON.stringify(plainObject, filter, space);
};

module.exports =
{
    build: function(objectStore)
    {
        eventQueue = objectStore.eventQueue;
        logger = objectStore.logger;
        subscriptions = objectStore.subscriptions;
        actors = objectStore.actors;
    },

    run: function()
    {
        let stop = false;

        while(!stop)
        {
            let event = eventQueue.next();
            if(event === null)
            {
                stop = true;
                break;
            }

            let subscribers = subscriptions.getSubscribersForEvent(event);

            if(subscribers === null || subscribers === undefined)
                continue;

            for (let actorId in subscribers)
            {
                if (!subscribers.hasOwnProperty(actorId))
                    continue;

                let actor = actors.getFromId(actorId);
                if(actor === null || actor === undefined)
                    continue;

                let callbackMethod = subscribers[actorId];
                let scriptName = actors.getScriptname(actorId);
                logger.display("_entering actorId" + actorId + ": " + actors.getScriptname(actorId) + "." + callbackMethod);
                logger.startCpuLog();

                try //if runtime error in one actor, the others will still run.
                {
                    actor[callbackMethod](event);
                }
                catch(err)
                {
                    logger.error("In eventLoop, calling actor " + actorId +": " + scriptName + "." +
                        callbackMethod + "(\"" + event + "\")\n" + stringifyError(err, null, '\n'));
                }

                logger.endCpuLog("finished");

                if(Game.cpu.getUsed() > Game.cpu.tickLimit * CPU_SAFETY_RATIO)
                {
                    logger.warning("aborted eventLoop due to low CPU. " + Game.cpu.getUsed() + " > " +
                        Game.cpu.tickLimit + " * " + CPU_SAFETY_RATIO);
                    stop = true;
                    break;

                }
            }
        }
    }
};