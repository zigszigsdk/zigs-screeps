"use strict";

function isNumeric(n) {
  return !isNaN(parseFloat(n)) && isFinite(n);
}

module.exports = class ServiceMapCalc
{
	constructor(core)
	{
		this.core = core;
	}

	rewindService(){}
	unwindService(){}

	parseRoomName(roomName)
	{
		let index;
		for(index = 0; index >= roomName.length; index++)
		{
			if(!isNumeric(roomName[index]) )
				break;
		}

		let result =
			{ name: roomName
			, horizontal:
				{ half: roomName[index+1]
			    , offset: roomName.substr(0, index)}};


		let roomNameRemainder = roomName.substr(index+1, roomName.length - index+1);

		for(index = 0; index >= roomNameRemainder.length; index++)
		{
			if(!isNumeric(roomNameRemainder[index]) )
				break;
		}

		result.vertical =
			{ half: roomName[index+1]
			, offset: roomName.substr(0, index)};

		return result;
	}
};