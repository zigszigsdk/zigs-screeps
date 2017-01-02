"use strict";
module.exports =
{
    build: function()
    {
        //build order is important
        this.logger.build(this);
        this.memoryBank.build(this);
        this.subscriptions.build(this);
        this.eventLoop.build(this);
        this.resetter.build(this);
        this.actors.build(this);

        this.rewind();
    },

    rewind: function()
    {
        //rewind order is important

        this.memoryBank.rewind();
        this.logger.rewind();
        this.subscriptions.rewind();
        this.eventQueue.rewind();
        this.actors.rewind();
    },

    unwind: function()
    {
        //unwind order is important

        this.actors.unwind();
        this.subscriptions.unwind();
        this.logger.unwind();
        this.memoryBank.unwind();
    },

    hardReset: function()
    {
        this.memoryBank.hardReset();
        this.logger.hardReset();
        this.subscriptions.hardReset();
        this.actors.hardReset();
        this.resetter.hardReset();
    },

    logger: require('logger'),
    eventLoop: require('eventLoop'),
    eventQueue: require('eventQueue'),
    subscriptions: require('subscriptions'),
    memoryBank: require('memoryBank'),
    actors: require('actors'),
    resetter: require('resetter'),
};