"use strict";

let ActorWithMemory = require('ActorWithMemory');

module.exports = class ActorRoomMine extends ActorWithMemory
{
	constructor(core)
	{
		super(core);
		this.CreepBodyFactory = core.getClass(CLASS_NAMES.CREEP_BODY_FACTORY);
	}

	initiateActor(parentId, roomName)
	{
		let roomScoring = this.core.getService(SERVICE_NAMES.ROOM_SCORING);
		let mines = roomScoring.getRoom(roomName).mines;

		let room = this.core.getRoom(roomName);
		let spawn = room.find(FIND_MY_SPAWNS)[0];

		let keyOfNearest = null;
		let bestScore = Number.NEGATIVE_INFINITY;

		let keys = Object.keys(mines);
		for(let index in keys)
		{
			mines[keys[index]].firstSpot = false;
			let miningSpot = mines[keys[index]].miningSpot;
			let score = spawn.pos.findPathTo(miningSpot[0], miningSpot[0], roomName).length;

			if(score <= bestScore)
				continue;

			bestScore = score;
			keyOfNearest = keys[index];
		}

		mines[keyOfNearest].firstSpot = true;

		this.memoryObject =
			{ parentId: parentId
			, roomName: roomName
			, mines: mines
			};
	}

	lateInitiate()
	{
		let parent = this.core.getActor(this.memoryObject.parentId);

		let keys = Object.keys(this.memoryObject.mines);
		for(let index in keys)
			parent.requestCreep(
				{ actorId: this.actorId
				, functionName: "createMiner"
				, priority: this.memoryObject.mines[keys[index]].firstSpot ? PRIORITY_NAMES.SPAWN.FIRST_MINER : PRIORITY_NAMES.SPAWN.MINER
				, callbackObj: this.memoryObject.mines[keys[index]].sourceId
				, energyNeeded: 300
				});

		for(let index in this.memoryObject.mines)
		{
			parent.requestBuilding([STRUCTURE_CONTAINER], this.memoryObject.mines[index].miningSpot, PRIORITY_NAMES.BUILD.DROP_MINING_CONTAINER);
			parent.requestPickup(this.memoryObject.mines[index].miningSpot, RESOURCE_ENERGY);
		}
	}

	createMiner(spawnId, sourceId)
    {
        let energy = this.core.room(this.memoryObject.roomName).energyAvailable;

        let body = new this.CreepBodyFactory()
            .addPattern([MOVE], 1)
            .addPattern([WORK], 5)
            .addPattern([MOVE], 4)
            .setSort([MOVE, WORK])
            .setMaxCost(energy)
            .fabricate();

        let pos = this.memoryObject.mines[sourceId].miningSpot;

		this.core.createActor(ACTOR_NAMES.PROCEDUAL_CREEP,
            (script)=>script.initiateActor("miner", {sourceId: sourceId},
            [ [CREEP_INSTRUCTION.SPAWN_UNTIL_SUCCESS,     [spawnId],   body            						  ]   //0
            , [CREEP_INSTRUCTION.MOVE_TO_POSITION,        pos                                                 ]   //1
            , [CREEP_INSTRUCTION.MINE_UNTIL_DEATH,        sourceId                                            ]   //2
            , [CREEP_INSTRUCTION.CALLBACK,                this.actorId,                       "minerDied"     ]   //3
            , [CREEP_INSTRUCTION.DESTROY_SCRIPT                                                             ] ]));//4
    }

    minerDied(callbackObj)
    {
    	let parent = this.core.getActor(this.memoryObject.parentId);
		parent.requestCreep(
			{ actorId: this.actorId
			, functionName: "createMiner"
			, priority: PRIORITY_NAMES.SPAWN.MINER
			, callbackObj: callbackObj.sourceId
			, energyNeeded: 300
			});
    }
};