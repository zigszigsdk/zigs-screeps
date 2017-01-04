"use strict";

const ALIAS = "roomStrategy";
const MAX_STEPS_REPEAT_FOR_EXTENSION_POS_CALC = 100;

let CreepBodyFactory = require('CreepBodyFactory');

module.exports = class ActorRoomUpgradeStrategy
{
    constructor(core)
    {
        this.core = core;
    }

    rewindActor(actorId)
    {
        this.actorId = actorId;
        this.bankKey = "actor:" + ALIAS + ":" + actorId;

        this.memoryObject = this.core.getMemory(this.bankKey);
    }

    initiateActor(roomName)
    {
        let sourcesInfo = {};
        let room = Game.rooms[roomName];
        let spawns = room.find(FIND_MY_SPAWNS);

        room.find(FIND_SOURCES).forEach(
            (source)=>
            {
                let miningPositions = this.filterBlockedPositions(this.getSurroundingPositions(source.pos));
                let bestPos = spawns[0].pos.findClosestByPath(miningPositions, {ignoreCreeps: true, ignoreRoads: true});

                sourcesInfo[source.id]=
                    { miners: 0
                    , recoveryMiners: 0
                    , haulers: 0
                    , containerBuilders: 0
                    , containerPos: [bestPos.x, bestPos.y, bestPos.roomName]
                    , fillers: 0
                    };
            });

        let ignoreAll = {ignoreCreeps: true, ignoreDestructibleStructures: true, ignoreRoads: true};
        let sourceNearestController = room.controller.pos.findClosestByPath(FIND_SOURCES, ignoreAll);
        let upgraderContainerPositions = this.filterBlockedPositions(this.upgraderContainerCandidates(room.controller.pos));
        let bestUpgraderContainerPos = sourceNearestController.pos.findClosestByPath(upgraderContainerPositions, ignoreAll);
        let ucp = [bestUpgraderContainerPos.x, bestUpgraderContainerPos.y, bestUpgraderContainerPos.roomName];

        let sourceNearestFirstSpawn = room.find(FIND_MY_SPAWNS)[0].pos.findClosestByPath(FIND_SOURCES, ignoreAll);

        this.memoryObject =
            { roomName: roomName
            , controllerId: Game.rooms[roomName].controller.id
            , sourcesInfo: sourcesInfo
            , sourceIdNearestFirstSpawn: sourceNearestFirstSpawn.id
            , sourceIdNearestController: sourceNearestController.id
            , firstSpawnId: room.find(FIND_MY_SPAWNS)[0].id
            , upgradeContainerPos: ucp
            , upgraders: 0
            , builders: 0
            , fixers: 0
            , latestSubActorId: null
            , monitoredRooms: [roomName]
            , unmonitoredRooms: []
            , extensionPositions: this.calcExtensionSpots(sourcesInfo[sourceNearestFirstSpawn.id].containerPos)
            };

        this.strategize();
    }

    unwindActor()
    {
        this.core.setMemory(this.bankKey, this.memoryObject);
    }

    removeActor()
    {
        this.core.eraseMemory(this.bankKey);
        this.memoryObject = null;
    }

    getSurroundingPositions(c)
    {
        return [ new RoomPosition(c.x-1, c.y-1, c.roomName)
               , new RoomPosition(c.x-1, c.y,   c.roomName)
               , new RoomPosition(c.x-1, c.y+1, c.roomName)
               , new RoomPosition(c.x,   c.y-1, c.roomName)
               , new RoomPosition(c.x,   c.y+1, c.roomName)
               , new RoomPosition(c.x+1, c.y-1, c.roomName)
               , new RoomPosition(c.x+1, c.y,   c.roomName)
               , new RoomPosition(c.x+1, c.y+1, c.roomName)];
    }

    upgraderContainerCandidates(c)
    {
        let results = [];

        for(let x = c.x-4; x <= c.x+4; x++)
        {
            if(x <= 0 || x >= 49)
                continue;

            for(let y = c.y-4; y <= c.y+4; y++)
            {
                if(y <= 0 || y >= 49)
                    continue;

                results.push(new RoomPosition(x, y, c.roomName));
            }
        }
        return results;
    }

    filterBlockedPositions(positions)
    {
        let result = [];

        positions.forEach((position) =>
        {
            if(position.lookFor(LOOK_TERRAIN)[0] !== "wall")
                result.push(position);
        });

        return result;
    }

    calcExtensionSpots(containerPos)
    {
        let isOpen = function(location)
        {
            let rp = new RoomPosition(location[0], location[1], location[2]);
            let structs = rp.lookFor(LOOK_STRUCTURES);
            let sites = rp.lookFor(LOOK_CONSTRUCTION_SITES);

            return (
                rp.lookFor(LOOK_TERRAIN)[0] !== "wall" &&
                location[0] < 49 && location[0] > 0 && //exclude edges
                location[1] < 49 && location[1] > 0 && //yes, 49 is the edge, not 50.
                (   structs.length === 0 ||
                    (   structs.length === 1 &&
                        structs[0].structureType === STRUCTURE_ROAD
                    )
                ) &&
                (   sites.length === 0 ||
                    (   sites.length === 1 &&
                        sites[0].structureType === STRUCTURE_ROAD)));

        };

        let getCardinals = (fromPos) =>
            [ [fromPos[0]-1, fromPos[1], fromPos[2]]
            , [fromPos[0]+1, fromPos[1], fromPos[2]]
            , [fromPos[0], fromPos[1]-1, fromPos[2]]
            , [fromPos[0], fromPos[1]+1, fromPos[2]] ];

        let getDiagonals = (fromPos) =>
            [ [fromPos[0]-1, fromPos[1]+1, fromPos[2]]
            , [fromPos[0]-1, fromPos[1]-1, fromPos[2]]
            , [fromPos[0]+1, fromPos[1]+1, fromPos[2]]
            , [fromPos[0]+1, fromPos[1]-1, fromPos[2]] ];

        let xFromList = (list, x) =>
                                _.filter(
                                    _.flatten(
                                        _.map(list, x))
                                    , isOpen);

        let cardinalsFromList = (list) => xFromList(list, (item)=>getCardinals(item));
        let diagonalsFromList = (list) => xFromList(list, (item)=>getDiagonals(item));

        let standingPositions = cardinalsFromList([containerPos]);
        let extensionPositions = [];

        let uniquePosCalc = (pos) => pos[0]*100 + pos[1] + pos[2];

        let steps;
        for(steps = 0; extensionPositions.length < 66 && steps < MAX_STEPS_REPEAT_FOR_EXTENSION_POS_CALC; steps++)
        {
            standingPositions = _.uniq(standingPositions.concat(diagonalsFromList(standingPositions)), uniquePosCalc);
            extensionPositions = _.uniq(extensionPositions.concat(cardinalsFromList(standingPositions)), uniquePosCalc);
        }

        if(steps === MAX_STEPS_REPEAT_FOR_EXTENSION_POS_CALC && extensionPositions.length < 66)
            this.core.logWarning("in ActorRoomUpgradeStratey.calcExtensionSpots: exceeded max allowed steps for repeat");

        let containerRp = new RoomPosition(containerPos[0], containerPos[1], containerPos[2]);

        extensionPositions = _.take(_.sortBy(extensionPositions, (pos) => containerRp.getRangeTo(pos[0], pos[1])), 66);

        return extensionPositions;
    }

    strategize()
    {
        this.cancelLatestSubActorIfNotSpawned();

        let spawnSource = this.memoryObject.sourcesInfo[this.memoryObject.sourceIdNearestFirstSpawn];

        if(spawnSource.recoveryMiners < 1 && spawnSource.miners < 1)
            return this.createRecoveryMiner(this.memoryObject.sourceIdNearestFirstSpawn);

        if(spawnSource.fillers < 1)
            return this.createFiller(this.memoryObject.sourceIdNearestFirstSpawn);

        if(spawnSource.miners < 1)
            return this.createMiner(this.memoryObject.sourceIdNearestFirstSpawn);

        let scp = spawnSource.containerPos;
        let spawnContainerList = new RoomPosition(scp[0], scp[1], scp[2]).lookFor(LOOK_STRUCTURES, FILTERS.CONTAINERS);

        if(spawnContainerList.length === 0 && spawnSource.containerBuilders < 1)
            return this.createMiningContainerBuilder(spawnSource.containerPos, this.memoryObject.sourceIdNearestFirstSpawn);

        let controllerSource = this.memoryObject.sourcesInfo[this.memoryObject.sourceIdNearestController];

        if(controllerSource.miners < 1)
            return this.createMiner(this.memoryObject.sourceIdNearestController);

        let controllerSourceContainerList = new RoomPosition(controllerSource.containerPos[0],
                                                            controllerSource.containerPos[1],
                                                            controllerSource.containerPos[2]
                                        ).lookFor(LOOK_STRUCTURES);
        if( (   controllerSourceContainerList.length === 0 ||
                (controllerSourceContainerList.length === 1 &&
                controllerSourceContainerList[0].structureType === STRUCTURE_ROAD)
            ) && this.memoryObject.builders < 1
        )
            return this.createMiningContainerBuilder(controllerSource.containerPos,
                                                    this.memoryObject.sourceIdNearestController);

        if(controllerSource.haulers < 1)
            return this.createSourceHauler(this.memoryObject.sourceIdNearestController);

        let controllerContainerList = new RoomPosition(this.memoryObject.upgradeContainerPos[0],
                                                        this.memoryObject.upgradeContainerPos[1],
                                                        this.memoryObject.upgradeContainerPos[2]
                                        ).lookFor(LOOK_STRUCTURES);

        if( (   controllerContainerList.length === 0 ||
                (controllerContainerList.length === 1 && controllerContainerList[0].structureType === STRUCTURE_ROAD)
            ) && this.memoryObject.builders < 1
        )
            return this.createControllerContainerBuilder();

        if(this.memoryObject.fixers < 1)
            this.createFixer();

        if(this.memoryObject.upgraders < 2)
            return this.createUpgrader();



        if(this.memoryObject.builders < 1)
        {
            let room = Game.rooms[this.memoryObject.roomName];

            let towers = room.find(FIND_MY_STRUCTURES, FILTERS.TOWERS);

            if(LEVEL_INDEX.MAX_TOWERS[room.controller.level] > towers.length)
                return this.createTowerBuilder();

            let extensions = room.find(FIND_MY_STRUCTURES, FILTERS.EXTENSIONS);

            if(LEVEL_INDEX.MAX_EXTENSIONS[room.controller.level] > extensions.length)
                return this.createExtensionBuilder();
        }

        if(Game.flags.Flag1)
            return this.createSoloDismantler(Game.flags.Flag1.pos);
        else if(Game.flags.Flag2)
            return this.createSoloDismantler(Game.flags.Flag2.pos);
        else if(Game.flags.Flag3)
            return this.createSoloDismantler(Game.flags.Flag3.pos);
        else if(Game.flags.Flag4)
            return this.createSoloDismantler(Game.flags.Flag4.pos);
        else if(Game.flags.Flag5)
            return this.createSoloDismantler(Game.flags.Flag5.pos);

        this.core.logWarning("end of ActorRoomUpgradeStrategy");
    }

    cancelLatestSubActorIfNotSpawned()
    {
        if(this.memoryObject.latestSubActorId === null)
            return;

        let subActor = this.core.actorFromId(this.memoryObject.latestSubActorId);
        if(subActor === null || subActor.pointerAt() !== 0)
            return;

        this.core.removeActor(this.memoryObject.latestSubActorId);

        this.memoryObject.latestSubActorId = null;
    }

    createMiner(sourceId)
    {
        let energy = Game.rooms[this.memoryObject.roomName].energyCapacityAvailable;

        let body = new CreepBodyFactory()
            .addPattern([MOVE], 1)
            .addPattern([WORK], 5)
            .addPattern([MOVE], 4)
            .setSort([MOVE, WORK])
            .setMaxCost(energy)
            .fabricate();

        let pos = this.memoryObject.sourcesInfo[sourceId].containerPos;

        this.createProceduralCreep( "miner", {sourceId: sourceId},
            [ [CREEP_INSTRUCTION.SPAWN_UNTIL_SUCCESS,     [this.memoryObject.firstSpawnId],   body            ] //0
            , [CREEP_INSTRUCTION.CALLBACK,                this.actorId,                       "minerSpawning" ] //1
            , [CREEP_INSTRUCTION.MOVE_TO_POSITION,        pos                                                 ] //2
            , [CREEP_INSTRUCTION.MINE_UNTIL_DEATH,        sourceId                                            ] //3
            , [CREEP_INSTRUCTION.CALLBACK,                this.actorId,                       "minerDied"     ] //4
            , [CREEP_INSTRUCTION.DESTROY_SCRIPT                                                             ] ] //5
        );
    }

    minerSpawning(infoObj)
    {
        this.memoryObject.sourcesInfo[infoObj.sourceId].miners++;
        this.strategize();
    }

    minerDied(infoObj)
    {
        this.memoryObject.sourcesInfo[infoObj.sourceId].miners--;
        this.strategize();
    }

    createRecoveryMiner(sourceId)
    {
        let energy = Game.rooms[this.memoryObject.roomName].energyCapacityAvailable;

        let body = new CreepBodyFactory()
            .addPattern([MOVE, WORK], 1)
            .setMaxCost(energy)
            .fabricate();

        let pos = this.memoryObject.sourcesInfo[sourceId].containerPos;

        this.createProceduralCreep( "rMiner", {sourceId: sourceId},
            [ [CREEP_INSTRUCTION.SPAWN_UNTIL_SUCCESS,     [this.memoryObject.firstSpawnId],   body                    ] //0
            , [CREEP_INSTRUCTION.CALLBACK,                this.actorId,                       "recoveryMinerSpawning" ] //1
            , [CREEP_INSTRUCTION.MOVE_TO_POSITION,        pos                                                         ] //2
            , [CREEP_INSTRUCTION.MINE_UNTIL_DEATH,        sourceId                                                    ] //3
            , [CREEP_INSTRUCTION.CALLBACK,                this.actorId,                       "recoveryMinerDied"     ] //4
            , [CREEP_INSTRUCTION.DESTROY_SCRIPT                                                                     ] ] //5
        );
    }

    recoveryMinerSpawning(infoObj)
    {
        this.memoryObject.sourcesInfo[infoObj.sourceId].recoveryMiners++;
        this.strategize();
    }

    recoveryMinerDied(infoObj)
    {
        this.memoryObject.sourcesInfo[infoObj.sourceId].recoveryMiners--;
        this.strategize();
    }

    createMiningContainerBuilder(pos, sourceId)
    {
        this.createProceduralCreep("containerBuilder", {sourceId: sourceId},
            [ [CREEP_INSTRUCTION.SPAWN_UNTIL_SUCCESS, [this.memoryObject.firstSpawnId], [MOVE, CARRY, WORK, WORK] ] //0
            , [CREEP_INSTRUCTION.CALLBACK, this.actorId, "miningContainerBuilderSpawning" ] //1
            , [CREEP_INSTRUCTION.PICKUP_AT_POS, pos, RESOURCE_ENERGY ] //2
            , [CREEP_INSTRUCTION.BUILD_UNTIL_EMPTY, pos, STRUCTURE_CONTAINER ] //3
            , [CREEP_INSTRUCTION.GOTO_IF_STRUCTURE_AT, pos, STRUCTURE_CONTAINER, 6 ] //4
            , [CREEP_INSTRUCTION.GOTO_IF_ALIVE, 2 ] //5
            , [CREEP_INSTRUCTION.RECYCLE_CREEP ] //6
            , [CREEP_INSTRUCTION.CALLBACK, this.actorId, "miningContainerBuilderDied" ] //7
            , [CREEP_INSTRUCTION.DESTROY_SCRIPT ] ] //8
        );
    }

    miningContainerBuilderSpawning(infoObj)
    {
        this.memoryObject.sourcesInfo[infoObj.sourceId].containerBuilders++;
        this.strategize();
    }

    miningContainerBuilderDied(infoObj)
    {
        this.memoryObject.sourcesInfo[infoObj.sourceId].containerBuilders--;
        this.strategize();
    }

    createControllerContainerBuilder()
    {
        let pos = this.memoryObject.upgradeContainerPos;

        this.createProceduralCreep("containerBuilder", {},
            [ [CREEP_INSTRUCTION.SPAWN_UNTIL_SUCCESS, [this.memoryObject.firstSpawnId], [MOVE, CARRY, WORK, WORK] ] //0
            , [CREEP_INSTRUCTION.CALLBACK, this.actorId, "builderspawning" ] //1
            , [CREEP_INSTRUCTION.PICKUP_AT_POS, pos, RESOURCE_ENERGY ] //2
            , [CREEP_INSTRUCTION.BUILD_UNTIL_EMPTY, pos, STRUCTURE_CONTAINER ] //3
            , [CREEP_INSTRUCTION.GOTO_IF_STRUCTURE_AT, pos, STRUCTURE_CONTAINER, 6   ] //4
            , [CREEP_INSTRUCTION.GOTO_IF_ALIVE, 2 ] //5
            , [CREEP_INSTRUCTION.RECYCLE_CREEP ] //6
            , [CREEP_INSTRUCTION.CALLBACK, this.actorId, "builderDied" ] //7
            , [CREEP_INSTRUCTION.DESTROY_SCRIPT ] ] //8
        );
    }

    createSourceHauler(sourceId)
    {
        let fromPos = this.memoryObject.sourcesInfo[sourceId].containerPos;
        let toPos = this.memoryObject.upgradeContainerPos;
        let body = [MOVE, MOVE, MOVE, CARRY, CARRY, CARRY];

        this.createProceduralCreep("sourceHauler", {sourceId: sourceId},
            [ [CREEP_INSTRUCTION.SPAWN_UNTIL_SUCCESS, [this.memoryObject.firstSpawnId], body ] //0
            , [CREEP_INSTRUCTION.CALLBACK, this.actorId, "sourceHaulerSpawning" ] //1
            , [CREEP_INSTRUCTION.PICKUP_AT_POS, fromPos, RESOURCE_ENERGY ] //2
            , [CREEP_INSTRUCTION.DEPOSIT_AT, toPos, RESOURCE_ENERGY ] //3
            , [CREEP_INSTRUCTION.GOTO_IF_ALIVE, 2 ] //4
            , [CREEP_INSTRUCTION.CALLBACK, this.actorId, "sourceHaulerDied" ] //5
            , [CREEP_INSTRUCTION.DESTROY_SCRIPT ] ] //6
        );
    }

    sourceHaulerSpawning(infoObj)
    {
        this.memoryObject.sourcesInfo[infoObj.sourceId].haulers++;
        this.strategize();
    }

    sourceHaulerDied(infoObj)
    {
        this.memoryObject.sourcesInfo[infoObj.sourceId].haulers--;
        this.strategize();
    }

    createUpgrader()
    {
        let energy = Game.rooms[this.memoryObject.roomName].energyCapacityAvailable;

        let body = new CreepBodyFactory()
            .addPattern([CARRY, WORK, MOVE], 1)
            .addPattern([WORK], 9)
            .addPattern([MOVE], 9)
            .addPattern([CARRY], 4)
            .setSort([MOVE, CARRY, WORK])
            .setMaxCost(energy)
            .fabricate();

        this.createProceduralCreep("Upgrader", {},
            [ [CREEP_INSTRUCTION.SPAWN_UNTIL_SUCCESS, [this.memoryObject.firstSpawnId], body ] //0
            , [CREEP_INSTRUCTION.CALLBACK, this.actorId, "upgraderSpawning" ] //1
            , [CREEP_INSTRUCTION.PICKUP_AT_POS, this.memoryObject.upgradeContainerPos, RESOURCE_ENERGY ] //2
            , [CREEP_INSTRUCTION.UPGRADE_UNTIL_EMPTY, this.memoryObject.controllerId ] //3
            , [CREEP_INSTRUCTION.GOTO_IF_ALIVE, 2 ] //4
            , [CREEP_INSTRUCTION.CALLBACK, this.actorId, "upgraderDied" ] //5
            , [CREEP_INSTRUCTION.DESTROY_SCRIPT ] ] //6
        );
    }

    upgraderSpawning(infoObj)
    {
        this.memoryObject.upgraders++;
        this.strategize();
    }

    upgraderDied (infoObj)
    {
        this.memoryObject.upgraders--;
        this.strategize();
    }

    createFiller(sourceId)
    {
        let source = Game.getObjectById(sourceId);
        let extensionIds = _.map(source.room.find(FIND_MY_STRUCTURES, FILTERS.EXTENSIONS), (x)=>x.id);
        let spawnIds = _.map(source.room.find(FIND_MY_SPAWNS), (x)=>x.id);
        let roomPowerFills = _.flatten([spawnIds, extensionIds]);

        let towerFills = _.map(source.room.find(FIND_MY_STRUCTURES, FILTERS.TOWERS), (x)=>x.id);

        let containerPos = this.memoryObject.sourcesInfo[sourceId].containerPos;
        let body = [CARRY, CARRY, CARRY, MOVE, MOVE, MOVE];
        this.createProceduralCreep("filler", {sourceId: sourceId},
            [ [CREEP_INSTRUCTION.SPAWN_UNTIL_SUCCESS,         [this.memoryObject.firstSpawnId],   body            ] //0
            , [CREEP_INSTRUCTION.CALLBACK,                    this.actorId,                       "fillerSpawning"] //1
            , [CREEP_INSTRUCTION.PICKUP_AT_POS,               containerPos,                       RESOURCE_ENERGY ] //2
            , [CREEP_INSTRUCTION.FILL_NEAREST_UNTIL_EMPTY,    RESOURCE_ENERGY,                    towerFills      ] //3
            , [CREEP_INSTRUCTION.FILL_NEAREST_UNTIL_EMPTY,    RESOURCE_ENERGY,                    roomPowerFills  ] //4
            , [CREEP_INSTRUCTION.GOTO_IF_ALIVE,               2                                                   ] //5
            , [CREEP_INSTRUCTION.CALLBACK,                    this.actorId,                       "fillerDied"    ] //6
            , [CREEP_INSTRUCTION.DESTROY_SCRIPT                                                                 ] ] //7
        );
    }

    fillerSpawning(infoObj)
    {
        this.memoryObject.sourcesInfo[infoObj.sourceId].fillers++;
        this.strategize();
    }

    fillerDied(infoObj)
    {
        this.memoryObject.sourcesInfo[infoObj.sourceId].fillers--;
        this.strategize();
    }

    createFixer()
    {
        let spawnContainer = this.memoryObject.sourcesInfo[this.memoryObject.sourceIdNearestFirstSpawn].containerPos;
        let controlSourceContainer = this.memoryObject.sourcesInfo[this.memoryObject.sourceIdNearestController].containerPos;

        this.createProceduralCreep("fixer", {},
            [ [CREEP_INSTRUCTION.SPAWN_UNTIL_SUCCESS, [this.memoryObject.firstSpawnId], [WORK, WORK, CARRY, MOVE] ] //0
            , [CREEP_INSTRUCTION.CALLBACK, this.actorId, "fixerSpawning"] //1

            , [CREEP_INSTRUCTION.PICKUP_AT_POS, spawnContainer, RESOURCE_ENERGY] //2
            , [CREEP_INSTRUCTION.FIX_AT, spawnContainer, STRUCTURE_CONTAINER ] //3
            , [CREEP_INSTRUCTION.GOTO_IF_NOT_FIXED, spawnContainer, STRUCTURE_CONTAINER, 2] //4

            , [CREEP_INSTRUCTION.PICKUP_AT_POS, controlSourceContainer, RESOURCE_ENERGY] //5
            , [CREEP_INSTRUCTION.FIX_AT, controlSourceContainer, STRUCTURE_CONTAINER] //6
            , [CREEP_INSTRUCTION.GOTO_IF_NOT_FIXED, controlSourceContainer, STRUCTURE_CONTAINER, 5] //7

            , [CREEP_INSTRUCTION.PICKUP_AT_POS, this.memoryObject.upgradeContainerPos, RESOURCE_ENERGY] //8
            , [CREEP_INSTRUCTION.FIX_AT, this.memoryObject.upgradeContainerPos, STRUCTURE_CONTAINER ] //9
            , [CREEP_INSTRUCTION.GOTO_IF_NOT_FIXED, this.memoryObject.upgradeContainerPos, STRUCTURE_CONTAINER, 8] //10

            , [CREEP_INSTRUCTION.GOTO_IF_ALIVE, 2] //11
            , [CREEP_INSTRUCTION.CALLBACK, this.actorId, "fixerDied"] //12
            , [CREEP_INSTRUCTION.DESTROY_SCRIPT] ] //13
        );
    }

    fixerSpawning(infoObj)
    {
        this.memoryObject.fixers++;
        this.strategize();
    }

    fixerDied(infoObj)
    {
        this.memoryObject.fixers--;
        this.strategize();
    }

    createSoloDismantler(targetRoomPos)
    {
        let energy = Game.rooms[this.memoryObject.roomName].energyCapacityAvailable;

        let body = new CreepBodyFactory()
            .addPattern([WORK, MOVE], 1)
            .addPattern([TOUGH], 48)
            .addReplace(TOUGH, MOVE, 24)
            .setSort([TOUGH, MOVE, WORK])
            .setMaxCost(energy)
            .fabricate();

        let targetPos = [targetRoomPos.x, targetRoomPos.y, targetRoomPos.roomName];

        this.createProceduralCreep("soloDismantler", {},
            [ [CREEP_INSTRUCTION.SPAWN_UNTIL_SUCCESS, [this.memoryObject.firstSpawnId],   body        ] //0
            , [CREEP_INSTRUCTION.CALLBACK,            this.actorId,                       "strategize"] //1
            , [CREEP_INSTRUCTION.DISMANTLE_AT,        targetPos                                       ] //2
            , [CREEP_INSTRUCTION.GOTO_IF_DEAD,        6                                               ] //3
            , [CREEP_INSTRUCTION.REMOVE_FLAG_AT,      targetPos                                       ] //4
            , [CREEP_INSTRUCTION.CALLBACK,            this.actorId,                       "strategize"] //5
            , [CREEP_INSTRUCTION.RECYCLE_CREEP                                                        ] //6
            , [CREEP_INSTRUCTION.DESTROY_SCRIPT                                                     ] ] //7
        );
    }

    createExtensionBuilder()
    {
        let energyPos = this.memoryObject.sourcesInfo[this.memoryObject.sourceIdNearestFirstSpawn].containerPos;

        let targetPos;

        for(let index in this.memoryObject.extensionPositions)
        {
            let pos = this.memoryObject.extensionPositions[index];
            let rp = new RoomPosition(pos[0], pos[1], pos[2]);
            let structs = rp.lookFor(LOOK_STRUCTURES);
            if(structs.length === 0 || (structs.length === 1 && structs[0].structureType === STRUCTURE_ROAD))
            {
                targetPos = pos;
                break;
            }
        }

        this.createProceduralCreep("extensionBuilder", {},
            [ [CREEP_INSTRUCTION.SPAWN_UNTIL_SUCCESS, [this.memoryObject.firstSpawnId], [MOVE, CARRY, WORK, WORK] ] //0
            , [CREEP_INSTRUCTION.CALLBACK, this.actorId, "builderSpawning" ] //1
            , [CREEP_INSTRUCTION.PICKUP_AT_POS, energyPos, RESOURCE_ENERGY ] //2
            , [CREEP_INSTRUCTION.BUILD_UNTIL_EMPTY, targetPos, STRUCTURE_EXTENSION ] //3
            , [CREEP_INSTRUCTION.GOTO_IF_STRUCTURE_AT, targetPos, STRUCTURE_EXTENSION, 6   ] //4
            , [CREEP_INSTRUCTION.GOTO_IF_ALIVE, 2 ] //5
            , [CREEP_INSTRUCTION.RECYCLE_CREEP ] //6
            , [CREEP_INSTRUCTION.CALLBACK, this.actorId, "builderDied" ] //7
            , [CREEP_INSTRUCTION.DESTROY_SCRIPT ] ] //8
        );
    }


    builderSpawning(infoObj)
    {
        this.memoryObject.builders++;
        this.strategize();
    }

    builderDied(infoObj)
    {
        this.memoryObject.builders--;
        this.strategize();
    }

    createTowerBuilder()
    {
        let energyPos = this.memoryObject.sourcesInfo[this.memoryObject.sourceIdNearestFirstSpawn].containerPos;

        let targetPos;

        for(let index in this.memoryObject.extensionPositions)
        {
            let pos = this.memoryObject.extensionPositions[index];
            let rp = new RoomPosition(pos[0], pos[1], pos[2]);
            let structs = rp.lookFor(LOOK_STRUCTURES);
            if(structs.length === 0 || (structs.length === 1 && structs[0].structureType === STRUCTURE_ROAD))
            {
                targetPos = pos;
                break;
            }
        }

        let body = [MOVE, CARRY, WORK, WORK];

        this.createProceduralCreep("towerBuilder", {towerPos: targetPos},
            [ [CREEP_INSTRUCTION.SPAWN_UNTIL_SUCCESS,     [this.memoryObject.firstSpawnId],   body                    ] //0
            , [CREEP_INSTRUCTION.CALLBACK,                this.actorId,                       "builderSpawning"       ] //1
            , [CREEP_INSTRUCTION.PICKUP_AT_POS,           energyPos,                          RESOURCE_ENERGY         ] //2
            , [CREEP_INSTRUCTION.BUILD_UNTIL_EMPTY,       targetPos,                          STRUCTURE_TOWER         ] //3
            , [CREEP_INSTRUCTION.GOTO_IF_STRUCTURE_AT,    targetPos,                          STRUCTURE_TOWER,    7   ] //4
            , [CREEP_INSTRUCTION.GOTO_IF_ALIVE,           2                                                           ] //5
            , [CREEP_INSTRUCTION.GOTO,                    7                                                           ] //6
            , [CREEP_INSTRUCTION.CALLBACK,                this.actorId,                       "towerCompleted"        ] //7
            , [CREEP_INSTRUCTION.RECYCLE_CREEP                                                                        ] //8
            , [CREEP_INSTRUCTION.CALLBACK,                this.actorId,                       "builderDied"           ] //9
            , [CREEP_INSTRUCTION.DESTROY_SCRIPT                                                                     ] ] //10
        );
    }

    towerCompleted(infoObj)
    {
        this.core.createActor("ActorNaiveTower", (script)=>script.initiateActor(infoObj.towerPos));
    }

    takeAffordableBody(fullBody)
    {
        let bodypartPrice = ((part) =>
        {
            switch(part)
            {
                case MOVE:          return  50;
                case CARRY:         return  50;
                case WORK:          return 100;
                case ATTACK:        return  80;
                case RANGED_ATTACK: return 150;
                case HEAL:          return 250;
                case CLAIM:         return 600;
                case TOUGH:         return  10;
                default: return Number.MAX_SAFE_INTEGER;}});

        let maxPrice = Game.rooms[this.memoryObject.roomName].energyCapacityAvailable;
        let price = 0;
        let result = [];

        let next;
        while(next = fullBody.pop())
        {
            price += bodypartPrice(next);
            if(price <= maxPrice)
                result.push(next);
            else
                break;
        }

        return result;
    }

    createProceduralCreep(creepName, callbackStamp, instructions)
    {
        let actorInfo = this.core.createActor("ActorProceduralCreep",
            (script)=>script.initiateActor(creepName, callbackStamp, instructions));

        this.memoryObject.latestSubActorId = actorInfo.id;

        return actorInfo.id;
    }
};