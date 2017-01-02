"use strict";
const bankDelimiter = "||";
const kvpDelimiter = "|";

let banksKvp;
let logger;

module.exports =
{
    build: function(objectStore)
    {
        logger = objectStore.logger;
    },

    rewind: function()
    {
        let memoryString = RawMemory.get();

        banksKvp = {};

        if(memoryString === null || memoryString === undefined || memoryString === "")
            return;

        let banks = memoryString.split(bankDelimiter);

        if(banks.indexOf("memoryBackup") !== -1)
        {
            console.log("recovering memoryBackup");
            //banks = Memory.memoryBackup.split(bankDelimiter);
        }
        banks.forEach(function(bank)
        {
            let kvp = bank.split(kvpDelimiter);
            if(kvp.length !== 2)
                return;

            banksKvp[kvp[0]] = kvp[1];
        });

        RawMemory.set(JSON.stringify({creeps:{}})); //memoryBackup: memoryString
    },

    unwind: function()
    {
        let rawMemory = "";

        for (let bankKey in banksKvp)
        {
            if (!banksKvp.hasOwnProperty(bankKey) ||
                typeof banksKvp[bankKey] === "undefined" ||
                banksKvp[bankKey] === null ||
                banksKvp[bankKey] === "null"
            )
                continue;

            logger.memory(bankKey, banksKvp[bankKey]);

            rawMemory += bankKey + kvpDelimiter + banksKvp[bankKey] + bankDelimiter;
        }

        RawMemory.set(rawMemory);
    },

    get: function(bankKey)
    {
        if(banksKvp[bankKey] !== undefined)
            return JSON.parse(banksKvp[bankKey]);

        return {};
    },

    set: function(bankKey, value)
    {
        if(bankKey === undefined || bankKey === null || bankKey === "")
            return;

        banksKvp[bankKey] = JSON.stringify(value);
    },

    erase: function(bankKey)
    {
        delete banksKvp[bankKey];
    },

    hardReset: function()
    {
        banksKvp = {};
        this.unwind();
    },
};