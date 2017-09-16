 "use strict";

const MAX_ENERGY_NEEDED = 750;
const ROLE_NAME = "mineralMiner";

const ActorWithMemory = require('ActorWithMemory');

module.exports = class ActorRoomMineMineral extends ActorWithMemory
{
	constructor(locator)
	{
		super(locator);
		this.CreepBodyFactory = locator.getClass(CLASS_NAMES.CREEP_BODY_FACTORY);
		this.ResourceRequest = locator.getClass(CLASS_NAMES.RESOURCE_REQUEST);

		this.roomScoring = locator.getService(SERVICE_NAMES.ROOM_SCORING);
		this.events = locator.getService(SERVICE_NAMES.EVENTS);
		this.screepsApi = locator.getService(SERVICE_NAMES.SCREEPS_API);
		this.actors = locator.getService(SERVICE_NAMES.ACTORS);
	}

	initiateActor(parentId, roomName)
	{
		this.memoryObject =
			{ parentId: parentId
			, roomName: roomName
			, mineral: this.roomScoring.getRoom(roomName).mineral
			, subActorId: null
			};
	}

	lateInitiate()
	{
		if(isUndefinedOrNull(this.memoryObject.mineral))
			return this.actors.remove(this.actorId);

		let parent = this.actors.get(this.memoryObject.parentId);

		parent.requestBuilding(	[STRUCTURE_CONTAINER],
								this.memoryObject.mineral.miningSpot,
								PRIORITY_NAMES.BUILD.MINERAL_MINING_CONTAINER,
								5);

		let mineral = this.screepsApi.getObjectById(this.memoryObject.mineral.id);
		let mineralPosArr = [mineral.pos.x, mineral.pos.y, mineral.pos.roomName];

		parent.requestBuilding(	[STRUCTURE_EXTRACTOR],
								mineralPosArr,
								PRIORITY_NAMES.BUILD.MINERAL_EXTRACTOR);

		parent.requestResource(
			new this.ResourceRequest(this.memoryObject.mineral.miningSpot, mineral.mineralType)
				.setPriorityName(PRIORITY_NAMES.RESOURCE.MINERAL)
				.setRate(5)
				.setDesired(0)
				.setMin(0)
				.setMinRoomLevel(6)
				.setParking(this.memoryObject.mineral.parkingSpot)
				.fabricate());

		this._update();
	}

	onRoomLevelChanged()
	{
		this.events.unsubscribe(EVENTS.ROOM_LEVEL_CHANGED + this.memoryObject.roomName, this.actorId);
		this._update();

	}

	onMineralRegenerated()
	{
		this._update();
	}

	onBuildingCompleted()
	{
		this.events.unsubscribe(EVENTS.STRUCTURE_BUILD + this.memoryObject.roomName, this.actorId);
		this._update();
	}

	_update()
	{
		let room = this.screepsApi.getRoom(this.memoryObject.roomName);
		let mineral = this.screepsApi.getObjectById(this.memoryObject.mineral.id);

		if(room.controller.level < LEVEL_REQUIRED_TO_MINE_MINERALS)
			return this.events.subscribe(EVENTS.ROOM_LEVEL_CHANGED + room.name, this.actorId, "onRoomLevelChanged");

		if(isUndefined(mineral.mineralAmount) || mineral.mineralAmount === 0)
			return; //this.???.callbackAfter(mineral.ticksToRegeneration, this.actorId, "onMineralRegenerated");

		let extractor = this.screepsApi.getStructureAt([mineral.pos.x, mineral.pos.y, mineral.pos.roomName],
												STRUCTURE_EXTRACTOR);

		if(isNullOrUndefined(extractor))
			return this.events.subscribe(EVENTS.STRUCTURE_BUILD + room.name, this.actorId, "onBuildingCompleted");

		this._requestMiner();
	}

	resetActor()
	{
		let oldMemory = JSON.parse(JSON.stringify(this.memoryObject));

		this.initiateActor(oldMemory.parentId, oldMemory.roomName);
		this.memoryObject.subActorId = oldMemory.subActorId;

		this.lateInitiate();
	}

	_requestMiner()
	{
		if(this.memoryObject.subActorId !== null)
			return;

		let parent = this.actors.get(this.memoryObject.parentId);

		parent.requestCreep(
			{ actorId: this.actorId
			, functionName: "createMiner"
			, priority: PRIORITY_NAMES.SPAWN.MINERAL_MINER
			, energyNeeded: MAX_ENERGY_NEEDED
			});
	}

	createMiner(spawnId)
	{
		if(this.memoryObject.subActorId !== null)
			return;

		let room = this.screepsApi.getRoom(this.memoryObject.roomName);
		let energy = room.energyAvailable;

		let	body = new this.CreepBodyFactory()
				.addPattern([MOVE], 1)
				.addPattern([WORK], 5)
				.addPattern([MOVE], 4)
				.setSort([MOVE, WORK])
				.setMaxCost(energy)
				.fabricate();

		let mineralId = this.memoryObject.mineral.id;
		let miningSpot = this.memoryObject.mineral.miningSpot;

		let result = this.actors.create(ACTOR_NAMES.PROCEDUAL_CREEP,
			(script)=>script.initiateActor(ROLE_NAME, {},
				[ [CREEP_INSTRUCTION.SPAWN_UNTIL_SUCCESS, [spawnId], body] //0
				, [CREEP_INSTRUCTION.MOVE_TO_POSITION, miningSpot] //1
				, [CREEP_INSTRUCTION.MINE_UNTIL_DEATH, mineralId] //2
				, [CREEP_INSTRUCTION.CALLBACK, this.actorId, "minerDied"] //3
				, [CREEP_INSTRUCTION.DESTROY_SCRIPT] ])); //4

		this.memoryObject.subActorId = result.id;
	}

	minerDied(callbackObj)
	{
		this.memoryObject.subActorId = null;
		this._update();
	}


};