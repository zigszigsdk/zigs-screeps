"use strict";

module.exports = class ConsoleInterface
{
    replaceMemory(oldValue, newValue)
    {
        RawMemory.set(RawMemory.get().replace(oldValue, newValue));
    }

    printMemory()
    {
        console.log(RawMemory.get());
    }

    hardReset()
    {
        this.replaceMemory('"clearMemory":false', '"clearMemory":true');
    }

    enableWarnings()
    {
        this.replaceMemory('"printWarnings":false', '"printWarnings":true');
    }

    disableWarnings()
    {
        this.replaceMemory('"printWarnings":true', '"printWarnings":false');
    }

    enableErrors()
    {
        this.replaceMemory('"printErrors":false', '"printErrors":true');
    }

    disableErrors()
    {
        this.replaceMemory('"printErrors":true', '"printErrors":false');
    }

    enableProfiles()
    {
        this.replaceMemory('"printProfiles":false', '"printProfiles":true');
    }

    disableProfiles()
    {
        this.replaceMemory('"printProfiles":true', '"printProfiles":false');
    }

    enableMemories()
    {
        this.replaceMemory('"printMemory":false', '"printMemory":true');
    }

    disableMemories()
    {
        this.replaceMemory('"printMemory":true', '"printMemory":false');
    }

    enableDisplays()
    {
        this.replaceMemory('"printDisplay":false', '"printDisplay":true');
    }

    disableDisplays()
    {
        this.replaceMemory('"printDisplay":true', '"printDisplay":false');
    }

    enableBoots()
    {
        this.replaceMemory('"printBoot":false', '"printBoot":true');
    }

    disableBoots()
    {
        this.replaceMemory('"printBoot":true', '"printBoot":false');
    }

    enableAll()
    {
        this.enableWarnings();
        this.enableErrors();
        this.enableProfiles();
        this.enableMemories();
        this.enableDisplays();
        this.enableBoots();
    }

    disableAll()
    {
        this.disableWarnings();
        this.disableErrors();
        this.disableProfiles();
        this.disableMemories();
        this.disableDisplays();
        this.disableBoots();
    }

    clearErrors()
    {
        this.setCommand(1);
    }

    clearWarnings()
    {
        this.setCommand(2);
    }

    setCommand(value)
    {
        this.replaceMemory('{"consoleInterfaceHook":null}', '{"consoleInterfaceHook":' + value + '}');
    }

    clearFlags()
    {
        for(let flagName of Object.keys(Game.flags))
            Game.flags[flagName].remove();
    }

};