var utils = require('utils');

const normal_creep = [WORK, WORK, WORK, WORK, CARRY, CARRY, MOVE, MOVE];

const build_creeps = [
    [0, normal_creep, utils.get_creep_cost(normal_creep)]
]

var roleSmartHarvester = {
    
    get_harvest_count: function(room) {
        sourceMapping = {}
        for (const sourceId in Memory.rooms[room.name].sources) {
            const s = Memory.rooms[room.name].sources[sourceId];
            if (s.finished) {
                // if we have a container that belongs to this source
                sourceMapping[s.container_x + '-' + s.container_y] = true
            }
        }
        const containers = room.find(FIND_STRUCTURES, {
            filter: (structure) => {
                    return structure.structureType == STRUCTURE_CONTAINER &&
                        sourceMapping[structure.pos.x + '-' + structure.pos.y] == true &&
                        structure.room.name == room.name;
                }
        });
        return containers.length;
    },
    
    run: function(creep) {
        if (!creep.memory.collecting && creep.store.getUsedCapacity() == 0) {
            creep.memory.collecting = true;
            utils.cleanup_move_to(creep);
            // reset destId if the claimed source is not null
            if (creep.memory.claimed_source != null) {
                creep.memory.destId = creep.memory.claimed_source;
            }
        }

        if (creep.memory.collecting) {
            if (!utils.harvest_source(creep, false)) {
                creep.memory.collecting = false;
                utils.cleanup_move_to(creep);
            } else {
                if (creep.memory.claimed_source == null && creep.memory.destId != null) {
                    creep.memory.claimed_source = creep.memory.destId;
                }
            }
        } 
        
        if (!creep.memory.collecting) {
            if (creep.memory.claimed_target == null) {
                // the claimed target is null
                const x = Memory.rooms[creep.room.name].sources[creep.memory.claimed_source].container_x;
                const y = Memory.rooms[creep.room.name].sources[creep.memory.claimed_source].container_y;
                const loc = creep.room.getPostitionAt(x, y);
                const structs = loc.lookFor(LOOK_STRUCTURES);
                let link_id = null;
                for (const i in structs) {
                    const v = structs[i];
                    if (v.structureType == 'link') {
                        link_id = v.id;
                        break;
                    }
                }
                if (link_id == null) {
                    // how the fuck is the link id null, was it destroyed???
                    console.log('smart harvester link somehow missing?????')
                    return;
                }
                creep.memory.claimed_target = link_id;
            }
            const target = Game.getObjectById(creep.memory.claimed_target);
            if (target.cooldown == 0 && target.getCapacity() > 0) {
                // send to the master link
                const masterTarget = Game.getObjectById(creep.room.memory.masterLink);
                target.transferEnergy(masterTarget);
            }
            // transfer to container
            const tErr = creep.transfer(target);
            if (tErr == ERR_NOT_IN_RANGE) {
                creep.moveTo(target, utils.movement_options);
            } else {
                console.log('smart harvester problem with transfer ' + tERr);
            }
        }
    },
	
	create_creep: function(spawn) {
        var newName = 'Smart-Harvester' + Game.time;
        if (spawn.spawnCreep(build_creeps[spawn.room.memory.upgrade_pos_smart_harvester][1], newName,
            {memory: {role: 'smartHarvester', collecting: true, claimed_source: null, home_room: spawn.room.name}}) == 0) {
            // lets go ahead and claim a source
            /*
            const creep = Game.creeps[newName];
            for (const sourceId in Memory.rooms[room.name].sources) {
                const s = Memory.rooms[room.name].sources[sourceId];
                if (s.finished) {
                    // todo find a source that isnt being used by another smart harvester
                }
            }
            */
        }
    },
    
    upgrade: function(room) {
        const room_id = room.id;
        const energy_available = room.energyCapacityAvailable;
        if (room.memory.upgrade_pos_smart_harvester == null || room.memory.upgrade_pos_smart_harvester == undefined) {
            room.memory.upgrade_pos_smart_harvester = 0;
        }
        if (room.controller.level == 0) {
            return;
        }
        const current_upgrade_cost = build_creeps[room.memory.upgrade_pos_smart_harvester][2];
        if (current_upgrade_cost > energy_available) {
            // attacked need to downgrade
            room.memory.upgrade_pos_smart_harvester = build_creeps[build_creeps[room.memory.upgrade_pos_smart_harvester][0] - 1][0];
        } else if (energy_available >= current_upgrade_cost && 
            build_creeps[room.memory.upgrade_pos_smart_harvester][0] < build_creeps.length - 1) {
            // lets see if we can upgrade
            const n = build_creeps[room.memory.upgrade_pos_smart_harvester + 1]
            if (energy_available >= n[2]) {
                room.memory.upgrade_pos_smart_harvester = n[0];
            }
        
        }
    }
    
    
}

module.exports = roleSmartHarvester;