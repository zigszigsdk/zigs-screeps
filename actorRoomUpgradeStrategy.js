"use strict";

const ALIAS = "roomStrategy";
const MAX_STEPS_REPEAT_FOR_EXTENSION_POS_CALC = 100;

let CreepBodyFactory = require('CreepBodyFactory');


let FILTER_CONTAINER = {filter: (x)=>x.structureType === STRUCTURE_CONTAINER};
let FILTER_EXTENSIONS = {filter: (x)=>x.structureType === STRUCTURE_EXTENSION};
let FILTER_TOWERS = {filter: (x)=>x.structureType === STRUCTURE_TOWER};

//  room level                    0,   1,   2,   3,   4,   5,   6,   7,   8
let maxExtensionsByLevel =     [  0,   0,   5,  10,  20,  30,  40,  50,  60];
let extensionCapacityByLevel = [  0,   0,  50,  50,  50,  50,  50, 100, 200];
let maxTowersByLevel =         [  0,   0,   0,   1,   1,   2,   2,   3,   6];

let INSTRUCTION =
    { SPAWN_UNTIL_SUCCESS: "spawnUntilSucess"
    , CALLBACK: "callback"
    , MINE_UNTIL_FULL: "mineUntilFull"
    , UPGRADE_UNTIL_EMPTY: "upgradeUntilEmpty"
    , GOTO_IF_ALIVE: "gotoIfAlive"
    , DESTROY_SCRIPT: "destroyScript"
    , PICKUP_AT_POS: "pickupAtPos"
    , BUILD_UNTIL_EMPTY: "buildUntilEmpty"
    , GOTO_IF_STRUCTURE_AT: "gotoIfStructureAt"
    , RECYCLE_CREEP: "recycleCreep"
    , MOVE_TO_POSITION: "moveToPosition"
    , MINE_UNTIL_DEATH: "mineUntilDeath"
    , FILL_NEAREST_UNTIL_EMPTY: "fillNearestUntilEmpty"
    , DEPOSIT_AT: "depositAt"
    , DISMANTLE_AT: "dismantleAt"
    , FIX_AT: "fixAt"
    , GOTO_IF_NOT_FIXED: "gotoIfNotFixed"
    , REMOVE_FLAG_AT: "removeFlagAt"
    };

module.exports = function(objectStore)
{
    this.memoryBank = objectStore.memoryBank;
    this.subscriptions = objectStore.subscriptions;
    this.actors = objectStore.actors;
    this.logger = objectStore.logger;

    this.rewind = function(actorId)
    {
        this.actorId = actorId;
        this.bankKey = "actor:" + ALIAS + ":" + actorId;

        this.memoryObject = this.memoryBank.get(this.bankKey);
    };

    this.getSurroundingPositions = function(c)
    {
        return [ new RoomPosition(c.x-1, c.y-1, c.roomName)
               , new RoomPosition(c.x-1, c.y,   c.roomName)
               , new RoomPosition(c.x-1, c.y+1, c.roomName)
               , new RoomPosition(c.x,   c.y-1, c.roomName)
               , new RoomPosition(c.x,   c.y+1, c.roomName)
               , new RoomPosition(c.x+1, c.y-1, c.roomName)
               , new RoomPosition(c.x+1, c.y,   c.roomName)
               , new RoomPosition(c.x+1, c.y+1, c.roomName)];
    };

    this.upgraderContainerCandidates = function(c)
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
    };

    this.filterBlockedPositions = function(positions)
    {
        let result = [];

        positions.forEach((position) =>
        {
            if(position.lookFor(LOOK_TERRAIN)[0] !== "wall")
                result.push(position);
        });

        return result;
    };

    this.init = function(roomName)
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
            , upgradeContainerBuilders: 0
            , upgraders: 0
            , builders: 0
            , fixers: 0
            , latestSubActorId: null
            , monitoredRooms: [roomName]
            , unmonitoredRooms: []
            , extensionPositions: this.calcExtensionSpots(sourcesInfo[sourceNearestFirstSpawn.id].containerPos)
            };

        this.strategize();
    };

    this.calcExtensionSpots = function(containerPos)
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
            this.logger.warning("in actorRoomUpgradeStratey.calcExtensionSpots: exceeded max allowed steps for repeat");

        let containerRp = new RoomPosition(containerPos[0], containerPos[1], containerPos[2]);

        extensionPositions = _.take(_.sortBy(extensionPositions, (pos) => containerRp.getRangeTo(pos[0], pos[1])), 66);

        return extensionPositions;
    };

    this.strategize = function()
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
        let spawnContainerList = new RoomPosition(scp[0], scp[1], scp[2]).lookFor(LOOK_STRUCTURES, FILTER_CONTAINER);

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
            ) && this.memoryObject.upgradeContainerBuilders < 1
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
            ) && this.memoryObject.upgradeContainerBuilders < 1
        )
            return this.createControllerContainerBuilder();

        if(this.memoryObject.fixers < 1)
            this.createFixer();

        if(this.memoryObject.upgraders < 2)
            return this.createUpgrader();



        if(this.memoryObject.builders < 1)
        {
            let room = Game.rooms[this.memoryObject.roomName];

            let towers = room.find(FIND_MY_STRUCTURES, FILTER_TOWERS);

            if(maxTowersByLevel[room.controller.level] > towers.length)
                return this.createTowerBuilder();

            let extensions = room.find(FIND_MY_STRUCTURES, FILTER_EXTENSIONS);

            if(maxExtensionsByLevel[room.controller.level] > extensions.length)
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

        this.logger.warning("end of actorRoomUpgradeStrategy");
    };

    this.cancelLatestSubActorIfNotSpawned = function()
    {
        if(this.memoryObject.latestSubActorId === null)
            return;

        let subActor = this.actors.getFromId(this.memoryObject.latestSubActorId);
        if(subActor === null || subActor.pointerAt() !== 0)
            return;

        this.actors.removeActor(this.memoryObject.latestSubActorId);

        this.memoryObject.latestSubActorId = null;
    };

    this.createMiner = function(sourceId)
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
            [ [INSTRUCTION.SPAWN_UNTIL_SUCCESS,     [this.memoryObject.firstSpawnId],   body            ] //0
            , [INSTRUCTION.CALLBACK,                this.actorId,                       "minerSpawning" ] //1
            , [INSTRUCTION.MOVE_TO_POSITION,        pos                                                 ] //2
            , [INSTRUCTION.MINE_UNTIL_DEATH,        sourceId                                            ] //3
            , [INSTRUCTION.CALLBACK,                this.actorId,                       "minerDied"     ] //4
            , [INSTRUCTION.DESTROY_SCRIPT                                                             ] ] //5
        );
    };

    this.minerSpawning = function(infoObj)
    {
        this.memoryObject.sourcesInfo[infoObj.sourceId].miners++;
        this.strategize();
    };

    this.minerDied = function(infoObj)
    {
        this.memoryObject.sourcesInfo[infoObj.sourceId].miners--;
        this.strategize();
    };

    this.createRecoveryMiner = function(sourceId)
    {
        let energy = Game.rooms[this.memoryObject.roomName].energyCapacityAvailable;

        let body = new CreepBodyFactory()
            .addPattern([MOVE, WORK], 1)
            .setMaxCost(energy)
            .fabricate();

        let pos = this.memoryObject.sourcesInfo[sourceId].containerPos;

        this.createProceduralCreep( "rMiner", {sourceId: sourceId},
            [ [INSTRUCTION.SPAWN_UNTIL_SUCCESS,     [this.memoryObject.firstSpawnId],   body                    ] //0
            , [INSTRUCTION.CALLBACK,                this.actorId,                       "recoveryMinerSpawning" ] //1
            , [INSTRUCTION.MOVE_TO_POSITION,        pos                                                         ] //2
            , [INSTRUCTION.MINE_UNTIL_DEATH,        sourceId                                                    ] //3
            , [INSTRUCTION.CALLBACK,                this.actorId,                       "recoveryMinerDied"     ] //4
            , [INSTRUCTION.DESTROY_SCRIPT                                                                     ] ] //5
        );
    };

    this.recoveryMinerSpawning = function(infoObj)
    {
        this.memoryObject.sourcesInfo[infoObj.sourceId].recoveryMiners++;
        this.strategize();
    };

    this.recoveryMinerDied = function(infoObj)
    {
        this.memoryObject.sourcesInfo[infoObj.sourceId].recoveryMiners--;
        this.strategize();
    };

    this.createMiningContainerBuilder = function(pos, sourceId)
    {
        this.createProceduralCreep("containerBuilder", {sourceId: sourceId},
            [ [INSTRUCTION.SPAWN_UNTIL_SUCCESS, [this.memoryObject.firstSpawnId], [MOVE, CARRY, WORK, WORK] ] //0
            , [INSTRUCTION.CALLBACK, this.actorId, "miningContainerBuilderSpawning" ] //1
            , [INSTRUCTION.PICKUP_AT_POS, pos, RESOURCE_ENERGY ] //2
            , [INSTRUCTION.BUILD_UNTIL_EMPTY, pos, STRUCTURE_CONTAINER ] //3
            , [INSTRUCTION.GOTO_IF_STRUCTURE_AT, pos, STRUCTURE_CONTAINER, 6 ] //4
            , [INSTRUCTION.GOTO_IF_ALIVE, 2 ] //5
            , [INSTRUCTION.RECYCLE_CREEP ] //6
            , [INSTRUCTION.CALLBACK, this.actorId, "miningContainerBuilderDied" ] //7
            , [INSTRUCTION.DESTROY_SCRIPT ] ] //8
        );
    };

    this.miningContainerBuilderSpawning = function(infoObj)
    {
        this.memoryObject.sourcesInfo[infoObj.sourceId].containerBuilders++;
        this.strategize();
    };

    this.miningContainerBuilderDied = function(infoObj)
    {
        this.memoryObject.sourcesInfo[infoObj.sourceId].containerBuilders--;
        this.strategize();
    };

    this.createControllerContainerBuilder = function()
    {
        let pos = this.memoryObject.upgradeContainerPos;

        this.createProceduralCreep("containerBuilder", {},
            [ [INSTRUCTION.SPAWN_UNTIL_SUCCESS, [this.memoryObject.firstSpawnId], [MOVE, CARRY, WORK, WORK] ] //0
            , [INSTRUCTION.CALLBACK, this.actorId, "upgradeContainerBuilderspawning" ] //1
            , [INSTRUCTION.PICKUP_AT_POS, pos, RESOURCE_ENERGY ] //2
            , [INSTRUCTION.BUILD_UNTIL_EMPTY, pos, STRUCTURE_CONTAINER ] //3
            , [INSTRUCTION.GOTO_IF_STRUCTURE_AT, pos, STRUCTURE_CONTAINER, 6   ] //4
            , [INSTRUCTION.GOTO_IF_ALIVE, 2 ] //5
            , [INSTRUCTION.RECYCLE_CREEP ] //6
            , [INSTRUCTION.CALLBACK, this.actorId, "controllerContainerBuilderDied" ] //7
            , [INSTRUCTION.DESTROY_SCRIPT ] ] //8
        );
    };

    this.upgradeContainerBuilderspawning = function(infoObj)
    {
        this.memoryObject.upgradeContainerBuilders++;
        this.strategize();
    };

    this.controllerContainerBuilderDied = function(infoObj)
    {
        this.memoryObject.upgradeContainerBuilders--;
        this.strategize();
    };

    this.createSourceHauler = function(sourceId)
    {
        let fromPos = this.memoryObject.sourcesInfo[sourceId].containerPos;
        let toPos = this.memoryObject.upgradeContainerPos;
        let body = [MOVE, MOVE, MOVE, CARRY, CARRY, CARRY];

        this.createProceduralCreep("sourceHauler", {sourceId: sourceId},
            [ [INSTRUCTION.SPAWN_UNTIL_SUCCESS, [this.memoryObject.firstSpawnId], body ] //0
            , [INSTRUCTION.CALLBACK, this.actorId, "sourceHaulerSpawning" ] //1
            , [INSTRUCTION.PICKUP_AT_POS, fromPos, RESOURCE_ENERGY ] //2
            , [INSTRUCTION.DEPOSIT_AT, toPos, RESOURCE_ENERGY ] //3
            , [INSTRUCTION.GOTO_IF_ALIVE, 2 ] //4
            , [INSTRUCTION.CALLBACK, this.actorId, "sourceHaulerDied" ] //5
            , [INSTRUCTION.DESTROY_SCRIPT ] ] //6
        );
    };

    this.sourceHaulerSpawning = function(infoObj)
    {
        this.memoryObject.sourcesInfo[infoObj.sourceId].haulers++;
        this.strategize();
    };

    this.sourceHaulerDied = function(infoObj)
    {
        this.memoryObject.sourcesInfo[infoObj.sourceId].haulers--;
        this.strategize();
    };

    this.createUpgrader = function()
    {
        let energy = Game.rooms[this.memoryObject.roomName].energyCapacityAvailable;

        let body = new CreepBodyFactory()
            .addPattern([CARRY, WORK, MOVE], 1)
            .addPattern([WORK], 9)
            .setSort([MOVE, WORK, CARRY])
            .setMaxCost(energy)
            .fabricate();

        this.createProceduralCreep("Upgrader", {},
            [ [INSTRUCTION.SPAWN_UNTIL_SUCCESS, [this.memoryObject.firstSpawnId], body ] //0
            , [INSTRUCTION.CALLBACK, this.actorId, "upgraderSpawning" ] //1
            , [INSTRUCTION.PICKUP_AT_POS, this.memoryObject.upgradeContainerPos, RESOURCE_ENERGY ] //2
            , [INSTRUCTION.UPGRADE_UNTIL_EMPTY, this.memoryObject.controllerId ] //3
            , [INSTRUCTION.GOTO_IF_ALIVE, 2 ] //4
            , [INSTRUCTION.CALLBACK, this.actorId, "upgraderDied" ] //5
            , [INSTRUCTION.DESTROY_SCRIPT ] ] //6
        );
    };

    this.upgraderSpawning = function(infoObj)
    {
        this.memoryObject.upgraders++;
        this.strategize();
    };

    this.upgraderDied  = function(infoObj)
    {
        this.memoryObject.upgraders--;
        this.strategize();
    };

    this.createFiller = function(sourceId)
    {
        let source = Game.getObjectById(sourceId);
        let extensionIds = _.map(source.room.find(FIND_MY_STRUCTURES, FILTER_EXTENSIONS), (x)=>x.id);
        let spawnIds = _.map(source.room.find(FIND_MY_SPAWNS), (x)=>x.id);
        let roomPowerFills = _.flatten([spawnIds, extensionIds]);

        let towerFills = _.map(source.room.find(FIND_MY_STRUCTURES, FILTER_TOWERS), (x)=>x.id);

        let containerPos = this.memoryObject.sourcesInfo[sourceId].containerPos;

        this.createProceduralCreep("filler", {sourceId: sourceId},
            [ [INSTRUCTION.SPAWN_UNTIL_SUCCESS,         [this.memoryObject.firstSpawnId],   [MOVE, CARRY]   ] //0
            , [INSTRUCTION.CALLBACK,                    this.actorId,                       "fillerSpawning"] //1
            , [INSTRUCTION.PICKUP_AT_POS,               containerPos,                       RESOURCE_ENERGY ] //2
            , [INSTRUCTION.FILL_NEAREST_UNTIL_EMPTY,    RESOURCE_ENERGY,                    towerFills      ] //3
            , [INSTRUCTION.FILL_NEAREST_UNTIL_EMPTY,    RESOURCE_ENERGY,                    roomPowerFills  ] //4
            , [INSTRUCTION.GOTO_IF_ALIVE,               2                                                   ] //5
            , [INSTRUCTION.CALLBACK,                    this.actorId,                       "fillerDied"    ] //6
            , [INSTRUCTION.DESTROY_SCRIPT                                                                 ] ] //7
        );
    };

    this.fillerSpawning = function(infoObj)
    {
        this.memoryObject.sourcesInfo[infoObj.sourceId].fillers++;
        this.strategize();
    };

    this.fillerDied = function(infoObj)
    {
        this.memoryObject.sourcesInfo[infoObj.sourceId].fillers--;
        this.strategize();
    };

    this.createFixer = function()
    {
        let spawnContainer = this.memoryObject.sourcesInfo[this.memoryObject.sourceIdNearestFirstSpawn].containerPos;
        let controlSourceContainer = this.memoryObject.sourcesInfo[this.memoryObject.sourceIdNearestController].containerPos;

        this.createProceduralCreep("fixer", {},
            [ [INSTRUCTION.SPAWN_UNTIL_SUCCESS, [this.memoryObject.firstSpawnId], [WORK, WORK, CARRY, MOVE] ] //0
            , [INSTRUCTION.CALLBACK, this.actorId, "fixerSpawning"] //1

            , [INSTRUCTION.PICKUP_AT_POS, spawnContainer, RESOURCE_ENERGY] //2
            , [INSTRUCTION.FIX_AT, spawnContainer, STRUCTURE_CONTAINER ] //3
            , [INSTRUCTION.GOTO_IF_NOT_FIXED, spawnContainer, STRUCTURE_CONTAINER, 2] //4

            , [INSTRUCTION.PICKUP_AT_POS, controlSourceContainer, RESOURCE_ENERGY] //5
            , [INSTRUCTION.FIX_AT, controlSourceContainer, STRUCTURE_CONTAINER] //6
            , [INSTRUCTION.GOTO_IF_NOT_FIXED, controlSourceContainer, STRUCTURE_CONTAINER, 5] //7

            , [INSTRUCTION.PICKUP_AT_POS, this.memoryObject.upgradeContainerPos, RESOURCE_ENERGY] //8
            , [INSTRUCTION.FIX_AT, this.memoryObject.upgradeContainerPos, STRUCTURE_CONTAINER ] //9
            , [INSTRUCTION.GOTO_IF_NOT_FIXED, this.memoryObject.upgradeContainerPos, STRUCTURE_CONTAINER, 8] //10

            , [INSTRUCTION.GOTO_IF_ALIVE, 2] //11
            , [INSTRUCTION.CALLBACK, this.actorId, "fixerDied"] //12
            , [INSTRUCTION.DESTROY_SCRIPT] ] //13
        );
    };

    this.fixerSpawning = function(infoObj)
    {
        this.memoryObject.fixers++;
        this.strategize();
    };

    this.fixerDied = function(infoObj)
    {
        this.memoryObject.fixers--;
        this.strategize();
    };

    this.createSoloDismantler = function(targetRoomPos)
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
            [ [INSTRUCTION.SPAWN_UNTIL_SUCCESS, [this.memoryObject.firstSpawnId], body ] //0
            , [INSTRUCTION.CALLBACK, this.actorId, "strategize"] //1
            , [INSTRUCTION.DISMANTLE_AT, targetPos ] //2
            , [INSTRUCTION.REMOVE_FLAG_AT, targetPos] //3
            , [INSTRUCTION.RECYCLE_CREEP ] //4
            , [INSTRUCTION.DESTROY_SCRIPT ] ] //5
        );
    };

    this.createExtensionBuilder = function()
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
            [ [INSTRUCTION.SPAWN_UNTIL_SUCCESS, [this.memoryObject.firstSpawnId], [MOVE, CARRY, WORK, WORK] ] //0
            , [INSTRUCTION.CALLBACK, this.actorId, "extensionBuilderSpawning" ] //1
            , [INSTRUCTION.PICKUP_AT_POS, energyPos, RESOURCE_ENERGY ] //2
            , [INSTRUCTION.BUILD_UNTIL_EMPTY, targetPos, STRUCTURE_EXTENSION ] //3
            , [INSTRUCTION.GOTO_IF_STRUCTURE_AT, targetPos, STRUCTURE_EXTENSION, 6   ] //4
            , [INSTRUCTION.GOTO_IF_ALIVE, 2 ] //5
            , [INSTRUCTION.RECYCLE_CREEP ] //6
            , [INSTRUCTION.CALLBACK, this.actorId, "extensionBuilderDied" ] //7
            , [INSTRUCTION.DESTROY_SCRIPT ] ] //8
        );
    };


    this.builderSpawning = function(infoObj)
    {
        this.memoryObject.builders++;
        this.strategize();
    };

    this.builderDied = function(infoObj)
    {
        this.memoryObject.builders--;
        this.strategize();
    };

    this.createTowerBuilder = function()
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
            [ [INSTRUCTION.SPAWN_UNTIL_SUCCESS,     [this.memoryObject.firstSpawnId],   body                    ] //0
            , [INSTRUCTION.CALLBACK,                this.actorId,                       "builderSpawning"       ] //1
            , [INSTRUCTION.PICKUP_AT_POS,           energyPos,                          RESOURCE_ENERGY         ] //2
            , [INSTRUCTION.BUILD_UNTIL_EMPTY,       targetPos,                          STRUCTURE_TOWER         ] //3
            , [INSTRUCTION.CALLBACK,                this.actorId,                       "towerPlaced"           ] //4
            , [INSTRUCTION.GOTO_IF_STRUCTURE_AT,    targetPos,                          STRUCTURE_TOWER,    6   ] //5
            , [INSTRUCTION.GOTO_IF_ALIVE,           2                                                           ] //6
            , [INSTRUCTION.RECYCLE_CREEP                                                                        ] //7
            , [INSTRUCTION.CALLBACK,                this.actorId,                       "builderDied"           ] //8
            , [INSTRUCTION.DESTROY_SCRIPT                                                                     ] ] //9
        );
    };

    this.towerPlaced = function(infoObj)
    {
        this.actors.createNew("actorNaiveTower", (script)=>script.init(infoObj.towerPos));
    };

    this.takeAffordableBody = function(fullBody)
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
    };

    this.createProceduralCreep = function(creepName, callbackStamp, instructions)
    {
        let actorInfo = this.actors.createNew("actorProceduralCreep",
            (script)=>script.init(creepName, callbackStamp, instructions));

        this.memoryObject.latestSubActorId = actorInfo.id;

        return actorInfo.id;
    };

    this.unwind = function()
    {
        this.memoryBank.set(this.bankKey, this.memoryObject);
    };

    this.remove = function()
    {
        this.memoryBank.erase(this.bankKey);
        this.memoryObject = null;
    };

    return this;
};