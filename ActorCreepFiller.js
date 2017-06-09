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
	constructor(core)
	{
		super(core);
		this.creepActions = core.getService(SERVICE_NAMES.CREEP_ACTIONS);
	}

	rewindActor(actorId)
	{
		super.rewindActor(actorId);
		if(!isUndefinedOrNull(this.memoryObject.roomName))
			this.creepName = NAME_PREFIX + this.memoryObject.roomName;
	}

	initiateActor(callbackTo, roomName, spawnHereId)
	{
		let layout = this.core.getService(SERVICE_NAMES.ROOM_SCORING).getRoom(roomName);

		let container = this.core.getStructureAt(layout.flower.container[0], STRUCTURE_CONTAINER);
		let link = this.core.getStructureAt(layout.flower.link[0], STRUCTURE_LINK);
		let storage = this.core.getStructureAt(layout.storage.storage[0], STRUCTURE_STORAGE);

		let targetIds = [];

		for(let index in layout.flower.spawn)
		{
			let target = this.core.getStructureAt(layout.flower.spawn[index], STRUCTURE_SPAWN);
			if(!isNullOrUndefined(target))
				targetIds.push(target.id);
		}
		for(let index in layout.flower.extension)
		{
			let target = this.core.getStructureAt(layout.flower.extension[index], STRUCTURE_EXTENSION);
			if(!isNullOrUndefined(target))
				targetIds.push(target.id);
		}
		for(let index in layout.flower.tower)
		{
			let target = this.core.getStructureAt(layout.flower.tower[index], STRUCTURE_TOWER);
			if(!isNullOrUndefined(target))
				targetIds.push(target.id);
		}


		this.memoryObject =
			{ callbackTo: callbackTo
			, roomName: roomName
			, state: STATES.SPAWNING
			, containerId: isNullOrUndefined(container) ? null : container.id
			, linkId: isNullOrUndefined(link) ? null : link.id
			, storageId: isNullOrUndefined(storage) ? null : storage.id
			, containerPos: layout.flower.container[0]
			, linkPos: layout.flower.link[0]
			, storagePos: layout.storage.storage[0]
			, targetIds: targetIds
			};

		this.creepName = NAME_PREFIX + roomName;

		this.core.subscribe(EVENTS.EVERY_TICK, this.actorId, "onEveryTick");

		if(!isNullOrUndefined(this.core.getCreep(this.creepName)))
			return;

		let CreepBodyFactory = this.core.getClass(CLASS_NAMES.CREEP_BODY_FACTORY);

		let body = new CreepBodyFactory()
			.addPattern([CARRY, MOVE], 4)
			.addPattern([WORK], 1)
			.addPattern([CARRY], 7)
			.setSort([WORK, CARRY, MOVE])
			.setMaxCost(this.core.getObjectById(spawnHereId).room.energyAvailable)
			.fabricate();

		this.creepActions.spawn(this.creepName, body, spawnHereId);
	}

	onEveryTick()
	{
		this._updateState();
		this._executeState();
	}

	_updateState()
	{
		let creep = this.core.getCreep(this.creepName);
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

				let link = this.core.getObjectById(this.memoryObject.linkId);
				let container = this.core.getObjectById(this.memoryObject.containerId);

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

				let container = this.core.getObjectById(this.memoryObject.containerId);

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
				let link = this.core.getObjectById(this.memoryObject.linkId);
				if(!isUndefinedOrNull(link) && link.energy !== 0)
				{
					if(this.creepActions.withdraw(this.creepName, link.id, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE)
						this.creepActions.moveTo(this.creepName, this.memoryObject.linkPos);
					return;
				}

				//look for flower-container
				let container = this.core.getObjectById(this.memoryObject.containerId);
				if(!isUndefinedOrNull(container) && !isUndefinedOrNull(container.store[RESOURCE_ENERGY]) &&
					container.store[RESOURCE_ENERGY] !== 0
				)
				{
					if(this.creepActions.withdraw(this.creepName, container.id, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE)
						this.creepActions.moveTo(this.creepName, this.memoryObject.containerPos);
					return;
				}

				//look for loose energy at flower-container position
				let energiesAtContainerPos = this.core.getRoomPosition(this.memoryObject.containerPos).lookFor(LOOK_ENERGY);
				if(energiesAtContainerPos.length !== 0)
				{
					if(this.creepActions.pickup(this.creepName, energiesAtContainerPos[0].id) === ERR_NOT_IN_RANGE)
						this.creepActions.moveTo(this.creepName, this.memoryObject.containerPos);
					return;
				}

				//look for energy at storage
				let storage = this.core.getObjectById(this.memoryObject.storageId);
				if(!isUndefinedOrNull(storage) && !isUndefinedOrNull(storage.store[RESOURCE_ENERGY]) &&
					storage.store[RESOURCE_ENERGY] !== 0
				)
				{
					if(this.creepActions.withdraw(this.creepName, storage.id, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE)
						this.creepActions.moveTo(this.creepName, this.memoryObject.storagePos);
					return;
				}

				return;
			}
			case STATES.FILL_ROOM:
			{
				let candidates = [];

				this.memoryObject.targetIds.forEach((targetId) =>
				{
					let candidate = this.core.getObjectById(targetId);

					if(candidate && candidate.energy !== candidate.energyCapacity)
						candidates.push(candidate);
				});

				let creep = this.core.getCreep(this.creepName);

				if(candidates.length === 0)
				{
					//look for manually placed first spawn that has not yet been automatically relocated.
					creep.room.find(FIND_STRUCTURES, (x)=>x.structureType === STRUCTURE_SPAWN)
						.forEach((candidate)=>
						{
							if(candidate && candidate.energy !== candidate.energyCapacity)
								candidates.push(candidate);
						});

					if(candidates.length === 0)
						return;
				}

				let target = creep.pos.findClosestByPath(candidates);

				if(creep.transfer(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE)
					creep.moveTo(target);

				break;

			}
			case STATES.OFFDUTY_FILL_SELF:
			{
				let creep = this.core.getCreep(this.creepName);
				if(creep.pos.x !== this.memoryObject.containerPos[0] ||
					creep.pos.y !== this.memoryObject.containerPos[1] ||
					creep.room.name !== this.memoryObject.containerPos[2]
				)
					return this.creepActions.moveTo(this.creepName, this.memoryObject.containerPos);

				let link = this.core.getObjectById(this.memoryObject.linkId);
				if(!isUndefinedOrNull(link) && link.energy !== 0)
					this.creepActions.withdraw(this.creepName, link.id, RESOURCE_ENERGY);

				return;
			}
			case STATES.OFFDUTY_FILL_CONTAINER:
			{
				let container = this.core.getObjectById(this.memoryObject.containerId);

				if(!isUndefinedOrNull(container))
					this.creepActions.deposit(this.creepName, this.memoryObject.containerId, RESOURCE_ENERGY);

				return;
			}
			case STATES.END:
				let parent = this.core.getActor(this.memoryObject.callbackTo.actorId);

				if(!isNullOrUndefined(parent))
					parent[this.memoryObject.callbackTo.diedFunctionName]();

				this.core.removeActor(this.actorId);
				return;
		}
	}

	removeActor()
	{
		this.core.unsubscribe(EVENTS.EVERY_TICK, this.actorId);
		super.removeActor();
	}

	resetActor()
	{
		let oldMemory = JSON.parse(JSON.stringify(this.memoryObject));
		this.initiateActor(oldMemory.callbackTo, oldMemory.roomName, null);
	}
};