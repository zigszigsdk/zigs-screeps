"use strict";

const MEMORY_KEY = "core:booter";

let objectStore;
let eventLoop;
let logger;
let memoryBank;
let resetter;

let memoryObject;
let recycleCount = 0;

module.exports.loop = function ()
{
    let cpuStamp = Game.cpu.getUsed();

    //if the memory isn't saved at some point in the loop, all data would be lost.
    RawMemory.set(RawMemory.get()); //This makes sure it'll be preserved even at runtime error after this point.

    //console interface helper consoleInterface is loaded first such that the console interface still usable,
    //even during constant runtime errors (such as the game's CPU limit reached). Unfortunately the console commands
    //are read after module.exports.loop. uncomment return to use if the script completely blocks.
    global.CI = require('consoleInterface');
    //CI.hardReset(); return;

    let memBlank = RawMemory.get() === "";

    if(recycleCount === 0)
    {
        objectStore = require('objectStore');
        objectStore.build();

        logger = objectStore.logger;
        eventLoop = objectStore.eventLoop;
        memoryBank = objectStore.memoryBank;
        resetter = objectStore.resetter;

        logger.coreBoot(cpuStamp, recycleCount++);
    }
    else
    {
        objectStore.rewind();

        logger.coreBoot(cpuStamp, recycleCount++);
    }

    memoryObject = memoryBank.get(MEMORY_KEY);

    if(memoryObject.clearMemory !== false || memBlank)
    {
        objectStore.hardReset();
        memoryBank.set(MEMORY_KEY, {clearMemory: false});
        logger.printErrorsAndWarnings();
        objectStore.unwind();
        console.log("======================================================================");
        console.log("=========================HARD RESET PERFORMED=========================");
        console.log("======================================================================");
        return;
    }

    logger.startCpuLog();
    eventLoop.run();
    logger.endCpuLog("end of eventLoop");

    logger.startCpuLog();
    objectStore.unwind();
    logger.endCpuLog("end of unwinding");

    logger.printErrorsAndWarnings();
};