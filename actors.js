"use strict";

const MEMORY_KEYWORD = "core:actors";

module.exports = class Actors
{
    constructor(core)
    {
        this.core = core;
        this.localCache =
            { actors: {}
            , classes: {}
            , outdatedActors: {}
            };
    }

    rewindCore()
    {
        this.memoryObject = this.core.getMemory(MEMORY_KEYWORD);

        for(let actorId in this.localCache.actors)
            this.localCache.outdatedActors[actorId] = this.localCache.actors[actorId];

        this.localCache.actors = {};
    }

    hardResetCore()
    {
        this.memoryObject =
            { actorIdCounter: 0
            , scriptNameFromId: {}
            , aliases: {}
            , debugWrap: false
            };

        this.localCache =
            { actors: {}
            , classes: {}
            , outdatedActors: {}
            };
    }

    unwindCore()
    {
        for (let actorId in this.localCache.actors)
        {
            if (!this.localCache.actors.hasOwnProperty(actorId))
                continue;

             this.localCache.actors[actorId].unwindActor();
        }

        this.core.setMemory(MEMORY_KEYWORD, this.memoryObject);
    }

    getFromId(actorId)
    {
        if(this.localCache.actors[actorId])
            return this.localCache.actors[actorId];

        if(this.localCache.outdatedActors[actorId])
        {
            this.core.startCpuLog("rewinding actor");
            let actor = this.localCache.outdatedActors[actorId];
            actor.rewindActor(actorId);
            this.localCache.actors[actorId] = actor;
            this.core.endCpuLog("rewinding actor");
            return actor;
        }

        let scriptName = this.getScriptname(actorId);

        if(typeof scriptName === UNDEFINED || scriptName === null)
        {
            this.core.logWarning("attempted to actors.getFromId with invalid details. Scriptname: " +
                scriptName + ", actorId: " + actorId);
            return null;
        }

        if(!this.localCache.classes[scriptName])
        {
            this.core.startCpuLog("load actor class script");
            try //insure that one failing actor can't take the core and thus all actors down.
            {
                this.localCache.classes[scriptName] = require(scriptName);
            }
            catch(error)
            {
                this.core.endCpuLog("load actor class script");
                this.core.logError("error requiring script " + scriptName, error);
                return;
            }
            this.core.endCpuLog("load actor class script");
        }

        this.core.startCpuLog("instanciate actor script");

        let ActorClass = this.localCache.classes[scriptName];
        let actor;

        if(DEBUG)
        {
            let DebugWrapperActor = require("DebugWrapperActor");
            actor = new DebugWrapperActor(ActorClass, actorId, this.core);
        }
        else
            actor = new ActorClass(this.core);

        this.core.endCpuLog("instanciate actor script");

        actor.rewindActor(actorId);

        this.localCache.actors[actorId] = actor;

        return actor;
    }

    createNew(scriptName, initFunc)
    {
        if(!this.localCache.classes[scriptName])
        {
            try //insure that one failing actor can't take the core and thus all actors down.
            {
                this.localCache.classes[scriptName] = require(scriptName);
            }
            catch(error)
            {
                this.core.logError("error requiring script " + scriptName, error);
                return;
            }
        }

        let actor;

        let ActorClass = this.localCache.classes[scriptName];

        let actorId = this.memoryObject.actorIdCounter++;

        if(DEBUG)
        {
            let DebugWrapperActor = require("DebugWrapperActor");
            actor = new DebugWrapperActor(ActorClass, actorId, this.core);
        }
        else
            actor = new ActorClass(this.core);

        this.memoryObject.scriptNameFromId[actorId] = scriptName;
        this.localCache.actors[actorId] = actor;

        actor.rewindActor(actorId);

        if(initFunc === null || initFunc === undefined)
            actor.initiateActor();
        else
            initFunc(actor);

        return  { actor: actor
                , id: actorId
                };
    }

    removeActor(actorId)
    {
        let actor = this.getFromId(actorId);
        if(actor)
            actor.removeActor();

        delete this.localCache.actors[actorId];
        delete this.localCache.outdatedActors[actorId];
        delete this.memoryObject.scriptNameFromId[actorId];
    }

    registerAlias(actorId, alias)
    {
        this.memoryObject.aliases[alias] = actorId;
    }

    getFromAlias(alias)
    {
        return this.getFromId(this.memoryObject.aliases[alias]);
    }

    removeAlias(alias)
    {
        delete this.memoryObject.aliases[alias];
    }

    getScriptname(actorId)
    {
        return this.memoryObject.scriptNameFromId[actorId];
    }

    resetActor(actorId)
    {
        let actor = this.getFromId(actorId);

        if(actor !== null)
            actor.resetActor();
    }

    resetAll()
    {
        let actorIds = Object.keys(this.memoryObject.scriptNameFromId);

        for(let idIndex in actorIds)
            this.resetActor(actorIds[idIndex]);
    }
};