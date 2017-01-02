"use strict";

const MEMORY_KEYWORD = "core:actors";

let memoryBank;
let memoryObject;
let objectStore;
let logger;

let localCache;

module.exports =
{
    build: function(_objectStore)
    {
        objectStore = _objectStore;
        memoryBank = _objectStore.memoryBank;
        logger = _objectStore.logger;

        localCache =
            { actors: {}
            , scripts: {}
            , outdatedActors: {}
            };
    },

    rewind: function()
    {
        memoryObject = memoryBank.get(MEMORY_KEYWORD);

        for(let actorId in localCache.actors)
            localCache.outdatedActors[actorId]=localCache.actors[actorId];

        localCache.actors = {};
    },

    hardReset: function()
    {
        memoryObject =
            { actorIdCounter: 0
            , actorNameFromId: {}
            , aliases: {}
            };

        localCache =
            { actors: {}
            , scripts: {}
            , outdatedActors: {}
            };
    },

    unwind: function()
    {
        for (let actorId in localCache.actors)
        {
            if (!localCache.actors.hasOwnProperty(actorId))
                continue;

             localCache.actors[actorId].unwind();
        }

        memoryBank.set(MEMORY_KEYWORD, memoryObject);

    },

    getFromId: function(actorId)
    {
        if(localCache.actors[actorId])
            return localCache.actors[actorId];

        if(localCache.outdatedActors[actorId])
        {
            let actor = localCache.outdatedActors[actorId];
            actor.rewind(actorId);
            localCache.actors[actorId] = actor;
            return actor;
        }

        let scriptName = memoryObject.actorNameFromId[actorId];

        if(typeof scriptName === "undefined" || scriptName === null)
        {
            logger.warning("attempted to actors.getFromId with invalid details. Scriptname: " +
                scriptName + ", actorId: " + actorId);
            return null;
        }
        if(!localCache.scripts[scriptName])
        {
            try //insure that one failing actor can't take the core and thus all actors down.
            {
                localCache.scripts[scriptName] = require(scriptName);
            }
            catch(error)
            {
                this.logger.error("error requiring script " + scriptName, error);    
            }
        }
        
        if(!localCache.scripts[scriptName])
            return;

        let actor = new localCache.scripts[scriptName](objectStore);
        actor.rewind(actorId);

        localCache.actors[actorId] = actor;

        return actor;
    },

    createNew: function(scriptName, initFunc)
    {
        if(!localCache.scripts[scriptName])
            localCache.scripts[scriptName] = require(scriptName);

        if(!localCache.scripts[scriptName])
        {
            logger.warning("attempted to create script that doesn't exist: " + scriptName);
            return;
        }

        let actor = new localCache.scripts[scriptName](objectStore);

        let actorId = memoryObject.actorIdCounter++;

        actor.rewind(actorId);

        if(initFunc === null || initFunc === undefined)
            actor.init();
        else
            initFunc(actor);

        memoryObject.actorNameFromId[actorId] = scriptName;
        localCache.actors[actorId] = actor;

        return {
              actor: actor
            , id: actorId
            };
    },

    removeActor: function(actorId)
    {
        let actor = this.getFromId(actorId);
        actor.remove();

        delete localCache.actors[actorId];
        delete localCache.outdatedActors[actorId];
        delete memoryObject.actorNameFromId[actorId];
    },

    registerAlias: function(actorId, alias)
    {
        memoryObject.aliases[alias] = actorId;
    },

    getFromAlias: function(alias)
    {
        return this.getFromId(memoryObject.aliases[alias]);
    },

    removeAlias: function(alias)
    {
        delete memoryObject.aliases[alias];
    },

    getScriptname: function(actorId)
    {
        return memoryObject.actorNameFromId[actorId];
    },
};