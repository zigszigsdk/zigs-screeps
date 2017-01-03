"use strict";

module.exports = {

    replaceMemory: function(oldValue, newValue)
    {
        RawMemory.set(RawMemory.get().replace(oldValue, newValue));
    },

    printMemory: function()
    {
        console.log(RawMemory.get());
    },

    hardReset: function()
    {
        this.replaceMemory('"clearMemory":false', '"clearMemory":true');
    },

    enableWarnings: function()
    {
        this.replaceMemory('"printWarnings":false', '"printWarnings":true');
    },

    disableWarnings: function()
    {
        this.replaceMemory('"printWarnings":true', '"printWarnings":false');
    },

    enableErrors: function()
    {
        this.replaceMemory('"printErrors":false', '"printErrors":true');
    },

    disableErrors: function()
    {
        this.replaceMemory('"printErrors":true', '"printErrors":false');
    },

    enableProfiles: function()
    {
        this.replaceMemory('"printProfiles":false', '"printProfiles":true');
    },

    disableProfiles: function()
    {
        this.replaceMemory('"printProfiles":true', '"printProfiles":false');
    },

    enableMemories: function()
    {
        this.replaceMemory('"printMemory":false', '"printMemory":true');
    },

    disableMemories: function()
    {
        this.replaceMemory('"printMemory":true', '"printMemory":false');
    },

    enableDisplays: function()
    {
        this.replaceMemory('"printDisplay":false', '"printDisplay":true');
    },

    disableDisplays: function()
    {
        this.replaceMemory('"printDisplay":true', '"printDisplay":false');
    },

    enableBoots: function()
    {
        this.replaceMemory('"printBoot":false', '"printBoot":true');
    },

    disableBoots: function()
    {
        this.replaceMemory('"printBoot":true', '"printBoot":false');
    },

    enableAll: function()
    {
        this.enableWarnings();
        this.enableErrors();
        this.enableProfiles();
        this.enableMemories();
        this.enableDisplays();
        this.enableBoots();
    },

    disableAll: function()
    {
        this.disableWarnings();
        this.disableErrors();
        this.disableProfiles();
        this.disableMemories();
        this.disableDisplays();
        this.disableBoots();
    },

    clearErrors: function()
    {
        let memoryBank = require('memoryBank');
        memoryBank.rewind();
        let memoryObject = memoryBank.get("core:logger");
        memoryObject.errors = {};
        memoryBank.set("core:logger", memoryObject);
        memoryBank.unwind();
    },

    clearWarnings: function()
    {
        let memoryBank = require('memoryBank');
        memoryBank.rewind();
        let memoryObject = memoryBank.get("core:logger");
        memoryObject.warnings = {};
        memoryBank.set("core:logger", memoryObject);
        memoryBank.unwind();
    },

    clearFlags: function()
    {
        for(let flagName of Object.keys(Game.flags))
            Game.flags[flagName].remove();
    },

};