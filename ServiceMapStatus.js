"use strict";

const BELONGING_OWN = "belongingOwn";
const BELONGING_ENEMY = "belongingEnemy";
const BELONGING_NONE = "belongingNone";
const NO_CONTROLLER = "noController";

const ServiceWithMemory = require('ServiceWithMemory');

module.exports = class ServiceMapStatus extends ServiceWithMemory
{
	constructor(locator)
	{
		super(locator);

		this.screepsApi = locator.getService(SERVICE_NAMES.SCREEPS_API);
		this.logger = locator.getService(SERVICE_NAMES.LOGGER);
	}

	resetService()
	{
		super.resetService();
		this.memoryObject.rooms = {};
	}

	setBelongingToNone(roomName)
	{
		this.memoryObject.rooms[roomName] = BELONGING_NONE;
	}

	setBelongingToOwn(roomName)
	{
		this.memoryObject.rooms[roomName] = BELONGING_OWN;
	}

	setBelongingToEnemy(roomName)
	{
		this.memoryObject.rooms[roomName] = BELONGING_ENEMY;
	}

	findAndSetStatusOfRoom(roomName)
	{
		let room = this.screepsApi.getRoom(roomName);

		if(isUndefined(room))
		{
			this.logger.warning(
				"at ServiceMapStatus.findAndSetStatusOfRoom: tried to set status of room without visibility: " +
				roomName);
			return;
		}

		if(!room.controller)
			this.memoryObject.rooms[roomName] = NO_CONTROLLER;

		else if(!room.controller.owner && !room.controller.reservation)
			this.memoryObject.rooms[roomName] = BELONGING_NONE;

		else if((room.controller.owner && room.controller.owner.username === MY_USERNAME) ||
			(room.controller.reservation && room.controller.reservation.username === MY_USERNAME))
			this.memoryObject.rooms[roomName] = BELONGING_OWN;

		else
			this.memoryObject.rooms[roomName] = BELONGING_ENEMY;

		return this.memoryObject.rooms[roomName];
	}

	setNoController(roomName)
	{
		this.memoryObject.rooms[roomName] = NO_CONTROLLER;
	}

	isBelongingToNone(roomName)
	{
		return this.memoryObject.rooms[roomName] === BELONGING_NONE;
	}

	isBelongingToOwn(roomName)
	{
		return this.memoryObject.rooms[roomName] === BELONGING_OWN;
	}

	isBelongingToEnemy(roomName)
	{
		return this.memoryObject.rooms[roomName] === BELONGING_ENEMY;
	}

	hasNoController(roomName)
	{
		return this.memoryObject.rooms[roomName] === NO_CONTROLLER;
	}

};