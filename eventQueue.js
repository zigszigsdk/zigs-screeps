"use strict";

module.exports = class EventQueue
{
	rewindCore()
	{
		this.queue = [EVENTS.EVERY_TICK, EVENTS.EVERY_TICK_EARLY];

		if(Game.cpu.bucket >= REQUIRED_BUCKET_FOR_LATE_TICK)
			this.rearLoad(EVENTS.EVERY_TICK_LATE);
	}

	frontLoad(item)
	{
		this.queue.push(item);
	}

	rearLoad(item)
	{
		this.queue.unshift(item);
	}

	next()
	{
		if(this.queue.length === 0)
			return null;

		return this.queue.pop();
	}
};