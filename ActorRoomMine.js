"use strict";

const MINER = "miner";
const RECOVERY_MINER = "recoveryMiner";

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
			mines[keys[index]].regularMinerActorId = null;
			mines[keys[index]].recoveryMinerActorId = null;

			let miningSpot = mines[keys[index]].miningSpot;
			let score = spawn.pos.findPathTo(miningSpot[0], miningSpot[0], roomName).length;

			if(score <= bestScore)
				continue;

			bestScore = score;
			keyOfNearest = keys[index];
		}

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
		{
			this.requestMinerFor(keys[index]);

			parent.requestBuilding(	[STRUCTURE_CONTAINER],
									this.memoryObject.mines[keys[index]].miningSpot,
									PRIORITY_NAMES.BUILD.DROP_MINING_CONTAINER);

			parent.requestPickup(	this.memoryObject.mines[keys[index]].miningSpot,
									RESOURCE_ENERGY);
		}
	}

	resetActor()
	{
		let oldMemory = JSON.parse(JSON.stringify(this.memoryObject));

		this.initiateActor(oldMemory.parentId, oldMemory.roomName);

		let keys = Object.keys(oldMemory.mines);
		for(let index in keys)
		{
			this.memoryObject.mines[keys[index]].regularFillActorId = oldMemory.mines[keys[index]].regularFillActorId;
			this.memoryObject.mines[keys[index]].recoveryMinerActorId = oldMemory.mines[keys[index]].recoveryFillActorId;
		}

		this.lateInitiate();
	}

	requestMinerFor(mineKey)
	{
		if(this.memoryObject.mines[mineKey].regularMinerActorId !== null)
			return;

		let parent = this.core.getActor(this.memoryObject.parentId);

		parent.requestCreep(
			{ actorId: this.actorId
			, functionName: "createMiner"
			, priority: PRIORITY_NAMES.SPAWN.MINER
			, callbackObj: { sourceId: this.memoryObject.mines[mineKey].sourceId }
			, energyNeeded: 750
			});

		if(this.memoryObject.mines[mineKey].regularMinerActorId !== null)
			return;

		parent.requestCreep(
			{ actorId: this.actorId
			, functionName: "createMiner"
			, priority: PRIORITY_NAMES.SPAWN.RECOVERY_MINER
			, callbackObj: { sourceId: this.memoryObject.mines[mineKey].sourceId }
			, energyNeeded: 150
			});
	}

	createMiner(spawnId, callbackObj)
    {
		if(this.memoryObject.mines[callbackObj.sourceId].regularMinerActorId !== null)
			return;

		let room = this.core.room(this.memoryObject.roomName);
        let energy = room.energyAvailable;

        let role = room.energyAvailable === room.energyCapacityAvailable ? MINER : RECOVERY_MINER;

        if(role === RECOVERY_MINER && this.memoryObject.mines[callbackObj.sourceId].recoveryMinerActorId !== null)
        	return;

        let body;
        if(role === MINER)
        	body = new this.CreepBodyFactory()
	            .addPattern([MOVE], 1)
	            .addPattern([WORK], 5)
	            .addPattern([MOVE], 4)
	            .setSort([MOVE, WORK])
	            .setMaxCost(energy)
	            .fabricate();
	    else
	    	body = [MOVE, WORK];

        let pos = this.memoryObject.mines[callbackObj.sourceId].miningSpot;

		let result = this.core.createActor(ACTOR_NAMES.PROCEDUAL_CREEP,
            (script)=>script.initiateActor(role, {sourceId: callbackObj.sourceId, role: role},
            [ [CREEP_INSTRUCTION.SPAWN_UNTIL_SUCCESS,     [spawnId],   body            						  ]   //0
            , [CREEP_INSTRUCTION.MOVE_TO_POSITION,        pos                                                 ]   //1
            , [CREEP_INSTRUCTION.MINE_UNTIL_DEATH,        callbackObj.sourceId                                ]   //2
            , [CREEP_INSTRUCTION.CALLBACK,                this.actorId,                       "minerDied"     ]   //3
            , [CREEP_INSTRUCTION.DESTROY_SCRIPT                                                             ] ]));//4

		if(role === MINER)
		{
			this.memoryObject.mines[callbackObj.sourceId].regularMinerActorId = result.id;
			this.core.removeActor(this.memoryObject.mines[callbackObj.sourceId].recoveryMinerActorId);
			this.memoryObject.mines[callbackObj.sourceId].recoveryMinerActorId = null;
			return;
		}

		this.memoryObject.mines[callbackObj.sourceId].recoveryMinerActorId = result.id;
		this.requestMinerFor(callbackObj.sourceId);
    }

    minerDied(callbackObj)
    {
    	if(callbackObj.role === MINER)
    		this.memoryObject.mines[callbackObj.sourceId].regularMinerActorId = null;
    	else
    		this.memoryObject.mines[callbackObj.sourceId].recoveryMiner = null;

    	this.requestMinerFor(callbackObj.sourceId);
    }
};