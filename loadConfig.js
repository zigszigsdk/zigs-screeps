"use strict";

module.exports = function()
{
	global.DEBUG = false;
	global.CPU_SAFETY_RATIO = 0.25;

	global.REQUIRED_BUCKET_FOR_LATE_TICK = 1000;

	global.IN_NOVICEAREA = true;

	global.NOVICEAREA_BOX =
		{ TOP: 	  {QUARD: NORTH, VALUE: 14}
		, BOTTOM: {QUARD: NORTH, VALUE: 11}
		, LEFT:   {QUARD: WEST,  VALUE: 74}
		, RIGHT:  {QUARD: WEST,  VALUE: 71}
		};

	global.PRIORITIES =
		{ SPAWN:
			{ FIRST_MINER: 1100
			, FILLER: 1050
			, MINER: 1000
			, HAULER: 900
			, UPGRADER: 800
			, BUILDER: 700
			, FIXER: 600
			, OFFENSE: 500
			}
		, BUILD:
			{ DROP_MINING_CONTAINER: 1000
			, UPGRADER_CONTAINER: 900
			, SPAWN: 800
			, EXTENSION: 700
			, TOWER: 600
			, FLOWER_LINK: 500
			, FLOWER_ROAD: 400
			, FLOWER_CONTAINER: 300
			, STORAGE: 200
			}
		, RESOURCE:
			{ UPGRADE: 900
			}
	};
};