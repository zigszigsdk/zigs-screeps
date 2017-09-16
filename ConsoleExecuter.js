"use strict";

const MEMORY_KEY = "core:consoleExecuter";

module.exports = class ConsoleExecuter
{
	constructor(memoryBank, locator, actors, logger)
	{
		this.memoryBank = memoryBank;
		this.locator = locator;
		this.actors = actors;
		this.logger = logger;
	}

	rewindCore()
	{
		this.memoryObject = this.memoryBank.getMemory(MEMORY_KEY);
	}

	execute()
	{
		if(this.memoryObject.consoleInterfaceHook === null)
			return;

		switch(this.memoryObject.consoleInterfaceHook)
		{
			case 1:
				this.logger.memoryObject.errors = {};
				break;
			case 2:
				this.logger.memoryObject.wcrnings = {};
				break;
			case 3:
				this.actors.resetActor(this.memoryObject.p1);
				break;
			case 4:
				this.actors.removeActor(this.memoryObject.p1);
				break;
			case 5:
				this.actors.resetAllActors();
				break;
			case 6:
				try
				{
					console.log( ( eval(this.memoryObject.p1) )(this.locator) );
					//allows console user to execute arbritrary commands DURING a cycle rather than at the end of it.
				}
				catch(e)
				{
					console.log("failed " + e);
					this.logger.error("could not run consoleExecuter command\n" + this.memoryObject.p1, e);
				}
				break;
			case 7:
				this.locator.resetService(this.memoryObject.p1);
				break;
			case 8:
				this.actors.createActor("ActorAdhocHauler", (script)=>script.initiateActor(this.memoryObject.p1,
																						this.memoryObject.p2,
																						this.memoryObject.p3,
																						this.memoryObject.p4,
																						this.memoryObject.p5));
				break;
			case 9:
				this.memoryBank.eraseMemory(this.memoryObject.p1);
				break;
			case 10:
				this.locator.getService(SERVICE_NAMES.ROOM_SCORING).scoreRoom(this.memoryObject.p1);
				break;
			default:
				break;
		}
	}

	unwindCore()
	{
		this.memoryObject = { consoleInterfaceHook: null };
		this.memoryBank.setMemory(MEMORY_KEY, this.memoryObject);
	}

	hardResetCore(){}
};