"use strict";

const MEMORY_KEYWORD = "core:logger";

let memoryBank;
let memoryObject;


let stringHash = function(input){

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
};

module.exports =
{
    loggerStack: [],

    build: function(objectStore)
    {
        memoryBank = objectStore.memoryBank;
    },

    rewind: function()
    {
        memoryObject = memoryBank.get(MEMORY_KEYWORD);
        this.loggerStack = [];
    },

    unwind: function()
    {
        memoryBank.set(MEMORY_KEYWORD, memoryObject);
    },

    hardReset: function()
    {
        memoryObject =
            { printErrors: true
            , printWarnings: true
            , printProfiles: false
            , printMemory: false
            , printDisplay: false
            , printBoot: false
            , errors: {}
            , warnings: {}
            };
    },

    startCpuLog: function()
    {
        this.loggerStack.push(Game.cpu.getUsed());
    },

    endCpuLog: function(displayText)
    {
        if(!memoryObject.printProfiles)
            return;

        let newUsedCPU = Game.cpu.getUsed();

        console.log("[PROFILE] " + ("_".repeat(this.loggerStack.length-1)) + displayText + ": " +
            (newUsedCPU - this.loggerStack.pop()) + " CPU (total used: " + newUsedCPU + ")");

    },

    display: function(displayText)
    {
        if(memoryObject.printDisplay)
            console.log("[DISPLAY] " + displayText);
    },

    error: function(errorText)
    {
        let hash = stringHash(errorText);
        if(memoryObject.errors[hash])
            memoryObject.errors[hash].times++;
        else
            memoryObject.errors[hash] =
                { times: 1
                , text: errorText
                };
    },

    warning: function(warningText)
    {
        let hash = stringHash(warningText);
        if(memoryObject.warnings[hash])
            memoryObject.warnings[hash].times++;
        else
            memoryObject.warnings[hash] =
                { times: 1
                , text: warningText
                };
    },

    printErrorsAndWarnings: function()
    {
        if(memoryObject.printWarnings)
            for(let hash in memoryObject.warnings)
                console.log("[WARNING] (" + memoryObject.warnings[hash].times +
                    " time(s)) " + memoryObject.warnings[hash].text);

        if(memoryObject.printErrors)
            for(let hash in memoryObject.errors)
                console.log("[  ERROR] (" + memoryObject.errors[hash].times +
                    " time(s)) " + memoryObject.errors[hash].text);
    },

    memory: function(bankKey, bankMemory)
    {
        if(memoryObject.printMemory)
            console.log("[ MEMORY] " + bankKey + "=>" + bankMemory);
    },

    coreBoot: function(preScriptCPU, timesRecycled)
    {
        if(memoryBank.printBoot !== true)
            return;

        let part2;
        if(timesRecycled === 0)
            part2 = " on NEW cloud unit. Build took: " +
                (Game.cpu.getUsed() - preScriptCPU) +
                " CPU.";
        else
            part2 = " on " +
                timesRecycled +
                " times reused cloud unit. rewinding took: " +
                (Game.cpu.getUsed() - preScriptCPU) +
                " CPU.";

        console.log(
            "----------------------------------------Pre-script CPU usage: " +
            preScriptCPU +
            ". Entered tick: " +
            Game.time +
            part2
            );


    },
};