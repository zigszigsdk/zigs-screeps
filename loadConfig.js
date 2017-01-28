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
		{ SPAWN_RECOVERY_FILLER: 1200
		, SPAWN_RECOVERY_MINER: 1150
		, SPAWN_FILLER: 1100
		, SPAWN_FIRST_MINER: 1050
		, SPAWN_MINER: 1000
		, SPAWN_HAULER: 900
		, SPAWN_UPGRADER: 800
		, SPAWN_BUILDER: 700
		, SPAWN_FIXER: 600
		, SPAWN_OFFENSE: 500

		, BUILD_TOWER: 1100
		, BUILD_EXTENSION: 1000
		, BUILD_SPAWN: 900
		, BUILD_DROP_MINING_CONTAINER: 800
		, BUILD_UPGRADER_CONTAINER: 700
		, BUILD_FLOWER_LINK: 500
		, BUILD_FLOWER_ROAD: 400
		, BUILD_FLOWER_CONTAINER: 300
		, BUILD_STORAGE: 200

		, RESOURCE_UPGRADE: 900
		};
};