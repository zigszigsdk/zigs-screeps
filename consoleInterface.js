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

    removeActor(actorId)
    {
        this.setCommand(4, actorId);
    }

    resetAllActors()
    {
        this.setCommand(5, 0);
    }

    resetService(serviceName)
    {
        this.setCommand(7, serviceName);
    }

    manipulateCore(manipulationFunctionString)
    {
        this.setCommand(6, manipulationFunctionString);
    }

    adhocHauler(from, to, type, controlledRoomId, size)
    {
        this.setCommand(8, from, to, type, controlledRoomId, size);
    }

    setCommand(command, p1, p2, p3, p4, p5)
    {
        this.replaceMemory('{"consoleInterfaceHook":null}', JSON.stringify(
            { consoleInterfaceHook: command
            , p1: p1
            , p2: p2
            , p3: p3
            , p4: p4
            , p5: p5
            }));
    }

    clearFlags()
    {
        for(let flagName of Object.keys(Game.flags))
            Game.flags[flagName].remove();
    }

};