"use strict";

const STATES =
	{ SPAWNING:			1
	, MOVE:				2
	, MINE:				3
	, UNLOAD:			4
	, REPAIR_CONTAINER: 5
	, REPAIR_LINK:		6
	, REPAIR_PICKUP:	7
	, WAIT_FOR_REGEN:	8
	, END:				9
	};

const NAME_PREFIX = "energyMiner";
const LINK_CAPACITY = 800;
const CONTAINER_ENERGY_GOAL = 500;

const ActorWithMemory = require('ActorWithMemory');

module.exports = class ActorCreepEnergyMiner extends ActorWithMemory
{
	constructor(locator)
	{
		super(locator);

		this.creepActions = locator.getService(SERVICE_NAMES.CREEP_ACTIONS);
		this.events = locator.getService(SERVICE_NAMES.EVENTS);
		this.screepsApi = locator.getService(SERVICE_NAMES.SCREEPS_API);
		this.actors = locator.getService(SERVICE_NAMES.ACTORS);

		this.CreepBodyFactory = locator.getClass(CLASS_NAMES.CREEP_BODY_FACTORY);
	}

	rewindActor(actorId)
	{
		super.rewindActor(actorId);
		if(!isUndefinedOrNull(this.memoryObject.mineInfo)) //not set when rewound first time, before initiateActor
			this.creepName = NAME_PREFIX + this.memoryObject.mineInfo.sourceId;
	}

	initiateActor(callbackTo, mineInfo, spawnId, navPermission)
	{
		this.memoryObject =
			{ state: STATES.SPAWNING
			, callbackTo: callbackTo
			, mineInfo: mineInfo
			, navPermission: navPermission
			, path: undefined
			};

		this.creepName = NAME_PREFIX + this.memoryObject.mineInfo.sourceId;

		this.events.subscribe(EVENTS.EVERY_TICK, this.actorId, "onEveryTick");

		if(!isNullOrUndefined(this.screepsApi.getCreep(this.creepName)))
			return;

		let body = new this.CreepBodyFactory()
			.addPattern([MOVE], 1)
			.addPattern([WORK], 6)
			.addPattern([CARRY], 6)
			.addPattern([MOVE], 5)
			.setSort([MOVE, CARRY, WORK])
			.setMaxCost(this.screepsApi.getObjectById(spawnId).room.energyAvailable)
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
				if(creep.spawning === false)
					this.memoryObject.state = STATES.MOVE;
				return;
			}
			case STATES.MOVE:
			{
				if(!creep.pos.isEqualTo(this.screepsApi.getRoomPosition(this.memoryObject.mineInfo.minePos)))
					return;

				this.memoryObject.path = undefined;
				this.memoryObject.state = STATES.MINE;
				return;
			}
			case STATES.MINE:
			{
				let link = this.screepsApi.getObjectById(this.memoryObject.mineInfo.linkId);
				let container = this.screepsApi.getObjectById(this.memoryObject.mineInfo.containerId);

				if(!isNullOrUndefined(link) &&
					link.energy !== LINK_CAPACITY &&
					( isNullOrUndefined(container) ||
					  container.store[RESOURCE_ENERGY] >= CONTAINER_ENERGY_GOAL) &&
					_.sum(creep.carry) === creep.carryCapacity
					)
					this.memoryObject.state = STATES.UNLOAD;

				else if(this.screepsApi.getObjectById(this.memoryObject.mineInfo.sourceId).energy === 0)
					this.memoryObject.state = STATES.REPAIR_CONTAINER;
				return;
			}
			case STATES.UNLOAD:
			{
				if(_.sum(creep.carry) === 0 ||
					this.screepsApi.getObjectById(this.memoryObject.mineInfo.linkId).energy === LINK_CAPACITY
					)
					this.memoryObject.state = STATES.MINE;
				return;
			}
			case STATES.REPAIR_CONTAINER:
			{
				if(this.screepsApi.getObjectById(this.memoryObject.mineInfo.sourceId).energy !== 0)
				{
					this.memoryObject.state = STATES.MINE;
					return;
				}

				if(isUndefined(creep.carry[RESOURCE_ENERGY]) || creep.carry[RESOURCE_ENERGY] === 0)
				{
					this.memoryObject.state = STATES.REPAIR_PICKUP;
					return;
				}

				let container = this.screepsApi.getObjectById(this.memoryObject.mineInfo.containerId);
				if(!isNullOrUndefined(container) && container.hits === container.hitsMax)
					this.memoryObject.state = STATES.REPAIR_LINK;
				return;
			}
			case STATES.REPAIR_LINK:
			{
				if(this.screepsApi.getObjectById(this.memoryObject.mineInfo.sourceId).energy !== 0)
				{
					this.memoryObject.state = STATES.MINE;
					return;
				}

				if(isUndefined(creep.carry[RESOURCE_ENERGY]) || creep.carry[RESOURCE_ENERGY] === 0)
				{
					this.memoryObject.state = STATES.REPAIR_PICKUP;
					return;
				}

				let link = this.screepsApi.getObjectById(this.memoryObject.mineInfo.linkId);
				if(!isNullOrUndefined(link) && link.hits === link.hitsMax)
					this.memoryObject.state = STATES.WAIT_FOR_REGEN;
				return;
			}
			case STATES.REPAIR_PICKUP:
			{
				if(isUndefined(creep.carry[RESOURCE_ENERGY]))
					this.memoryObject.state = STATES.WAIT_FOR_REGEN;
				else
					this.memoryObject.state = STATES.REPAIR_CONTAINER;
				return;
			}
			case STATES.WAIT_FOR_REGEN:
			{
				if(this.screepsApi.getObjectById(this.memoryObject.mineInfo.sourceId).energy !== 0)
					this.memoryObject.state = STATES.MINE;
				return;
			}
		}
	}

	_executeState()
	{


		switch(this.memoryObject.state)
		{
			case STATES.MOVE:
				let creep = this.screepsApi.getCreep(this.creepName);
				let newPos = [creep.pos.x, creep.pos.y, creep.pos.roomName];
				if(! this.memoryObject.lastPosition ||
					(
						this.memoryObject.lastPosition[0] === newPos[0] &&
						this.memoryObject.lastPosition[1] === newPos[1] &&
						this.memoryObject.lastPosition[2] === newPos[2]
					)
				)
					this.memoryObject.path = undefined;

				this.memoryObject.path =
					this.creepActions.moveWithPath(
						this.creepName
					,	this.memoryObject.mineInfo.minePos
					,	this.memoryObject.path
					,	this.memoryObject.navPermission
					);

				this.memoryObject.lastPosition = newPos;
				return;

			case STATES.MINE:
				this.creepActions.mine(this.creepName, this.memoryObject.mineInfo.sourceId);
				return;

			case STATES.UNLOAD:
				this.creepActions.deposit(this.creepName, this.memoryObject.mineInfo.linkId, RESOURCE_ENERGY);
				return;

			case STATES.REPAIR_CONTAINER:
				this.creepActions.repair(this.creepName, this.memoryObject.mineInfo.containerId);
				return;

			case STATES.REPAIR_LINK:
				this.creepActions.repair(this.creepName, this.memoryObject.mineInfo.linkId);
				return;

			case STATES.REPAIR_PICKUP:
				this.creepActions.withdraw(this.creepName, this.memoryObject.mineInfo.containerId, RESOURCE_ENERGY);
				return;
			case STATES.END:
				let parent = this.actors.get(this.memoryObject.callbackTo.actorId);

				if(!isNullOrUndefined(parent))
					parent[this.memoryObject.callbackTo.diedFunctionName](this.memoryObject.mineInfo.sourceId);

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
		let oldMemory = JSON.parse(JSON.stringify(this.memoryObject));
		this.initiateActor(oldMemory.callbackTo, oldMemory.mineInfo, oldMemory.spawnId);
	}
};