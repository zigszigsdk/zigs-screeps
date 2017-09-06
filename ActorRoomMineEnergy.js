"use strict";

const RECOVERY_MINER = "recoveryMiner";
const MAX_ENERGY_NEEDED = 1200;

let ActorWithMemory = require('ActorWithMemory');

module.exports = class ActorRoomMineEnergy extends ActorWithMemory
{
	constructor(core)
	{
		super(core);
		this.CreepBodyFactory = core.getClass(CLASS_NAMES.CREEP_BODY_FACTORY);
		this.ResourceRequest = core.getClass(CLASS_NAMES.RESOURCE_REQUEST);
		this.roomScoring = core.getService(SERVICE_NAMES.ROOM_SCORING);
	}

	initiateActor(parentId, roomName)
	{
		let roomScoring = this.roomScoring.getRoom(roomName);

		let mines = roomScoring.mines;

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

			parent.registerEnergyLocation(request);
		}

		this.core.subscribe(EVENTS.STRUCTURE_BUILD + this.memoryObject.roomName, this.actorId, "onStructuresChanged");
		this.core.subscribe(EVENTS.STRUCTURE_DESTROYED + this.memoryObject.roomName, this.actorId, "onStructuresChanged");
		this._updateRequests();
	}

	onStructuresChanged()
	{
		this._updateRequests();
	}

	_updateRequests()
	{
		let parent = this.core.getActor(this.memoryObject.parentId);


		let layout = this.core.getService(SERVICE_NAMES.ROOM_SCORING).getRoom(this.memoryObject.roomName);

		let recieversReady = !(isNullOrUndefined(this.core.getStructureAt(layout.upgrade.container, STRUCTURE_LINK)) ||
			isNullOrUndefined(this.core.getStructureAt(layout.upgrade.container, STRUCTURE_LINK)));

		let keys = Object.keys(this.memoryObject.mines);
		for(let index in keys)
		{
			let link = this.core.getStructureAt(this.memoryObject.mines[keys[index]].linkSpot, STRUCTURE_LINK);
			if(isNullOrUndefined(link) || !recieversReady)
			{
				let request = new this.ResourceRequest(this.memoryObject.mines[keys[index]].miningSpot, RESOURCE_ENERGY)
					.setRate(10)
					.setDesired(500)
					.setMin(250)
					.setParking(this.memoryObject.mines[keys[index]].parkingSpot)
					.fabricate();

				parent.requestResource(request);
				continue;
			}

			parent.removeResourceRequestsAt(this.memoryObject.mines[keys[index]].miningSpot);
		}
	}

	resetActor()
	{
		let oldMemory = JSON.parse(JSON.stringify(this.memoryObject));

		this.initiateActor(oldMemory.parentId, oldMemory.roomName);

		let keys = Object.keys(oldMemory.mines);
		for(let index in keys)
		{
			this.memoryObject.mines[keys[index]].regularMinerActorId =
				isNullOrUndefined(this.core.getActor(oldMemory.mines[keys[index]].regularMinerActorId)) ?
				null : oldMemory.mines[keys[index]].regularMinerActorId;

			this.memoryObject.mines[keys[index]].recoveryMinerActorId =
				isNullOrUndefined(this.core.getActor(oldMemory.mines[keys[index]].recoveryMinerActorId)) ?
				null : oldMemory.mines[keys[index]].recoveryMinerActorId;
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

		if(room.energyAvailable === room.energyCapacityAvailable || room.energyAvailable >= MAX_ENERGY_NEEDED)
			return this._createFullMiner(spawnId, callbackObj);

		if(isNullOrUndefined(this.memoryObject.mines[callbackObj.sourceId].recoveryMinerActorId))
			this._createRecoveryMiner(spawnId, callbackObj);
	}

	_createRecoveryMiner(spawnId, callbackObj)
	{
		let body = [MOVE, WORK];

		let pos = this.memoryObject.mines[callbackObj.sourceId].miningSpot;

		let result = this.core.createActor(ACTOR_NAMES.PROCEDUAL_CREEP,
			(script)=>script.initiateActor(RECOVERY_MINER, callbackObj,
			[ [CREEP_INSTRUCTION.SPAWN_UNTIL_SUCCESS, [spawnId], body]   //0
			, [CREEP_INSTRUCTION.MOVE_TO_POSITION, pos]   //1
			, [CREEP_INSTRUCTION.MINE_UNTIL_DEATH, callbackObj.sourceId]   //2
			, [CREEP_INSTRUCTION.CALLBACK, this.actorId, "recoveryMinerDied"]   //3
			, [CREEP_INSTRUCTION.DESTROY_SCRIPT] ]));//4

		this.memoryObject.mines[callbackObj.sourceId].recoveryMinerActorId = result.id;

		this.requestMinerFor(callbackObj.sourceId);
	}

	recoveryMinerDied(callbackObj)
	{
		this.memoryObject.mines[callbackObj.sourceId].recoveryMinerActorId = null;
		this.requestMinerFor(callbackObj.sourceId);
	}

	_createFullMiner(spawnId, callbackObj)
	{
		let core = this.core;
		let findAt = function(posArr, structureType)
		{
			let results = _.filter(core.getRoomPosition(posArr).lookFor(LOOK_STRUCTURES),
				(x)=>x.structureType === structureType);
			if(results.length === 0)
				return null;
			return results[0];
		};

		let minePos = this.memoryObject.mines[callbackObj.sourceId].miningSpot;
		let container = findAt(minePos, STRUCTURE_CONTAINER);
		let link = findAt(this.memoryObject.mines[callbackObj.sourceId].linkSpot, STRUCTURE_LINK);

		let mineInfo =
			{ minePos: minePos
			, sourceId: callbackObj.sourceId
			, containerId: container === null ? null : container.id
			, linkId: link === null ? null : link.id
			};

		let callbackTo =
			{ actorId: this.actorId
			, diedFunctionName: "fullMinerDied"
			};

		let result = this.core.createActor(ACTOR_NAMES.CREEP_ENERGY_MINER,
			(script)=> script.initiateActor(callbackTo, mineInfo, spawnId));

		this.memoryObject.mines[callbackObj.sourceId].regularMinerActorId = result.id;

			if(!isNullOrUndefined(this.memoryObject.mines[callbackObj.sourceId].recoveryMinerActorId))
				this.core.removeActor(this.memoryObject.mines[callbackObj.sourceId].recoveryMinerActorId);

			this.memoryObject.mines[callbackObj.sourceId].recoveryMinerActorId = null;
	}

	fullMinerDied(sourceId)
	{
		this.memoryObject.mines[sourceId].regularMinerActorId = null;
		this.requestMinerFor(sourceId);
	}
};