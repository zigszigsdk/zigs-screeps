"use strict";

const bankDelimiter = "||";
const kvpDelimiter = "|";

module.exports = class MemoryBank
{
    constructor(core)
    {
        this.core = core;
    }

    rewindCore()
    {
        let memoryString = RawMemory.get();

        let banksKvp = {};

        if(memoryString === null || memoryString === undefined || memoryString === "")
            return;

        let banks = memoryString.split(bankDelimiter);

        banks.forEach(function(bank)
        {
            let kvp = bank.split(kvpDelimiter);
            if(kvp.length !== 2)
                return;

            banksKvp[kvp[0]] = kvp[1];
        });

        this.banksKvp = banksKvp;
        RawMemory.set(JSON.stringify({creeps:{}}));
    }

    unwindCore()
    {
        let rawMemory = "";

        for (let bankKey in this.banksKvp)
        {
            if (!this.banksKvp.hasOwnProperty(bankKey) ||
                typeof this.banksKvp[bankKey] === "undefined" ||
                this.banksKvp[bankKey] === null ||
                this.banksKvp[bankKey] === "null"
            )
                continue;

            this.core.logMemory(bankKey, this.banksKvp[bankKey]);

            rawMemory += bankKey + kvpDelimiter + this.banksKvp[bankKey] + bankDelimiter;
        }

        RawMemory.set(rawMemory);
    }

    getMemory(bankKey)
    {
        if(typeof this.banksKvp !== 'undefined' && typeof this.banksKvp[bankKey] !== 'undefined')
            return JSON.parse(this.banksKvp[bankKey]);

        return {};
    }

    setMemory(bankKey, value)
    {
        if(bankKey === undefined || bankKey === null || bankKey === "")
            return;

        this.banksKvp[bankKey] = JSON.stringify(value);
    }

    erase(bankKey)
    {
        delete this.banksKvp[bankKey];
    }

    hardResetCore()
    {
        this.banksKvp = {};
        this.unwindCore();
    }
};