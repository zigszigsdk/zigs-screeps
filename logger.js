"use strict";

const MEMORY_KEYWORD = "core:logger";

module.exports = class Logger
{
    constructor(core)
    {
        this.loggerStack = [];
        this.core = core;
    }

    rewindCore()
    {
        this.memoryObject = this.core.getMemory(MEMORY_KEYWORD);
        this.loggerStack = [];
    }

    unwindCore()
    {
        this.printErrorsAndWarnings();
        this.core.setMemory(MEMORY_KEYWORD, this.memoryObject);
    }

    hardResetCore()
    {
        this.memoryObject =
            { printErrors: true
            , printWarnings: true
            , printProfiles: false
            , printMemory: false
            , printDisplay: false
            , printBoot: true
            , errors: {}
            , warnings: {}
            };
    }

    startCpuLog()
    {
        this.loggerStack.push(Game.cpu.getUsed());
    }

    endCpuLog(displayText)
    {
        if(!this.memoryObject.printProfiles)
            return;

        let newUsedCPU = Game.cpu.getUsed();

        console.log("[PROFILE] " + ("_".repeat(this.loggerStack.length-1)) + displayText + ": " +
            (newUsedCPU - this.loggerStack.pop()) + " CPU (total used: " + newUsedCPU + ")");

    }

    display(displayText)
    {
        if(this.memoryObject.printDisplay)
            console.log("[DISPLAY] " + displayText);
    }

    error(errorText, error)
    {
        let hash = this.stringHash(errorText);
        if(this.memoryObject.errors[hash])
            this.memoryObject.errors[hash].times++;
        else
            this.memoryObject.errors[hash] =
                { times: 1
                , text: errorText
                , error: this.stringifyError(error, null, '\n')
                };
    }

    warning(warningText)
    {
        let hash = this.stringHash(warningText);
        if(this.memoryObject.warnings[hash])
            this.memoryObject.warnings[hash].times++;
        else
            this.memoryObject.warnings[hash] =
                { times: 1
                , text: warningText
                };
    }

    printErrorsAndWarnings()
    {
        if(this.memoryObject.printWarnings)
            for(let hash in this.memoryObject.warnings)
                console.log("[WARNING] (" + this.memoryObject.warnings[hash].times +
                    " time(s)) " + this.memoryObject.warnings[hash].text);

        if(this.memoryObject.printErrors)
            for(let hash in this.memoryObject.errors)
                console.log("[  ERROR] (" + this.memoryObject.errors[hash].times +
                    " time(s)) " + this.memoryObject.errors[hash].text + "\n" + this.memoryObject.errors[hash].error);
    }

    memory(bankKey, bankMemory)
    {
        if(this.memoryObject.printMemory)
            console.log("[ MEMORY] " + bankKey + " => " + bankMemory);
    }

    coreBoot(timesRecycled)
    {
        if(this.memoryObject.printBoot !== true)
            return;

        let recyclesMessage;
        if(timesRecycled === 0)
            recyclesMessage = " on NEW cloud unit";
        else
            recyclesMessage = " on " + timesRecycled + " times reused cloud unit";

        console.log("=".repeat(60) + "Booted tick " + Game.time + recyclesMessage + "=".repeat(60));
    }

    stringHash(input)
    {
        let hash = 0;

        if (input.length === 0)
            return hash;

        for (let i = 0; i < input.length; i++)
        {
            let char = input.charCodeAt(i);
            hash = ((hash<<5)-hash)+char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return hash;
    }

    stringifyError(err, filter, space)
    {
        let plainObject = {};
        Object.getOwnPropertyNames(err).forEach(function(key)
        {
            plainObject[key] = err[key];
        });

        return JSON.stringify(plainObject, filter, space);
    }

    printHardReset()
    {
        console.log("======================================================================");
        console.log("=========================HARD RESET PERFORMED=========================");
        console.log("======================================================================");
    }

};