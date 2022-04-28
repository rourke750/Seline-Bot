const pathFinder = require('pathFinder');

let filtered_mapping = {};

var utils = {
    movement_options: {visualizePathStyle: {stroke: '#ffffff'}, reusePath: 10, ignoreCreeps: true},
    movement_collision: {visualizePathStyle: {stroke: '#ffffff'}, reusePath: 10, ignoreCreeps: false},
    
    get_filtered_creeps: function(role) {
        if (!(role in filtered_mapping)) {
            // doesnt exist lets add it
            filtered_mapping[role] = _.filter(Game.creeps, (creep) => creep.memory.role == role);
        }
        return filtered_mapping[role];
    },
    
    clear_filtered_creeps: function() {
        filtered_mapping = {};
        for (const k in Game.creeps) {
            const v = Game.creeps[k];
            const r = v.memory.role;
            if (!(r in filtered_mapping)) {
                filtered_mapping[r] = [];
            }
            filtered_mapping[r].push(v);
        }
    },
    
    recycle_creep: function(creep) {
        // attempt to move the creep to spawner for recycling.
        // if it is not close enough move it closer.
        // todo check the movebypath for ERR_NOT_FOUND || -5 as it might have gotten a new construction job causing it to move
        // and then ran out of work again, if we get an error not found create a new path
    },
    
    initialize_traverse_rooms: function(creep, dstRoom) {
        // initialize traverse room, ie get path and other logic
        creep.memory.dstRoom = dstRoom
        // find highway traversal
        creep.memory.dstRoomPath = pathFinder.find_highway(creep.pos, dstRoom);
        this.traverse_rooms(creep, dstRoom);
    },
    
    traverse_rooms: function(creep, dstRoom) {
        // check if we need to initialize the creep for traveling
        if (creep.memory.dstRoom == null) {
            this.initialize_traverse_rooms(creep, dstRoom)
        }
        
        // let's check if we are in the start room
        if (creep.memory.current_path == null) {
            const roomPosArray = {};
            roomPosArray[creep.room.name] = Room.serializePath(creep.pos.findPathTo(creep.memory.dstRoomPath.start.x, 
                creep.memory.dstRoomPath.start.y, this.movement_options));
            roomPosArray[dstRoom] = null;
            
            const mergedPath = {
                ...roomPosArray,
                ...creep.memory.dstRoomPath.paths
            };
            creep.memory.current_path = mergedPath;
            delete creep.memory.dstRoomPath; // it is no longer needed get rid of it
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
    
    find_source: function(creep) {
        // todo first will have them go to random ones, later we can keep track of who is going where and then calculate where to send
        // based on available energy, distance, etc
        // todo ignore sources that are currently being mined based on a number
        const energyRequirement = creep.store.getFreeCapacity();
        const sources = creep.room.find(FIND_SOURCES, {
                        filter: (source) => {
                            return source.energy > 0 && 
                            source.room.memory.sources[source.id].totalEnergyWant + energyRequirement < source.energy &&
                            Object.keys(source.room.memory.sources[source.id].creeps).length < source.room.memory.sources[source.id].maxCreeps.maxCount;
                        }
                });
        if (sources.length == 0) {
            //todo oof not good
            // todo check if energy tab has anything and if it does grab that room and iterate through
            //console.log('herm')
            const exits = Game.map.describeExits(creep.room.name);
            for (const eK in exits) {
                const currentRoomName = exits[eK];
                if (Memory.flags.energy != null && Memory.flags.energy[currentRoomName] != null && creep.memory.home_room != null) {
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
                            creep.memory.destId = oK;
                            const memoryPosition = oV.maxCreeps.positions.pop();
                            if (oV.creeps[creep.name] == null) {
                                oV.creeps[creep.name] = {};
                            }
                            oV.creeps[creep.name].claimedPos = memoryPosition;
                            creep.memory.destLoc = {
                                x : memoryPosition[0],
                                y : memoryPosition[1],
                                roomName : currentRoomName
                            };
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
            creep.memory.destId = source.id;
            // for the destLoc we are actually going to use one of the available spaces
            const memoryPosition = source.room.memory.sources[source.id].maxCreeps.positions.pop();
            if (source.room.memory.sources[source.id].creeps[creep.name] == null) {
                source.room.memory.sources[source.id].creeps[creep.name] = {};
            }
            source.room.memory.sources[source.id].creeps[creep.name].claimedPos = memoryPosition;
            creep.memory.destLoc = new RoomPosition(memoryPosition[0], memoryPosition[1], source.room.name);  //source.pos;
            return true;
        }
    },
    
    harvest_source: function(creep) {
        if (creep.spawning) {
            return true;
        }
        
        if ((creep.memory.destId == null || creep.memory.destId == undefined) &&
            (creep.memory.destLoc == null || creep.memory.destLoc == undefined)) {
            if(!this.find_source(creep)) {
                return true;
            }
        }
        
        const position = creep.memory.destLoc;
        const destId = creep.memory.destId;
        //if (position == null) {
        //    creep.memory.destLoc = null
        //    creep.memory.destId = null
        //}
        if (Memory.rooms[position.roomName].sources[destId].creeps[creep.name] == null) {
            Memory.rooms[position.roomName].sources[destId].creeps[creep.name] = {};
        }
        
        Memory.rooms[position.roomName].sources[destId].creeps[creep.name].lastTicked = Game.time;
        if (Object.keys(Memory.rooms[position.roomName].sources[destId].creeps).length > 4) {
            console.log(position.roomName + ' ' + destId + ' '  + Object.keys(Memory.rooms[position.roomName].sources[destId].creeps))
        }
        
        if (position.roomName != creep.pos.roomName) {
            this.move_to(creep);
            return true;
        }
        
        const source = Game.getObjectById(creep.memory.destId);
        
        var hErr = creep.harvest(source);
        
        if (hErr == ERR_NOT_ENOUGH_RESOURCES) {
            this.cleanup_move_to(creep);
            if (!(this.find_source(creep)) && creep.store.getFreeCapacity() != 0) {
                // we couldn't find another source and the capacity isn't zero so lets get to work
                return false;
            }
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
            console.log('harvest source error ' + hErr + ' ' +creep.id)
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
    
    move_to: function(creep, newRoomFunc = null) {
        // hanldes destinations even in other rooms
        const v = this.move_to_helper(creep);
        if (creep.memory.current_path == null || creep.memory.current_path == undefined) {
            if (v[2] != creep.pos.roomName) {
                // not same room handle traverse room logic
                this.initialize_traverse_rooms(creep, v[2]);
            } else {
                // we are in the same room lets get a path
                creep.memory.current_path = {};
                creep.memory.current_path[v[2]] = Room.serializePath(creep.pos.findPathTo(v[0], v[1], this.movement_options))
            }
        }
        
        if (creep.memory.last_pos != null && creep.pos.isEqualTo(creep.memory.last_pos.x, creep.memory.last_pos.y) 
            && creep.fatigue == 0) {
            //todo come back and come up with something clever like making this try move out the way and then go back
            // this will be the highest cpu stuff
            
            if (v[2] != creep.pos.roomName) {
                
                // not same room
                
                // todo handle what to do here as we dont want to recalculate 
                
                //this.traverse_rooms(creep, v[2]);
                //this.cleanup_move_to(creep)
                
                // todo come up with logic here if a creep gets stuck on its way to another room
            } else {
                creep.memory.current_path = {};
                creep.memory.current_path[v[2]] = Room.serializePath(creep.pos.findPathTo(v[0], v[1], this.movement_collision));
            }
        }
        
        // lets get the destination
        p = creep.memory.current_path[creep.pos.roomName];
        if (p == null) {
            // we need to calculate the path, first lets check if we have a function
            if (newRoomFunc != null) {
                // if this value is not null it means we have been provided a function for finding where to go next
                const target = newRoomFunc(creep);
                //todo target can be null if all energy null
                if (target == null) {
                    // todo we want additional logic if a new target cannot be picked
                    return
                }
                creep.memory.destId = target.id;
                creep.memory.destLoc = target.pos;
                creep.memory.current_path[creep.pos.roomName] = Room.serializePath(creep.pos.findPathTo(target.pos.x, target.pos.y, this.movement_options));
            } else {
                // if we dont have a new roomfunc used for calculating where to go next we will instead use the saved cords for returning
                creep.memory.current_path[creep.pos.roomName] = Room.serializePath(creep.pos.findPathTo(v[0], v[1], this.movement_options));
            }
            p = creep.memory.current_path[creep.pos.roomName];
        }
        
        if (creep.fatigue == 0) {
            const errCode = creep.moveByPath(p);
            creep.memory.last_pos = creep.pos;
            if (errCode != 0) {
                console.log('error with creep moving ' + errCode)
            }
        }
        
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