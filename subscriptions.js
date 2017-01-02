"use strict";

const MEMORY_KEYWORD = "core:subscriptions";

let memoryBank;
let memoryObject;
let logger;

module.exports =
{
    build: function(objectStore)
    {
        memoryBank = objectStore.memoryBank;
        logger = objectStore.logger;
    },

    rewind: function()
    {
        memoryObject = memoryBank.get(MEMORY_KEYWORD);
    },

    unwind: function()
    {
        memoryBank.set(MEMORY_KEYWORD, memoryObject);
    },

    subscribe: function(eventString, actor, callbackMethod)
    {
        if(eventString === "" || eventString === undefined || eventString === undefined ||
            actor === "" || actor === undefined || actor === undefined ||
            callbackMethod === "" || callbackMethod === undefined || callbackMethod === undefined
        )
            logger.warning("Tried to subscribe with invalid parameters. eventString: " +
                eventString +
                ", actor: " +
                actor +
                ", callbackMethod: " +
                callbackMethod);

        if(!memoryObject[eventString])
            memoryObject[eventString] = {};

        memoryObject[eventString][actor] = callbackMethod;
    },

    unsubscribe: function(eventString, actor)
    {
        delete memoryObject[eventString][actor];
    },

    getSubscribersForEvent: function(eventString)
    {
        return memoryObject[eventString];
    },

    hardReset: function()
    {
        memoryObject = {};
    },
};