var utils = require('utils');

const normal_creep = [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE]; // for every carry need 1 move for road

const build_creeps = [
    [0, normal_creep, utils.get_creep_cost(normal_creep)]
]

var roleHauler = {
    
    get_harvest_count: function(room) {
        // if there is a master link we want to return 1
        if (room.memory.masterLink != null) {
            return 1;
        }
        return 0;
    },

    find_storage: function(creep) {

    },
    
    /**
     * This method finds the closed spawn/extension, if none are found/full then it will look for a container/storage
     */
    find_closest_structure: function(creep) {
        let objs = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                        filter: (structure) => {
                            return (structure.structureType == STRUCTURE_EXTENSION || structure.structureType == STRUCTURE_SPAWN || 
                                structure.structureType == STRUCTURE_TOWER) &&
                                structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0 && structure.room.name == creep.room.name;
                        }
                    });
        if (!objs) {
            // Let's see if there is a storage we can use
            objs = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                filter: (structure) => {
                    return (structure.structureType == STRUCTURE_CONTAINER && structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0) ||
                    (structure.structureType == STRUCTURE_STORAGE && structure.store.getUsedCapacity(RESOURCE_ENERGY) < 500000) 
                    && structure.room.name == creep.room.name;
                }
            });
        }
        return objs;
    },
    
    run: function(creep) {
        if (creep.spawning) {
            return;
        }
        /*
        Current though process collect energy from master link if we are out of energy.
        Put all energy into any extension or spawn thats available
        if those are full start storing energy in a container or long term storage
        */
        // check if we are out of energy if we are time to switch to collection mode
        if (!creep.memory.collecting && creep.store.getUsedCapacity() == 0) {
            creep.memory.collecting = true;
            utils.cleanup_move_to(creep);
        }

        // if we are collecting energy then collect it
        if (creep.memory.collecting) {
            // we want to get the master link and draw energy from that
            // check if its not null
            if (creep.room.memory.masterLink != null) {
                const link = Game.getObjectById(creep.room.memory.masterLink);
                // try draw energy from the link
                if (link.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
                    const wErr = creep.withdraw(link, RESOURCE_ENERGY);
                    if (wErr == ERR_NOT_IN_RANGE) {
                        // let's move to it if we are not near
                        if (creep.memory.destId == null) {
                            creep.memory.destId = link.id;
                            creep.memory.destLoc = link.pos;
                        }
                        utils.move_to(creep);
                    } else if (wErr == ERR_FULL) {
                        creep.memory.collecting = false;
                        utils.cleanup_move_to(creep);
                    } else if (wErr != 0) {
                        console.log('hauler had an error with withdrawing energy ' + wErr);
                    }
                } else if (creep.store.getUsedCapacity() > 0) { 
                    // so the link didnt have any energy, do we have any that we can dispense
                    creep.memory.collecting = false;
                    utils.cleanup_move_to(creep);
                } else {
                    // link has no energy, we have no energy, lets move to the right of the link and wait there
                    const link = Game.getObjectById(creep.room.memory.masterLink);
                    const pos = link.pos;
                    pos.x += 1
                    const creepDstPos = creep.memory.destLoc;
                    if (creepDstPos == null || !pos.isEqualTo(creepDstPos.x, creepDstPos.y)) {
                        utils.cleanup_move_to(creep);
                        creep.memory.destLoc = pos;
                    }
                    if (!creep.pos.isEqualTo(pos)) {
                        // only move when we are not in the spot
                        creep.moveTo(pos.x, pos.y)
                    }
                    return;
                }
                
            }
            // todo if it is null or empty then we can scan for other energy in the room to pick up
        }

        // if we are not collecting energy then lets start dispensing it
        if (!creep.memory.collecting) {
            if ((creep.memory.destId == null || creep.memory.destLoc == null) || creep.memory.destId == creep.room.memory.masterLink) {
                // do we have a destination, if not lets find one
                // we will go to extensions first, then container and storage but container will normally be deposited first since its closer
                const target = this.find_closest_structure(creep);
                if (target == null) {
                    // no target go sit
                    // it's fine to let the bottom code run even if its already set as its really cheap to run if we are at the location
                    // and destId is already link.id
                    const link = Game.getObjectById(creep.room.memory.masterLink);
                    const pos = link.pos;
                    pos.x += 1
                    const creepDstPos = creep.memory.destLoc;
                    if (creepDstPos == null || !pos.isEqualTo(creepDstPos.x, creepDstPos.y)) {
                        //console.log('hauler test2')
                        utils.cleanup_move_to(creep);
                        creep.memory.destLoc = pos;
                    }
                    if (!creep.pos.isEqualTo(pos)) {
                        // only move when we are not in the spot
                        //console.log('hauler test 3')
                        //todo figure out why moveBypath is having issues with one spot, prob more optomizations need to be made
                        // fuck it this doesnt work sometime
                        creep.moveTo(pos.x, pos.y)
                    }
                    return;
                }
                utils.cleanup_move_to(creep);
                creep.memory.destId = target.id;
                creep.memory.destLoc = target.pos;
            }
            
            // let's try transfer energy
            const dst = Game.getObjectById(creep.memory.destId);
            if (dst == null) {
                utils.move_to(creep);
            } else {
                const tErr = creep.transfer(dst, RESOURCE_ENERGY);
                
                if (tErr == ERR_NOT_IN_RANGE) {
                    utils.move_to(creep);
                } else if (tErr == ERR_FULL) {
                    // we are full we will find a new one next turn
                    utils.cleanup_move_to(creep);
                }
            }
        }
    },
	
	create_creep: function(spawn) {
        var newName = 'Hauler' + Game.time + spawn.name.charAt(spawn.name.length - 1);
        spawn.spawnCreep(build_creeps[spawn.room.memory.upgrade_pos_smart_hauler][1], newName,
            {memory: {role: 'hauler', collecting: true, home_room: spawn.room.name}});
        if (Game.creeps[newName]) {
            return Game.creeps[newName];
        }
    },
    
    upgrade: function(room) {
        const room_id = room.id;
        const energy_available = room.energyCapacityAvailable;
        if (room.memory.upgrade_pos_smart_hauler == null || room.memory.upgrade_pos_smart_hauler == undefined) {
            room.memory.upgrade_pos_smart_hauler = 0;
        }
        if (room.controller.level == 0) {
            return;
        }
        const current_upgrade_cost = build_creeps[room.memory.upgrade_pos_smart_hauler][2];
        if (current_upgrade_cost > energy_available && room.memory.upgrade_pos_scout != 0) {
            // attacked need to downgrade
            room.memory.upgrade_pos_smart_hauler = build_creeps[build_creeps[room.memory.upgrade_pos_smart_hauler][0] - 1][0];
        } else if (energy_available >= current_upgrade_cost && 
            build_creeps[room.memory.upgrade_pos_smart_hauler][0] < build_creeps.length - 1) {
            // lets see if we can upgrade
            const n = build_creeps[room.memory.upgrade_pos_smart_hauler + 1]
            if (energy_available >= n[2]) {
                room.memory.upgrade_pos_smart_hauler = n[0];
            }
        
        }
    }
};

module.exports = roleHauler;