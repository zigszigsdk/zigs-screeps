"use strict";

const MEMORY_KEY = "core:booter";

module.exports = class Core
{
	constructor()
	{
		require('loadGlobals')();
		require('loadConfig')();
		require('loadData')();

		let ConsoleInterface = require('ConsoleInterface');
		let Logger = require('Logger');
		let EventQueue = require('EventQueue');
		let Subscriptions = require('Subscriptions');
		let MemoryBank = require('MemoryBank');
		let Actors = require('Actors');
		let Locator = require('Locator');
		let Resetter = require('Resetter');
		let ConsoleExecuter = require('ConsoleExecuter');

		global.CI = new ConsoleInterface();

		this.memoryBank = new MemoryBank();
		this.logger = new Logger(this.memoryBank);
		this.memoryBank.setLogger(this.logger);
		this.eventQueue = new EventQueue();
		this.subscriptions = new Subscriptions(this.memoryBank, this.logger);
		this.locator = new Locator();
		this.actors = new Actors(this.memoryBank, this.logger, this.locator);

		this.locator.setCoreAccess(	{ logger: this.logger
									, eventQueue: this.eventQueue
									, subscriptions: this.subscriptions
									, memoryBank: this.memoryBank
									, actors: this.actors
									});


		this.resetter = new Resetter(this.locator, this.actors);
		this.consoleExecuter = new ConsoleExecuter(this.memoryBank, this.locator, this.actors, this.logger);

		this.recycleCount = 0;
	}

	boot()
	{
		this.logger.startCpuLog("Core:boot");

		//if the memory isn't saved at some point in the loop, all data would be lost.
		RawMemory.set(RawMemory.get()); //This makes sure it'll be preserved even at runtime error after this point.

		let memBlank = RawMemory.get() === "";

		this.memoryBank.rewindCore();
		this.logger.rewindCore();
		this.locator.rewindCore();
		this.subscriptions.rewindCore();
		this.eventQueue.rewindCore();
		this.actors.rewindCore();

		this.logger.coreBoot(this.recycleCount++);

		try //make sure an invalid console command doesn't break the core.
		{
			this.consoleExecuter.rewindCore();
			this.consoleExecuter.execute();
		}
		catch(error)
		{
			this.logger.error("consoleExecuter", error);
		}

		this.memoryObject = this.memoryBank.getMemory(MEMORY_KEY);

		if(this.memoryObject.clearMemory !== false || memBlank)
		{
			this.memoryBank.hardResetCore();
			this.logger.hardResetCore();
			this.subscriptions.hardResetCore();
			this.actors.hardResetCore();
			this.resetter.hardResetCore();
			this.consoleExecuter.hardResetCore();

			this.memoryBank.setMemory(MEMORY_KEY, {clearMemory: false});
			this.logger.printHardReset();
		}
		else
		{
			this.logger.startCpuLog("Core:eventLoop");
			this.eventLoop();
			this.logger.endCpuLog("Core:eventLoop");
		}

		this.logger.startCpuLog("Core:unwinding");

		this.consoleExecuter.unwindCore();
		this.actors.unwindCore();
		this.subscriptions.unwindCore();
		this.locator.unwindCore();
		this.logger.unwindCore();
		this.memoryBank.unwindCore();

		this.logger.endCpuLog("Core:unwinding");

		this.logger.endCpuLog("Core:boot");

		this.logger.latePrints();
	}

	eventLoop()
	{
		let stop = false;

		while(!stop)
		{
			let event = this.eventQueue.next();

			this.logger.startCpuLog("event:" + event);

			if(event === null)
			{
				stop = true;
				this.logger.endCpuLog("event:" + event);
				break;
			}

			let subscribers = this.subscriptions.getSubscribersForEvent(event);

			if(subscribers === null || subscribers === undefined)
			{
				this.logger.endCpuLog("event:" + event);
				continue;
			}
			for (let actorId in subscribers)
			{
				if (!subscribers.hasOwnProperty(actorId))
					continue;

				let actor = this.actors.getFromId(actorId);

				if(isNullOrUndefined(actor))
				{
					this.subscriptions.unsubscribe(event, actorId);
					this.logger.warning("actor " + actorId + " didn't exit cleanly.");
					continue;
				}

				let callbackMethod = subscribers[actorId];

				try //if runtime error in one actor, the others will still run.
				{
					actor[callbackMethod](event);
				}
				catch(err)
				{
					let scriptName = this.actors.getScriptname(actorId);
					this.logger.error("In eventLoop, calling actor " + actorId +": " + scriptName + "." +
						callbackMethod + "(\"" + event + "\")\n", err);
				}

				if(Game.cpu.getUsed() > Game.cpu.tickLimit * CPU_SAFETY_RATIO)
				{
					this.logger.endCpuLog("event:" + event);
					stop = true;
					if(event !== EVENTS.EVERY_TICK_LATE)
						this.logger.warning("aborted eventLoop due to low CPU, during event: " + event);
					break;
				}
			}

			this.logger.endCpuLog("event:" + event);

		}
	}
};