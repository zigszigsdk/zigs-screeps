"use strict";

const MAX_BODYPARTS = 50;

module.exports = class CreepBodyFactory
{
	constructor()
	{
		this.data =
			{ maxCost: 0
			, patterns: []
			, replaces: []
			, sortOrder: []
		};
	}

	addPattern(patternList, maxTimes)
	{
		this.data.patterns.push(	{ pattern: patternList
									, maxTimes: maxTimes });
		return this;
	}

	addReplace(oldPart, newPart, maxTimes)
	{
		this.data.replaces.push( 	{ oldPart: oldPart
									, newPart: newPart
									, maxTimes: maxTimes });
		return this;
	}

	setSort(order)
	{
		this.data.sortOrder = order;

		return this;
	}

	setMaxCost(maxCost)
	{
		this.data.maxCost = maxCost;

		return this;
	}

	export()
	{
		return this.data;
	}

	import(data)
	{
		this.data = data;

		return this;
	}

	fabricate()
	{
		let bodypartPrice = ((part) =>
        {
            switch(part)
            {
                case MOVE:          return  50;
                case CARRY:         return  50;
                case WORK:          return 100;
                case ATTACK:        return  80;
                case RANGED_ATTACK: return 150;
                case HEAL:          return 250;
                case CLAIM:         return 600;
                case TOUGH:         return  10;
                default: 			return Number.MAX_SAFE_INTEGER;}});

		let maxCost = this.data.maxCost;
		let currentCost = 0;
		let result = [];

		this.data.patterns.forEach(function(patternObject)
		{
			for(let repeats = 0; repeats < patternObject.maxTimes; repeats++)
			{
				patternObject.pattern.forEach( function(part)
				{
					let price = bodypartPrice(part);
					if(price + currentCost > maxCost || result.length >= MAX_BODYPARTS)
						return;

					currentCost += price;
					result.push(part);
				});
			}
		});

		this.data.replaces.forEach(function(replaceObject)
		{
			for(let repeats = 0; repeats < replaceObject.maxTimes; repeats++)
			{
				let index = result.indexOf(replaceObject.oldPart);
				if(index === -1)
					break;

				let oldCost = bodypartPrice(replaceObject.oldPart);
				let newCost = bodypartPrice(replaceObject.newPart);

				if(currentCost - oldCost + newCost > maxCost)
					break;

				currentCost += newCost - oldCost;
				result[index] = replaceObject.newPart;
			}
		} );

		if(this.data.sortOrder.length !== 0)
			result = _.sortBy(result, (part)=> this.data.sortOrder.indexOf(part));

		return result;
	}
};