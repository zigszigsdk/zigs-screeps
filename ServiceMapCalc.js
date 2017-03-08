"use strict";

function isNumeric(n)
{
	return !isNaN(parseFloat(n)) && isFinite(n);
}

const Service = require('Service');

module.exports = class ServiceMapCalc extends Service
{
	constructor(core)
	{
		super(core);
	}

	parseRoomName(roomName)
	{
		let indexOfSecondLetter;
		for(indexOfSecondLetter = 1; indexOfSecondLetter <= roomName.length; indexOfSecondLetter++)
			if(!isNumeric(roomName[indexOfSecondLetter]))
				break;

		let result =
			{ name: roomName
			, horizontal:
				{ half: roomName[0] //"E" or "W", matching the globals EAST and WEST
				, distance: roomName.substr(1, indexOfSecondLetter-1)
				}
			, vertical:
				{ half: roomName[indexOfSecondLetter] //"N" or "S", matching the globals NORTH and SOUTH
				, distance: roomName.substr(indexOfSecondLetter+1, roomName.length-indexOfSecondLetter+1)
				}
			};

		return result;
	}

	IsRoomInsideArea(roomName, area)
	{
		let numericArea = this._areaToNumericArea(area);
		let numericRoom = this._roomToNumericRoom(this.parseRoomName(roomName));

		return 	numericRoom.vertical >= numericArea.top &&
				numericRoom.vertical <= numericArea.bottom &&
				numericRoom.horizontal >= numericArea.left &&
				numericRoom.horizontal <= numericArea.right;
	}

	_areaToNumericArea(area)
	{
		return 	{ top: this._toNumericCoordinate(area.top)
				, bottom: this._toNumericCoordinate(area.bottom)
				, left: this._toNumericCoordinate(area.left)
				, right: this._toNumericCoordinate(area.right)
				};
	}

	_roomToNumericRoom(room)
	{
		return 	{ horizontal: this._toNumericCoordinate(room.horizontal)
				, vertical: this._toNumericCoordinate(room.vertical)
				};
	}

	_toNumericCoordinate(coordinate)
	{
		if(coordinate.half === WEST || coordinate.half === NORTH)
			return -coordinate.distance;
		return coordinate.distance;
	}


};
