const os = require('os');

const common = require('common');

const construction = require('construction');

const pathFinder = require('pathFinder');

const military = require('military');

let closestRoomMappingSpawn = {};
let closestRoomMappingTick = Game.time;

var utilsroom = {

    doesStructureExist: function(pos, struct) {
        const structs = pos.lookFor(LOOK_STRUCTURES);
        for (const s in structs) {
            if (structs[s].structureType == struct) {
                return structs[s].id;
            }
        }
        return false;
    },

    getClosestRoomFromRoom: function(spawnsMapping, roomName, array=false) {
        // first if game tick isnt the same than clear it
        if (Game.time != closestRoomMappingTick) {
            closestRoomMappingSpawn = {};
            closestRoomMappingTick = Game.time;
        }

        // check if the mapping exists
        if (roomName in closestRoomMappingSpawn) {
            if (array)
                return closestRoomMappingSpawn[roomName];
            return closestRoomMappingSpawn[roomName][0];
        }
        let mapping = [];
        for (const otherRoomName in spawnsMapping) {
            const d = Game.map.getRoomLinearDistance(roomName, otherRoomName);
            mapping.push({d:d, name:otherRoomName});
        }
        mapping.sort((a, b) => a.d - b.d)
        mapping = mapping.map(f => f.name);
        closestRoomMappingSpawn[roomName] = mapping;
        if (array) 
            return closestRoomMappingSpawn[roomName];
        return closestRoomMappingSpawn[roomName][0];
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

    upgradeRooms: function(r, creepMapping) {
        const roomName = r.name;
        let n = 'upgradeRooms-' + roomName + '-watcher'
        if (!os.existsThread(n)) {
            const f = function() {
                for (const role in creepMapping) {
                    // todo i might need to fix this maybe itll generate in every room?
                    if (!(roomName in Game.rooms)) { //|| Game.rooms[roomName].energyCapacityAvailable == 0) {
                        continue;
                    }
                    const name = 'roomUpgrader-' + roomName + '-role-' + role;
                    if (!os.existsThread(name)) {
                        const f = function() {
                            const room = Game.rooms[roomName];
                            if (!room) {
                                //console.log('utilsroom upgrade rooms room is empty ' + roomName + ' ' + room);
                                return; 
                            }
                            if (!room.controller || !room.controller.my) {
                                return;
                            }
                            creepMapping[role].upgrade(room);
                        }
                        os.newTimedThread(name, f, 10, 0, 10);
                    }
                }
            }
            os.newTimedThread(n, f, 10, 10, 100); // spawn a new timed thread that runs every 40 ticks
        }
    },

    cleanupSources: function(roomName, sourceId) {
        // remove dead canharvester
        if (Memory.rooms[roomName].sources[sourceId].canCreep != null &&
            Game.creeps[Memory.rooms[roomName].sources[sourceId].canCreep] == null) {
            Memory.rooms[roomName].sources[sourceId].canCreep = undefined;
        }

        let totalRequest = 0;
        const creeps = Memory.rooms[roomName].sources[sourceId].creeps;
        for (const c in creeps) {
            const v = creeps[c];
            if (v.lastTicked == null) {
                Memory.rooms[roomName].sources[sourceId].maxCreeps.occupied[v.maxCreepsIndexPosition] = 0;
                delete Memory.rooms[roomName].sources[sourceId].creeps[c];
            } else if (Game.time > v.lastTicked + 3) {
                Memory.rooms[roomName].sources[sourceId].maxCreeps.occupied[v.maxCreepsIndexPosition] = 0;
                delete Memory.rooms[roomName].sources[sourceId].creeps[c];
            } else {
                if (Game.creeps[c] != undefined) {
                    totalRequest += Game.creeps[c].store.getFreeCapacity();
                    // let's go ahead and set this to 1 incase we had cleared it earlier or something
                    if (!Memory.rooms[roomName].sources[sourceId].canCreep) // only set to 1 if we are not can mining
                        Memory.rooms[roomName].sources[sourceId].maxCreeps.occupied[v.maxCreepsIndexPosition] = 1;
                }
            }
        }
        Memory.rooms[roomName].sources[sourceId].totalEnergyWant = totalRequest;
    },

    handleSources: function(room) {
        const sources = room.find(FIND_SOURCES);
        const roomName = room.name;
        for (var id in sources) {
            const name = 'handleSources-' + room.name + '-' + id;
            const sourceId = sources[id].id;
            if (!os.existsThread(name)) {
                const f = function() {
                    const source = Game.getObjectById(sourceId);
                    room = Game.rooms[roomName];
                    if (!room) {
                        return;
                    }
                    construction.build_link_near_sources(source);

                    // set sources energy request to 0
                    if (room.memory.sources == null) {
                        room.memory.sources = {};
                    }
                    if (!(sourceId in room.memory.sources)) {
                        room.memory.sources[sourceId] = {};
                    }
                    if (room.memory.sources[sourceId].creeps == null) {
                        room.memory.sources[sourceId].creeps = {};
                    }
                    
                    if (room.controller == undefined || !room.controller.my) {
                        // Let's go ahead and scout this room
                        room.memory.sources[sourceId].x = source.pos.x;
                        room.memory.sources[sourceId].y = source.pos.y;
                    }

                    const a = room.lookAtArea(source.pos.y-1, source.pos.x-1, source.pos.y+1, source.pos.x+1, true);
                    let count = 0
                    let tempPositions = {};
                    for (const aK in a) {
                        const aV = a[aK];
                        const k = `${aV.x}-${aV.y}`;
                        if (aV.type == 'terrain' && (aV.terrain == 'plain' || aV.terrain == 'swamp')) {
                            if (!(k in tempPositions)) {
                                tempPositions[k] = true;
                                count++;
                            }
                        } else if (aV.type == 'structure' && aV.structure.structureType in common.obsticalD) {
                            if (k in tempPositions && tempPositions[k]) {
                                count--;
                            }
                            tempPositions[k] = false;
                        }
                    }
                    let positions = [];
                    for (const posK in tempPositions) {
                        if (tempPositions[posK]) {
                            const v = posK.split('-');
                            positions.push([v[0], v[1]]);
                        }
                    }
                    // check if the count for a source changed
                    if (room.memory.sources[sourceId].maxCreeps && room.memory.sources[sourceId].maxCreeps.maxCount &&
                        count != room.memory.sources[sourceId].maxCreeps.maxCount) {
                        room.memory.sources[sourceId].maxCreeps.positions = positions;
                        room.memory.sources[sourceId].maxCreeps.maxCount = count;
                    } else if (room.memory.sources[sourceId].maxCreeps == null) {
                        room.memory.sources[sourceId].maxCreeps = {positions: positions, maxCount: count, occupied: new Array(count).fill(0)};
                    }
                    
                    // remove dead smartharvester
                    if (room.memory.sources[sourceId].smartCreep != null &&
                        Game.creeps[room.memory.sources[sourceId].smartCreep] == null) {
                        room.memory.sources[sourceId].smartCreep = null;
                    }

                    utilsroom.cleanupSources(roomName, sourceId);
                    const exits = Game.map.describeExits(roomName);
                    for (const k in exits) {
                        if (!(exits[k] in Memory.rooms) || !Memory.rooms[exits[k]].sources)
                            continue; // no sources than skip
                        for (const sId in Memory.rooms[exits[k]].sources)
                            utilsroom.cleanupSources(exits[k], sId);
                    }
                }
                os.newThread(name, f, 1, true);
            }
        }
    }
}
module.exports = utilsroom;