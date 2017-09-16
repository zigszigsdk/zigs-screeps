"use strict";

const Service = require('Service');

module.exports = class ServiceMapNavigation extends Service
{
	constructor(locator)
	{
		super();

		const mapStatus = locator.getService(SERVICE_NAMES.MAP_STATUS);
		const mapCalc = locator.getService(SERVICE_NAMES.MAP_CALC);
		this.mapSearch = locator.getService(SERVICE_NAMES.MAP_SEARCH);

		//functions passed as parameters cannot access class instance 'this'.
		this._safeRoomFilter = function(roomName)
		{
			return !mapStatus.isBelongingToEnemy(roomName);
		};

		this._noviceAreaFilter = function(roomName)
		{
			return mapCalc.IsRoomInsideArea(roomName, NOVICEAREA_BOX);
		};
	}

	findPath(fromRoomName, toRoomName, roomFilters = [])
	{
		if(IN_NOVICEAREA)
			roomFilters.push(this._noviceAreaFilter);

		return this.mapSearch.searchBreadthFirst(
												fromRoomName,
												this._makeAcceptFunction(toRoomName),
												this._backtrackPath,
												this._makeFilterFunction(roomFilters)
												);

	}

	findSafePath(fromRoomName, toRoomName, roomFilters = [])
	{
		roomFilters.push(this._safeRoomFilter);
		return this.findPath(fromRoomName, toRoomName, roomFilters);
	}

	findAllRoomsWithinRange(fromRoom, range, roomFilters = [])
	{
		if(IN_NOVICEAREA)
			roomFilters.push(this._noviceAreaFilter);
	}

	_makeAcceptFunction(toRoomName)
	{
		return function (room, fromRoomName, visitedRooms)
		{
			return room.roomName === toRoomName;
		};
	}

	_makeFilterFunction(roomFilters)
	{
		return function(roomName)
		{
			for(let index in roomFilters)
				if(! roomFilters[index](roomName) )
					return false;

			return true;
		};
	}

	_backtrackPath(room, fromRoomName, visitedRooms)
	{
		let path = [];
		let nextRoomName = room.roomName;

		while(nextRoomName !== fromRoomName)
		{
			path.unshift(nextRoomName);
			nextRoomName = visitedRooms[nextRoomName].parentRoomName;
		}
		return path;
	}

};