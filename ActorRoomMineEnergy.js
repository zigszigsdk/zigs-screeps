"use strict";

const RECOVERY_MINER = "recoveryMiner";
const PERMISSIONS = { MINER_PARKING: "EnergyMinerParkingPermission"
					, HAULER_PARKING: "EnergyHaulerParkingPermission"};

const MAX_ENERGY_NEEDED = 1200;

let ActorWithMemory = require('ActorWithMemory');

module.exports = class ActorRoomMineEnergy extends ActorWithMemory
{
	constructor(locator)
	{
		super(locator);
		this.CreepBodyFactory = locator.getClass(CLASS_NAMES.CREEP_BODY_FACTORY);
		this.ResourceRequest = locator.getClass(CLASS_NAMES.RESOURCE_REQUEST);

		this.roomScoring = locator.getService(SERVICE_NAMES.ROOM_SCORING);
		this.roomNavigation = locator.getService(SERVICE_NAMES.ROOM_NAVIGATION);
		this.events = locator.getService(SERVICE_NAMES.EVENTS);
		this.screepsApi = locator.getService(SERVICE_NAMES.SCREEPS_API);
		this.actors = locator.getService(SERVICE_NAMES.ACTORS);
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
		let parent = this.actors.get(this.memoryObject.parentId);

		let minerReservationPositions = [];
		let haulerReservationPositions = [];

		let keys = Object.keys(this.memoryObject.mines);
		for(let index in keys)
		{
			this.requestMinerFor(keys[index]);

			const miningSpot = this.memoryObject.mines[keys[index]].miningSpot;

			parent.requestBuilding(	[STRUCTURE_CONTAINER],
									miningSpot,
									PRIORITY_NAMES.BUILD.ENERGY_MINING_CONTAINER,
									2);

			parent.requestBuilding(	[STRUCTURE_LINK],
									this.memoryObject.mines[keys[index]].linkSpot,
									PRIORITY_NAMES.BUILD.ENERGY_MINING_LINK);

			let request = new this.ResourceRequest(this.memoryObject.mines[keys[index]].miningSpot, RESOURCE_ENERGY)
					.setRate(10)
					.setDesired(500)
					.setMin(250)
					.setParking(this.memoryObject.mines[keys[index]].parkingSpot)
					.setNavPermissions(PERMISSIONS.HAULER_PARKING)
					.fabricate();

			parent.registerEnergyLocation(request);

			minerReservationPositions.push(	{ x:miningSpot[0]
											, y:miningSpot[1]
											, roomName:miningSpot[2]
											});

			const haulerParkingSpot = this.memoryObject.mines[keys[index]].parkingSpot;
			haulerReservationPositions.push({ x:haulerParkingSpot[0]
											, y: haulerParkingSpot[1]
											, roomName: haulerParkingSpot[2]
											});
		}

		this.roomNavigation.reservePositions(	this.memoryObject.roomName,
												minerReservationPositions,
												PERMISSIONS.MINER_PARKING);

		this.roomNavigation.reservePositions(	this.memoryObject.roomName,
												haulerReservationPositions,
												PERMISSIONS.HAULER_PARKING);

		this.events.subscribe(EVENTS.STRUCTURE_BUILD + this.memoryObject.roomName, this.actorId, "onStructuresChanged");
		this.events.subscribe(EVENTS.STRUCTURE_DESTROYED + this.memoryObject.roomName, this.actorId, "onStructuresChanged");
		this._updateRequests();
	}

	onStructuresChanged()
	{
		this._updateRequests();
	}

	_updateRequests()
	{
		let parent = this.actors.get(this.memoryObject.parentId);


		let layout = this.roomScoring.getRoom(this.memoryObject.roomName);

		let recieversReady = !(isNullOrUndefined(this.screepsApi.getStructureAt(layout.upgrade.container, STRUCTURE_LINK)) ||
			isNullOrUndefined(this.screepsApi.getStructureAt(layout.upgrade.container, STRUCTURE_LINK)));

		let keys = Object.keys(this.memoryObject.mines);
		for(let index in keys)
		{
			let link = this.screepsApi.getStructureAt(this.memoryObject.mines[keys[index]].linkSpot, STRUCTURE_LINK);
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
				isNullOrUndefined(this.actors.get(oldMemory.mines[keys[index]].regularMinerActorId)) ?
				null : oldMemory.mines[keys[index]].regularMinerActorId;

			this.memoryObject.mines[keys[index]].recoveryMinerActorId =
				isNullOrUndefined(this.actors.get(oldMemory.mines[keys[index]].recoveryMinerActorId)) ?
				null : oldMemory.mines[keys[index]].recoveryMinerActorId;
		}

		this.lateInitiate();
	}

	requestMinerFor(mineKey)
	{
		if(!isNullOrUndefined(this.memoryObject.mines[mineKey].regularMinerActorId))
			return;

		let parent = this.actors.get(this.memoryObject.parentId);

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

		let room = this.screepsApi.getRoom(this.memoryObject.roomName);

		if(room.energyAvailable === room.energyCapacityAvailable || room.energyAvailable >= MAX_ENERGY_NEEDED)
			return this._createFullMiner(spawnId, callbackObj);

		if(isNullOrUndefined(this.memoryObject.mines[callbackObj.sourceId].recoveryMinerActorId))
			this._createRecoveryMiner(spawnId, callbackObj);
	}

	_createRecoveryMiner(spawnId, callbackObj)
	{
		let body = [MOVE, WORK];

		let pos = this.memoryObject.mines[callbackObj.sourceId].miningSpot;

		let result = this.actors.create(ACTOR_NAMES.PROCEDUAL_CREEP,
			(script)=>script.initiateActor(RECOVERY_MINER, callbackObj,
			[ [CREEP_INSTRUCTION.SPAWN_UNTIL_SUCCESS, [spawnId], body]   //0
			, [CREEP_INSTRUCTION.MOVE_TO_POSITION, pos, PERMISSIONS.MINER_PARKING]   //1
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
		let screepsApi = this.screepsApi;
		let findAt = function(posArr, structureType)
		{
			let results = _.filter(screepsApi.getRoomPosition(posArr).lookFor(LOOK_STRUCTURES),
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

		let result = this.actors.create(ACTOR_NAMES.CREEP_ENERGY_MINER,
			(script)=> script.initiateActor(callbackTo, mineInfo, spawnId, PERMISSIONS.MINER_PARKING));

		this.memoryObject.mines[callbackObj.sourceId].regularMinerActorId = result.id;

			if(!isNullOrUndefined(this.memoryObject.mines[callbackObj.sourceId].recoveryMinerActorId))
				this.actors.remove(this.memoryObject.mines[callbackObj.sourceId].recoveryMinerActorId);

			this.memoryObject.mines[callbackObj.sourceId].recoveryMinerActorId = null;
	}

	fullMinerDied(sourceId)
	{
		this.memoryObject.mines[sourceId].regularMinerActorId = null;
		this.requestMinerFor(sourceId);
	}
};