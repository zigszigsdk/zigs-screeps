"use strict";

const MEMORY_KEYWORD = "core:logger";
const CPU_TO_TRACE_MULTIPLIER = 1000000;

module.exports = class Logger
{
    constructor(core)
    {
        this.core = core;
    }

    rewindCore()
    {
        this.memoryObject = this.core.getMemory(MEMORY_KEYWORD);
        this.traceLog = [];
    }

    unwindCore()
    {
        if(this.memoryObject && this.memoryObject.printProfiles)
            console.log(JSON.stringify(this.traceLog));

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

    startCpuLog(name)
    {
        if(! this.memoryObject || ! this.memoryObject.printProfiles)
            return;

        this.traceLog.push(
            { name: name
            , ph: "B"
            , ts: Game.cpu.getUsed() * CPU_TO_TRACE_MULTIPLIER
            , pid: 0
            });
    }

    endCpuLog(name)
    {
        if(! this.memoryObject || ! this.memoryObject.printProfiles)
            return;

        this.traceLog.push(
            { name: name
            , ph: "E"
            , ts: Game.cpu.getUsed() * CPU_TO_TRACE_MULTIPLIER
            , pid: 0
            });
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