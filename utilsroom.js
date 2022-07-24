const os = require('os');

const common = require('common');

const construction = require('construction');

const pathFinder = require('pathFinder');

const military = require('military');

let closestRoomMappingSpawn = {};
let closestRoomMappingTick = Game.time;

var utilsroom = {

    getClosestRoomFromRoom(spawnsMapping, roomName) {
        // first if game tick isnt the same than clear it
        if (Game.time != closestRoomMappingTick) {
            closestRoomMappingSpawn = {};
            closestRoomMappingTick = Game.time;
        }

        // check if the mapping exists
        if (roomName in closestRoomMappingSpawn) {
            return closestRoomMappingSpawn[roomName];
        }
        let closest = 9999999;
        let closestRoomName = null;
        for (const otherRoomName in spawnsMapping) {
            const d = Game.map.getRoomLinearDistance(roomName, otherRoomName);
            if (d < closest) {
                closest = d;
                closestRoomName = otherRoomName;
            }
        }
        closestRoomMappingSpawn[roomName] = closestRoomName;
        return closestRoomName;
    },

    constructRooms: function(room) {
        const roomName = room.name
        let name = 'construction-' + roomName + '-watcher'
        if (!os.existsThread(name)) {
            const f = function() {
                construction.generateThreads(room);
            }
            os.newTimedThread(name, f, 10, 0, 40); // spawn a new timed thread that runs every 40 ticks
        }

        name = 'pathFinder-' + roomName + '-watcher'
        if (!os.existsThread(name)) {
            const f = function() {
                pathFinder.generateThreads(roomName);
            }
            os.newTimedThread(name, f, 10, 0, 40); // spawn a new timed thread that runs every 40 ticks
        }

        name = 'military-' + roomName + '-watcher'
        if (!os.existsThread(name)) {
            const f = function() {
                military.generateThreads(roomName);
            }
            os.newThread(name, f, 10);
        }
    },

    upgradeRooms: function(r) {
        const roomName = r.name;
        let name = 'upgradeRooms-' + roomName + '-watcher'
        if (!os.existsThread(name)) {
            const f = function() {
                for (const role in common.creepMapping) {
                    if (!(roomName in Game.rooms) || Game.rooms[roomName].energyCapacityAvailable == 0) {
                        continue;
                    }
                    const name = 'roomUpgrader-' + roomName + '-role-' + role;
                    if (!os.existsThread(name)) {
                        const f = function() {
                            const room = Game.rooms[roomName];
                            if (!room) {
                                console.log('utilsroom upgrade rooms room is empty ' + roomName + ' ' + room);
                                return; 
                            }
                            common.creepMapping[role].upgrade(room);
                        }
                        os.newTimedThread(name, f, 10, 0, 10);
                    }
                }
            }
            os.newTimedThread(name, f, 10, 10, 100); // spawn a new timed thread that runs every 40 ticks
        }
    },

    handleSources: function(room) {
        const sources = room.find(FIND_SOURCES);
        const roomName = room.name;
        for (var id in sources) {
            const name = 'handleSources-' + room.name + '-' + id;
            const source = sources[id];
            if (!os.existsThread(name)) {
                const f = function() {
                    room = Game.rooms[roomName];
                    if (!room) {
                        return;
                    }``
                    construction.build_link_near_sources(source);

                    // set sources energy request to 0
                    if (room.memory.sources == null) {
                        room.memory.sources = {};
                    }
                    if (!(source.id in room.memory.sources)) {
                        room.memory.sources[source.id] = {};
                    }
                    if (room.memory.sources[source.id].creeps == null) {
                        room.memory.sources[source.id].creeps = {};
                    }
                    
                    if (room.controller == undefined || !room.controller.my) {
                        // Let's go ahead and scout this room
                        room.memory.sources[source.id].x = source.pos.x;
                        room.memory.sources[source.id].y = source.pos.y;
                    }

                    if (room.memory.sources[source.id].maxCreeps == null) {
                        // let's try find the max creeps we can support
                        const a = room.lookAtArea(source.pos.y-1, source.pos.x-1, source.pos.y+1, source.pos.x+1, true);
                        count = 0
                        positions = [];
                        for (const aK in a) {
                            const aV = a[aK];
                            if (aV.type == 'terrain' && (aV.terrain == 'plain' || aV.terrain == 'swamp')) {
                                count += 1;
                                positions.push([aV.x, aV.y])
                            }
                        }
                        room.memory.sources[source.id].maxCreeps = {positions: positions, maxCount: count, occupied: new Array(count).fill(0)};
                    }
                    
                    if (room.memory.sources[source.id].smartCreep != null &&
                        Game.creeps[room.memory.sources[source.id].smartCreep] == null) {
                        room.memory.sources[source.id].smartCreep = null
                    }

                    let totalRequest = 0;
                    for (const c in room.memory.sources[source.id].creeps) {
                        const v = room.memory.sources[source.id].creeps[c];
                        if (v.lastTicked == null) {
                            room.memory.sources[source.id].maxCreeps.occupied[v.maxCreepsIndexPosition] = 0;
                            delete room.memory.sources[source.id].creeps[c];
                        } else if (Game.time > v.lastTicked + 3) {
                            room.memory.sources[source.id].maxCreeps.occupied[v.maxCreepsIndexPosition] = 0;
                            delete room.memory.sources[source.id].creeps[c];
                        } else {
                            if (Game.creeps[c] != undefined) {
                                totalRequest += Game.creeps[c].store.getFreeCapacity();
                                // let's go ahead and set this to 1 incase we had cleared it earlier or something
                                room.memory.sources[source.id].maxCreeps.occupied[v.maxCreepsIndexPosition] = 1;
                            }
                        }
                    }
                    room.memory.sources[source.id].totalEnergyWant = totalRequest;
                }
                os.newThread(name, f, 1, true);
            }
        }
    }
}
module.exports = utilsroom;