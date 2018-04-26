"use strict";

const MEMORY_KEYWORD = "core:actors";

module.exports = class Actors
{
	constructor(memoryBank, logger, locator)
	{
		this.memoryBank = memoryBank;
		this.logger = logger;
		this.locator = locator;

		this.localCache =
			{ actors: {}
			, classes: {}
			, outdatedActors: {}
			};
	}

	rewindCore()
	{
		this.memoryObject = this.memoryBank.getMemory(MEMORY_KEYWORD);

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

		this.memoryBank.setMemory(MEMORY_KEYWORD, this.memoryObject);
	}

	getFromId(actorId)
	{
		if(this.localCache.actors[actorId])
			return this.localCache.actors[actorId];

		if(this.localCache.outdatedActors[actorId])
		{
			this.logger.startCpuLog("rewinding actor");
			let actor = this.localCache.outdatedActors[actorId];
			try
			{
				actor.rewindActor(Number(actorId));
			}
			catch(e)
			{
				this.logger.error("Error rewinding actor: " + actorId, e);
			}
			this.localCache.actors[actorId] = actor;
			this.logger.endCpuLog("rewinding actor");
			return actor;
		}

		let scriptName = this.getScriptname(actorId);

		if(typeof scriptName === UNDEFINED || scriptName === null)
		{
			this.logger.warning("attempted to actors.getFromId with invalid details. Scriptname: " +
				scriptName + ", actorId: " + actorId);
			return null;
		}

		if(!this.localCache.classes[scriptName])
		{
			this.logger.startCpuLog("load actor class script");
			try //insure that one failing actor can't take the core and thus all actors down.
			{
				this.localCache.classes[scriptName] = require(scriptName);
			}
			catch(error)
			{
				this.logger.endCpuLog("load actor class script");
				this.logger.error("error requiring script " + scriptName, error);
				return;
			}
			this.logger.endCpuLog("load actor class script");
		}

		this.logger.startCpuLog("instanciate actor script");

		let ActorClass = this.localCache.classes[scriptName];
		let actor;

		try
		{
			actor = new ActorClass(this.locator);
		}
		catch(e)
		{
			this.logger.error("Error instantiating actor: " + scriptName, e);
			this.logger.endCpuLog("instanciate actor script");
			return;
		}

		this.logger.endCpuLog("instanciate actor script");

		try
		{
			actor.rewindActor(Number(actorId));
		}
		catch(e)
		{
			this.logger.error("Error rewinding actor: " + scriptName, e);
			return;
		}

		this.localCache.actors[actorId] = actor;

		return actor;
	}

	createNew(scriptName, initFunc)
	{
		if(!this.localCache.classes[scriptName])
		{
			try
			{
				this.localCache.classes[scriptName] = require(scriptName);
			}
			catch(error)
			{
				this.logger.error("error requiring script " + scriptName, error);
				return;
			}
		}

		let actor;

		let ActorClass = this.localCache.classes[scriptName];

		let actorId = this.memoryObject.actorIdCounter++;

		try
		{
			actor = new ActorClass(this.locator);
		}
		catch(e)
		{
			this.logger.error("Error instantiating actor: " + scriptName, e);
			return;
		}


		this.memoryObject.scriptNameFromId[actorId] = scriptName;
		this.localCache.actors[actorId] = actor;

		try
		{
			actor.rewindActor(Number(actorId));
		}
		catch(e)
		{
			this.logger.error("Error rewinding actor: " + scriptName, e);
			return;
		}

		try
		{
			if(initFunc === null || initFunc === undefined)
				actor.initiateActor();
			else
				initFunc(actor);
		}
		catch(e)
		{
			this.logger.error("Error initiating actor: " + scriptName, e);
			return;
		}

		return  { actor: actor
				, id: actorId
				};
	}

	removeActor(actorId)
	{
		let actor = this.getFromId(actorId);
		if(actor)
			try
			{
				actor.removeActor();
			}
			catch(e)
			{
				this.logger.error("Error removing actor: " + actorId, e);
				return;
			}

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
		if(isNullOrUndefined(actorId))
			return;

		let actor = this.getFromId(actorId);

		if(isUndefinedOrNull(actor))
			return;

		try
		{
			actor.resetActor();
		}
		catch(e)
		{
			this.logger.error("Error resetting actor: " + actorId, e);
		}
	}

	resetAll()
	{
		let actorIds = Object.keys(this.memoryObject.scriptNameFromId);

		for(let idIndex in actorIds)
			this.resetActor(actorIds[idIndex]);
	}
};