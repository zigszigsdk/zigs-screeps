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
        global.CI = new ConsoleInterface();

        this.recycleCount = 0;

        let CoreInterface = require('CoreInterface');
        let coreInterface = new CoreInterface();


        let Logger = require('Logger');
        let EventQueue = require('EventQueue');
        let Subscriptions = require('Subscriptions');
        let MemoryBank = require('MemoryBank');
        let Actors = require('Actors');
        let Locator = require('Locator');
        let Resetter = require('Resetter');
        let ConsoleExecuter = require('ConsoleExecuter');

        let DebugWrapperCore;
        if(DEBUG)
        {
            DebugWrapperCore = require("DebugWrapperCore");
            this.logger = new DebugWrapperCore(Logger, coreInterface);
            coreInterface.setLogger(this.logger);

            this.eventQueue = new DebugWrapperCore(EventQueue, coreInterface);
            coreInterface.setEventQueue(this.eventQueue);

            this.subscriptions = new DebugWrapperCore(Subscriptions, coreInterface);
            coreInterface.setSubscriptions(this.subscriptions);

            this.memoryBank = new DebugWrapperCore(MemoryBank, coreInterface);
            coreInterface.setMemoryBank(this.memoryBank);

            this.actors = new DebugWrapperCore(Actors, coreInterface);
            coreInterface.setActors(this.actors);

            this.locator = new DebugWrapperCore(Locator, coreInterface);
            coreInterface.setLocator(this.locator);
        }
        else
        {
            this.logger = new Logger(coreInterface);
            coreInterface.setLogger(this.logger);

            this.eventQueue = new EventQueue(coreInterface);
            coreInterface.setEventQueue(this.eventQueue);

            this.subscriptions = new Subscriptions(coreInterface);
            coreInterface.setSubscriptions(this.subscriptions);

            this.memoryBank = new MemoryBank(coreInterface);
            coreInterface.setMemoryBank(this.memoryBank);

            this.actors = new Actors(coreInterface);
            coreInterface.setActors(this.actors);

            this.locator = new Locator(coreInterface);
            coreInterface.setLocator(this.locator);
        }

        this.resetter = new Resetter(coreInterface);
        this.consoleExecuter = new ConsoleExecuter(coreInterface);
	}

	boot()
	{
        this.logger.startCpuLog("Core:boot");

	    //if the memory isn't saved at some point in the loop, all data would be lost.
	    RawMemory.set(RawMemory.get()); //This makes sure it'll be preserved even at runtime error after this point.

        //return;

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