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
        this.enableBoots();
    }

    disableAll()
    {
        this.disableWarnings();
        this.disableErrors();
        this.disableProfiles();
        this.disableMemories();
        this.disableBoots();
    }

    clearErrors()
    {
        this.setCommand(1, 0);
    }

    clearWarnings()
    {
        this.setCommand(2, 0);
    }

    resetActor(actorId)
    {
        this.setCommand(3, actorId);
    }


    setCommand(command, p1)
    {
        this.replaceMemory('{"consoleInterfaceHook":null}', '{"consoleInterfaceHook":' + command + ',"p1":' + p1 + '}');
    }

    clearFlags()
    {
        for(let flagName of Object.keys(Game.flags))
            Game.flags[flagName].remove();
    }

};