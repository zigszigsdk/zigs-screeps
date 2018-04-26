"use strict";

const STATES =
	{ SPAWNING: 0
	, FILL_SELF: 1
	, FILL_ROOM: 2
	, OFFDUTY_FILL_SELF: 3
	, OFFDUTY_WAIT: 4
	, OFFDUTY_FILL_CONTAINER: 5
	, OFFDUTY_REPAIR: 6
	, END: 100
	};

const CONTAINER_CAPACITY = 2000;

const NAME_PREFIX = "filler";

const ActorWithMemory = require('ActorWithMemory');

module.exports = class ActorCreepFiller extends ActorWithMemory
{
	constructor(locator)
	{
		super(locator);
		this.creepActions = locator.getService(SERVICE_NAMES.CREEP_ACTIONS);
		this.roomScoring = locator.getService(SERVICE_NAMES.ROOM_SCORING);
		this.events = locator.getService(SERVICE_NAMES.EVENTS);
		this.actors = locator.getService(SERVICE_NAMES.ACTORS);
		this.screepsApi = locator.getService(SERVICE_NAMES.SCREEPS_API);

		this.CreepBodyFactory = locator.getClass(CLASS_NAMES.CREEP_BODY_FACTORY);
	}

	rewindActor(actorId)
	{
		super.rewindActor(actorId);
		if(!isUndefinedOrNull(this.memoryObject.roomName))
			this.creepName = NAME_PREFIX + this.memoryObject.roomName;
	}

	initiateActor(callbackTo, roomName, spawnHereId)
	{

		this.memoryObject =
			{ callbackTo: callbackTo
			, roomName: roomName
			, state: STATES.SPAWNING
			, containerId: undefined
			, linkId: undefined
			, storageId: undefined
			, minerContainerIds: undefined
			, containerPos: undefined
			, linkPos: undefined
			, storagePos: undefined
			, targetIds: undefined
			, minerContainerPoss: undefined
			};

		this.updateBuildings();

		this.creepName = NAME_PREFIX + roomName;

		this.events.subscribe(EVENTS.EVERY_TICK, this.actorId, "onEveryTick");

		if(!isNullOrUndefined(this.screepsApi.getCreep(this.creepName)))
			return;

		let body = new this.CreepBodyFactory()
			.addPattern([CARRY, MOVE], 4)
			.addPattern([WORK], 1)
			.addPattern([CARRY], 7)
			.setSort([WORK, CARRY, MOVE])
			.setMaxCost(this.screepsApi.getObjectById(spawnHereId).room.energyAvailable)
			.fabricate();

		this.creepActions.spawn(this.creepName, body, spawnHereId);
	}

	onEveryTick()
	{
		this._updateState();
		this._executeState();
	}

	updateBuildings()
	{
		let layout = this.roomScoring.getRoom(this.memoryObject.roomName);

		let container = this.screepsApi.getStructureAt(layout.flower.container[0], STRUCTURE_CONTAINER);
		this.memoryObject.containerId = isNullOrUndefined(container) ? null : container.id;
		this.memoryObject.containerPos = layout.flower.container[0];

		let link = this.screepsApi.getStructureAt(layout.flower.link[0], STRUCTURE_LINK);
		this.memoryObject.linkId = isNullOrUndefined(link) ? null : link.id;
		this.memoryObject.linkPos = layout.flower.link[0];

		let storage = this.screepsApi.getStructureAt(layout.storage.storage[0], STRUCTURE_STORAGE);
		this.memoryObject.storageId = isNullOrUndefined(storage) ? null : storage.id;
		this.memoryObject.storagePos = layout.storage.storage[0];

		this.memoryObject.targetIds = [];

		for(let index in layout.flower.spawn)
		{
			let target = this.screepsApi.getStructureAt(layout.flower.spawn[index], STRUCTURE_SPAWN);
			if(!isNullOrUndefined(target))
				this.memoryObject.targetIds.push(target.id);
		}

		for(let index in layout.flower.extension)
		{
			let target = this.screepsApi.getStructureAt(layout.flower.extension[index], STRUCTURE_EXTENSION);
			if(!isNullOrUndefined(target))
				this.memoryObject.targetIds.push(target.id);
		}

		for(let index in layout.flower.tower)
		{
			let target = this.screepsApi.getStructureAt(layout.flower.tower[index], STRUCTURE_TOWER);
			if(!isNullOrUndefined(target))
				this.memoryObject.targetIds.push(target.id);
		}

		this.memoryObject.minerContainerIds = [];
		this.memoryObject.minerContainerPoss = [];

		for(let index in layout.mines)
		{
			const spot = layout.mines[index].miningSpot;
			this.memoryObject.minerContainerPoss.push(spot);
			let target = this.screepsApi.getStructureAt(spot, STRUCTURE_CONTAINER);
			if(!isNullOrUndefined(target))
				this.memoryObject.minerContainerIds.push(target.id);
		}

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

				if(creep.room.energyAvailable === creep.room.energyCapacityAvailable)
					this.memoryObject.state = STATES.OFFDUTY_FILL_SELF;
				else
					this.memoryObject.state = STATES.FILL_SELF;

				return;
			}

			case STATES.FILL_SELF:
			{
				if(creep.room.energyAvailable === creep.room.energyCapacityAvailable)
					this.memoryObject.state = STATES.OFFDUTY_FILL_SELF;
				else
					this.memoryObject.state = STATES.FILL_SELF;

				let energy = creep.carry[RESOURCE_ENERGY];
				if(energy !== 0 && !isUndefined(energy))
					this.memoryObject.state = STATES.FILL_ROOM;
				return;
			}

			case STATES.FILL_ROOM:
			{
				if(creep.room.energyAvailable === creep.room.energyCapacityAvailable)
					this.memoryObject.state = STATES.OFFDUTY_FILL_SELF;

				let energy = creep.carry[RESOURCE_ENERGY];
				if(energy === 0 || isUndefined(energy))
					this.memoryObject.state = STATES.FILL_SELF;
				return;
			}
			case STATES.OFFDUTY_FILL_SELF:
			{
				if(creep.room.energyAvailable !== creep.room.energyCapacityAvailable)
				{
					this.memoryObject.state = STATES.FILL_SELF;
					return;
				}

				if(creep.carry[RESOURCE_ENERGY] !== creep.carryCapacity)
					return;

				let link = this.screepsApi.getObjectById(this.memoryObject.linkId);
				let container = this.screepsApi.getObjectById(this.memoryObject.containerId);

				if(isNullOrUndefined(link) || isNullOrUndefined(container) ||
					container.store[RESOURCE_ENERGY] === CONTAINER_CAPACITY)
					this.memoryObject.state = STATES.OFFDUTY_WAIT;
				else
					this.memoryObject.state = STATES.OFFDUTY_FILL_CONTAINER;
				return;
			}
			case STATES.OFFDUTY_FILL_CONTAINER:
			{
				if(creep.room.energyAvailable !== creep.room.energyCapacityAvailable)
				{
					this.memoryObject.state = STATES.FILL_ROOM;
					return;
				}

				if(creep.carry[RESOURCE_ENERGY] !== creep.carryCapacity)
				{
					this.memoryObject.state = STATES.OFFDUTY_FILL_SELF;
					return;
				}

				let container = this.screepsApi.getObjectById(this.memoryObject.containerId);

				if(isNullOrUndefined(container) || container.store[RESOURCE_ENERGY] === CONTAINER_CAPACITY)
					this.memoryObject.state = STATES.OFFDUTY_WAIT;

				return;
			}
			case STATES.OFFDUTY_WAIT:
			{
				if(creep.room.energyAvailable !== creep.room.energyCapacityAvailable)
					this.memoryObject.state = STATES.FILL_ROOM;
				return;
			}
			case STATES.OFFDUTY_REPAIR:
			{
				return;
			}
		}
	}

	_executeState()
	{
		switch(this.memoryObject.state)
		{

			case STATES.FILL_SELF:
			{
				//look for flower-link
				let link = this.screepsApi.getObjectById(this.memoryObject.linkId);
				if(!isUndefinedOrNull(link) && link.energy !== 0)
				{
					if(this.creepActions.withdraw(this.creepName, link.id, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE)
						this.creepActions.moveTo(this.creepName, this.memoryObject.linkPos);
					return;
				}

				//look for flower-container
				let container = this.screepsApi.getObjectById(this.memoryObject.containerId);
				if(!isUndefinedOrNull(container) && !isUndefinedOrNull(container.store[RESOURCE_ENERGY]) &&
					container.store[RESOURCE_ENERGY] !== 0
				)
				{
					if(this.creepActions.withdraw(this.creepName, container.id, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE)
						this.creepActions.moveTo(this.creepName, this.memoryObject.containerPos);
					return;
				}

				//look for loose energy at flower-container position
				let energiesAtContainerPos = this.screepsApi.getRoomPosition(this.memoryObject.containerPos).lookFor(LOOK_ENERGY);
				if(energiesAtContainerPos.length !== 0)
				{
					if(this.creepActions.pickup(this.creepName, energiesAtContainerPos[0].id) === ERR_NOT_IN_RANGE)
						this.creepActions.moveTo(this.creepName, this.memoryObject.containerPos);
					return;
				}

				//look for energy at storage
				let storage = this.screepsApi.getObjectById(this.memoryObject.storageId);
				if(!isUndefinedOrNull(storage) && !isUndefinedOrNull(storage.store[RESOURCE_ENERGY]) &&
					storage.store[RESOURCE_ENERGY] !== 0
				)
				{
					if(this.creepActions.withdraw(this.creepName, storage.id, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE)
						this.creepActions.moveTo(this.creepName, this.memoryObject.storagePos);
					return;
				}

				//look for energy in mining containers
				for(let index in this.memoryObject.minerContainerIds)
				{
					let container = this.screepsApi.getObjectById(this.memoryObject.minerContainerIds[index]);
					if(!isUndefinedOrNull(container) && !isUndefinedOrNull(container.store[RESOURCE_ENERGY]) &&
						container.store[RESOURCE_ENERGY] !== 0
					)
					{
						if(this.creepActions.withdraw(this.creepName, container.id, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE)
							this.creepActions.moveTo(	this.creepName,
														[container.pos.x, container.pos.y, container.pos.roomName]);
						return;
					}
				}
				//look for loose energy at mining container positions
				for(let index in this.memoryObject.minerContainerPoss)
				{
					let energiesAtContainerPos = this.screepsApi.getRoomPosition(this.memoryObject.minerContainerPoss[index]).lookFor(LOOK_ENERGY);
					if(energiesAtContainerPos.length !== 0)
					{
						if(this.creepActions.pickup(this.creepName, energiesAtContainerPos[0].id) === ERR_NOT_IN_RANGE)
							this.creepActions.moveTo(this.creepName, this.memoryObject.minerContainerPoss[index]);
						return;
					}
				}

				return;
			}
			case STATES.FILL_ROOM:
			{
				let candidates = [];

				this.memoryObject.targetIds.forEach((targetId) =>
				{
					let candidate = this.screepsApi.getObjectById(targetId);

					if(candidate && candidate.energy !== candidate.energyCapacity)
						candidates.push(candidate);
				});

				let creep = this.screepsApi.getCreep(this.creepName);

				if(candidates.length === 0)
				{
					//look for manually placed first spawn that has not yet been automatically relocated.
					creep.room.find(FIND_STRUCTURES)
						.forEach((candidate)=>
						{
							if(candidate.structureType === STRUCTURE_SPAWN && candidate && candidate.energy !== candidate.energyCapacity)
								candidates.push(candidate);
						});

					if(candidates.length === 0)
						return;
				}

				let target = creep.pos.findClosestByPath(candidates);

				if(creep.transfer(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE)
					this.creepActions.moveTo(this.creepName, [target.pos.x, target.pos.y, target.pos.roomName]);

				break;

			}
			case STATES.OFFDUTY_FILL_SELF:
			{
				let creep = this.screepsApi.getCreep(this.creepName);
				let containerPos = this.memoryObject.containerPos;
				let parkingDistance = isNullOrUndefined(this.memoryObject.containerId) ? 1 : 0;

				if(creep.pos.getRangeTo(containerPos[0], containerPos[1]) > parkingDistance)
					return this.creepActions.moveTo(this.creepName, this.memoryObject.containerPos);

				let link = this.screepsApi.getObjectById(this.memoryObject.linkId);
				if(!isUndefinedOrNull(link))
				{
					if(link.energy !== 0)
						this.creepActions.withdraw(this.creepName, link.id, RESOURCE_ENERGY);
					return;
				}

				let container = this.screepsApi.getObjectById(this.memoryObject.containerId);
				if(!isUndefinedOrNull(container))
				{
					if(container.store.energy !== 0)
						this.creepActions.withdraw(this.creepName, container.id, RESOURCE_ENERGY);
					return;
				}

				let energiesAtContainerPos = this.screepsApi.getRoomPosition(this.memoryObject.containerPos).lookFor(LOOK_ENERGY);
				if(energiesAtContainerPos.length !== 0)
				{
					if(this.creepActions.pickup(this.creepName, energiesAtContainerPos[0].id))
					return;
				}

				return;
			}
			case STATES.OFFDUTY_FILL_CONTAINER:
			{
				let container = this.screepsApi.getObjectById(this.memoryObject.containerId);

				if(!isUndefinedOrNull(container))
					this.creepActions.deposit(this.creepName, this.memoryObject.containerId, RESOURCE_ENERGY);

				return;
			}
			case STATES.END:
				let parent = this.actors.get(this.memoryObject.callbackTo.actorId);

				if(!isNullOrUndefined(parent))
					parent[this.memoryObject.callbackTo.diedFunctionName]();

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
		this.initiateActor(oldMemory.callbackTo, oldMemory.roomName, null);
	}
};