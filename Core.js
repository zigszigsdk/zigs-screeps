"use strict";

const MEMORY_KEY = "core:booter";
const CPU_SAFETY_RATIO = 0.8;

module.exports = class Core
{
	constructor()
	{
		let ConsoleInterface = require('ConsoleInterface');
	    global.CI = new ConsoleInterface();

		require('loadGlobals')();

        this.recycleCount = 0;

        let CoreInterface = require('CoreInterface');
        let coreInterface = new CoreInterface();


        let Logger = require('Logger');
        let EventQueue = require('EventQueue');
        let Subscriptions = require('Subscriptions');
        let MemoryBank = require('MemoryBank');
        let Actors = require('Actors');
        let Resetter = require('Resetter');
        let ConsoleExecuter = require('ConsoleExecuter');

        let DebugWrapperCore;
        if(DEBUG)
            DebugWrapperCore = require("DebugWrapperCore");

		this.logger = !DEBUG ? new Logger(coreInterface) : new DebugWrapperCore(Logger, coreInterface);
        coreInterface.setLogger(this.logger);

        this.eventQueue = !DEBUG ? new EventQueue(coreInterface) : new DebugWrapperCore(EventQueue, coreInterface);
        coreInterface.setEventQueue(this.eventQueue);

        this.subscriptions =
            DEBUG ? new Subscriptions(coreInterface) : new DebugWrapperCore(Subscriptions, coreInterface);
		coreInterface.setSubscriptions(this.subscriptions);

        this.memoryBank = DEBUG ? new MemoryBank(coreInterface) : new DebugWrapperCore(MemoryBank, coreInterface);
        coreInterface.setMemoryBank(this.memoryBank);

        this.actors = DEBUG ? new Actors(coreInterface) : new DebugWrapperCore(Actors, coreInterface);
        coreInterface.setActors(this.actors);

        this.resetter = new Resetter(coreInterface);
        this.consoleExecuter = new ConsoleExecuter(coreInterface);
	}

	boot()
	{
	    //if the memory isn't saved at some point in the loop, all data would be lost.
	    RawMemory.set(RawMemory.get()); //This makes sure it'll be preserved even at runtime error after this point.

	    let memBlank = RawMemory.get() === "";

        this.memoryBank.rewindCore();
        this.logger.rewindCore();
        this.subscriptions.rewindCore();
        this.eventQueue.rewindCore();
        this.actors.rewindCore();
        this.consoleExecuter.rewindCore();

        this.logger.coreBoot(this.recycleCount++);

        this.consoleExecuter.execute();

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
        this.logger.unwindCore();
        this.memoryBank.unwindCore();

	    this.logger.endCpuLog("Core:unwinding");
	}

	eventLoop()
	{
        let stop = false;

        while(!stop)
        {
            let event = this.eventQueue.next();
            if(event === null)
            {
                stop = true;
                break;
            }

            let subscribers = this.subscriptions.getSubscribersForEvent(event);

            if(subscribers === null || subscribers === undefined)
                continue;

            for (let actorId in subscribers)
            {
                if (!subscribers.hasOwnProperty(actorId))
                    continue;

                let actor = this.actors.getFromId(actorId);
                if(actor === null || actor === undefined)
                    continue;

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
                    this.logger.warning("aborted eventLoop due to low CPU. " + Game.cpu.getUsed() + " > " +
                        Game.cpu.tickLimit + " * " + CPU_SAFETY_RATIO);
                    stop = true;
                    break;
                }
            }
        }
    }
};