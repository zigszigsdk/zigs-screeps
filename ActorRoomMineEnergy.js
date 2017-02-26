"use strict";

const MINER = "miner";
const RECOVERY_MINER = "recoveryMiner";
const MAX_ENERGY_NEEDED = 750;

let ActorWithMemory = require('ActorWithMemory');

module.exports = class ActorRoomMineEnergy extends ActorWithMemory
{
	constructor(core)
	{
		super(core);
		this.CreepBodyFactory = core.getClass(CLASS_NAMES.CREEP_BODY_FACTORY);
		this.ResourceRequest = core.getClass(CLASS_NAMES.RESOURCE_REQUEST);
	}

	initiateActor(parentId, roomName)
	{
		let roomScoring = this.core.getService(SERVICE_NAMES.ROOM_SCORING);
		let mines = roomScoring.getRoom(roomName).mines;

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
									PRIORITY_NAMES.BUILD.ENERGY_MINING_CONTAINER);

			parent.requestBuilding(	[STRUCTURE_LINK],
									this.memoryObject.mines[keys[index]].linkSpot,
									PRIORITY_NAMES.BUILD.ENERGY_MINING_LINK);

			let request = new this.ResourceRequest(this.memoryObject.mines[keys[index]].miningSpot, RESOURCE_ENERGY)
					.setRate(10)
					.setDesired(500)
					.setMin(250)
					.setParking(this.memoryObject.mines[keys[index]].parkingSpot)
					.fabricate();

			parent.requestResource(request);
			parent.registerEnergyLocation(request);
		}
	}

	resetActor()
	{
		let oldMemory = JSON.parse(JSON.stringify(this.memoryObject));

		this.initiateActor(oldMemory.parentId, oldMemory.roomName);

		let keys = Object.keys(oldMemory.mines);
		for(let index in keys)
		{
			this.memoryObject.mines[keys[index]].regularMinerActorId = oldMemory.mines[keys[index]].regularMinerActorId;
			this.memoryObject.mines[keys[index]].recoveryMinerActorId = oldMemory.mines[keys[index]].recoveryMinerActorId;
		}

		this.lateInitiate();
	}

	requestMinerFor(mineKey)
	{
		if(!isNullOrUndefined(this.memoryObject.mines[mineKey].regularMinerActorId))
			return;

		let parent = this.core.getActor(this.memoryObject.parentId);

		parent.requestCreep(
			{ actorId: this.actorId
			, functionName: "createMiner"
			, priority: PRIORITY_NAMES.SPAWN.ENERGY_MINER
			, callbackObj: { sourceId: this.memoryObject.mines[mineKey].sourceId }
			, energyNeeded: MAX_ENERGY_NEEDED
			});

		if(!isNullOrUndefined(this.memoryObject.mines[mineKey].recoveryMinerActorId))
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
		if(!isNullOrUndefined(this.memoryObject.mines[callbackObj.sourceId].regularMinerActorId))
			return;

		let room = this.core.getRoom(this.memoryObject.roomName);
        let energy = room.energyAvailable;

        let role = energy === room.energyCapacityAvailable || energy >= MAX_ENERGY_NEEDED ? MINER : RECOVERY_MINER;

        if(role === RECOVERY_MINER && !isNullOrUndefined(this.memoryObject.mines[callbackObj.sourceId].recoveryMinerActorId))
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

			if(!isNullOrUndefined(this.memoryObject.mines[callbackObj.sourceId].recoveryMinerActorId))
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
    		this.memoryObject.mines[callbackObj.sourceId].recoveryMinerActorId = null;

    	this.requestMinerFor(callbackObj.sourceId);
    }
};