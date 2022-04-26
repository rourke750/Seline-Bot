const pathFinder = require('pathFinder');

var utils = {
    movement_options: {visualizePathStyle: {stroke: '#ffffff'}, reusePath: 10, ignoreCreeps: true},
    movement_collision: {visualizePathStyle: {stroke: '#ffffff'}, reusePath: 10, ignoreCreeps: false},
    
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
            
            const mergedPath = {
                ...roomPosArray,
                ...creep.memory.dstRoomPath.paths
            };
            creep.memory.current_path = mergedPath;
            delete creep.memory.dstRoomPath; // it is no longer needed get rid of it
        }
        
        if (creep.room.name == creep.memory.dstRoom) {
            // return true we've made it to the room but we havent moved yet so will need to move
            return true;
        }
        
        // now lets move
        creep.moveByPath(creep.memory.current_path[creep.room.name])
        new RoomVisual(creep.room.name).poly(Room.deserializePath(creep.memory.current_path[creep.room.name]), {stroke: '#fff', strokeWidth: .15,
                opacity: .2, lineStyle: 'dashed'});
        return false;
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
                            Object.keys(source.room.memory.sources[source.id].creeps).length < 4;
                        }
                });
        if (sources.length == 0) {
            //todo oof not good
            // todo check if energy tab has anything and if it does grab that room and iterate through
            console.log('herm')
            this.cleanup_move_to(creep)
            return false
        } else {
            const source = sources[Math.floor(Math.random() * sources.length)];
            source.room.memory.sources[source.id].totalEnergyWant += energyRequirement;
            creep.memory.destId = source.id;
            creep.memory.destLoc = source.pos;
            return true;
        }
    },
    
    harvest_source: function(creep) {
        if ((creep.memory.destId == null || creep.memory.destId == undefined) &&
            (creep.memory.destLoc == null || creep.memory.destLoc == undefined)) {
            if(!this.find_source(creep)) {
                return true;
            }
        }
        
        if (creep.spawning) {
            return true;
        }
        
        const position = creep.memory.destLoc;
        const destId = creep.memory.destId;
        
        //if (source != null && position.roomName != creep.room.name) {
        //    console.log('harvest huh ' + creep.name + ' ' + source.pos.x + ' ' + source.pos.y + ' ' + source.pos.roomName)
        //}
        
        if (creep.memory.current_path == null || creep.memory.current_path == undefined) {
            creep.memory.current_path = Room.serializePath(creep.pos.findPathTo(position.x, position.y, this.movement_options));
        }
        
        if (Memory.rooms[position.roomName].sources[destId].creeps[creep.name] == null) {
            Memory.rooms[position.roomName].sources[destId].creeps[creep.name] = {};
        }
        
        Memory.rooms[position.roomName].sources[destId].creeps[creep.name].lastTicked = Game.time;
        
        if (position.roomName != creep.pos.roomName) {
            this.move_to(creep);
            return true;
        }
        
        const source = Game.getObjectById(creep.memory.destId);
        
        var hErr = creep.harvest(source);
        
        if (hErr == ERR_NOT_ENOUGH_RESOURCES) {
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
        return [obj.pos.x, obj.pos.y, obj.pos.roomName];
    },
    
    move_to: function(creep) {
        // hanldes destinations even in other rooms
        const v = this.move_to_helper(creep);
        if (creep.memory.current_path == null || creep.memory.current_path == undefined) {
            if (v[2] != creep.pos.roomName) {
                // not same room handle traverse room logic
                this.initialize_traverse_rooms(creep, v[2]);
            } else {
                creep.memory.current_path = Room.serializePath(creep.pos.findPathTo(v[0], v[1], this.movement_options))
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
            } else {
                creep.memory.current_path = Room.serializePath(creep.pos.findPathTo(v[0], v[1], this.movement_collision));
            }
        }
        
        // if dstRoom is defined that means we are traversing to another room
        if (creep.memory.dstRoom != undefined) {
            if (this.traverse_rooms(creep, creep.memory.destLoc.roomName)) { // if true then we have made it to the room
                const destLoc = creep.memory.destLoc;
                // we just arrive at the room lets cleanup
                utils.cleanup_move_to(creep);
                creep.memory.destLoc = destLoc;
                // we set current path if traverserooms returns true as it returns true when its made it to the current room
                creep.memory.current_path = Room.serializePath(creep.pos.findPathTo(v[0], v[1], this.movement_collision));
            }
        }
        
        // if this is not defined then we are traverseing the same room
        if (creep.memory.dstRoom == undefined || creep.memory.dstRoom == null) {
            p = creep.memory.current_path;
        
            if (creep.fatigue == 0) {
                creep.moveByPath(creep.memory.current_path)
                creep.memory.last_pos = creep.pos
            }
        
            new RoomVisual(creep.room.name).poly(Room.deserializePath(creep.memory.current_path), {stroke: '#fff', strokeWidth: .15,
                opacity: .2, lineStyle: 'dashed'});
        }
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