var utils = require('utils');

const normal_creep = [WORK, WORK, WORK, WORK, CARRY, MOVE, MOVE];

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
        // check if we have a source claimed
        if (!creep.memory.claimed) {
            // no source claimed
        }
        // first thing we want to do is try claim a source that will only be used by this harvester
    },
	
	create_creep: function(spawn) {
        var newName = 'Smart-Harvester' + Game.time;
        spawn.spawnCreep(build_creeps[spawn.room.memory.upgrade_pos_smart_harvester][1], newName,
            {memory: {role: 'smartHarvester', collecting: false, claimed: false, home_room: spawn.room.name}});
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