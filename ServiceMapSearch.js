'use strict';

const MAX_SEARCH_ITERATIONS = 50;

const Service = require('Service');

module.exports = class ServiceMapSearch extends Service
{
	searchBreadthFirst(fromRoomName, acceptFunc, returnFunc, filterFunc)
	{
		return this.search(fromRoomName, acceptFunc, returnFunc, filterFunc, this._breadthFirstScoring);
	}

	search(fromRoomName, acceptFunc, returnFunc, filterFunc, scoringFunc)
	{
		let visitedRooms =
		{	[fromRoomName]:
				{ score: 0
				, parentRoomName: null
				, roomName: fromRoomName
				}
		};

		let nextCandidates = [];
		nextCandidates.push(fromRoomName);

		for(let iteration = 0; iteration < MAX_SEARCH_ITERATIONS && nextCandidates.length > 0; iteration++)
		{
			nextCandidates.sort((a, b) => visitedRooms[b].score - visitedRooms[a].score); //descending

			let roomName = nextCandidates.shift();
			let room = visitedRooms[roomName];

			if(acceptFunc(room, fromRoomName, visitedRooms))
				return returnFunc(room, fromRoomName, visitedRooms);


			let connectedRooms = Game.map.describeExits(roomName);  //k:v = direction:roomName
			let keys = Object.keys(connectedRooms);

			for(let keyIndex in keys)
			{
				let connectedRoomName = connectedRooms[keys[keyIndex]];

				if(typeof visitedRooms[connectedRoomName] !== UNDEFINED)
					continue; //room has already been searched

				visitedRooms[connectedRoomName] =
					{ roomName: connectedRoomName
					, parentRoomName: roomName
					};

				//late setting of score such that the function can use connectedRoomName's entry in visitedRooms
				visitedRooms[connectedRoomName].score = scoringFunc(connectedRoomName, fromRoomName, visitedRooms);

				if(filterFunc(connectedRoomName, fromRoomName, visitedRooms))
					nextCandidates.push(connectedRoomName);
			}
		}

		return null;
	}

	_breadthFirstScoring(thisRoomName, fromRoomName, visitedRooms)
	{
		if(fromRoomName === thisRoomName)
			return 0;

		return visitedRooms[thisRoomName].score - 1;
	}
};