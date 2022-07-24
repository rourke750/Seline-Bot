const pathFinder = require('pathFinder');

var utils = {
    movement_options: {visualizePathStyle: {stroke: '#ffffff'}, reusePath: 10, ignoreCreeps: true},
    movement_collision: {visualizePathStyle: {stroke: '#ffffff'}, reusePath: 10, ignoreCreeps: false},

    get_claimer_count: function() {
        let count = 0;
        for (const k in Memory.flags.reserve) {
            count += 2;
        }
        for (const k in Memory.flags.capture) {
            count += 1;
        }
        for (const k in Memory.flags.captureAuto) {
            count += 1;
        }
        return count;
    },

    deleteRoads: function(roomName) {
        const room = Game.rooms[roomName];
        const roads = room.find(FIND_STRUCTURES, {
            filter: (structure) => {
                return structure.room.name == room.name && structure.structureType == STRUCTURE_ROAD;
            }
        });
        for (const k in roads) {
            roads[k].destroy();
        }
        pathFinder.build_cost_matrix(roomName, true);
    },

    buildLineDirection(x, y, dir, length) {
        positions = []
        for (let xx = 1; xx <= length; xx++) {
            if (dir == 0) { // line going up
                positions.push([x, y-(1 * xx)]);
            } else if (dir == 1) { // top right
                positions.push([x+(1 * xx), y-(1 * xx)]);
            } else if (dir == 2) { // right
                positions.push([x+(1 * xx), y]);
            } else if (dir == 3) {// we going bottom right
                positions.push([x+(1 * xx), y+(1 * xx)]);
            } else if (dir == 4) {// bottom
                positions.push([x, y+(1 * xx)]);
            } else if (dir == 5) {// we going bottom left
                positions.push([x-(1 * xx), y+(1 * xx)]);
            } else if (dir == 6) {// left
                positions.push([x-(1 * xx), y]);
            } else if (dir == 7) {// top left 
                positions.push([x-(1 * xx), y-(1 * xx)]);
            }
        }
        return positions;
    },
    
    recycle_creep: function(creep) {
        // attempt to move the creep to spawner for recycling.
        // if it is not close enough move it closer.
        // todo check the movebypath for ERR_NOT_FOUND || -5 as it might have gotten a new construction job causing it to move
        // and then ran out of work again, if we get an error not found create a new path
        if (creep.memory.destId == null) { 
            const spawn = creep.pos.findClosestByRange(FIND_MY_STRUCTURES, {
                filter: (structure) => {
                    return structure.room.name == creep.room.name && structure.structureType == STRUCTURE_SPAWN;
                }
            });
            creep.memory.destId = spawn.id;
            creep.memory.destLoc = null;
        }
        const spawn = Game.getObjectById(creep.memory.destId);
        if (spawn.recycleCreep(creep) == ERR_NOT_IN_RANGE) {
            utils.move_to(creep)
        }
    },
    
    notZero: function(n) {
        if (!isFinite(n) || n === null) {
            return 1;
        }
        return n;
    },
    
    get_creep_cost: function(body_parts) {
        let cost = _.sum(body_parts.map(function (b) {
               return BODYPART_COST[b];
           }));
       return cost;
    },

    findStorage: function(creep) {
        if (creep.room.memory.spawnMaster == null) {
            return false;
        }
        const v = creep.room.find(FIND_MY_STRUCTURES, {
            filter: { structureType: STRUCTURE_STORAGE }
        });
        if (v.length == 1 && v[0].store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
            creep.memory.destLoc = v[0].pos
            creep.memory.destId = v[0].id;
            return true;
        }
        return false;
        
    },

    findContainer: function(creep) {
        if (creep.room.memory.spawnMaster == null) {
            return false;
        }
        const roomMemory = creep.room.memory;
        const containerPos = creep.room.getPositionAt(roomMemory.spawnMasterX, roomMemory.spawnMasterY + 1);
        const v = creep.room.lookForAt(LOOK_STRUCTURES, containerPos);
        for (const s in v) {
            if (v[s].structureType == STRUCTURE_CONTAINER && v[s].store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
                creep.memory.destLoc = v[s].pos
                creep.memory.destId = v[s].id;
                return true;
            }
        }
        
        return this.findStorage(creep);
    },
    
    find_source: function(creep) {
        // todo first will have them go to random ones, later we can keep track of who is going where and then calculate where to send
        // based on available energy, distance, etc
        // todo ignore sources that are currently being mined based on a number
        const energyRequirement = creep.store.getFreeCapacity();
        const sources = creep.room.find(FIND_SOURCES, {
                        filter: (source) => {
                            // set up code for smart harvester
                            if (creep.memory.role == 'smartHarvester') {
                                return source.room.memory.sources[source.id].smartCreep == null;
                            }
                            return source.energy > 0 && 
                            source.room.memory.sources[source.id].totalEnergyWant + energyRequirement < source.energy &&
                            Object.keys(source.room.memory.sources[source.id].creeps).length < source.room.memory.sources[source.id].maxCreeps.maxCount
                            && source.room.memory.sources[source.id].smartCreep == null;
                        }
                });
        if (sources.length == 0) {
            //todo oof not good
            // todo check if energy tab has anything and if it does grab that room and iterate through
            //console.log('herm')
            const exits = Game.map.describeExits(creep.room.name);
            for (const eK in exits) {
                const currentRoomName = exits[eK];
                if (Memory.flags.energy != null && Memory.flags.energy[currentRoomName] != null && creep.memory.home_room != null && 
                    Memory.rooms[currentRoomName] != null) {
                    //return false
                    // there is a flag set let's go get that energy
                    const otherRoomSources = Memory.rooms[currentRoomName].sources;
                    for (const oK in otherRoomSources) {
                        const oV = otherRoomSources[oK];
                        
                        const aSource = Game.getObjectById(oK) // let's see if we can get the source, if we cant it means we dont have vision
                        let hasEnergy = true;
                        let meetsEnergy = true;
                        if (aSource != null) {
                            // we have the source we can filter better
                            hasEnergy = aSource.energy > 0;
                            meetsEnergy = oV.totalEnergyWant + energyRequirement < aSource.energy;
                        } 
                        
                        if (hasEnergy && meetsEnergy && Object.keys(oV.creeps).length < oV.maxCreeps.maxCount) {
                            // we meet all the criteria lets send them off
                            oV.totalEnergyWant += energyRequirement;

                            // for the destLoc we are actually going to use one of the available spaces
                            const memoryPosition = oV.maxCreeps.positions;
                            const occupiedPosition = oV.maxCreeps.occupied;

                            let indexPosition = -1;
                            for (const mK in memoryPosition) {
                                if (occupiedPosition[mK] == 0) {
                                    indexPosition = mK;
                                    break
                                }
                            }
                            if (indexPosition == -1) {
                                //console.log('wtf index position -1 ' + aSource.id)
                                // let's go now and clear all indexes
                                for (const mK in memoryPosition) {
                                    occupiedPosition[mK] = 0;
                                }
                                continue;
                            }
                            if (oV.creeps[creep.name] == null) {
                                oV.creeps[creep.name] = {};
                            }
                            oV.creeps[creep.name].maxCreepsIndexPosition = indexPosition;
                            creep.memory.maxCreepsIndexPosition = indexPosition;
                            oV.maxCreeps.occupied[indexPosition] = 1;
                            creep.memory.destLoc = {
                                x : memoryPosition[indexPosition][0],
                                y : memoryPosition[indexPosition][1],
                                roomName : currentRoomName
                            };
                            creep.memory.destId = oK;
                            return true;
                        }
                    }
                }
            }
            this.cleanup_move_to(creep)
            return false
        } else {
            const source = sources[Math.floor(Math.random() * sources.length)];
            source.room.memory.sources[source.id].totalEnergyWant += energyRequirement;
            // for the destLoc we are actually going to use one of the available spaces
            const maxCreeps = source.room.memory.sources[source.id].maxCreeps;
            const memoryPosition = maxCreeps.positions;
            const occupiedPosition = maxCreeps.occupied;
            // todo there is a chance for losing position but then it will just result in maybe doubling up, eh fine for now
            let indexPosition = -1;
            for (const mK in memoryPosition) {
                if (occupiedPosition[mK] == 0) {
                    indexPosition = mK;
                    break
                }
            }
            if (indexPosition == -1) {
                console.log('wtf index position -1 ' + source.id)
                // let's go now and clear all indexes
                for (const mK in memoryPosition) {
                    occupiedPosition[mK] = 0;
                }
                return false;
            }
            if (source.room.memory.sources[source.id].creeps[creep.name] == null) {
                source.room.memory.sources[source.id].creeps[creep.name] = {};
            }
            source.room.memory.sources[source.id].creeps[creep.name].maxCreepsIndexPosition = indexPosition;
            creep.memory.maxCreepsIndexPosition = indexPosition;
            source.room.memory.sources[source.id].maxCreeps.occupied[indexPosition] = 1;
            creep.memory.destLoc = new RoomPosition(memoryPosition[indexPosition][0], memoryPosition[indexPosition][1], source.room.name);  //source.pos;
            creep.memory.destId = source.id;

            // if the creep is a smart harvester claim the source
            if (creep.memory.role == 'smartHarvester') {
                source.room.memory.sources[source.id].smartCreep = creep.name;
            }

            return true;
        }
    },
    
    harvest_source: function(creep, findNewOnEmpty=true) {
        if (creep.spawning) {
            return true;
        }
        
        if ((creep.memory.destId == null || creep.memory.destId == undefined) &&
            (creep.memory.destLoc == null || creep.memory.destLoc == undefined)) {
            // lets see if its a type that we want to get from the container
            let found = false;
            const role = creep.memory.role;
            if (role === 'builder' || role === 'upgrader' || role === 'repairer') {
                found = this.findContainer(creep);
            }
            if(!found && !this.find_source(creep)) {
                return true;
            }
        }
        
        let position = creep.memory.destLoc;
        const destId = creep.memory.destId;
        if (position == null) {
            creep.memory.destLoc = null
            creep.memory.destId = null
            return;
        }

        // now check dest loc if we are smart harvesting it
        const tempMemSource = Memory.rooms[position.roomName].sources[destId];
        if (tempMemSource != null && tempMemSource.smartCreep != null && tempMemSource.smartCreep != creep.name) {
            this.cleanup_move_to(creep);
            if(!this.find_source(creep)) {
                return true;
            }
        }
        
        if (destId in Memory.rooms[position.roomName].sources && Memory.rooms[position.roomName].sources[destId].creeps[creep.name] == null) {
            Memory.rooms[position.roomName].sources[destId].creeps[creep.name] = {};
        }

        if (destId in Memory.rooms[position.roomName].sources) {
            Memory.rooms[position.roomName].sources[destId].creeps[creep.name].lastTicked = Game.time;
            Memory.rooms[position.roomName].sources[destId].creeps[creep.name].maxCreepsIndexPosition = creep.memory.maxCreepsIndexPosition;
        }
        
        if (position.roomName != creep.pos.roomName) {
            this.move_to(creep);
            return true;
        }
        
        const source = Game.getObjectById(creep.memory.destId);
        if (source == null) {
            console.log('utils source was null how?');
            return;
        }

        let hErr = null;
        if (source.structureType == STRUCTURE_CONTAINER || source.structureType == STRUCTURE_STORAGE) {
            hErr = creep.withdraw(source, RESOURCE_ENERGY);
        } else {
            hErr = creep.harvest(source);
            if (hErr == OK && (creep.pos.x != creep.memory.destLoc.x || creep.pos.y != creep.memory.destLoc.y)) {
                // we harvested but we are not in the right spot lets keep moving
                this.move_to(creep);
            }
        }
        
        if (hErr == ERR_NOT_ENOUGH_RESOURCES && findNewOnEmpty) {
            this.cleanup_move_to(creep);
            // we need to check again if we want to use a specily refill
            let found = creep.store.getFreeCapacity() != 0;
            if (!found && (role === 'builder' || role === 'upgrader' || role === 'repairer')) {
                found = this.findContainer(creep);
            }

            if (!found && !this.find_source(creep)) {
                // we couldn't find another source and the capacity isn't zero so lets get to work
                return false;
            }
            return true;
        } else if (hErr == ERR_NOT_ENOUGH_RESOURCES && !findNewOnEmpty) { // if we dont want a new source
            return true;
        }

        if (hErr == ERR_NOT_IN_RANGE) {
            this.move_to(creep);
        } else if(creep.store.getFreeCapacity() == 0) {
            return false;
        } else if (hErr == ERR_INVALID_TARGET) {
            console.log('source harvest errro ' + source.pos.x + ' ' + source.pos.y + ' ' + source.pos.roomName)
        } else if (hErr == ERR_NO_BODYPART) {
            //console.log('harvest source error no body parts??? ' + JSON.stringify(creep.body));
        } else if (hErr != 0) {
            console.log('harvest source error ' + hErr + ' ' +creep.name)
        }
        
        return true;
    },
    
    move_to_helper: function(creep) {
        if (creep.memory.destLoc != null) {
            return [creep.memory.destLoc.x, creep.memory.destLoc.y, creep.memory.destLoc.roomName];
        }
        const obj = Game.getObjectById(creep.memory.destId);
        if (obj == null) {
            console.log(creep.name + ' ' + creep.pos + ' ' + creep.memory.destId)
        }
        return [obj.pos.x, obj.pos.y, obj.pos.roomName];
    },
    
    initialize_traverse_rooms: function(creep, dstRoom) {
        // initialize traverse room, ie get path and other logic
        creep.memory.dstRoom = dstRoom
        // find highway traversal
        creep.memory.dstRoomPath = pathFinder.find_highway(creep.pos, dstRoom);
        
        const roomPosArray = {};
        const p = pathFinder.find_path_in_room(creep, 
            creep.memory.dstRoomPath.start.x, 
            creep.memory.dstRoomPath.start.y);

        roomPosArray[creep.room.name] = p;
        roomPosArray[dstRoom] = null;
        
        const mergedPath = {
            ...roomPosArray,
            ...creep.memory.dstRoomPath.paths
        };
        creep.memory.current_path = mergedPath;
        delete creep.memory.dstRoomPath; // it is no longer needed get rid of it
    },
    
    move_to: function(creep, newRoomFunc = null, avoidCreepIfStuck=true) {
        // hanldes destinations even in other rooms
        const v = this.move_to_helper(creep);
        if (creep.memory.current_path == null || creep.memory.current_path == undefined) {
            if (v[2] != creep.pos.roomName) {
                // not same room handle traverse room logic
                this.initialize_traverse_rooms(creep, v[2]);
            } else {
                // we are in the same room lets get a path
                creep.memory.current_path = {};
                const p = pathFinder.find_path_in_room(creep, v[0], v[1]);
                creep.memory.current_path[creep.room.name] = p;
            }
        }
        
        // below code is beginning steps if we are stuck in position, in the future we can try ask the offending creep to move out the way
        if (creep.memory.last_pos != null && creep.pos.isEqualTo(creep.memory.last_pos.x, creep.memory.last_pos.y) 
            && creep.fatigue == 0 && avoidCreepIfStuck) {
            // get the path we are currently traveling
            
            const sePath = creep.memory.current_path[creep.room.name];
            if (sePath != "" && sePath != null) {
                
            if (creep.name == 'Claimer83533332') {
                console.log(JSON.stringify(creep.memory.current_path))
            }
                const oldPath = Room.deserializePath(sePath);
                const finalDest = oldPath[oldPath.length - 1];
                // now we can take the old path get the last element and go there
                const p = pathFinder.find_path_in_room(creep, finalDest.x, finalDest.y, {avoidCreep:true});
                creep.memory.current_path[creep.room.name] = p;
            }
        }
        
        // lets get the destination
        let p = creep.memory.current_path[creep.room.name];
        if (p == null || p == "") {
            // we need to calculate the path, first lets check if we have a function
            if (newRoomFunc != null) {
                // if this value is not null it means we have been provided a function for finding where to go next
                const target = newRoomFunc(creep);
                //todo target can be null if all energy null
                if (target == null) {
                    // todo eventually something better
                    // current for builders if they dont have a target and got energy from another room will cycle till death
                    return
                }
                creep.memory.destId = target.id;
                creep.memory.destLoc = target.pos;
                // if we have a function this should normally be for coming into destination room
                const newP = pathFinder.find_path_in_room(creep, target.pos.x, target.pos.y);
                creep.memory.current_path[creep.pos.roomName] = newP;
            } else if (v[0] != null && v[1] != null && v[2] == creep.room.name) {
                // if we dont have a new roomfunc used for calculating where to go next we will instead use the saved cords for returning
                const newP = pathFinder.find_path_in_room(creep, v[0], v[1]);
                creep.memory.current_path[creep.pos.roomName] = newP;
            } else {
                console.log('utils creep could not find path to destination clearing ' + creep.name)
                utils.cleanup_move_to(creep);
                return;
            }
            p = creep.memory.current_path[creep.pos.roomName];
        }
        
        if (creep.fatigue == 0) {
            const errCode = creep.moveByPath(p);
            creep.memory.last_pos = creep.pos;
            if (errCode == ERR_NOT_FOUND) {
                return;
                //creep.memory.current_path = {};
                if (v[2] != creep.room.name) {
                    if (creep.name.startsWith('Scout')) {
                        console.log('beep8')
                    }
                    this.cleanup_move_to(creep);
                    return;
                }
                p = pathFinder.find_path_in_room(creep, v[0], v[1]);
                creep.memory.current_path[creep.roomName] = p;
            } else if (errCode == ERR_INVALID_ARGS) {
                this.cleanup_move_to(creep);
            }
            else if (errCode != 0) {
                console.log(creep.name + ' error with creep moving ' + errCode + ' ' + creep.pos)
            }
        }
        if (p != null)
            new RoomVisual(creep.room.name).poly(Room.deserializePath(p), {stroke: '#fff', strokeWidth: .15,
                opacity: .2, lineStyle: 'dashed'});
    },
    
    cleanup_move_to: function(creep) {
        creep.memory.last_pos = null;
        creep.memory.current_path = null;
        creep.memory.destId = null;
        creep.memory.destLoc = null;
        creep.memory.dstRoom = null;
        creep.memory.dstRoomPath = null;
    }
}

module.exports = utils;