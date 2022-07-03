var utils = require('utils');

const normal_creep = [WORK, CARRY, MOVE];
const big_creep = [WORK, WORK, WORK, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE];

const build_creeps = [
    [0, normal_creep, utils.get_creep_cost(normal_creep)],
    [1, big_creep, utils.get_creep_cost(big_creep)]
]

var roleRepairer = {
    
    get_harvest_count: function(room) {
        var totalRepairPoints = 0
        const structs = room.find(FIND_STRUCTURES, {
                    filter: (structure) => {
                        if (structure.structureType == STRUCTURE_WALL || structure.structureType == STRUCTURE_RAMPART)
                            return structure.hits < 3000;
                        return structure.hits < structure.hitsMax && structure.room.name == room.name;
                    }
                });
        for (var struct in structs) {
            const s = structs[struct]
            //console.log(s.hitsMax + ' ' + s.hits + ' ' + s.structureType + ' ' + s.pos.x + ' ' + s.pos.y)
            totalRepairPoints += s.hitsMax - s.hits;
        }
        if (totalRepairPoints == 0) {
            return 0;
        }
        const repairAmount = Math.ceil(Math.log10(totalRepairPoints/100));
        //console.log(repairAmount, + ' ' + totalRepairPoints)
        return repairAmount;
    },

    find_repairs: function(creep) {
        return creep.pos.findClosestByRange(FIND_STRUCTURES, {
            filter: (structure) => {
                if (structure.structureType == STRUCTURE_WALL || structure.structureType == STRUCTURE_RAMPART){
                    return structure.hits < 3000;
                }
                return structure.hits < structure.hitsMax && structure.room.name == creep.room.name;
            }
        })
    },

    /** @param {Creep} creep **/
    run: function(creep) {
        if (creep.memory.repairing && creep.store[RESOURCE_ENERGY] == 0) {
            creep.memory.repairing = false;
            utils.cleanup_move_to(creep);
        }
        
        if (!creep.memory.repairing) {
            if (!utils.harvest_source(creep)) {
                console.log('herm')
                creep.memory.repairing = true;
                utils.cleanup_move_to(creep);
            }
        }
        if(creep.memory.repairing) {
            if (creep.room.name != creep.memory.home_room) {
                creep.memory.destLoc = {roomName: creep.memory.home_room};
                utils.move_to(creep, this.find_repairs);
                return;
            }
            if (creep.memory.destId == null) {
                const repairs = this.find_repairs(creep);
                if (repairs != null) {
                    creep.memory.destId = repairs.id;
                } else {
                    // todo meh just suicide
                    //creep.suicide();
                }
            }
            
            if (creep.memory.destId != null) {
                const source = Game.getObjectById(creep.memory.destId);
                if (source == null) {
                    utils.cleanup_move_to(creep);
                }
                else if (source.hits != null) {
                    const buildErr = creep.repair(source);
                    if (buildErr == ERR_NOT_IN_RANGE) {
                        utils.move_to(creep, this.find_repairs);
                    } else if (buildErr == ERR_INVALID_TARGET) {
                        utils.cleanup_move_to(creep);
                    }
                    
                    if (source.hits == source.hitsMax) {
                        utils.cleanup_move_to(creep);
                    }
                }
            } 
	    }
	},
	
	create_creep: function(spawn) {
        var newName = 'Repairer' + Game.time + spawn.name.charAt(spawn.name.length - 1);
        spawn.spawnCreep(build_creeps[spawn.room.memory.upgrade_pos_repairer][1], newName,
            {memory: {role: 'repairer', repairing: false, home_room: spawn.room.name}});
        if (Game.creeps[newName]) {
            return Game.creeps[newName];
        }
    },
    
    upgrade: function(room) {
        const room_id = room.id;
        const energy_available = room.energyCapacityAvailable;
        if (room.memory.upgrade_pos_repairer == null || room.memory.upgrade_pos_repairer == undefined) {
            room.memory.upgrade_pos_repairer = 0;
        }
        if (room.controller.level == 0) {
            return;
        }
        const current_upgrade_cost = build_creeps[room.memory.upgrade_pos_repairer][2];
        if (current_upgrade_cost > energy_available) {
            // attacked need to downgrade
            room.memory.upgrade_pos_repairer = build_creeps[build_creeps[room.memory.upgrade_pos_repairer][0] - 1][0];
        } else if (energy_available >= current_upgrade_cost && 
            build_creeps[room.memory.upgrade_pos_repairer][0] < build_creeps.length - 1) {
            // lets see if we can upgrade
            const n = build_creeps[room.memory.upgrade_pos_repairer + 1]
            if (energy_available >= n[2]) {
                room.memory.upgrade_pos_repairer = n[0];
            }
        
        }
    }
};

module.exports = roleRepairer;