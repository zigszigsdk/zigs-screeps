"use strict";

const STATES =
	{ SPAWNING:					1
	, LOAD: 					2
	, MOVE_TO_PARKING:			3
	, UPGRADE:					4
	, LOAD_IN_YOUNG_ROOM: 		5
	, UPGRADE_IN_YOUNG_ROOM: 	6
	, END:						100
	};

const YOUNG_ROOM_RL = 2;

const NAME_PREFIX = "Upgrader";

const ActorWithMemory = require('ActorWithMemory');

module.exports = class ActorCreepUpgrader extends ActorWithMemory
{
	constructor(locator)
	{
		super(locator);

		this.creepActions = locator.getService(SERVICE_NAMES.CREEP_ACTIONS);
		this.events = locator.getService(SERVICE_NAMES.EVENTS);
		this.screepsApi = locator.getService(SERVICE_NAMES.SCREEPS_API);
		this.actors = locator.getService(SERVICE_NAMES.ACTORS);
		this.gameObjectFinder = locator.getService(SERVICE_NAMES.GAME_OBJECT_FINDER);

		this.CreepBodyFactory = locator.getClass(CLASS_NAMES.CREEP_BODY_FACTORY);
	}

	rewindActor(actorId)
	{
		super.rewindActor(actorId);
		this.creepName = NAME_PREFIX + actorId;
	}

	initiateActor(callbackTo, positions, spawnId, parkingIndex, navPermissions=[])
	{
		this.memoryObject =
			{ state: STATES.SPAWNING
			, callbackTo: callbackTo
			, roomName: positions.parkingSpace.roomName
			, parkingSpace: positions.parkingSpace
			, energyLocation: positions.energyLocation
			, controllerId: this.screepsApi.getRoom(positions.parkingSpace.roomName).controller.id
			, parkingIndex: parkingIndex
			, navPermissions: navPermissions
			};

		this.creepName = NAME_PREFIX + this.actorId;

		this.events.subscribe(EVENTS.EVERY_TICK, this.actorId, "onEveryTick");

		if(!isNullOrUndefined(this.screepsApi.getCreep(this.creepName)))
			return;

		let room = this.screepsApi.getRoom(this.memoryObject.roomName);
		let energy = room.energyCapacityAvailable;

		let body = new this.CreepBodyFactory()
			.addPattern([CARRY, WORK, WORK, MOVE], 1)
			.addPattern(Array(2).fill(WORK), 1)
			.addPattern([MOVE], 3)
			.addPattern(Array(1).fill(WORK), 1)
			.addPattern([MOVE], 1)
			.addPattern(Array(5).fill(WORK), 1)
			.addPattern([MOVE], 5)
			.addPattern([CARRY], 4)
			.addPattern(Array(10).fill(WORK), 1)
			.addPattern([MOVE], 10)
			.addPattern([CARRY], 5)
			.setSort([MOVE, CARRY, WORK])
			.setMaxCost(energy)
			.fabricate();

		this.creepActions.spawn(this.creepName, body, spawnId);
	}

	onEveryTick()
	{
		this._updateState();
		this._executeState();
	}

	_updateState()
	{
		let creep = this.screepsApi.getCreep(this.creepName);
		if(isUndefinedOrNull(creep))
		{
			this.memoryObject.state = STATES.END;
			return;
		}
		switch(this.memoryObject.state)
		{
			case STATES.SPAWNING:
			{
				if(creep.spawning === true)
					return;

				let room = this.screepsApi.getRoom(this.memoryObject.roomName);

				if(room.controller.level > YOUNG_ROOM_RL)
					this.memoryObject.state = STATES.MOVE_TO_PARKING;
				else
					this.memoryObject.state = STATES.LOAD_IN_YOUNG_ROOM;

				return;
			}

			case STATES.MOVE_TO_PARKING:
			{
				if(!creep.pos.isEqualTo(this.screepsApi.getRoomPosition(this.memoryObject.parkingSpace)))
					return;
				this.memoryObject.path = undefined;
				this.memoryObject.state = STATES.LOAD;
				return;
			}

			case STATES.LOAD:
			{
				if(creep.carry[RESOURCE_ENERGY] === creep.carryCapacity)
					this.memoryObject.state = STATES.UPGRADE;
				return;
			}

			case STATES.UPGRADE:
			{
				if(creep.carry[RESOURCE_ENERGY] === 0)
					this.memoryObject.state = STATES.LOAD;
				return;
			}

			case STATES.LOAD_IN_YOUNG_ROOM:
			{
				if(creep.carry[RESOURCE_ENERGY] === creep.carryCapacity)
					this.memoryObject.state = STATES.UPGRADE_IN_YOUNG_ROOM;
				return;
			}

			case STATES.UPGRADE_IN_YOUNG_ROOM:
			{
				if(creep.carry[RESOURCE_ENERGY] === 0)
					this.memoryObject.state = STATES.LOAD_IN_YOUNG_ROOM;
				return;
			}
		}
	}

	_executeState()
	{

		switch(this.memoryObject.state)
		{
			case STATES.LOAD:
			{
				this.creepActions.withdrawOrPickupAt(this.creepName, this.memoryObject.energyLocation);
				return;
			}
			case STATES.MOVE_TO_PARKING:
			{
				this.memoryObject.path =
					this.creepActions.moveWithPath(	this.creepName,
													this.memoryObject.parkingSpace,
													this.memoryObject.path,
													this.memoryObject.navPermissions);
				return;
			}
			case STATES.UPGRADE:
			case STATES.UPGRADE_IN_YOUNG_ROOM:
			{
				this.creepActions.upgrade(this.creepName, this.memoryObject.controllerId);
				return;
			}

			case STATES.LOAD_IN_YOUNG_ROOM:
			{
				const pos = this.gameObjectFinder.getNearestUnreservedResoucePositionAboveLevelInRoom(
					this.screepsApi.getCreep(this.creepName).pos
				,	RESOURCE_ENERGY
				,	50
				);

				if(isNullOrUndefined(pos))
					return;

				this.creepActions.withdrawOrPickupAt(this.creepName, pos);
				return;
			}

			case STATES.END:
				let parent = this.actors.get(this.memoryObject.callbackTo.actorId);

				if(!isNullOrUndefined(parent))
					parent[this.memoryObject.callbackTo.diedFunctionName](this.memoryObject.parkingIndex);

				this.actors.remove(this.actorId);
				return;
		}
	}

	removeActor()
	{
		this.events.unsubscribe(EVENTS.EVERY_TICK, this.actorId);
		super.removeActor();
	}

	resetActor()
	{
		const oldMemory = JSON.parse(JSON.stringify(this.memoryObject));
		const positions = 	{ parkingSpace: oldMemory.parkingSpace
							, energyLocation: oldMemory.energyLocation
							};
		this.initiateActor(oldMemory.callbackTo, positions, null);
	}
};
