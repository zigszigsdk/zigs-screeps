"use strict";

const MEMORY_KEY = "core:consoleExecuter";

module.exports = class ConsoleExecuter
{
	constructor(core)
    {
        this.core = core;
    }

    rewindCore()
    {
    	this.memoryObject = this.core.getMemory(MEMORY_KEY);
    }

    execute()
    {
        if(this.memoryObject.consoleInterfaceHook === null)
            return;

    	switch(this.memoryObject.consoleInterfaceHook)
    	{
            case 1:
                this.core.logger.memoryObject.errors = {};
                break;
            case 2:
                this.core.logger.memoryObject.warnings = {};
                break;
            case 3:
                this.core.resetActor(this.memoryObject.p1);
                break;
            case 4:
                this.core.removeActor(this.memoryObject.p1);
                break;
            case 5:
                this.core.resetAllActors();
                break;
            case 6:
                try
                {
                    console.log( ( eval(this.memoryObject.p1) )(this.core) );
                    //allows console user to execute arbritrary commands DURING a cycle rather than at the end of it.
                }
                catch(e)
                {
                    console.log("failed " + e);
                    this.core.logError("could not run consoleExecuter command\n" + this.memoryObject.p1, e);
                }
                break;
            case 7:
                this.core.resetService(this.memoryObject.p1);
                break;
            default:
                break;
        }
    }

    unwindCore()
    {
    	this.memoryObject = { consoleInterfaceHook: null };
    	this.core.setMemory(MEMORY_KEY, this.memoryObject);
    }

    hardResetCore(){}
};